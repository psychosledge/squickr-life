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
  CollectionHistoryEntry,
  TaskCreated,
  TaskCompleted,
  TaskReopened,
  TaskDeleted,
  TaskRestored,
  TaskReordered,
  TaskTitleChanged,
  TaskMigrated,
  TaskAddedToCollection,
  TaskRemovedFromCollection,
  CreateTaskCommand,
  CreateSubTaskCommand,
  CompleteTaskCommand,
  CompleteParentTaskCommand,
  ReopenTaskCommand,
  DeleteTaskCommand,
  DeleteParentTaskCommand,
  RestoreTaskCommand,
  ReorderTaskCommand,
  UpdateTaskTitleCommand,
  MigrateTaskCommand,
  AddTaskToCollectionCommand,
  RemoveTaskFromCollectionCommand,
  MoveTaskToCollectionCommand,
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
  NoteRestored,
  NoteReordered,
  NoteMigrated,
  NoteAddedToCollection,
  NoteRemovedFromCollection,
  CreateNoteCommand,
  UpdateNoteContentCommand,
  DeleteNoteCommand,
  RestoreNoteCommand,
  ReorderNoteCommand,
  MigrateNoteCommand,
  AddNoteToCollectionCommand,
  RemoveNoteFromCollectionCommand,
  MoveNoteToCollectionCommand,
  NoteEvent,
} from './task.types';

// Event domain types
export type {
  Event,
  EventCreated,
  EventContentChanged,
  EventDateChanged,
  EventDeleted,
  EventRestored,
  EventReordered,
  EventMigrated,
  EventAddedToCollection,
  EventRemovedFromCollection,
  CreateEventCommand,
  UpdateEventContentCommand,
  UpdateEventDateCommand,
  DeleteEventCommand,
  RestoreEventCommand,
  ReorderEventCommand,
  MigrateEventCommand,
  AddEventToCollectionCommand,
  RemoveEventFromCollectionCommand,
  MoveEventToCollectionCommand,
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
  CollectionRestored,
  CollectionSettingsUpdated,
  CollectionFavorited,
  CollectionUnfavorited,
  CollectionAccessed,
  CreateCollectionCommand,
  RenameCollectionCommand,
  ReorderCollectionCommand,
  DeleteCollectionCommand,
  RestoreCollectionCommand,
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
export { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler, DeleteTaskHandler, RestoreTaskHandler, ReorderTaskHandler, UpdateTaskTitleHandler, MoveEntryToCollectionHandler, MigrateTaskHandler } from './task.handlers';

// Multi-Collection Command Handlers
export { AddTaskToCollectionHandler, RemoveTaskFromCollectionHandler, MoveTaskToCollectionHandler } from './collection-management.handlers';

// Note Multi-Collection Command Handlers
export { AddNoteToCollectionHandler, RemoveNoteFromCollectionHandler, MoveNoteToCollectionHandler } from './note-collection-management.handlers';

// Event Multi-Collection Command Handlers
export { AddEventToCollectionHandler, RemoveEventFromCollectionHandler, MoveEventToCollectionHandler } from './event-collection-management.handlers';

// Sub-Task Command Handlers (Phase 1: Sub-Tasks)
export { CreateSubTaskHandler } from './sub-task.handlers';

// Phase 3: Parent Migration Cascade Handler
export { MoveParentTaskHandler } from './move-parent-task.handler';

// Phase 4: Completion Cascade Handler
export { CompleteParentTaskHandler } from './complete-parent-task.handler';

// Phase 5: Deletion Cascade Handler - FINAL PHASE!
export { DeleteParentTaskHandler } from './delete-parent-task.handler';

// Bulk Migration Handler (ADR-013 Phase 3)
export { BulkMigrateEntriesHandler } from './bulk-migrate-entries.handler';
export type { BulkMigrateEntriesCommand } from './bulk-migrate-entries.handler';

// Note Command Handlers
export { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler, RestoreNoteHandler, ReorderNoteHandler, MigrateNoteHandler } from './note.handlers';

// Event Command Handlers
export { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler, RestoreEventHandler, ReorderEventHandler, MigrateEventHandler } from './event.handlers';

// Collection Command Handlers
export { 
  CreateCollectionHandler, 
  RenameCollectionHandler, 
  ReorderCollectionHandler, 
  DeleteCollectionHandler, 
  RestoreCollectionHandler,
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
export { EntryEventApplicator } from './entry.event-applicator';
export { CollectionListProjection } from './collection.projections';
export { UserPreferencesProjection } from './user-preferences.projections';

