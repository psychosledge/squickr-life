import { describe, it, expect } from 'vitest';
import { buildEntriesByCollectionMap } from './buildEntriesByCollectionMap';
import type { Entry } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Extract<Entry, { type: 'task' }>>): Entry {
  return {
    id: 'task-1',
    type: 'task',
    content: 'Test task',
    status: 'open',
    createdAt: '2026-02-09T10:00:00Z',
    collections: [],
    ...overrides,
  } as Entry;
}

function makeNote(overrides: Partial<Extract<Entry, { type: 'note' }>>): Entry {
  return {
    id: 'note-1',
    type: 'note',
    content: 'Test note',
    createdAt: '2026-02-09T10:00:00Z',
    ...overrides,
  } as Entry;
}

function makeEvent(overrides: Partial<Extract<Entry, { type: 'event' }>>): Entry {
  return {
    id: 'event-1',
    type: 'event',
    content: 'Test event',
    eventDate: '2026-02-09',
    createdAt: '2026-02-09T10:00:00Z',
    ...overrides,
  } as Entry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildEntriesByCollectionMap', () => {
  it('should return an empty map for an empty entry list', () => {
    const result = buildEntriesByCollectionMap([]);
    expect(result.size).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Task — multi-collection pattern
  // -------------------------------------------------------------------------

  describe('tasks (multi-collection pattern)', () => {
    it('buckets a task by its collections[] — not by the absent collectionId', () => {
      // Simulates a task added to a collection via TaskAddedToCollection with
      // no original collectionId (the exact bug that was fixed).
      const task = makeTask({
        id: 'task-mc-1',
        collectionId: undefined,
        collections: ['col-A'],
      });

      const result = buildEntriesByCollectionMap([task]);

      // Must appear under 'col-A'
      expect(result.get('col-A')).toEqual([task]);
      // Must NOT appear under null (the old, broken behaviour)
      expect(result.has(null)).toBe(false);
    });

    it('buckets a task by collections[] and ignores a stale collectionId', () => {
      // Simulates a task whose collectionId still points to its original
      // collection but whose collections[] has been updated to a new one.
      const task = makeTask({
        id: 'task-stale-1',
        collectionId: 'old-col',
        collections: ['new-col'],
      });

      const result = buildEntriesByCollectionMap([task]);

      // Appears under 'new-col' (source of truth)
      expect(result.get('new-col')).toEqual([task]);
      // Does NOT appear under the stale collectionId
      expect(result.has('old-col')).toBe(false);
    });

    it('places a task in BOTH buckets when it belongs to two collections', () => {
      const task = makeTask({
        id: 'task-shared-1',
        collectionId: 'col-A',
        collections: ['col-A', 'col-B'],
      });

      const result = buildEntriesByCollectionMap([task]);

      expect(result.get('col-A')).toEqual([task]);
      expect(result.get('col-B')).toEqual([task]);
    });

    it('falls back to collectionId for a legacy task whose collections[] is empty', () => {
      // Legacy entry: no collectionHistory field — old data before multi-collection system.
      // collectionId fallback must still apply.
      const task = makeTask({
        id: 'task-legacy-1',
        collectionId: 'legacy-col',
        collections: [],
        // collectionHistory intentionally absent (legacy entry)
      });

      const result = buildEntriesByCollectionMap([task]);

      expect(result.get('legacy-col')).toEqual([task]);
    });

    it('buckets a task under null when collections[] is empty AND collectionId is undefined', () => {
      // A truly uncategorised task — should appear in the null / "Uncategorised" bucket.
      const task = makeTask({
        id: 'task-uncat-1',
        collectionId: undefined,
        collections: [],
      });

      const result = buildEntriesByCollectionMap([task]);

      expect(result.get(null)).toEqual([task]);
    });

    it('does NOT place a modern task in the old monthly log after TaskRemovedFromCollection empties collections[]', () => {
      // Regression test for: monthly log showing "1 task" when there are no active tasks.
      //
      // A modern task (has collectionHistory) that was removed from its only collection
      // ends up with collections: []. The old fallback incorrectly re-bucketed it under
      // collectionId (the monthly log), causing ghost tasks to appear in stats.
      //
      // Expected: a task with collectionHistory defined but collections[] empty belongs
      // to NO collection — it should NOT appear in any bucket.
      const monthlyLogId = 'monthly-log-feb-2026';
      const task = makeTask({
        id: 'task-removed-1',
        collectionId: monthlyLogId,         // stale — was here before removal
        collections: [],                     // emptied by TaskRemovedFromCollection
        collectionHistory: [                 // proves this is a modern entry
          {
            collectionId: monthlyLogId,
            addedAt: '2026-02-01T08:00:00Z',
            removedAt: '2026-02-10T09:00:00Z',
          },
        ],
      });

      const result = buildEntriesByCollectionMap([task]);

      // Must NOT appear in the monthly log bucket
      expect(result.has(monthlyLogId)).toBe(false);
      // Must NOT appear anywhere at all (it belongs to no collection)
      expect(result.size).toBe(0);
    });

    it('preserves collectionId fallback ONLY for entries with NO collectionHistory (truly legacy)', () => {
      // Contrasts the two cases side-by-side to make the distinction explicit.
      const legacyTask = makeTask({
        id: 'legacy',
        collectionId: 'col-legacy',
        collections: [],
        // collectionHistory: undefined — legacy, use collectionId fallback
      });
      const modernTask = makeTask({
        id: 'modern',
        collectionId: 'col-old',            // stale pointer from before removal
        collections: [],                     // emptied by modern event system
        collectionHistory: [
          {
            collectionId: 'col-old',
            addedAt: '2026-01-01T00:00:00Z',
            removedAt: '2026-01-15T00:00:00Z',
          },
        ],
      });

      const result = buildEntriesByCollectionMap([legacyTask, modernTask]);

      // Legacy task: falls back to collectionId
      expect(result.get('col-legacy')).toEqual([legacyTask]);
      // Modern task: trusts collections[] (empty) — does NOT fall back to stale collectionId
      expect(result.has('col-old')).toBe(false);
      expect(result.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Notes and events — legacy single-collection pattern
  // -------------------------------------------------------------------------

  describe('notes and events (legacy collectionId pattern)', () => {
    it('buckets a note under its collectionId', () => {
      const note = makeNote({ id: 'note-1', collectionId: 'col-1' });

      const result = buildEntriesByCollectionMap([note]);

      expect(result.get('col-1')).toEqual([note]);
    });

    it('buckets a note under null when collectionId is absent', () => {
      const note = makeNote({ id: 'note-uncat', collectionId: undefined });

      const result = buildEntriesByCollectionMap([note]);

      expect(result.get(null)).toEqual([note]);
    });

    it('buckets an event under its collectionId', () => {
      const event = makeEvent({ id: 'event-1', collectionId: 'col-2' });

      const result = buildEntriesByCollectionMap([event]);

      expect(result.get('col-2')).toEqual([event]);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed entry types
  // -------------------------------------------------------------------------

  describe('mixed entry types', () => {
    it('correctly segregates tasks, notes, and events into their respective buckets', () => {
      const task = makeTask({
        id: 't1',
        collectionId: 'col-A',
        collections: ['col-A', 'col-B'],
      });
      const note = makeNote({ id: 'n1', collectionId: 'col-A' });
      const event = makeEvent({ id: 'e1', collectionId: 'col-C' });

      const result = buildEntriesByCollectionMap([task, note, event]);

      expect(result.get('col-A')).toEqual([task, note]);
      expect(result.get('col-B')).toEqual([task]);
      expect(result.get('col-C')).toEqual([event]);
      expect(result.size).toBe(3);
    });

    it('accumulates multiple entries under the same bucket key', () => {
      const task1 = makeTask({ id: 't1', collectionId: 'col-X', collections: ['col-X'] });
      const task2 = makeTask({ id: 't2', collectionId: 'col-X', collections: ['col-X'] });
      const note = makeNote({ id: 'n1', collectionId: 'col-X' });

      const result = buildEntriesByCollectionMap([task1, task2, note]);

      expect(result.get('col-X')).toEqual([task1, task2, note]);
      expect(result.size).toBe(1);
    });
  });
});
