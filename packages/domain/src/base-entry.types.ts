import type { DomainEvent } from './domain-event';

// ============================================================================
// Shared / Base Entry Types
// ============================================================================

/**
 * Collection history entry - tracks when an entry was added/removed from a collection
 * Used for ghost rendering (show removed entries as crossed out)
 */
export interface CollectionHistoryEntry {
  readonly collectionId: string;
  readonly addedAt: string;
  readonly removedAt?: string; // undefined = still in this collection
}

/**
 * BaseEntry interface - shared fields for all entry types (Task, Note, Event)
 * Provides multi-collection support and audit trail fields.
 */
export interface BaseEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly order?: string;
  readonly collectionId?: string;
  /** Array of collection IDs this entry belongs to (multi-collection support) */
  readonly collections: string[];
  readonly collectionHistory?: CollectionHistoryEntry[];
  readonly userId?: string;
  readonly migratedTo?: string;
  readonly migratedFrom?: string;
  readonly migratedToCollectionId?: string;
  readonly migratedFromCollectionId?: string;
  /** ISO timestamp set when entry is soft-deleted; undefined means the entry is active */
  readonly deletedAt?: string;
}

/**
 * Entry type discriminator
 */
export type EntryType = 'task' | 'note' | 'event';

/**
 * Entry filter options
 */
export type EntryFilter = 'all' | 'tasks' | 'notes' | 'events' | 'open-tasks' | 'completed-tasks';

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

// ============================================================================
// Unified Entry Types (for UI)
// Defined here to avoid circular imports: task/note/event.types import BaseEntry,
// and this file imports Task/Note/Event to compose the Entry union.
// TypeScript resolves type-only circular imports correctly.
// ============================================================================

import type { Task } from './task.types';
import type { Note } from './note.types';
import type { Event } from './event.types';
import type { TaskEvent } from './task.types';
import type { NoteEvent } from './note.types';
import type { EventEvent } from './event.types';

/**
 * Unified entry - discriminated union of Task, Note, and Event
 * Used by projections to create a unified view for the UI
 */
export type Entry =
  | (Task & { readonly type: 'task' })
  | (Note & { readonly type: 'note' })
  | (Event & { readonly type: 'event' });

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
