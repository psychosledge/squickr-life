import type { DomainEvent } from './domain-event';
import type { BaseEntry, EntryMovedToCollection } from './base-entry.types';

// ============================================================================
// Event Domain Types (Bullet Journal Events)
// ============================================================================

/**
 * Event entity - represents an event entry in the bullet journal
 * Events are things that happen/happened on specific dates
 */
export interface Event extends BaseEntry {
  /** Event content/description (1-5000 characters) */
  readonly content: string;

  /** Optional: When the event actually occurs/occurred (ISO 8601 date) */
  readonly eventDate?: string;
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
  /** If provided and the event is in multiple collections, only remove from this collection */
  readonly currentCollectionId?: string;
}

/**
 * EventRestored Event
 * Emitted when a soft-deleted event entry is restored
 */
export interface EventRestored extends DomainEvent {
  readonly type: 'EventRestored';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly restoredAt: string;
  };
}

/**
 * RestoreEvent Command
 * Represents the user's intent to restore a soft-deleted event entry
 */
export interface RestoreEventCommand {
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

// ============================================================================
// Event Multi-Collection Events
// ============================================================================

/**
 * EventAddedToCollection Event
 * Emitted when an event entry is added to an additional collection
 *
 * Invariants:
 * - aggregateId must match an existing event entry
 * - Event must not already be in this collection (idempotent check)
 */
export interface EventAddedToCollection extends DomainEvent {
  readonly type: 'EventAddedToCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly collectionId: string;
    readonly addedAt: string;
  };
}

/**
 * EventRemovedFromCollection Event
 * Emitted when an event entry is removed from a collection
 *
 * Invariants:
 * - aggregateId must match an existing event entry
 * - Event must be in this collection (idempotent check)
 */
export interface EventRemovedFromCollection extends DomainEvent {
  readonly type: 'EventRemovedFromCollection';
  readonly aggregateId: string;
  readonly payload: {
    readonly eventId: string;
    readonly collectionId: string;
    readonly removedAt: string;
  };
}

/**
 * AddEventToCollection Command
 */
export interface AddEventToCollectionCommand {
  readonly eventId: string;
  readonly collectionId: string;
}

/**
 * RemoveEventFromCollection Command
 */
export interface RemoveEventFromCollectionCommand {
  readonly eventId: string;
  readonly collectionId: string;
}

/**
 * MoveEventToCollection Command
 */
export interface MoveEventToCollectionCommand {
  readonly eventId: string;
  readonly currentCollectionId: string;
  readonly targetCollectionId: string;
}

/**
 * Union type of all event-related events
 */
export type EventEvent = EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventRestored | EventReordered | EntryMovedToCollection | EventMigrated | EventAddedToCollection | EventRemovedFromCollection;
