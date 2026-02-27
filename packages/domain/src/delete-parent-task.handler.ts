import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { DeleteParentTaskCommand, TaskDeleted } from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * Command Handler for DeleteParentTask (Phase 5: Deletion Cascade - FINAL PHASE!)
 * 
 * Responsibilities:
 * - Validate task exists
 * - Check if task has sub-tasks
 * - If task has children and not confirmed: Throw error with warning message
 * - If task has children and confirmed: Delete all children + parent (cascade delete)
 * - If task has no children: Delete normally
 * - Generate batch of TaskDeleted events
 * - Persist events to EventStore
 * 
 * This implements the deletion cascade pattern:
 * - User cannot orphan sub-tasks by deleting parent
 * - Confirmation dialog ensures intentional action
 * - All sub-tasks deleted before parent is deleted
 * - Unlike completion cascade, deletes ALL children (not filtered by status)
 */
export class DeleteParentTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle DeleteParentTask command
   * 
   * Validation rules:
   * - Task must exist
   * - If task has children and not confirmed, throw error
   * - If confirmed, delete all children + parent
   * 
   * @param command - The DeleteParentTask command
   * @throws Error if validation fails or confirmation required
   */
  async handle(command: DeleteParentTaskCommand): Promise<void> {
    // Validate task exists
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }

    // Get all children (sub-tasks)
    const children = await this.entryProjection.getSubTasks(command.taskId);

    // If there are children and user hasn't confirmed, throw error
    if (children.length > 0 && !command.confirmed) {
      throw new Error(
        `This will delete the parent task AND all ${children.length} sub-task(s). Are you sure?`
      );
    }

    const events: TaskDeleted[] = [];

    // Capture ONE timestamp for the entire batch so that all child deletedAt values
    // are identical to the parent's — this makes the 1-second window check in
    // RestoreTaskHandler reliable (all children will pass the ≤1000 ms test).
    const batchMetadata = generateEventMetadata();

    // Delete all children first (simpler than completion - no filtering by status)
    for (const child of children) {
      const event: TaskDeleted = {
        ...batchMetadata,
        type: 'TaskDeleted',
        aggregateId: child.id,
        payload: {
          taskId: child.id,
          deletedAt: batchMetadata.timestamp,
        },
      };
      events.push(event);
    }

    // Delete parent last (same timestamp as children)
    const parentEvent: TaskDeleted = {
      ...batchMetadata,
      type: 'TaskDeleted',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        deletedAt: batchMetadata.timestamp,
      },
    };
    events.push(parentEvent);

    // Persist all events
    // For now, append sequentially (could be optimized with batch append in future)
    for (const event of events) {
      await this.eventStore.append(event);
    }
  }
}
