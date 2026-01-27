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
  
  /** Optional: User who created the note */
  readonly userId?: string;
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
 * Union type of all note-related events
 */
export type NoteEvent = NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered;

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
  
  /** Optional: User who created the event */
  readonly userId?: string;
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
 * Union type of all event-related events
 */
export type EventEvent = EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered;

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
