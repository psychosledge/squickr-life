import type { IEventStore } from './event-store';
import type { Task, TaskCreated, TaskCompleted, TaskReopened, TaskDeleted, TaskReordered, TaskTitleChanged, TaskEvent, TaskFilter } from './task.types';

/**
 * TaskListProjection - Read Model for Task List
 * 
 * This is the "read side" of CQRS.
 * Projections rebuild state by replaying events from the EventStore.
 * 
 * Key principles:
 * - State is derived from events (not stored separately in this simple version)
 * - Can be rebuilt at any time by replaying all events
 * - Optimized for queries (getTasks, getTaskById)
 * - Separate from write side (command handlers)
 * 
 * Future optimization: Cache the projection state instead of rebuilding on every query
 */
export class TaskListProjection {
  constructor(private readonly eventStore: IEventStore) {}

  /**
   * Get all tasks
   * Rebuilds state by replaying all events
   * 
   * @param filter - Optional filter for task status ('all', 'open', 'completed')
   * @returns Array of tasks in chronological order
   */
  async getTasks(filter: TaskFilter = 'all'): Promise<Task[]> {
    const events = await this.eventStore.getAll();
    const tasks = this.applyEvents(events);
    
    // Apply filter
    if (filter === 'all') {
      return tasks;
    }
    
    return tasks.filter(task => task.status === filter);
  }

  /**
   * Get a specific task by ID
   * 
   * @param taskId - The task ID to find
   * @returns The task, or undefined if not found
   */
  async getTaskById(taskId: string): Promise<Task | undefined> {
    const events = await this.eventStore.getById(taskId);
    const tasks = this.applyEvents(events);
    return tasks[0]; // Should only be one task per aggregate
  }

  /**
   * Rebuild the projection from scratch
   * This is useful for:
   * - Initial load
   * - Recovering from errors
   * - Time travel / debugging
   * 
   * In this simple version, we rebuild on every query.
   * Future optimization: maintain in-memory cache and rebuild only when needed
   */
  async rebuild(): Promise<void> {
    // In this simple version, rebuild happens on every query
    // This method exists for future caching implementations
    await this.getTasks();
  }

  /**
   * Apply events to build task state
   * This is the core projection logic
   * 
   * @param events - Domain events to apply
   * @returns Current task state
   */
  private applyEvents(events: readonly import('./domain-event').DomainEvent[]): Task[] {
    const tasks: Map<string, Task> = new Map();

    for (const event of events) {
      // Type guard - only process TaskEvents
      if (this.isTaskEvent(event)) {
        switch (event.type) {
          case 'TaskCreated':
            this.applyTaskCreated(tasks, event);
            break;
          case 'TaskCompleted':
            this.applyTaskCompleted(tasks, event);
            break;
          case 'TaskReopened':
            this.applyTaskReopened(tasks, event);
            break;
          case 'TaskDeleted':
            this.applyTaskDeleted(tasks, event);
            break;
          case 'TaskReordered':
            this.applyTaskReordered(tasks, event);
            break;
          case 'TaskTitleChanged':
            this.applyTaskTitleChanged(tasks, event);
            break;
        }
      }
    }

    // Return tasks sorted by order (fractional index)
    // Use simple string comparison (not localeCompare) as fractional-indexing
    // uses character code ordering
    // Handle legacy tasks without order field by falling back to createdAt
    return Array.from(tasks.values()).sort((a, b) => {
      // If both have order, use order
      if (a.order && b.order) {
        return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
      }
      // If only a has order, a comes first
      if (a.order && !b.order) {
        return -1;
      }
      // If only b has order, b comes first
      if (!a.order && b.order) {
        return 1;
      }
      // If neither has order, fall back to createdAt (legacy behavior)
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  /**
   * Apply TaskCreated event
   * Creates a new task in the projection
   */
  private applyTaskCreated(tasks: Map<string, Task>, event: TaskCreated): void {
    const task: Task = {
      id: event.payload.id,
      title: event.payload.title,
      createdAt: event.payload.createdAt,
      status: event.payload.status,
      order: event.payload.order, // May be undefined for legacy events
      userId: event.payload.userId,
    };

    tasks.set(task.id, task);
  }

  /**
   * Apply TaskCompleted event
   * Marks a task as completed
   */
  private applyTaskCompleted(tasks: Map<string, Task>, event: TaskCompleted): void {
    const task = tasks.get(event.payload.taskId);
    if (!task) {
      // This shouldn't happen if events are valid, but handle gracefully
      console.warn(`TaskCompleted event for non-existent task: ${event.payload.taskId}`);
      return;
    }

    tasks.set(task.id, {
      ...task,
      status: 'completed',
      completedAt: event.payload.completedAt,
    });
  }

  /**
   * Apply TaskReopened event
   * Reopens a completed task
   */
  private applyTaskReopened(tasks: Map<string, Task>, event: TaskReopened): void {
    const task = tasks.get(event.payload.taskId);
    if (!task) {
      // This shouldn't happen if events are valid, but handle gracefully
      console.warn(`TaskReopened event for non-existent task: ${event.payload.taskId}`);
      return;
    }

    tasks.set(task.id, {
      ...task,
      status: 'open',
      completedAt: undefined,
    });
  }

  /**
   * Apply TaskDeleted event
   * Removes a task from the projection
   */
  private applyTaskDeleted(tasks: Map<string, Task>, event: TaskDeleted): void {
    const task = tasks.get(event.payload.taskId);
    if (!task) {
      // This shouldn't happen if events are valid, but handle gracefully
      console.warn(`TaskDeleted event for non-existent task: ${event.payload.taskId}`);
      return;
    }

    // Remove the task from the map (hard delete from view)
    tasks.delete(event.payload.taskId);
  }

  /**
   * Apply TaskReordered event
   * Updates a task's order in the projection
   */
  private applyTaskReordered(tasks: Map<string, Task>, event: TaskReordered): void {
    const task = tasks.get(event.payload.taskId);
    if (!task) {
      // This shouldn't happen if events are valid, but handle gracefully
      console.warn(`TaskReordered event for non-existent task: ${event.payload.taskId}`);
      return;
    }

    // Update the task's order
    tasks.set(task.id, {
      ...task,
      order: event.payload.order,
    });
  }

  /**
   * Apply TaskTitleChanged event
   * Updates a task's title in the projection
   */
  private applyTaskTitleChanged(tasks: Map<string, Task>, event: TaskTitleChanged): void {
    const task = tasks.get(event.payload.taskId);
    if (!task) {
      // This shouldn't happen if events are valid, but handle gracefully
      console.warn(`TaskTitleChanged event for non-existent task: ${event.payload.taskId}`);
      return;
    }

    // Update the task's title
    tasks.set(task.id, {
      ...task,
      title: event.payload.newTitle,
    });
  }

  /**
   * Type guard for TaskEvent
   */
  private isTaskEvent(event: import('./domain-event').DomainEvent): event is TaskEvent {
    return event.type === 'TaskCreated' || event.type === 'TaskCompleted' || event.type === 'TaskReopened' || event.type === 'TaskDeleted' || event.type === 'TaskReordered' || event.type === 'TaskTitleChanged';
  }
}
