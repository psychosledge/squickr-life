/**
 * Firestore Event Validator (ADR-028)
 *
 * Provides runtime validation of raw Firestore documents before they are cast
 * to domain types. This prevents silent data corruption from unexpected or
 * corrupted Firestore documents.
 *
 * - assertValidDomainEvent: validates base DomainEvent shape and known type
 *   discriminant; throws FirestoreValidationError on any failure (fail-loud).
 * - validateProjectionSnapshot: validates ProjectionSnapshot shape; returns
 *   null on failure so callers can fall back to full event replay (fail-soft).
 */

import type { SquickrDomainEvent, ProjectionSnapshot } from '@squickr/domain';
import { SNAPSHOT_SCHEMA_VERSION } from '@squickr/domain';

// ---------------------------------------------------------------------------
// FirestoreValidationError
// ---------------------------------------------------------------------------

/**
 * Thrown by assertValidDomainEvent when a Firestore document does not
 * conform to the expected DomainEvent shape or contains an unknown type.
 */
export class FirestoreValidationError extends Error {
  /** The Firestore document ID, for tracing which document caused the error. */
  readonly documentId: string;

  /** The raw, unvalidated data from Firestore. */
  readonly raw: unknown;

  /**
   * The event type string, when the type field was a string but not a known
   * SquickrDomainEvent discriminant.  Undefined when the type field itself
   * was missing or was not a string.
   */
  readonly eventType: string | undefined;

  constructor(
    message: string,
    documentId: string,
    raw: unknown,
    eventType?: string
  ) {
    super(message);
    this.name = 'FirestoreValidationError';
    this.documentId = documentId;
    this.raw = raw;
    this.eventType = eventType;
  }
}

// ---------------------------------------------------------------------------
// Known event type set — compile-time sync with SquickrDomainEvent
// ---------------------------------------------------------------------------

/**
 * All discriminant string literals from the SquickrDomainEvent union.
 *
 * The `satisfies` expression below gives a compile-time check: every string
 * in KNOWN_EVENT_TYPES must be a valid SquickrDomainEvent['type'].
 *
 * If a new event type is added to the domain unions, TypeScript will NOT error
 * here automatically — the developer must add the new string to this set.
 * The satisfies check prevents adding strings that are NOT valid type literals
 * (typos, removed events).
 */
type KnownSquickrType = SquickrDomainEvent['type'];

// Set of all event type strings that are legitimate in Firestore.
// The array is typed as ReadonlyArray<KnownSquickrType> which ensures every
// entry is a real SquickrDomainEvent discriminant.
//
// When adding a new event type to the SquickrDomainEvent union, add the type string here too.
// There is no compile-time enforcement in the add direction.
const KNOWN_EVENT_TYPES_ARRAY = [
  // Task events
  'TaskCreated',
  'TaskCompleted',
  'TaskReopened',
  'TaskDeleted',
  'TaskRestored',
  'TaskReordered',
  'TaskTitleChanged',
  'TaskMigrated',
  'TaskAddedToCollection',
  'TaskRemovedFromCollection',
  // Note events
  'NoteCreated',
  'NoteContentChanged',
  'NoteDeleted',
  'NoteRestored',
  'NoteReordered',
  'NoteMigrated',
  'NoteAddedToCollection',
  'NoteRemovedFromCollection',
  // Calendar/Event events
  'EventCreated',
  'EventContentChanged',
  'EventDateChanged',
  'EventDeleted',
  'EventRestored',
  'EventReordered',
  'EventMigrated',
  'EventAddedToCollection',
  'EventRemovedFromCollection',
  // Shared entry event (appears in Task, Note, and Event unions)
  'EntryMovedToCollection',
  // Collection events
  'CollectionCreated',
  'CollectionRenamed',
  'CollectionReordered',
  'CollectionDeleted',
  'CollectionRestored',
  'CollectionSettingsUpdated',
  'CollectionFavorited',
  'CollectionUnfavorited',
  'CollectionAccessed',
  // Habit events
  'HabitCreated',
  'HabitTitleChanged',
  'HabitFrequencyChanged',
  'HabitCompleted',
  'HabitCompletionReverted',
  'HabitArchived',
  'HabitRestored',
  'HabitReordered',
  'HabitNotificationTimeSet',
  'HabitNotificationTimeCleared',
  // UserPreferences events
  'UserPreferencesUpdated',
] as const satisfies ReadonlyArray<KnownSquickrType>;

// Fast O(1) lookup set
const KNOWN_EVENT_TYPES = new Set<string>(KNOWN_EVENT_TYPES_ARRAY);

// ---------------------------------------------------------------------------
// assertValidDomainEvent
// ---------------------------------------------------------------------------

/**
 * Validates that `raw` is a well-formed DomainEvent with a known type
 * discriminant, then returns it as SquickrDomainEvent.
 *
 * Checks:
 * - raw is a non-null, non-array object
 * - id is a non-empty string
 * - type is a string in KNOWN_EVENT_TYPES
 * - timestamp is a string
 * - version is a number
 * - aggregateId is a string
 *
 * Throws FirestoreValidationError on any failure.
 *
 * @param raw        - The raw data from `doc.data()`
 * @param documentId - The Firestore document ID (for error context)
 */
export function assertValidDomainEvent(
  raw: unknown,
  documentId: string
): SquickrDomainEvent {
  // Must be a plain object (not null, not an array)
  if (
    raw === null ||
    raw === undefined ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  ) {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" is not a valid object`,
      documentId,
      raw
    );
  }

  const obj = raw as Record<string, unknown>;

  // Validate id
  if (typeof obj['id'] !== 'string' || obj['id'] === '') {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has missing or invalid "id" field`,
      documentId,
      raw
    );
  }

  // Validate type — must be a string first
  if (typeof obj['type'] !== 'string') {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has missing or non-string "type" field`,
      documentId,
      raw
    );
  }

  const eventType = obj['type'] as string;

  // Validate type — must be a known discriminant
  if (!KNOWN_EVENT_TYPES.has(eventType)) {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has unknown event type "${eventType}"`,
      documentId,
      raw,
      eventType
    );
  }

  // Validate timestamp
  if (typeof obj['timestamp'] !== 'string') {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has missing or invalid "timestamp" field`,
      documentId,
      raw,
      eventType
    );
  }

  // Validate version
  if (typeof obj['version'] !== 'number') {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has missing or invalid "version" field`,
      documentId,
      raw,
      eventType
    );
  }

  // Validate aggregateId
  if (typeof obj['aggregateId'] !== 'string') {
    throw new FirestoreValidationError(
      `Firestore document "${documentId}" has missing or invalid "aggregateId" field`,
      documentId,
      raw,
      eventType
    );
  }

  // All checks passed — cast is safe for the validated fields
  return raw as unknown as SquickrDomainEvent;
}

// ---------------------------------------------------------------------------
// validateProjectionSnapshot
// ---------------------------------------------------------------------------

/**
 * Validates that `raw` is a well-formed ProjectionSnapshot with the current
 * schema version.
 *
 * Returns the snapshot when valid, or null when:
 * - raw is not an object
 * - any required field (version, lastEventId, state, savedAt) is missing
 *   or has the wrong type
 * - version does not match SNAPSHOT_SCHEMA_VERSION
 *
 * Never throws — callers should fall back to full event replay when null
 * is returned.
 *
 * @param raw - The raw data from `snap.data()`
 */
export function validateProjectionSnapshot(raw: unknown): ProjectionSnapshot | null {
  // Must be a plain object
  if (
    raw === null ||
    raw === undefined ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  ) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // version must be a number equal to SNAPSHOT_SCHEMA_VERSION
  if (typeof obj['version'] !== 'number') return null;
  if (obj['version'] !== SNAPSHOT_SCHEMA_VERSION) return null;

  // lastEventId must be a string
  if (typeof obj['lastEventId'] !== 'string') return null;

  // state must be an array
  if (!Array.isArray(obj['state'])) return null;

  // savedAt must be a string
  if (typeof obj['savedAt'] !== 'string') return null;

  return raw as unknown as ProjectionSnapshot;
}
