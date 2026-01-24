import type { IEventStore } from './event-store';
import type { CreateTaskCommand, TaskCreated } from './task.types';

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
