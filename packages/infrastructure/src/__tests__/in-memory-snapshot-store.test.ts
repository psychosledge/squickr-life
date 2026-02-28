/**
 * InMemorySnapshotStore Tests
 *
 * Verifies all contract cases for the in-memory ISnapshotStore implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySnapshotStore } from '../in-memory-snapshot-store';
import { SNAPSHOT_SCHEMA_VERSION } from '@squickr/domain';
import type { ISnapshotStore, ProjectionSnapshot } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
  return {
    version: SNAPSHOT_SCHEMA_VERSION,
    lastEventId: 'evt-001',
    state: [],
    savedAt: '2026-02-28T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemorySnapshotStore', () => {
  let store: ISnapshotStore;

  beforeEach(() => {
    store = new InMemorySnapshotStore();
  });

  describe('load()', () => {
    it('returns null when no snapshot exists for the key', async () => {
      // Act
      const result = await store.load('entry-list');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('save() + load()', () => {
    it('returns the saved snapshot after save()', async () => {
      // Arrange
      const snapshot = makeSnapshot({ lastEventId: 'evt-100' });

      // Act
      await store.save('entry-list', snapshot);
      const loaded = await store.load('entry-list');

      // Assert
      expect(loaded).toEqual(snapshot);
    });

    it('overwrites (not appends) when save() is called twice with the same key', async () => {
      // Arrange
      const snapshot1 = makeSnapshot({ lastEventId: 'evt-001', savedAt: '2026-02-28T00:00:00.000Z' });
      const snapshot2 = makeSnapshot({ lastEventId: 'evt-002', savedAt: '2026-02-28T00:01:00.000Z' });

      // Act
      await store.save('entry-list', snapshot1);
      await store.save('entry-list', snapshot2);
      const loaded = await store.load('entry-list');

      // Assert — only snapshot2 should be present
      expect(loaded).toEqual(snapshot2);
    });
  });

  describe('clear()', () => {
    it('makes subsequent load() return null', async () => {
      // Arrange
      const snapshot = makeSnapshot({ lastEventId: 'evt-200' });
      await store.save('entry-list', snapshot);

      // Act
      await store.clear('entry-list');
      const result = await store.load('entry-list');

      // Assert
      expect(result).toBeNull();
    });

    it('is a no-op when no snapshot exists for the key (does not throw)', async () => {
      // Act & Assert — resolves without throwing
      await expect(store.clear('nonexistent-key')).resolves.toBeUndefined();
    });
  });

  describe('key independence', () => {
    it('saving under one key does not affect another key', async () => {
      // Arrange
      const snapshotA = makeSnapshot({ lastEventId: 'evt-a', savedAt: '2026-02-28T00:00:00.000Z' });
      const snapshotB = makeSnapshot({ lastEventId: 'evt-b', savedAt: '2026-02-28T00:01:00.000Z' });

      // Act
      await store.save('projection-a', snapshotA);
      await store.save('projection-b', snapshotB);

      // Assert
      expect(await store.load('projection-a')).toEqual(snapshotA);
      expect(await store.load('projection-b')).toEqual(snapshotB);
    });
  });
});
