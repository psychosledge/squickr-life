import type { DomainEvent } from './domain-event';

// ============================================================================
// Task Domain Types (EM-001: Create Task)
// ============================================================================

/**
 * Possible status values for a task
 */
export type TaskStatus = 'open' | 'completed';

/**
 * Task filter options
 * Used for filtering the task list in the UI
 */
export type TaskFilter = 'all' | 'open' | 'completed';

/**
 * Task entity - represents the current state of a task
 * This is derived from events, not stored directly
 */
export interface Task {
  /** Unique identifier (UUID v4) */
  readonly id: string;
  
  /** Task title (1-500 characters) */
  readonly title: string;
  
  /** When the task was created (ISO 8601) */
  readonly createdAt: string;
  
  /** Current status of the task */
  readonly status: TaskStatus;
  
  /** When the task was completed (ISO 8601), if applicable */
  readonly completedAt?: string;
  
  /** Fractional index for ordering tasks (e.g., "a0", "a1", "a0V") 
   * Optional for backward compatibility with tasks created before this field was added */
  readonly order?: string;
  
  /** Optional: User who created the task (for future multi-user support) */
  readonly userId?: string;
}

/**
 * TaskCreated Event (EM-001)
 * Emitted when a new task is created
 * 
 * Invariants:
 * - aggregateId must equal payload.id
 * - title must be 1-500 characters (after trim)
 * - status is always 'open' for new tasks
 * - createdAt must not be in the future
 * - order is a fractional index for positioning
 */
export interface TaskCreated extends DomainEvent {
  readonly type: 'TaskCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly title: string;
    readonly createdAt: string;
    readonly status: 'open';
    readonly order?: string; // Optional for backward compatibility
    readonly userId?: string;
  };
}

/**
 * CreateTask Command
 * Represents the user's intent to create a new task
 * 
 * Validation rules:
 * - title: Required, will be trimmed, 1-500 characters
 */
export interface CreateTaskCommand {
  readonly title: string;
  readonly userId?: string;
}

/**
 * TaskCompleted Event
 * Emitted when a task is marked as completed
 * 
 * Invariants:
 * - aggregateId must match an existing task
 * - Task must be in 'open' status
 */
export interface TaskCompleted extends DomainEvent {
  readonly type: 'TaskCompleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly completedAt: string;
  };
}

/**
 * CompleteTask Command
 * Represents the user's intent to complete a task
 */
export interface CompleteTaskCommand {
  readonly taskId: string;
}

/**
 * TaskReopened Event
 * Emitted when a completed task is reopened
 * 
 * Invariants:
 * - aggregateId must match an existing task
 * - Task must be in 'completed' status
 */
export interface TaskReopened extends DomainEvent {
  readonly type: 'TaskReopened';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly reopenedAt: string;
  };
}

/**
 * ReopenTask Command
 * Represents the user's intent to reopen a completed task
 */
export interface ReopenTaskCommand {
  readonly taskId: string;
}

/**
 * TaskDeleted Event
 * Emitted when a task is deleted
 * 
 * Invariants:
 * - aggregateId must match an existing task
 * - Task can be in any status (open or completed)
 */
export interface TaskDeleted extends DomainEvent {
  readonly type: 'TaskDeleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly deletedAt: string;
  };
}

/**
 * DeleteTask Command
 * Represents the user's intent to delete a task
 */
export interface DeleteTaskCommand {
  readonly taskId: string;
}

/**
 * TaskReordered Event
 * Emitted when a task's position in the list is changed
 * 
 * Invariants:
 * - aggregateId must match an existing task
 * - Task can be in any status (open or completed)
 * - order must be a valid fractional index string
 */
export interface TaskReordered extends DomainEvent {
  readonly type: 'TaskReordered';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly order: string;
    readonly reorderedAt: string;
  };
}

/**
 * ReorderTask Command
 * Represents the user's intent to reorder a task
 * 
 * @param taskId - The task to reorder
 * @param previousTaskId - The task that should come before this one (null if moving to start)
 * @param nextTaskId - The task that should come after this one (null if moving to end)
 */
export interface ReorderTaskCommand {
  readonly taskId: string;
  readonly previousTaskId: string | null;
  readonly nextTaskId: string | null;
}

/**
 * TaskTitleChanged Event
 * Emitted when a task's title is updated
 * 
 * Invariants:
 * - aggregateId must match an existing task
 * - Task can be in any status (open or completed)
 * - newTitle must be 1-500 characters (after trim)
 */
export interface TaskTitleChanged extends DomainEvent {
  readonly type: 'TaskTitleChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly newTitle: string;
    readonly changedAt: string;
  };
}

/**
 * UpdateTaskTitle Command
 * Represents the user's intent to update a task's title
 * 
 * Validation rules:
 * - title: Required, will be trimmed, 1-500 characters
 */
export interface UpdateTaskTitleCommand {
  readonly taskId: string;
  readonly title: string;
}

/**
 * Union type of all task-related events
 * This enables type-safe event handling with discriminated unions
 */
export type TaskEvent = TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged;
