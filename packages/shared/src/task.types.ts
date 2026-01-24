import type { DomainEvent } from './domain-event';

// ============================================================================
// Task Domain Types (EM-001: Create Task)
// ============================================================================

/**
 * Possible status values for a task
 * Currently only 'open' - will expand as we model more events
 */
export type TaskStatus = 'open';

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
 */
export interface TaskCreated extends DomainEvent {
  readonly type: 'TaskCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly title: string;
    readonly createdAt: string;
    readonly status: 'open';
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
 * Union type of all task-related events
 * This enables type-safe event handling with discriminated unions
 */
export type TaskEvent = TaskCreated;
