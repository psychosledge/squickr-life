import type { DomainEvent } from './domain-event';
import type { BaseEntry, EntryMovedToCollection } from './base-entry.types';

// Re-export shared types so existing `import ... from './task.types'` imports keep working
export type {
  CollectionHistoryEntry,
  BaseEntry,
  EntryType,
  EntryFilter,
  Entry,
  DailyLog,
  EntryMovedToCollection,
  MoveEntryToCollectionCommand,
  ReorderEntryCommand,
  SquickrDomainEvent,
} from './base-entry.types';

// Re-export Note types so existing `import ... from './task.types'` imports keep working
export type {
  Note,
  NoteCreated,
  CreateNoteCommand,
  NoteContentChanged,
  UpdateNoteContentCommand,
  NoteDeleted,
  DeleteNoteCommand,
  NoteRestored,
  RestoreNoteCommand,
  ReorderNoteCommand,
  NoteReordered,
  NoteMigrated,
  MigrateNoteCommand,
  NoteAddedToCollection,
  NoteRemovedFromCollection,
  AddNoteToCollectionCommand,
  RemoveNoteFromCollectionCommand,
  MoveNoteToCollectionCommand,
  NoteEvent,
} from './note.types';

// Re-export Event types so existing `import ... from './task.types'` imports keep working
export type {
  Event,
  EventCreated,
  CreateEventCommand,
  EventContentChanged,
  UpdateEventContentCommand,
  EventDateChanged,
  UpdateEventDateCommand,
  EventDeleted,
  DeleteEventCommand,
  EventRestored,
  RestoreEventCommand,
  ReorderEventCommand,
  EventReordered,
  EventMigrated,
  MigrateEventCommand,
  EventAddedToCollection,
  EventRemovedFromCollection,
  AddEventToCollectionCommand,
  RemoveEventFromCollectionCommand,
  MoveEventToCollectionCommand,
  EventEvent,
} from './event.types';

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
export interface Task extends BaseEntry {
  /** Task content / description (1-500 characters) */
  readonly content: string;

  /** Current status of the task */
  readonly status: TaskStatus;

  /** When the task was completed (ISO 8601), if applicable */
  readonly completedAt?: string;

  /** Optional: ID of task this was moved from (for movement tracking, not migration)
   * When a task is MOVED (not migrated) between collections, this is set to self-reference.
   * This distinguishes movement (same task ID) from migration (new task created). */
  readonly movedFrom?: string;

  /** Optional: Collection ID where this task was moved from (for "Go back" after movement)
   * Set when task is moved between collections using MoveTaskToCollectionHandler.
   * Distinct from migratedFromCollectionId which is for TaskMigrated events. */
  readonly movedFromCollectionId?: string;
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
    readonly content: string;
    readonly title?: string; // backward-compat: old events stored title, not content
    readonly createdAt: string;
    readonly status: 'open';
    readonly order?: string; // Optional for backward compatibility
    readonly collectionId?: string; // Optional - collection this task belongs to
    readonly userId?: string;
    readonly parentTaskId?: string; // Optional - parent task ID if this is a sub-task (Phase 1)
  };
}

/**
 * CreateTask Command
 * Represents the user's intent to create a new task
 *
 * Validation rules:
 * - content: Required, will be trimmed, 1-500 characters
 */
export interface CreateTaskCommand {
  readonly content: string;
  readonly collectionId?: string;
  readonly userId?: string;
}

/**
 * CreateSubTask Command (Phase 1: Sub-Tasks)
 * Represents the user's intent to create a sub-task under a parent task
 *
 * Validation rules:
 * - content: Required, will be trimmed, 1-500 characters
 * - parentEntryId: Required, must reference an existing task
 * - Parent task must not be a sub-task itself (max 2 levels)
 */
export interface CreateSubTaskCommand {
  readonly content: string;
  readonly parentEntryId: string; // Required - which entry to add sub-task under
  readonly collectionId?: string; // Optional - undefined means uncategorized, matching CreateTaskCommand behaviour
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
 * CompleteParentTask Command (Phase 4: Completion Cascade)
 * Represents the user's intent to complete a parent task
 *
 * Behavior:
 * - If all children complete: Complete parent (TaskCompleted event)
 * - If some children incomplete and confirmed=false: Throw error with warning message
 * - If some children incomplete and confirmed=true: Complete all incomplete children + parent
 */
export interface CompleteParentTaskCommand {
  readonly taskId: string;
  readonly confirmed: boolean; // If true, cascade complete all incomplete children
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
  /** If provided and the task is in multiple collections, only remove from this collection */
  readonly currentCollectionId?: string;
}

/**
 * TaskRestored Event
 * Emitted when a soft-deleted task is restored
 */
export interface TaskRestored extends DomainEvent {
  readonly type: 'TaskRestored';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly restoredAt: string;
  };
}

/**
 * RestoreTask Command
 * Represents the user's intent to restore a soft-deleted task
 */
export interface RestoreTaskCommand {
  readonly taskId: string;
}

/**
 * DeleteParentTask Command (Phase 5: Deletion Cascade)
 * Represents the user's intent to delete a parent task and all its sub-tasks
 *
 * Validation rules:
 * - taskId: Required, must reference an existing task
 * - confirmed: If false and task has children, throw error with warning message
 * - confirmed: If true, delete all children + parent (cascade delete)
 *
 * Behavior:
 * - If task has no children: Delete normally (confirmed flag ignored)
 * - If task has children and confirmed=false: Throw error
 * - If task has children and confirmed=true: Delete all children + parent
 */
export interface DeleteParentTaskCommand {
  readonly taskId: string;
  readonly confirmed: boolean; // If true, cascade delete all children
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
 * - newContent must be 1-500 characters (after trim)
 */
export interface TaskTitleChanged extends DomainEvent {
  readonly type: 'TaskTitleChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly newContent: string;
    readonly newTitle?: string; // backward-compat: old events stored newTitle
    readonly changedAt: string;
  };
}

/**
 * UpdateTaskTitle Command
 * Represents the user's intent to update a task's title
 *
 * Validation rules:
 * - content: Required, will be trimmed, 1-500 characters
 */
export interface UpdateTaskTitleCommand {
  readonly taskId: string;
  readonly content: string;
  readonly title?: string; // backward-compat: some callers may still send title
}

/**
 * TaskMigrated Event
 * Emitted when a task is migrated to a different collection
 *
 * This is a bullet journal migration pattern:
 * - Original task is preserved with migratedTo pointer
 * - New task is created in target collection with migratedFrom pointer
 * - Audit trail is maintained
 *
 * Invariants:
 * - aggregateId must match an existing task
 * - Task must not already be migrated (migratedTo must be undefined)
 * - migratedToId must be the ID of the newly created task
 */
export interface TaskMigrated extends DomainEvent {
  readonly type: 'TaskMigrated';
  readonly aggregateId: string;
  readonly payload: {
    readonly originalTaskId: string;
    readonly targetCollectionId: string | null; // null = migrate to uncategorized
    readonly migratedToId: string; // ID of new task created in target
    readonly migratedAt: string;
  };
}

/**
 * MigrateTask Command
 * Represents the user's intent to migrate a task to a different collection
 *
 * This creates a new task in the target collection and marks both tasks
 * with migration pointers for audit trail.
 */
export interface MigrateTaskCommand {
  readonly taskId: string;
  readonly targetCollectionId: string | null;
}

// ============================================================================
// Multi-Collection Events (Phase: Multi-Collection Refactor)
// ============================================================================

/**
 * TaskAddedToCollection Event
 * Emitted when a task is added to an additional collection
 *
 * This enables multi-collection membership where one task can appear in multiple collections.
 *
 * Invariants:
 * - aggregateId must match an existing task
 * - Task must not already be in this collection (idempotent check)
 * - collectionId is required (use empty collections array for uncategorized)
 */
export interface TaskAddedToCollection extends DomainEvent {
  readonly type: 'TaskAddedToCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly collectionId: string;
    readonly addedAt: string;
  };
}

/**
 * TaskRemovedFromCollection Event
 * Emitted when a task is removed from a collection
 *
 * This creates a "ghost" entry - the task appears crossed out in the original collection.
 *
 * Invariants:
 * - aggregateId must match an existing task
 * - Task must be in this collection (idempotent check)
 */
export interface TaskRemovedFromCollection extends DomainEvent {
  readonly type: 'TaskRemovedFromCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly taskId: string;
    readonly collectionId: string;
    readonly removedAt: string;
  };
}

/**
 * AddTaskToCollection Command
 * Represents the user's intent to add a task to an additional collection
 */
export interface AddTaskToCollectionCommand {
  readonly taskId: string;
  readonly collectionId: string;
}

/**
 * RemoveTaskFromCollection Command
 * Represents the user's intent to remove a task from a collection
 */
export interface RemoveTaskFromCollectionCommand {
  readonly taskId: string;
  readonly collectionId: string;
}

/**
 * MoveTaskToCollection Command
 * Represents the user's intent to move a task to a different collection
 * This removes the task from the current collection only and adds it to the target
 *
 * Multi-collection behavior:
 * - If task is in [A, B, C] and you move from B → D
 * - Result: Task is in [A, C, D]
 * - Only the currentCollectionId is removed, other collections are preserved
 *
 * Validation rules:
 * - taskId: Must reference an existing task
 * - currentCollectionId: Required, task must be in this collection
 * - targetCollectionId: Required, must differ from currentCollectionId
 *
 * Idempotent: Moving from A → A is a no-op (no events generated)
 */
export interface MoveTaskToCollectionCommand {
  /** ID of the task to move */
  readonly taskId: string;
  /** Source collection to remove from (task must be in this collection) */
  readonly currentCollectionId: string;
  /** Target collection to add to (must differ from currentCollectionId) */
  readonly targetCollectionId: string;
}

/**
 * Union type of all task-related events
 * This enables type-safe event handling with discriminated unions
 */
export type TaskEvent = TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskRestored | TaskReordered | TaskTitleChanged | EntryMovedToCollection | TaskMigrated | TaskAddedToCollection | TaskRemovedFromCollection;
