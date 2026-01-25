import type { IEventStore } from './event-store';
import type { TaskListProjection } from './task.projections';
import type { 
  CreateTaskCommand, 
  TaskCreated, 
  CompleteTaskCommand, 
  TaskCompleted,
  ReopenTaskCommand,
  TaskReopened,
  DeleteTaskCommand,
  TaskDeleted
} from './task.types';
import { createDomainEvent, generateEventMetadata } from './event-helpers';
import { validateTaskExists, validateTaskStatus } from './task-validation';

/**
 * Command Handler for CreateTask
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Generate unique identifiers
 * - Create domain events
 * - Persist events to EventStore
 * 
 * This is the "write side" of CQRS
 */
export class CreateTaskHandler {
  constructor(private readonly eventStore: IEventStore) {}

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
