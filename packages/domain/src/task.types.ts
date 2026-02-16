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
 * Collection history entry - tracks when a task was added/removed from a collection
 * Used for ghost rendering (show removed tasks as crossed out)
 */
export interface CollectionHistoryEntry {
  readonly collectionId: string;
  readonly addedAt: string;
  readonly removedAt?: string; // undefined = still in this collection
}

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
  
  /** Optional: Collection this task belongs to (null/undefined = uncategorized) 
   * LEGACY: Kept for backward compatibility with single-collection tasks */
  readonly collectionId?: string;
  
  /** Array of collection IDs this task belongs to (multi-collection support) 
   * Empty array = uncategorized */
  readonly collections: string[];
  
  /** Collection history - track when task was added/removed from collections */
  readonly collectionHistory?: CollectionHistoryEntry[];
  
  /** Optional: User who created the task (for future multi-user support) */
  readonly userId?: string;
  
  /** Optional: ID of entry this task was migrated to (audit trail) */
  readonly migratedTo?: string;
  
  /** Optional: ID of entry this task was migrated from (audit trail) */
  readonly migratedFrom?: string;
  
  /** Optional: Collection ID where this task was migrated to (for "Go to" navigation) */
  readonly migratedToCollectionId?: string;
  
  /** Optional: Collection ID where this task was migrated from (for "Go back" navigation) */
  readonly migratedFromCollectionId?: string;
  
  /** Optional: ID of task this was moved from (for movement tracking, not migration)
   * When a task is MOVED (not migrated) between collections, this is set to self-reference.
   * This distinguishes movement (same task ID) from migration (new task created). */
  readonly movedFrom?: string;
  
  /** Optional: Collection ID where this task was moved from (for "Go back" after movement)
   * Set when task is moved between collections using MoveTaskToCollectionHandler.
   * Distinct from migratedFromCollectionId which is for TaskMigrated events. */
  readonly movedFromCollectionId?: string;
  
  /** Optional: Parent entry ID (if this is a sub-task)
   * NOTE: Use parentEntryId (not parentTaskId) to enable future sub-notes/events */
  readonly parentEntryId?: string;
  
  /** DEPRECATED: Use parentEntryId instead - kept for backward compatibility */
  readonly parentTaskId?: string;
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
 * - title: Required, will be trimmed, 1-500 characters
 */
export interface CreateTaskCommand {
  readonly title: string;
  readonly collectionId?: string;
  readonly userId?: string;
}

/**
 * CreateSubTask Command (Phase 1: Sub-Tasks)
 * Represents the user's intent to create a sub-task under a parent task
 * 
 * Validation rules:
 * - title: Required, will be trimmed, 1-500 characters
 * - parentTaskId: Required, must reference an existing task
 * - Parent task must not be a sub-task itself (max 2 levels)
 */
export interface CreateSubTaskCommand {
  readonly title: string;
  readonly parentTaskId: string; // Required - which task to add sub-task under
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
 * EntryMovedToCollection Event
 * Emitted when an entry (task/note/event) is moved to a different collection
 * 
 * Invariants:
 * - aggregateId must match an existing entry
 * - Entry can be of any type (task, note, or event)
 * - collectionId can be null to move to uncategorized
 */
export interface EntryMovedToCollection extends DomainEvent {
  readonly type: 'EntryMovedToCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly entryId: string;
    readonly collectionId: string | null; // null = move to uncategorized
    readonly movedAt: string;
  };
}

/**
 * MoveEntryToCollection Command
 * Represents the user's intent to move an entry to a different collection
 */
export interface MoveEntryToCollectionCommand {
  readonly entryId: string;
  readonly collectionId: string | null;
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
export type TaskEvent = TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged | EntryMovedToCollection | TaskMigrated | TaskAddedToCollection | TaskRemovedFromCollection;

// ============================================================================
// Note Domain Types (Bullet Journal Notes)
// ============================================================================

/**
 * Note entity - represents a note entry in the bullet journal
 * Notes are informational entries without completion status
 */
export interface Note {
  /** Unique identifier (UUID v4) */
  readonly id: string;
  
  /** Note content (1-5000 characters) */
  readonly content: string;
  
  /** When the note was created (ISO 8601) */
  readonly createdAt: string;
  
  /** Fractional index for ordering entries */
  readonly order?: string;
  
  /** Optional: Collection this note belongs to (null/undefined = uncategorized) */
  readonly collectionId?: string;
  
  /** Optional: User who created the note */
  readonly userId?: string;
  
  /** Optional: ID of entry this note was migrated to (audit trail) */
  readonly migratedTo?: string;
  
  /** Optional: ID of entry this note was migrated from (audit trail) */
  readonly migratedFrom?: string;
  
  /** Optional: Collection ID where this note was migrated to (for "Go to" navigation) */
  readonly migratedToCollectionId?: string;
  
  /** Optional: Collection ID where this note was migrated from (for "Go back" navigation) */
  readonly migratedFromCollectionId?: string;
}

/**
 * NoteCreated Event
 * Emitted when a new note is created
 * 
 * Invariants:
 * - aggregateId must equal payload.id
 * - content must be 1-5000 characters (after trim)
 * - createdAt must not be in the future
 */
export interface NoteCreated extends DomainEvent {
  readonly type: 'NoteCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly content: string;
    readonly createdAt: string;
    readonly order?: string;
    readonly collectionId?: string; // Optional - collection this note belongs to
    readonly userId?: string;
  };
}

/**
 * CreateNote Command
 * Represents the user's intent to create a new note
 * 
 * Validation rules:
 * - content: Required, will be trimmed, 1-5000 characters
 */
export interface CreateNoteCommand {
  readonly content: string;
  readonly collectionId?: string;
  readonly userId?: string;
}

/**
 * NoteContentChanged Event
 * Emitted when a note's content is updated
 */
export interface NoteContentChanged extends DomainEvent {
  readonly type: 'NoteContentChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly noteId: string;
    readonly newContent: string;
    readonly changedAt: string;
  };
}

/**
 * UpdateNoteContent Command
 * Represents the user's intent to update a note's content
 */
export interface UpdateNoteContentCommand {
  readonly noteId: string;
  readonly content: string;
}

/**
 * NoteDeleted Event
 * Emitted when a note is deleted
 */
export interface NoteDeleted extends DomainEvent {
  readonly type: 'NoteDeleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly noteId: string;
    readonly deletedAt: string;
  };
}

/**
 * DeleteNote Command
 * Represents the user's intent to delete a note
 */
export interface DeleteNoteCommand {
  readonly noteId: string;
}

/**
 * ReorderNote Command
 * Represents the user's intent to reorder a note
 */
export interface ReorderNoteCommand {
  readonly noteId: string;
  readonly previousNoteId: string | null;
  readonly nextNoteId: string | null;
}

/**
 * NoteReordered Event
 * Emitted when a note's position is changed
 */
export interface NoteReordered extends DomainEvent {
  readonly type: 'NoteReordered';
  readonly aggregateId: string;
  readonly payload: {
    readonly noteId: string;
    readonly order: string;
    readonly reorderedAt: string;
  };
}

/**
 * NoteMigrated Event
 * Emitted when a note is migrated to a different collection
 * 
 * This is a bullet journal migration pattern:
 * - Original note is preserved with migratedTo pointer
 * - New note is created in target collection with migratedFrom pointer
 * - Audit trail is maintained
 * 
 * Invariants:
 * - aggregateId must match an existing note
 * - Note must not already be migrated (migratedTo must be undefined)
 * - migratedToId must be the ID of the newly created note
 */
export interface NoteMigrated extends DomainEvent {
  readonly type: 'NoteMigrated';
  readonly aggregateId: string;
  readonly payload: {
    readonly originalNoteId: string;
    readonly targetCollectionId: string | null;
    readonly migratedToId: string;
    readonly migratedAt: string;
  };
}

/**
 * MigrateNote Command
 * Represents the user's intent to migrate a note to a different collection
 */
export interface MigrateNoteCommand {
  readonly noteId: string;
  readonly targetCollectionId: string | null;
}

/**
 * Union type of all note-related events
 */
export type NoteEvent = NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered | EntryMovedToCollection | NoteMigrated;

// ============================================================================
// Event Domain Types (Bullet Journal Events)
// ============================================================================

/**
 * Event entity - represents an event entry in the bullet journal
 * Events are things that happen/happened on specific dates
 */
export interface Event {
  /** Unique identifier (UUID v4) */
  readonly id: string;
  
  /** Event content/description (1-5000 characters) */
  readonly content: string;
  
  /** When the event entry was created (ISO 8601) */
  readonly createdAt: string;
  
  /** Optional: When the event actually occurs/occurred (ISO 8601 date) */
  readonly eventDate?: string;
  
  /** Fractional index for ordering entries */
  readonly order?: string;
  
  /** Optional: Collection this event belongs to (null/undefined = uncategorized) */
  readonly collectionId?: string;
  
  /** Optional: User who created the event */
  readonly userId?: string;
  
  /** Optional: ID of entry this event was migrated to (audit trail) */
  readonly migratedTo?: string;
  
  /** Optional: ID of entry this event was migrated from (audit trail) */
  readonly migratedFrom?: string;
  
  /** Optional: Collection ID where this event was migrated to (for "Go to" navigation) */
  readonly migratedToCollectionId?: string;
  
  /** Optional: Collection ID where this event was migrated from (for "Go back" navigation) */
  readonly migratedFromCollectionId?: string;
}

/**
 * EventCreated Event
 * Emitted when a new event entry is created
 * 
 * Invariants:
 * - aggregateId must equal payload.id
 * - content must be 1-5000 characters (after trim)
 * - createdAt must not be in the future
 */
export interface EventCreated extends DomainEvent {
  readonly type: 'EventCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly content: string;
    readonly createdAt: string;
    readonly eventDate?: string;
    readonly order?: string;
    readonly collectionId?: string; // Optional - collection this event belongs to
    readonly userId?: string;
  };
}

/**
 * CreateEvent Command
 * Represents the user's intent to create a new event entry
 * 
 * Validation rules:
 * - content: Required, will be trimmed, 1-5000 characters
 * - eventDate: Optional, must be valid ISO date if provided
 */
export interface CreateEventCommand {
  readonly content: string;
  readonly eventDate?: string;
  readonly collectionId?: string;
  readonly userId?: string;
}

/**
 * EventContentChanged Event
 * Emitted when an event's content is updated
 */
export interface EventContentChanged extends DomainEvent {
  readonly type: 'EventContentChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly newContent: string;
    readonly changedAt: string;
  };
}

/**
 * UpdateEventContent Command
 * Represents the user's intent to update an event's content
 */
export interface UpdateEventContentCommand {
  readonly eventId: string;
  readonly content: string;
}

/**
 * EventDateChanged Event
 * Emitted when an event's date is updated
 */
export interface EventDateChanged extends DomainEvent {
  readonly type: 'EventDateChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly newEventDate: string | null;
    readonly changedAt: string;
  };
}

/**
 * UpdateEventDate Command
 * Represents the user's intent to update an event's date
 */
export interface UpdateEventDateCommand {
  readonly eventId: string;
  readonly eventDate: string | null;
}

/**
 * EventDeleted Event
 * Emitted when an event is deleted
 */
export interface EventDeleted extends DomainEvent {
  readonly type: 'EventDeleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly deletedAt: string;
  };
}

/**
 * DeleteEvent Command
 * Represents the user's intent to delete an event
 */
export interface DeleteEventCommand {
  readonly eventId: string;
}

/**
 * ReorderEvent Command
 * Represents the user's intent to reorder an event
 */
export interface ReorderEventCommand {
  readonly eventId: string;
  readonly previousEventId: string | null;
  readonly nextEventId: string | null;
}

/**
 * EventReordered Event
 * Emitted when an event's position is changed
 */
export interface EventReordered extends DomainEvent {
  readonly type: 'EventReordered';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly order: string;
    readonly reorderedAt: string;
  };
}

/**
 * EventMigrated Event
 * Emitted when an event is migrated to a different collection
 * 
 * This is a bullet journal migration pattern:
 * - Original event is preserved with migratedTo pointer
 * - New event is created in target collection with migratedFrom pointer
 * - Audit trail is maintained
 * 
 * Invariants:
 * - aggregateId must match an existing event
 * - Event must not already be migrated (migratedTo must be undefined)
 * - migratedToId must be the ID of the newly created event
 */
export interface EventMigrated extends DomainEvent {
  readonly type: 'EventMigrated';
  readonly aggregateId: string;
  readonly payload: {
    readonly originalEventId: string;
    readonly targetCollectionId: string | null;
    readonly migratedToId: string;
    readonly migratedAt: string;
  };
}

/**
 * MigrateEvent Command
 * Represents the user's intent to migrate an event to a different collection
 */
export interface MigrateEventCommand {
  readonly eventId: string;
  readonly targetCollectionId: string | null;
}

/**
 * Union type of all event-related events
 */
export type EventEvent = EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered | EntryMovedToCollection | EventMigrated;

// ============================================================================
// Unified Entry Types (for UI)
// ============================================================================

/**
 * Entry type discriminator
 */
export type EntryType = 'task' | 'note' | 'event';

/**
 * Unified entry - discriminated union of Task, Note, and Event
 * Used by projections to create a unified view for the UI
 */
export type Entry = 
  | (Task & { readonly type: 'task' })
  | (Note & { readonly type: 'note' })
  | (Event & { readonly type: 'event' });

/**
 * Entry filter options
 */
export type EntryFilter = 'all' | 'tasks' | 'notes' | 'events' | 'open-tasks' | 'completed-tasks';

/**
 * DailyLog - Groups entries by their creation date
 * Used for the bullet journal daily logs view
 */
export interface DailyLog {
  /** Date in YYYY-MM-DD format */
  readonly date: string;
  
  /** Entries created on this date, sorted by order field */
  readonly entries: Entry[];
}

/**
 * Union of all domain events in the system
 */
export type SquickrDomainEvent = TaskEvent | NoteEvent | EventEvent | import('./collection.types').CollectionEvent;
