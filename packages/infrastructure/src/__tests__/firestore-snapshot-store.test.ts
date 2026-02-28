/**
 * FirestoreSnapshotStore Tests
 *
 * Mirrors the InMemorySnapshotStore contract tests and adds Firestore-specific
 * behaviour (schema version guard).
 *
 * Uses the same vi.mock('firebase/firestore') pattern as firestore-event-store.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirestoreSnapshotStore } from '../firestore-snapshot-store';
import { SNAPSHOT_SCHEMA_VERSION } from '@squickr/domain';
import type { ProjectionSnapshot } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Mock Firestore SDK
// ---------------------------------------------------------------------------

const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
}));

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

function makeDocSnap(data: unknown, exists = true) {
  return { exists: () => exists, data: () => data };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FirestoreSnapshotStore', () => {
  let firestore: any;
  let store: FirestoreSnapshotStore;
  const userId = 'user-abc';

  beforeEach(() => {
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
    mockDeleteDoc.mockClear();
    mockCollection.mockClear();
    mockDoc.mockClear();

    firestore = {};

    mockCollection.mockReturnValue('collection-ref');
    mockDoc.mockReturnValue('doc-ref');
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    // Default: document does not exist
    mockGetDoc.mockResolvedValue(makeDocSnap(null, false));

    store = new FirestoreSnapshotStore(firestore, userId);
  });

  describe('constructor', () => {
    it('creates a FirestoreSnapshotStore instance', () => {
      expect(store).toBeDefined();
    });
  });

  // ---- load() ----

  describe('load()', () => {
    it('returns null when no document exists for the key', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(null, false));

      const result = await store.load('entry-list-projection');

      expect(result).toBeNull();
    });

    it('returns the snapshot when a valid document exists', async () => {
      const snapshot = makeSnapshot({ lastEventId: 'evt-100' });
      mockGetDoc.mockResolvedValue(makeDocSnap(snapshot, true));

      const result = await store.load('entry-list-projection');

      expect(result).toEqual(snapshot);
    });

    it('returns null when stored snapshot version does not match SNAPSHOT_SCHEMA_VERSION', async () => {
      const staleSnapshot = makeSnapshot({ version: SNAPSHOT_SCHEMA_VERSION + 999 });
      mockGetDoc.mockResolvedValue(makeDocSnap(staleSnapshot, true));

      const result = await store.load('entry-list-projection');

      expect(result).toBeNull();
    });

    it('calls getDoc with the correct Firestore path', async () => {
      await store.load('entry-list-projection');

      expect(mockCollection).toHaveBeenCalledWith(firestore, `users/${userId}/snapshots`);
      expect(mockDoc).toHaveBeenCalledWith('collection-ref', 'entry-list-projection');
      expect(mockGetDoc).toHaveBeenCalledWith('doc-ref');
    });
  });

  // ---- save() ----

  describe('save()', () => {
    it('calls setDoc with the snapshot data', async () => {
      const snapshot = makeSnapshot({ lastEventId: 'evt-200' });

      await store.save('entry-list-projection', snapshot);

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      // setDoc receives (docRef, data) — verify data is the (cleaned) snapshot
      const [, data] = mockSetDoc.mock.calls[0]!;
      expect(data).toMatchObject({
        version: SNAPSHOT_SCHEMA_VERSION,
        lastEventId: 'evt-200',
      });
    });

    it('calls setDoc with the correct Firestore path', async () => {
      await store.save('my-projection', makeSnapshot());

      expect(mockCollection).toHaveBeenCalledWith(firestore, `users/${userId}/snapshots`);
      expect(mockDoc).toHaveBeenCalledWith('collection-ref', 'my-projection');
      expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', expect.any(Object));
    });
  });

  // ---- save() + load() round-trip ----

  describe('save() + load() round-trip', () => {
    it('load() returns the same snapshot that was passed to save()', async () => {
      const snapshot = makeSnapshot({ lastEventId: 'evt-300', savedAt: '2026-02-28T01:00:00.000Z' });

      await store.save('entry-list-projection', snapshot);

      // Simulate Firestore storing and returning the same data
      mockGetDoc.mockResolvedValue(makeDocSnap(snapshot, true));

      const loaded = await store.load('entry-list-projection');
      expect(loaded).toEqual(snapshot);
    });

    it('second save() overwrites the first (no append semantics)', async () => {
      const snapshot1 = makeSnapshot({ lastEventId: 'evt-001' });
      const snapshot2 = makeSnapshot({ lastEventId: 'evt-002' });

      await store.save('entry-list-projection', snapshot1);
      await store.save('entry-list-projection', snapshot2);

      // setDoc should have been called twice
      expect(mockSetDoc).toHaveBeenCalledTimes(2);

      // The second call carries snapshot2's data
      const [, data2] = mockSetDoc.mock.calls[1]!;
      expect(data2).toMatchObject({ lastEventId: 'evt-002' });
    });
  });

  // ---- clear() ----

  describe('clear()', () => {
    it('calls deleteDoc with the correct reference', async () => {
      await store.clear('entry-list-projection');

      expect(mockDoc).toHaveBeenCalledWith('collection-ref', 'entry-list-projection');
      expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
    });

    it('is a no-op (does not throw) when no document exists for the key', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);

      await expect(store.clear('nonexistent-key')).resolves.toBeUndefined();
    });
  });

  // ---- key independence ----

  describe('key independence', () => {
    it('uses the key as the Firestore document ID', async () => {
      await store.save('projection-a', makeSnapshot());
      await store.save('projection-b', makeSnapshot());

      const calls = mockDoc.mock.calls;
      expect(calls[0]![1]).toBe('projection-a');
      expect(calls[1]![1]).toBe('projection-b');
    });
  });

  // ---- removeUndefinedDeep ----

  describe('removeUndefinedDeep integration', () => {
    it('strips undefined values from the snapshot state before saving', async () => {
      const snapshotWithUndefined = {
        ...makeSnapshot(),
        // state contains an entry with an undefined field
        state: [{ id: 't1', type: 'task', deletedAt: undefined } as any],
      };

      await store.save('entry-list-projection', snapshotWithUndefined);

      const [, data] = mockSetDoc.mock.calls[0]!;
      // deletedAt: undefined should be stripped
      expect((data as any).state[0]).not.toHaveProperty('deletedAt');
    });
  });
});
