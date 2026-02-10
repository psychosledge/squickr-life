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
  EntryMovedToCollection,
  MigrateTaskCommand,
  TaskMigrated
} from './task.types';
import { generateEventMetadata } from './event-helpers';
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
 * - Validate task exists and is in 'open' status (including migrated tasks)
 * - Create TaskCompleted event
 * - Persist event to EventStore
 */
export class CompleteTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle CompleteTask command
   * 
   * Validation rules:
   * - Task must exist (including migrated tasks)
   * - Task must be in 'open' status
   * 
   * @param command - The CompleteTask command
   * @throws Error if validation fails
   */
  async handle(command: CompleteTaskCommand): Promise<void> {
    // Validate task exists and is open (use EntryListProjection to find migrated tasks)
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    if (task.status !== 'open') {
      throw new Error(`Task ${command.taskId} is not open (status: ${task.status})`);
    }

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
 * - Validate task exists and is in 'completed' status (including migrated tasks)
 * - Create TaskReopened event
 * - Persist event to EventStore
 */
export class ReopenTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle ReopenTask command
   * 
   * Validation rules:
   * - Task must exist (including migrated tasks)
   * - Task must be in 'completed' status
   * 
   * @param command - The ReopenTask command
   * @throws Error if validation fails
   */
  async handle(command: ReopenTaskCommand): Promise<void> {
    // Validate task exists and is completed (use EntryListProjection to find migrated tasks)
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    if (task.status !== 'completed') {
      throw new Error(`Task ${command.taskId} is not completed (status: ${task.status})`);
    }

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
 * - Validate task exists (including migrated tasks)
 * - Create TaskDeleted event
 * - Persist event to EventStore
 */
export class DeleteTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle DeleteTask command
   * 
   * Validation rules:
   * - Task must exist (including migrated tasks)
   * - Task can be in any status (open or completed)
   * 
   * @param command - The DeleteTask command
   * @throws Error if validation fails
   */
  async handle(command: DeleteTaskCommand): Promise<void> {
    // Validate task exists (use EntryListProjection to find migrated tasks)
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

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
 * - Validate task exists (including migrated tasks)
 * - Calculate new fractional index based on neighboring entries (of ANY type)
 * - Create TaskReordered event
 * - Persist event to EventStore
 */
export class ReorderTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle ReorderTask command
   * 
   * Validation rules:
   * - Task must exist (including migrated tasks)
   * - Task can be in any status (open or completed)
   * - previousTaskId and nextTaskId can be ANY entry type (task, note, or event)
   * 
   * @param command - The ReorderTask command
   * @throws Error if validation fails
   */
  async handle(command: ReorderTaskCommand): Promise<void> {
    // Validate task exists (use EntryListProjection to find migrated tasks)
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

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
 * - Validate task exists (including migrated tasks)
 * - Validate new title meets requirements
 * - Create TaskTitleChanged event
 * - Persist event to EventStore
 */
export class UpdateTaskTitleHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle UpdateTaskTitle command
   * 
   * Validation rules:
   * - Task must exist (including migrated tasks)
   * - Task can be in any status (open or completed)
   * - Title must not be empty after trimming
   * - Title must be 1-500 characters
   * 
   * @param command - The UpdateTaskTitle command
   * @throws Error if validation fails
   */
  async handle(command: UpdateTaskTitleCommand): Promise<void> {
    // Validate task exists (use EntryListProjection to find migrated tasks)
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

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
   * Phase 3: Parent Migration Cascade
   * - If entry is a parent task with sub-tasks, cascade move to unmigrated children
   * - Unmigrated children (in same collection) follow parent to new collection
   * - Migrated children (in different collection) stay put (preserve symlinks)
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

    // Build list of events to append
    const events: EntryMovedToCollection[] = [];

    // Generate event metadata for parent
    const metadata = generateEventMetadata();

    // Create EntryMovedToCollection event for parent/entry
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
    events.push(event);

    // Phase 3: Cascade migration for parent tasks
    // If this is a task (not note/event), check if it has children
    if (entry.type === 'task') {
      const children = await this.entryProjection.getSubTasks(entry.id);
      
      // Cascade move: ALL children follow parent (children belong to parent, not collection)
      // This includes previously migrated children - they get ANOTHER move event
      for (const child of children) {
        // Child should follow parent to new collection (cascade migrate)
        // Note: If child was previously migrated, this creates another symlink
        const childMetadata = generateEventMetadata();
        const childMoveEvent: EntryMovedToCollection = {
          ...childMetadata,
          type: 'EntryMovedToCollection',
          aggregateId: child.id,
          payload: {
            entryId: child.id,
            collectionId: targetCollectionId, // Same as parent's new collection
            movedAt: childMetadata.timestamp,
          },
        };
        events.push(childMoveEvent);
      }
    }

    // Persist all events (parent + cascaded children) atomically
    // Use appendBatch() to ensure all-or-nothing semantics
    // If cascade migration fails, entire operation is rolled back
    await this.eventStore.appendBatch(events);
  }
}

/**
 * Command Handler for MigrateTask
 * 
 * Responsibilities:
 * - Validate task exists
 * - Validate task has not already been migrated
 * - Create new task in target collection (with migratedFrom pointer)
 * - Create TaskMigrated event (marks original with migratedTo pointer)
 * - Ensure idempotency (return existing migration if same target)
 * 
 * This implements the bullet journal migration pattern:
 * - Original task is preserved in its original collection
 * - New task is created in target collection
 * - Both tasks have migration pointers for audit trail
 */
export class MigrateTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle MigrateTask command with Phase 3 Parent Migration Cascade
   * 
   * Validation rules:
   * - Task must exist
   * - Task must not already be migrated (migratedTo must be undefined)
   * - Idempotent: Return existing migration if already migrated to same target
   * 
   * Phase 3 Cascade Rules:
   * - If task is a parent with sub-tasks, cascade migrate unmigrated children
   * - Unmigrated children (in same collection as parent) → create symlinks in target
   * - Already-migrated children (in different collection) → preserve existing symlinks
   * - Migrated children point to MIGRATED parent (preserve hierarchy in new collection)
   * 
   * @param command - The MigrateTask command
   * @returns The ID of the newly created task in the target collection
   * @throws Error if validation fails
   */
  async handle(command: MigrateTaskCommand): Promise<string> {
    // Validate task exists
    const originalTask = await this.entryProjection.getTaskById(command.taskId);
    if (!originalTask) {
      throw new Error(`Entry ${command.taskId} not found`);
    }

    // Idempotency check: If already migrated, check if to same target
    if (originalTask.migratedTo) {
      // Task has already been migrated
      // Check if the target is the same - if so, return existing migration (idempotent)
      const migratedTask = await this.entryProjection.getTaskById(originalTask.migratedTo);
      if (migratedTask) {
        const migratedCollectionId = migratedTask.collectionId ?? null;
        const targetCollectionId = command.targetCollectionId;
        
        if (migratedCollectionId === targetCollectionId) {
          // Already migrated to the same collection - idempotent, return existing
          return originalTask.migratedTo;
        }
      }
      
      // Migrated to different collection - throw error
      throw new Error('Task has already been migrated');
    }

    // Generate unique ID for new task
    const newTaskId = crypto.randomUUID();
    
    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create TaskMigrated event for parent
    // The projection will handle creating the new task with proper properties
    const event: TaskMigrated = {
      ...metadata,
      type: 'TaskMigrated',
      aggregateId: command.taskId,
      payload: {
        originalTaskId: command.taskId,
        targetCollectionId: command.targetCollectionId,
        migratedToId: newTaskId,
        migratedAt: metadata.timestamp,
      },
    };

    // Build list of events to append (parent + cascaded children)
    const events: TaskMigrated[] = [event];

    // Phase 3: Cascade migration for parent tasks
    // Check if this task has children (is a parent)
    const children = await this.entryProjection.getSubTasks(command.taskId);
    
    if (children.length > 0) {
      // Task is a parent - ALL children follow parent (children belong to parent, not collection)
      // This includes previously migrated children - they get ANOTHER migration event
      for (const child of children) {
        // Child should follow parent to new collection (cascade migrate)
        // Note: If child was previously migrated, this creates another symlink (appears in multiple places)
        const childNewId = crypto.randomUUID();
        const childMetadata = generateEventMetadata();
        
        const childMigrationEvent: TaskMigrated = {
          ...childMetadata,
          type: 'TaskMigrated',
          aggregateId: child.id,
          payload: {
            originalTaskId: child.id,
            targetCollectionId: command.targetCollectionId,
            migratedToId: childNewId,
            migratedAt: childMetadata.timestamp,
          },
        };
        
        events.push(childMigrationEvent);
      }
    }

    // Persist all events (parent + cascaded children) atomically
    // Use appendBatch() to ensure all-or-nothing semantics
    if (events.length > 1) {
      await this.eventStore.appendBatch(events);
    } else {
      await this.eventStore.append(event);
    }
    
    return newTaskId;
  }
}
