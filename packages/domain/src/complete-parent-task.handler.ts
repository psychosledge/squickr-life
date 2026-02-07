import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { CompleteParentTaskCommand, TaskCompleted } from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * Command Handler for CompleteParentTask (Phase 4: Completion Cascade)
 * 
 * Responsibilities:
 * - Validate task exists and is in 'open' status
 * - Check if task has sub-tasks
 * - If all sub-tasks complete: Complete parent only
 * - If some sub-tasks incomplete and not confirmed: Throw error with warning message
 * - If some sub-tasks incomplete and confirmed: Complete all incomplete sub-tasks + parent
 * - Generate batch of TaskCompleted events
 * - Persist events to EventStore
 * 
 * This implements the completion cascade pattern:
 * - User cannot leave orphaned incomplete sub-tasks
 * - Confirmation dialog ensures intentional action
 * - All sub-tasks complete before parent completes
 */
export class CompleteParentTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle CompleteParentTask command
   * 
   * Validation rules:
   * - Task must exist
   * - Task must be in 'open' status
   * - If task has incomplete children and not confirmed, throw error
   * - If confirmed, complete all incomplete children + parent
   * 
   * @param command - The CompleteParentTask command
   * @throws Error if validation fails or confirmation required
   */
  async handle(command: CompleteParentTaskCommand): Promise<void> {
    // Validate task exists and is open
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    if (task.status !== 'open') {
      throw new Error(`Task ${command.taskId} is not open (status: ${task.status})`);
    }

    // Get all children (sub-tasks)
    const children = await this.entryProjection.getSubTasks(command.taskId);
    const incompleteChildren = children.filter(child => child.status !== 'completed');

    // If there are incomplete children and user hasn't confirmed, throw error
    if (incompleteChildren.length > 0 && !command.confirmed) {
      throw new Error(
        `This will complete the parent task AND all ${incompleteChildren.length} sub-task(s). Are you sure?`
      );
    }

    const events: TaskCompleted[] = [];

    // Complete all incomplete children (if any)
    for (const child of incompleteChildren) {
      const metadata = generateEventMetadata();
      const event: TaskCompleted = {
        ...metadata,
        type: 'TaskCompleted',
        aggregateId: child.id,
        payload: {
          taskId: child.id,
          completedAt: metadata.timestamp,
        },
      };
      events.push(event);
    }

    // Complete parent
    const parentMetadata = generateEventMetadata();
    const parentEvent: TaskCompleted = {
      ...parentMetadata,
      type: 'TaskCompleted',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        completedAt: parentMetadata.timestamp,
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
