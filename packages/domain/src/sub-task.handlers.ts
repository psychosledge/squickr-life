import type { IEventStore } from './event-store';
import type { TaskListProjection } from './task.projections';
import type { EntryListProjection } from './entry.projections';
import type { 
  CreateSubTaskCommand,
  TaskCreated
} from './task.types';
import { generateEventMetadata } from './event-helpers';
import { generateKeyBetween } from 'fractional-indexing';

/**
 * Command Handler for CreateSubTask (Phase 1: Sub-Tasks)
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Validate parent task exists and is not a sub-task (2-level limit)
 * - Sub-task inherits parent's collectionId
 * - Generate unique identifiers
 * - Generate fractional index for task ordering
 * - Create TaskCreated event with parentTaskId (event payload - immutable field name)
 * - Persist events to EventStore
 * 
 * This is the "write side" of CQRS for sub-tasks
 */
export class CreateSubTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    _taskProjection: TaskListProjection, // Not used (kept for signature compatibility)
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle CreateSubTask command
   * 
   * Validation rules:
   * - Title must not be empty after trimming
   * - Title must be 1-500 characters
   * - Parent task must exist
   * - Parent task must not be a sub-task (enforce 2-level limit)
   * 
   * @param command - The CreateSubTask command
   * @returns The ID of the created sub-task
   * @throws Error if validation fails
   */
  async handle(command: CreateSubTaskCommand): Promise<string> {
    // Validate title (same rules as CreateTask)
    const title = command.title.trim();

    if (title.length === 0) {
      throw new Error('Title cannot be empty');
    }

    if (title.length > 500) {
      throw new Error('Title must be between 1 and 500 characters');
    }

    // Validate parent task exists
    const parentTask = await this.entryProjection.getTaskById(command.parentEntryId);
    if (!parentTask) {
      throw new Error(`Parent task ${command.parentEntryId} not found`);
    }

    // Validate parent is not a sub-task (enforce 2-level limit)
    if (parentTask.parentEntryId) {
      throw new Error(
        `Cannot create sub-task under ${command.parentEntryId}: parent is already a sub-task (2-level limit)`
      );
    }

    // Get last entry to generate order after it
    const entries = await this.entryProjection.getEntries();
    const lastEntry = entries[entries.length - 1];
    const order = generateKeyBetween(lastEntry?.order ?? null, null);

    // Generate unique task ID and event metadata
    const taskId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    // Create TaskCreated event with parentTaskId set (this makes it a sub-task)
    // Sub-task inherits parent's collectionId (Option 1 from design doc)
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
        collectionId: parentTask.collectionId, // Inherit parent's collection
        userId: command.userId,
        parentTaskId: command.parentEntryId, // Event payload field name stays for backward compat of stored events
      },
    };

    // Persist event
    await this.eventStore.append(event);

    // Return task ID for reference
    return taskId;
  }
}
