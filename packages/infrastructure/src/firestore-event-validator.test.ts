/**
 * FirestoreEventValidator Tests
 *
 * Validates that assertValidDomainEvent and validateProjectionSnapshot
 * correctly validate (or reject) raw Firestore data before casting.
 *
 * Red-Green-Refactor: these tests are written first.
 */

import { describe, it, expect } from 'vitest';
import {
  assertValidDomainEvent,
  validateProjectionSnapshot,
  FirestoreValidationError,
} from './firestore-event-validator';
import { SNAPSHOT_SCHEMA_VERSION } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-001',
    type: 'TaskCreated',
    timestamp: '2026-04-04T10:00:00.000Z',
    version: 1,
    aggregateId: 'task-abc',
    ...overrides,
  };
}

function makeRawSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: SNAPSHOT_SCHEMA_VERSION,
    lastEventId: 'evt-001',
    state: [],
    savedAt: '2026-04-04T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// FirestoreValidationError
// ---------------------------------------------------------------------------

describe('FirestoreValidationError', () => {
  it('is an instance of Error', () => {
    const err = new FirestoreValidationError('bad data', 'doc-1', { raw: 'data' });
    expect(err).toBeInstanceOf(Error);
  });

  it('carries documentId', () => {
    const err = new FirestoreValidationError('msg', 'doc-42', {});
    expect(err.documentId).toBe('doc-42');
  });

  it('carries raw value', () => {
    const raw = { type: 'Unknown', id: 'x' };
    const err = new FirestoreValidationError('msg', 'doc-1', raw);
    expect(err.raw).toBe(raw);
  });

  it('carries optional eventType', () => {
    const err = new FirestoreValidationError('msg', 'doc-1', {}, 'TaskCreated');
    expect(err.eventType).toBe('TaskCreated');
  });

  it('has undefined eventType when not provided', () => {
    const err = new FirestoreValidationError('msg', 'doc-1', {});
    expect(err.eventType).toBeUndefined();
  });

  it('has the correct message', () => {
    const err = new FirestoreValidationError('Invalid event', 'doc-1', {});
    expect(err.message).toBe('Invalid event');
  });
});

// ---------------------------------------------------------------------------
// assertValidDomainEvent — happy path
// ---------------------------------------------------------------------------

describe('assertValidDomainEvent — valid events', () => {
  it('passes through a valid TaskCreated event', () => {
    const raw = makeRawEvent({ type: 'TaskCreated' });
    const result = assertValidDomainEvent(raw, 'doc-1');
    expect(result.id).toBe('evt-001');
    expect(result.type).toBe('TaskCreated');
    expect(result.aggregateId).toBe('task-abc');
  });

  it('passes through all known task event types', () => {
    const types = [
      'TaskCreated', 'TaskCompleted', 'TaskReopened', 'TaskDeleted',
      'TaskRestored', 'TaskReordered', 'TaskTitleChanged', 'TaskMigrated',
      'TaskAddedToCollection', 'TaskRemovedFromCollection',
    ];
    for (const type of types) {
      const raw = makeRawEvent({ type });
      expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
    }
  });

  it('passes through all known note event types', () => {
    const types = [
      'NoteCreated', 'NoteContentChanged', 'NoteDeleted', 'NoteRestored',
      'NoteReordered', 'NoteMigrated', 'NoteAddedToCollection', 'NoteRemovedFromCollection',
    ];
    for (const type of types) {
      const raw = makeRawEvent({ type });
      expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
    }
  });

  it('passes through all known event (calendar) event types', () => {
    const types = [
      'EventCreated', 'EventContentChanged', 'EventDateChanged', 'EventDeleted',
      'EventRestored', 'EventReordered', 'EventMigrated', 'EventAddedToCollection',
      'EventRemovedFromCollection',
    ];
    for (const type of types) {
      const raw = makeRawEvent({ type });
      expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
    }
  });

  it('passes through all known collection event types', () => {
    const types = [
      'CollectionCreated', 'CollectionRenamed', 'CollectionReordered', 'CollectionDeleted',
      'CollectionRestored', 'CollectionSettingsUpdated', 'CollectionFavorited',
      'CollectionUnfavorited', 'CollectionAccessed',
    ];
    for (const type of types) {
      const raw = makeRawEvent({ type });
      expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
    }
  });

  it('passes through all known habit event types', () => {
    const types = [
      'HabitCreated', 'HabitTitleChanged', 'HabitFrequencyChanged', 'HabitCompleted',
      'HabitCompletionReverted', 'HabitArchived', 'HabitRestored', 'HabitReordered',
      'HabitNotificationTimeSet', 'HabitNotificationTimeCleared',
    ];
    for (const type of types) {
      const raw = makeRawEvent({ type });
      expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
    }
  });

  it('passes through EntryMovedToCollection', () => {
    const raw = makeRawEvent({ type: 'EntryMovedToCollection' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
  });

  it('passes through UserPreferencesUpdated', () => {
    const raw = makeRawEvent({ type: 'UserPreferencesUpdated' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
  });

  it('allows optional userId field', () => {
    const raw = makeRawEvent({ userId: 'user-123' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).not.toThrow();
  });

  it('returns the same object reference', () => {
    const raw = makeRawEvent();
    const result = assertValidDomainEvent(raw, 'doc-1');
    expect(result).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// assertValidDomainEvent — missing required fields
// ---------------------------------------------------------------------------

describe('assertValidDomainEvent — missing required fields', () => {
  it('throws FirestoreValidationError when id is missing', () => {
    const raw = makeRawEvent({ id: undefined });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws FirestoreValidationError when type is missing', () => {
    const raw = makeRawEvent({ type: undefined });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws FirestoreValidationError when timestamp is missing', () => {
    const raw = makeRawEvent({ timestamp: undefined });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws FirestoreValidationError when version is missing', () => {
    const raw = makeRawEvent({ version: undefined });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws FirestoreValidationError when aggregateId is missing', () => {
    const raw = makeRawEvent({ aggregateId: undefined });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when raw is null', () => {
    expect(() => assertValidDomainEvent(null, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when raw is undefined', () => {
    expect(() => assertValidDomainEvent(undefined, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when raw is a string', () => {
    expect(() => assertValidDomainEvent('not-an-object', 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when raw is an array', () => {
    expect(() => assertValidDomainEvent([], 'doc-1')).toThrow(FirestoreValidationError);
  });
});

// ---------------------------------------------------------------------------
// assertValidDomainEvent — wrong primitive types
// ---------------------------------------------------------------------------

describe('assertValidDomainEvent — wrong primitive types', () => {
  it('throws when id is not a string', () => {
    const raw = makeRawEvent({ id: 42 });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when type is not a string', () => {
    const raw = makeRawEvent({ type: 123 });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when timestamp is not a string', () => {
    const raw = makeRawEvent({ timestamp: new Date() });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when version is not a number', () => {
    const raw = makeRawEvent({ version: '1' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws when aggregateId is not a string', () => {
    const raw = makeRawEvent({ aggregateId: true });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });
});

// ---------------------------------------------------------------------------
// assertValidDomainEvent — unknown event type
// ---------------------------------------------------------------------------

describe('assertValidDomainEvent — unknown event type', () => {
  it('throws FirestoreValidationError for a completely unknown type', () => {
    const raw = makeRawEvent({ type: 'SomeFutureEvent' });
    expect(() => assertValidDomainEvent(raw, 'doc-99')).toThrow(FirestoreValidationError);
  });

  it('throws for empty string type', () => {
    const raw = makeRawEvent({ type: '' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('throws FirestoreValidationError when id is an empty string', () => {
    const raw = makeRawEvent({ id: '' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });

  it('is case-sensitive (lowercase known type fails)', () => {
    const raw = makeRawEvent({ type: 'taskcreated' });
    expect(() => assertValidDomainEvent(raw, 'doc-1')).toThrow(FirestoreValidationError);
  });
});

// ---------------------------------------------------------------------------
// assertValidDomainEvent — error carries context
// ---------------------------------------------------------------------------

describe('assertValidDomainEvent — error carries context', () => {
  it('error carries documentId', () => {
    const raw = makeRawEvent({ id: undefined });
    try {
      assertValidDomainEvent(raw, 'my-doc-id');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FirestoreValidationError);
      expect((err as FirestoreValidationError).documentId).toBe('my-doc-id');
    }
  });

  it('error carries raw value', () => {
    const raw = makeRawEvent({ type: 'UnknownEvent' });
    try {
      assertValidDomainEvent(raw, 'doc-1');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FirestoreValidationError);
      expect((err as FirestoreValidationError).raw).toBe(raw);
    }
  });

  it('error carries eventType when type string is present but unknown', () => {
    const raw = makeRawEvent({ type: 'UnknownFutureEvent' });
    try {
      assertValidDomainEvent(raw, 'doc-1');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FirestoreValidationError);
      expect((err as FirestoreValidationError).eventType).toBe('UnknownFutureEvent');
    }
  });

  it('error eventType is undefined when type field itself is invalid', () => {
    const raw = makeRawEvent({ type: 42 });
    try {
      assertValidDomainEvent(raw, 'doc-1');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FirestoreValidationError);
      // type was not a string so eventType can't be set
      expect((err as FirestoreValidationError).eventType).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// validateProjectionSnapshot — happy path
// ---------------------------------------------------------------------------

describe('validateProjectionSnapshot — valid snapshots', () => {
  it('returns the snapshot when all required fields are present and version matches', () => {
    const raw = makeRawSnapshot();
    const result = validateProjectionSnapshot(raw);
    expect(result).toEqual(raw);
  });

  it('returns same object reference for valid snapshot', () => {
    const raw = makeRawSnapshot();
    const result = validateProjectionSnapshot(raw);
    expect(result).toBe(raw);
  });

  it('accepts optional collections field', () => {
    const raw = makeRawSnapshot({ collections: [] });
    expect(validateProjectionSnapshot(raw)).not.toBeNull();
  });

  it('accepts optional habits field', () => {
    const raw = makeRawSnapshot({ habits: [] });
    expect(validateProjectionSnapshot(raw)).not.toBeNull();
  });

  it('accepts optional userPreferences field', () => {
    const raw = makeRawSnapshot({ userPreferences: {} });
    expect(validateProjectionSnapshot(raw)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateProjectionSnapshot — invalid / stale snapshots return null
// ---------------------------------------------------------------------------

describe('validateProjectionSnapshot — returns null on failure', () => {
  it('returns null when raw is null', () => {
    expect(validateProjectionSnapshot(null)).toBeNull();
  });

  it('returns null when raw is undefined', () => {
    expect(validateProjectionSnapshot(undefined)).toBeNull();
  });

  it('returns null when raw is not an object', () => {
    expect(validateProjectionSnapshot('string')).toBeNull();
    expect(validateProjectionSnapshot(42)).toBeNull();
    expect(validateProjectionSnapshot([])).toBeNull();
  });

  it('returns null when version is missing', () => {
    const raw = makeRawSnapshot({ version: undefined });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when version does not match SNAPSHOT_SCHEMA_VERSION', () => {
    const raw = makeRawSnapshot({ version: SNAPSHOT_SCHEMA_VERSION + 999 });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when version is 0 (wrong)', () => {
    const raw = makeRawSnapshot({ version: 0 });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when lastEventId is missing', () => {
    const raw = makeRawSnapshot({ lastEventId: undefined });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when lastEventId is not a string', () => {
    const raw = makeRawSnapshot({ lastEventId: 42 });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when state is missing', () => {
    const raw = makeRawSnapshot({ state: undefined });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when state is not an array', () => {
    const raw = makeRawSnapshot({ state: {} });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when savedAt is missing', () => {
    const raw = makeRawSnapshot({ savedAt: undefined });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('returns null when savedAt is not a string', () => {
    const raw = makeRawSnapshot({ savedAt: 12345 });
    expect(validateProjectionSnapshot(raw)).toBeNull();
  });

  it('does not throw — always returns null on failure', () => {
    // Bizarre inputs that might cause errors in naive implementations
    expect(() => validateProjectionSnapshot(null)).not.toThrow();
    expect(() => validateProjectionSnapshot(undefined)).not.toThrow();
    expect(() => validateProjectionSnapshot({ version: 'bad', lastEventId: null })).not.toThrow();
  });
});
