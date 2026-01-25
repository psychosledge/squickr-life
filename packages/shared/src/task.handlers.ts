import type { IEventStore } from './event-store';
import type { TaskListProjection } from './task.projections';
import type { 
  CreateTaskCommand, 
  TaskCreated, 
  CompleteTaskCommand, 
  TaskCompleted,
  ReopenTaskCommand,
  TaskReopened
} from './task.types';

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

    // Generate unique IDs
    const taskId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create TaskCreated event (EM-001)
    const event: TaskCreated = {
      id: eventId,
      type: 'TaskCreated',
      timestamp,
      version: 1,
      aggregateId: taskId,
      payload: {
        id: taskId,
        title,
        createdAt: timestamp,
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
    // Get current task state
    const task = await this.projection.getTaskById(command.taskId);

    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

    if (task.status !== 'open') {
      throw new Error(`Task ${command.taskId} is not open (status: ${task.status})`);
    }

    // Generate event metadata
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create TaskCompleted event
    const event: TaskCompleted = {
      id: eventId,
      type: 'TaskCompleted',
      timestamp,
      version: 1,
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        completedAt: timestamp,
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
    // Get current task state
    const task = await this.projection.getTaskById(command.taskId);

    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

    if (task.status !== 'completed') {
      throw new Error(`Task ${command.taskId} is not completed (status: ${task.status})`);
    }

    // Generate event metadata
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create TaskReopened event
    const event: TaskReopened = {
      id: eventId,
      type: 'TaskReopened',
      timestamp,
      version: 1,
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        reopenedAt: timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}
