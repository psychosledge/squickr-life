/**
 * Barrel file for @squickr/domain package
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
  TaskMigrated,
  CreateTaskCommand,
  CreateSubTaskCommand,
  CompleteTaskCommand,
  ReopenTaskCommand,
  DeleteTaskCommand,
  ReorderTaskCommand,
  UpdateTaskTitleCommand,
  MigrateTaskCommand,
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
  NoteMigrated,
  CreateNoteCommand,
  UpdateNoteContentCommand,
  DeleteNoteCommand,
  ReorderNoteCommand,
  MigrateNoteCommand,
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
  EventMigrated,
  CreateEventCommand,
  UpdateEventContentCommand,
  UpdateEventDateCommand,
  DeleteEventCommand,
  ReorderEventCommand,
  MigrateEventCommand,
  EventEvent,
} from './task.types';

// Collection domain types
export type {
  CollectionType,
  CompletedTaskBehavior,
  Collection,
  CollectionSettings,
  CollectionCreated,
  CollectionRenamed,
  CollectionReordered,
  CollectionDeleted,
  CollectionSettingsUpdated,
  CollectionFavorited,
  CollectionUnfavorited,
  CollectionAccessed,
  CreateCollectionCommand,
  RenameCollectionCommand,
  ReorderCollectionCommand,
  DeleteCollectionCommand,
  UpdateCollectionSettingsCommand,
  FavoriteCollectionCommand,
  UnfavoriteCollectionCommand,
  AccessCollectionCommand,
  CollectionEvent,
} from './collection.types';

// User preferences domain types
export type {
  UserPreferences,
  UserPreferencesUpdated,
  UpdateUserPreferencesCommand,
  UserPreferencesEvent,
} from './user-preferences.types';
export { DEFAULT_USER_PREFERENCES } from './user-preferences.types';

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

// Event Store (interface only - implementations are in @squickr/infrastructure)
export type { IEventStore } from './event-store';

// Task Command Handlers
export { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler, DeleteTaskHandler, ReorderTaskHandler, UpdateTaskTitleHandler, MoveEntryToCollectionHandler, MigrateTaskHandler } from './task.handlers';

// Sub-Task Command Handlers (Phase 1: Sub-Tasks)
export { CreateSubTaskHandler } from './sub-task.handlers';

// Note Command Handlers
export { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler, ReorderNoteHandler, MigrateNoteHandler } from './note.handlers';

// Event Command Handlers
export { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler, ReorderEventHandler, MigrateEventHandler } from './event.handlers';

// Collection Command Handlers
export { 
  CreateCollectionHandler, 
  RenameCollectionHandler, 
  ReorderCollectionHandler, 
  DeleteCollectionHandler, 
  UpdateCollectionSettingsHandler,
  FavoriteCollectionHandler,
  UnfavoriteCollectionHandler,
  AccessCollectionHandler
} from './collection.handlers';

// User Preferences Command Handlers
export { UpdateUserPreferencesHandler } from './user-preferences.handlers';

// Helpers
export { generateEventMetadata } from './event-helpers';
export type { EventMetadata } from './event-helpers';
export { validateTaskExists, validateTaskStatus } from './task-validation';
export { validateContent, isValidISODate, validateOptionalISODate } from './content-validation';
export { getLocalDateKey, isoToLocalDateKey } from './date-utils';
export { validateCollectionName } from './collection-validation';
export { validateCollectionDate } from './collection-date-validation';

// Projections (Read Models)
export { TaskListProjection } from './task.projections';
export { EntryListProjection } from './entry.projections';
export { CollectionListProjection } from './collection.projections';
export { UserPreferencesProjection } from './user-preferences.projections';

