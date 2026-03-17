import type { DomainEvent } from './domain-event';
import type { BaseEntry, EntryMovedToCollection } from './base-entry.types';

// ============================================================================
// Note Domain Types (Bullet Journal Notes)
// ============================================================================

/**
 * Note entity - represents a note entry in the bullet journal
 * Notes are informational entries without completion status
 */
export interface Note extends BaseEntry {
  /** Note content (1-5000 characters) */
  readonly content: string;
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
  /** If provided and the note is in multiple collections, only remove from this collection */
  readonly currentCollectionId?: string;
}

/**
 * NoteRestored Event
 * Emitted when a soft-deleted note is restored
 */
export interface NoteRestored extends DomainEvent {
  readonly type: 'NoteRestored';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly restoredAt: string;
  };
}

/**
 * RestoreNote Command
 * Represents the user's intent to restore a soft-deleted note
 */
export interface RestoreNoteCommand {
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

// ============================================================================
// Note Multi-Collection Events
// ============================================================================

/**
 * NoteAddedToCollection Event
 * Emitted when a note is added to an additional collection
 *
 * Invariants:
 * - aggregateId must match an existing note
 * - Note must not already be in this collection (idempotent check)
 */
export interface NoteAddedToCollection extends DomainEvent {
  readonly type: 'NoteAddedToCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly noteId: string;
    readonly collectionId: string;
    readonly addedAt: string;
  };
}

/**
 * NoteRemovedFromCollection Event
 * Emitted when a note is removed from a collection
 *
 * Invariants:
 * - aggregateId must match an existing note
 * - Note must be in this collection (idempotent check)
 */
export interface NoteRemovedFromCollection extends DomainEvent {
  readonly type: 'NoteRemovedFromCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly noteId: string;
    readonly collectionId: string;
    readonly removedAt: string;
  };
}

/**
 * AddNoteToCollection Command
 */
export interface AddNoteToCollectionCommand {
  readonly noteId: string;
  readonly collectionId: string;
}

/**
 * RemoveNoteFromCollection Command
 */
export interface RemoveNoteFromCollectionCommand {
  readonly noteId: string;
  readonly collectionId: string;
}

/**
 * MoveNoteToCollection Command
 */
export interface MoveNoteToCollectionCommand {
  readonly noteId: string;
  readonly currentCollectionId: string;
  readonly targetCollectionId: string;
}

/**
 * Union type of all note-related events
 */
export type NoteEvent = NoteCreated | NoteContentChanged | NoteDeleted | NoteRestored | NoteReordered | EntryMovedToCollection | NoteMigrated | NoteAddedToCollection | NoteRemovedFromCollection;
