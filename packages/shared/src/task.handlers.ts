import type { IEventStore } from './event-store';
import type { TaskListProjection } from './task.projections';
import type { EntryListProjection } from './entry.projections';
import type { 
  CreateTaskCommand, 
  TaskCreated, 
  CompleteTaskCommand, 
  TaskCompleted,
  ReopenTaskCommand,
  TaskReopened,
  DeleteTaskCommand,
  TaskDeleted,
  ReorderTaskCommand,
  TaskReordered,
  UpdateTaskTitleCommand,
  TaskTitleChanged,
  MoveEntryToCollectionCommand,
  EntryMovedToCollection
} from './task.types';
import { generateEventMetadata } from './event-helpers';
import { validateTaskExists, validateTaskStatus } from './task-validation';
import { generateKeyBetween } from 'fractional-indexing';

/**
 * Command Handler for CreateTask
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Generate unique identifiers
 * - Generate fractional index for task ordering
 * - Create domain events
 * - Persist events to EventStore
 * 
 * This is the "write side" of CQRS
 */
export class CreateTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    _taskProjection: TaskListProjection, // Not used in CreateTaskHandler (kept for signature compatibility)
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle CreateTask command
   * 
   * Validation rules (from EM-001):
   * - Title must not be empty after trimming
   * - Title must be 1-500 characters
   * 
   * @param command - The CreateTask command
   * @returns The ID of the created task
   * @throws Error if validation fails
   */
  async handle(command: CreateTaskCommand): Promise<string> {
    // Validate title
    const title = command.title.trim();

    if (title.length === 0) {
      throw new Error('Title cannot be empty');
    }

    if (title.length > 500) {
      throw new Error('Title must be between 1 and 500 characters');
    }

    // Get last entry (of any type) to generate order after it
    const entries = await this.entryProjection.getEntries();
    const lastEntry = entries[entries.length - 1];
    const order = generateKeyBetween(lastEntry?.order ?? null, null);

    // Generate unique task ID and event metadata
    const taskId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    // Create TaskCreated event (EM-001)
    const event: TaskCreated = {
      ...metadata,
      type: 'TaskCreated',
      aggregateId: taskId,
      payload: {
        id: taskId,
        title,
        createdAt: metadata.timestamp,
        status: 'open',
        order,
        collectionId: command.collectionId,
        userId: command.userId,
      },
    };

    // Persist event
    await this.eventStore.append(event);

    // Return task ID for reference
    return taskId;
  }
}

/**
 * Command Handler for CompleteTask
 * 
 * Responsibilities:
 * - Validate task exists and is in 'open' status
 * - Create TaskCompleted event
 * - Persist event to EventStore
 */
export class CompleteTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: TaskListProjection
  ) {}

  /**
   * Handle CompleteTask command
   * 
   * Validation rules:
   * - Task must exist
   * - Task must be in 'open' status
   * 
   * @param command - The CompleteTask command
   * @throws Error if validation fails
   */
  async handle(command: CompleteTaskCommand): Promise<void> {
    // Validate task exists and is open
    await validateTaskStatus(this.projection, command.taskId, 'open');

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskCompleted event
    const event: TaskCompleted = {
      ...metadata,
      type: 'TaskCompleted',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        completedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ReopenTask
 * 
 * Responsibilities:
 * - Validate task exists and is in 'completed' status
 * - Create TaskReopened event
 * - Persist event to EventStore
 */
export class ReopenTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: TaskListProjection
  ) {}

  /**
   * Handle ReopenTask command
   * 
   * Validation rules:
   * - Task must exist
   * - Task must be in 'completed' status
   * 
   * @param command - The ReopenTask command
   * @throws Error if validation fails
   */
  async handle(command: ReopenTaskCommand): Promise<void> {
    // Validate task exists and is completed
    await validateTaskStatus(this.projection, command.taskId, 'completed');

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskReopened event
    const event: TaskReopened = {
      ...metadata,
      type: 'TaskReopened',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        reopenedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for DeleteTask
 * 
 * Responsibilities:
 * - Validate task exists
 * - Create TaskDeleted event
 * - Persist event to EventStore
 */
export class DeleteTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: TaskListProjection
  ) {}

  /**
   * Handle DeleteTask command
   * 
   * Validation rules:
   * - Task must exist
   * - Task can be in any status (open or completed)
   * 
   * @param command - The DeleteTask command
   * @throws Error if validation fails
   */
  async handle(command: DeleteTaskCommand): Promise<void> {
    // Validate task exists
    await validateTaskExists(this.projection, command.taskId);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskDeleted event
    const event: TaskDeleted = {
      ...metadata,
      type: 'TaskDeleted',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        deletedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ReorderTask
 * 
 * Responsibilities:
 * - Validate task exists
 * - Calculate new fractional index based on neighboring entries (of ANY type)
 * - Create TaskReordered event
 * - Persist event to EventStore
 */
export class ReorderTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly taskProjection: TaskListProjection,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle ReorderTask command
   * 
   * Validation rules:
   * - Task must exist
   * - Task can be in any status (open or completed)
   * - previousTaskId and nextTaskId can be ANY entry type (task, note, or event)
   * 
   * @param command - The ReorderTask command
   * @throws Error if validation fails
   */
  async handle(command: ReorderTaskCommand): Promise<void> {
    // Validate task exists
    await validateTaskExists(this.taskProjection, command.taskId);

    // Get the neighboring ENTRIES (not just tasks) to calculate new order
    // This allows tasks to be reordered relative to notes and events
    let previousOrder: string | null = null;
    let nextOrder: string | null = null;

    if (command.previousTaskId) {
      const previousEntry = await this.entryProjection.getEntryById(command.previousTaskId);
      if (!previousEntry) {
        throw new Error(`Previous entry ${command.previousTaskId} not found`);
      }
      previousOrder = previousEntry.order || null;
    }

    if (command.nextTaskId) {
      const nextEntry = await this.entryProjection.getEntryById(command.nextTaskId);
      if (!nextEntry) {
        throw new Error(`Next entry ${command.nextTaskId} not found`);
      }
      nextOrder = nextEntry.order || null;
    }

    // Generate new fractional index between the neighboring entries
    const order = generateKeyBetween(previousOrder, nextOrder);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskReordered event
    const event: TaskReordered = {
      ...metadata,
      type: 'TaskReordered',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        order,
        reorderedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for UpdateTaskTitle
 * 
 * Responsibilities:
 * - Validate task exists
 * - Validate new title meets requirements
 * - Create TaskTitleChanged event
 * - Persist event to EventStore
 */
export class UpdateTaskTitleHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: TaskListProjection
  ) {}

  /**
   * Handle UpdateTaskTitle command
   * 
   * Validation rules:
   * - Task must exist
   * - Task can be in any status (open or completed)
   * - Title must not be empty after trimming
   * - Title must be 1-500 characters
   * 
   * @param command - The UpdateTaskTitle command
   * @throws Error if validation fails
   */
  async handle(command: UpdateTaskTitleCommand): Promise<void> {
    // Validate task exists
    await validateTaskExists(this.projection, command.taskId);

    // Validate title (same rules as CreateTask)
    const title = command.title.trim();

    if (title.length === 0) {
      throw new Error('Title cannot be empty');
    }

    if (title.length > 500) {
      throw new Error('Title must be between 1 and 500 characters');
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskTitleChanged event
    const event: TaskTitleChanged = {
      ...metadata,
      type: 'TaskTitleChanged',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        newTitle: title,
        changedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for MoveEntryToCollection
 * 
 * Responsibilities:
 * - Validate entry exists (can be task, note, or event)
 * - Check if entry is already in target collection (idempotency)
 * - Create EntryMovedToCollection event
 * - Persist event to EventStore
 */
export class MoveEntryToCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle MoveEntryToCollection command
   * 
   * Validation rules:
   * - Entry must exist (can be task, note, or event)
   * - Idempotent: No event if entry is already in target collection
   * - collectionId can be null to move to uncategorized
   * 
   * @param command - The MoveEntryToCollection command
   * @throws Error if validation fails
   */
  async handle(command: MoveEntryToCollectionCommand): Promise<void> {
    // Validate entry exists (polymorphic - works for tasks, notes, and events)
    const entry = await this.entryProjection.getEntryById(command.entryId);
    if (!entry) {
      throw new Error(`Entry ${command.entryId} not found`);
    }

    // Idempotency check: Don't create event if already in target collection
    // Compare with undefined/null handling: both undefined and null mean uncategorized
    const currentCollectionId = entry.collectionId ?? null;
    const targetCollectionId = command.collectionId;
    
    if (currentCollectionId === targetCollectionId) {
      // Already in target collection - no event needed (idempotent)
      return;
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EntryMovedToCollection event
    const event: EntryMovedToCollection = {
      ...metadata,
      type: 'EntryMovedToCollection',
      aggregateId: command.entryId,
      payload: {
        entryId: command.entryId,
        collectionId: command.collectionId,
        movedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}
