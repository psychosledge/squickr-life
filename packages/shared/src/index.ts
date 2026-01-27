/**
 * Barrel file for @squickr/shared package
 * Re-exports all types for clean imports in other packages
 */

// Base domain event
export type { DomainEvent } from './domain-event';

// Task domain types
export type {
  TaskStatus,
  TaskFilter,
  Task,
  TaskCreated,
  TaskCompleted,
  TaskReopened,
  TaskDeleted,
  TaskReordered,
  TaskTitleChanged,
  CreateTaskCommand,
  CompleteTaskCommand,
  ReopenTaskCommand,
  DeleteTaskCommand,
  ReorderTaskCommand,
  UpdateTaskTitleCommand,
  TaskEvent,
  EntryMovedToCollection,
  MoveEntryToCollectionCommand,
} from './task.types';

// Note domain types
export type {
  Note,
  NoteCreated,
  NoteContentChanged,
  NoteDeleted,
  NoteReordered,
  CreateNoteCommand,
  UpdateNoteContentCommand,
  DeleteNoteCommand,
  ReorderNoteCommand,
  NoteEvent,
} from './task.types';

// Event domain types
export type {
  Event,
  EventCreated,
  EventContentChanged,
  EventDateChanged,
  EventDeleted,
  EventReordered,
  CreateEventCommand,
  UpdateEventContentCommand,
  UpdateEventDateCommand,
  DeleteEventCommand,
  ReorderEventCommand,
  EventEvent,
} from './task.types';

// Collection domain types
export type {
  CollectionType,
  Collection,
  CollectionCreated,
  CollectionRenamed,
  CollectionReordered,
  CollectionDeleted,
  CreateCollectionCommand,
  RenameCollectionCommand,
  ReorderCollectionCommand,
  DeleteCollectionCommand,
  CollectionEvent,
} from './collection.types';

// Unified entry types
export type {
  EntryType,
  Entry,
  EntryFilter,
  DailyLog,
  SquickrDomainEvent,
} from './task.types';

// Union type of all domain events in Squickr Life (deprecated, use SquickrDomainEvent)
export type { TaskEvent as SquickrEvent } from './task.types';

// Event Store
export { EventStore, type IEventStore } from './event-store';
export { IndexedDBEventStore } from './indexeddb-event-store';

// Task Command Handlers
export { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler, DeleteTaskHandler, ReorderTaskHandler, UpdateTaskTitleHandler, MoveEntryToCollectionHandler } from './task.handlers';

// Note Command Handlers
export { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler, ReorderNoteHandler } from './note.handlers';

// Event Command Handlers
export { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler, ReorderEventHandler } from './event.handlers';

// Collection Command Handlers
export { CreateCollectionHandler, RenameCollectionHandler, ReorderCollectionHandler, DeleteCollectionHandler } from './collection.handlers';

// Helpers
export { generateEventMetadata } from './event-helpers';
export type { EventMetadata } from './event-helpers';
export { validateTaskExists, validateTaskStatus } from './task-validation';
export { validateContent, isValidISODate, validateOptionalISODate } from './content-validation';
export { getLocalDateKey, isoToLocalDateKey } from './date-utils';
export { validateCollectionName } from './collection-validation';

// Projections (Read Models)
export { TaskListProjection } from './task.projections';
export { EntryListProjection } from './entry.projections';
export { CollectionListProjection } from './collection.projections';
