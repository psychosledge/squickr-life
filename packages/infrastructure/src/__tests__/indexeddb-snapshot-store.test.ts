/**
 * IndexedDBSnapshotStore Tests
 *
 * Verifies all contract cases for the IndexedDB-backed ISnapshotStore implementation.
 * Uses fake-indexeddb so these tests run in Node (no real browser required).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBSnapshotStore } from '../indexeddb-snapshot-store';
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

describe('IndexedDBSnapshotStore', () => {
  let store: ISnapshotStore & { initialize(): Promise<void> };
  let dbIndex = 0;

  /**
   * Each test gets a fresh IndexedDB instance via a unique DB name.
   * fake-indexeddb provides a fresh IDBFactory per instance, ensuring
   * complete test isolation.
   */
  beforeEach(async () => {
    const fakeIDB = new IDBFactory();
    const dbName = `test-squickr-snapshots-${++dbIndex}`;
    store = new IndexedDBSnapshotStore(dbName, fakeIDB);
    await store.initialize();
  });

  // -------------------------------------------------------------------------
  // load() — base case
  // -------------------------------------------------------------------------

  describe('load()', () => {
    it('returns null when no snapshot exists for the key', async () => {
      // Act
      const result = await store.load('entry-list');

      // Assert
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // save() + load()
  // -------------------------------------------------------------------------

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
      expect(loaded?.lastEventId).toBe('evt-002');
    });
  });

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Key independence
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Not-initialized guard
  // -------------------------------------------------------------------------

  describe('not-initialized guard', () => {
    it('throws if save() is called before initialize()', async () => {
      // Arrange — a fresh store that has NOT been initialized
      const uninitStore = new IndexedDBSnapshotStore('uninit-db', new IDBFactory());

      // Act & Assert
      await expect(uninitStore.save('key', makeSnapshot())).rejects.toThrow(
        'SnapshotStore not initialized',
      );
    });

    it('throws if load() is called before initialize()', async () => {
      const uninitStore = new IndexedDBSnapshotStore('uninit-db-2', new IDBFactory());

      await expect(uninitStore.load('key')).rejects.toThrow('SnapshotStore not initialized');
    });

    it('throws if clear() is called before initialize()', async () => {
      const uninitStore = new IndexedDBSnapshotStore('uninit-db-3', new IDBFactory());

      await expect(uninitStore.clear('key')).rejects.toThrow('SnapshotStore not initialized');
    });
  });

  // -------------------------------------------------------------------------
  // IndexedDB-specific: object store created by initialize()
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    it('creates the "snapshots" object store', async () => {
      // Arrange — access the raw db via the store's internal db property
      const fakeIDB = new IDBFactory();
      const rawStore = new IndexedDBSnapshotStore('init-test-db', fakeIDB);
      await rawStore.initialize();

      // Verify by opening the same DB and checking objectStoreNames
      await new Promise<void>((resolve, reject) => {
        const req = fakeIDB.open('init-test-db');
        req.onsuccess = () => {
          const db = req.result;
          expect(db.objectStoreNames.contains('snapshots')).toBe(true);
          db.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    });
  });

  // -------------------------------------------------------------------------
  // IndexedDB-specific: stored record's key field is NOT returned in load()
  // -------------------------------------------------------------------------

  describe('load() — key field not leaked', () => {
    it('does not include the IndexedDB keyPath field "key" in the returned snapshot', async () => {
      // Arrange
      const snapshot = makeSnapshot({ lastEventId: 'evt-300' });
      await store.save('my-projection', snapshot);

      // Act
      const loaded = await store.load('my-projection');

      // Assert — the 'key' field used as keyPath must be stripped
      expect(loaded).not.toBeNull();
      expect('key' in (loaded as object)).toBe(false);
    });
  });
});
