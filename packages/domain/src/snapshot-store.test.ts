import { describe, it, expect } from 'vitest';
import { SNAPSHOT_SCHEMA_VERSION } from './snapshot-store';
import type { ISnapshotStore, ProjectionSnapshot } from './snapshot-store';

// ---------------------------------------------------------------------------
// SNAPSHOT_SCHEMA_VERSION
// ---------------------------------------------------------------------------

describe('SNAPSHOT_SCHEMA_VERSION', () => {
  it('is a number', () => {
    expect(typeof SNAPSHOT_SCHEMA_VERSION).toBe('number');
  });

  it('equals 1', () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ProjectionSnapshot interface
//
// There is no runtime logic to test — these tests confirm that the TypeScript
// type compiles correctly and that a correctly-shaped object satisfies the
// interface at the type level.
// ---------------------------------------------------------------------------

describe('ProjectionSnapshot interface', () => {
  it('accepts an object with all required fields', () => {
    // Arrange — construct a minimal valid snapshot
    const snapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-001',
      state: [],
      savedAt: new Date().toISOString(),
    };

    // Assert — structural checks (guards against accidental field renames)
    expect(snapshot.version).toBe(1);
    expect(snapshot.lastEventId).toBe('evt-001');
    expect(Array.isArray(snapshot.state)).toBe(true);
    expect(typeof snapshot.savedAt).toBe('string');
  });

  it('carries non-empty state when entries are present', () => {
    // Arrange — a snapshot with a single task entry to verify state typing
    const taskEntry = {
      type: 'task' as const,
      id: 'task-001',
      title: 'Write snapshot tests',
      status: 'open' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      collections: [],
    };

    const snapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-042',
      state: [taskEntry],
      savedAt: '2026-01-01T00:01:00.000Z',
    };

    // Assert
    expect(snapshot.state).toHaveLength(1);
    expect(snapshot.state.at(0)?.id).toBe('task-001');
  });
});

// ---------------------------------------------------------------------------
// ISnapshotStore interface
//
// The interface itself has no runtime behaviour to test.  We verify it is
// structurally usable by constructing a minimal in-memory implementation and
// exercising all three methods.
// ---------------------------------------------------------------------------

describe('ISnapshotStore interface', () => {
  /** Minimal in-memory implementation used only within this test file. */
  class InMemorySnapshotStore implements ISnapshotStore {
    private readonly store = new Map<string, ProjectionSnapshot>();

    async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
      this.store.set(key, snapshot);
    }

    async load(key: string): Promise<ProjectionSnapshot | null> {
      return this.store.get(key) ?? null;
    }

    async clear(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  it('save persists a snapshot that load can retrieve', async () => {
    const store: ISnapshotStore = new InMemorySnapshotStore();
    const snapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-100',
      state: [],
      savedAt: '2026-02-28T00:00:00.000Z',
    };

    await store.save('entry-list', snapshot);
    const loaded = await store.load('entry-list');

    expect(loaded).toEqual(snapshot);
  });

  it('load returns null when no snapshot has been saved', async () => {
    const store: ISnapshotStore = new InMemorySnapshotStore();

    const result = await store.load('entry-list');

    expect(result).toBeNull();
  });

  it('clear removes a previously saved snapshot', async () => {
    const store: ISnapshotStore = new InMemorySnapshotStore();
    const snapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-200',
      state: [],
      savedAt: '2026-02-28T00:00:00.000Z',
    };
    await store.save('entry-list', snapshot);

    await store.clear('entry-list');
    const result = await store.load('entry-list');

    expect(result).toBeNull();
  });

  it('clear is a no-op when no snapshot exists for the key', async () => {
    const store: ISnapshotStore = new InMemorySnapshotStore();

    // Should not throw
    await expect(store.clear('nonexistent-key')).resolves.toBeUndefined();
  });

  it('save overwrites a previously saved snapshot for the same key', async () => {
    // Arrange
    const store: ISnapshotStore = new InMemorySnapshotStore();
    const snapshot1: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-001',
      state: [],
      savedAt: '2026-02-28T00:00:00.000Z',
    };
    const snapshot2: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-002',
      state: [],
      savedAt: '2026-02-28T00:01:00.000Z',
    };

    // Act
    await store.save('entry-list', snapshot1);
    await store.save('entry-list', snapshot2);
    const loaded = await store.load('entry-list');

    // Assert
    expect(loaded).toEqual(snapshot2);
  });

  it('keys are independent — saving under one key does not affect another', async () => {
    // Arrange
    const store: ISnapshotStore = new InMemorySnapshotStore();
    const snapshotA: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-a',
      state: [],
      savedAt: '2026-02-28T00:00:00.000Z',
    };
    const snapshotB: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-b',
      state: [],
      savedAt: '2026-02-28T00:01:00.000Z',
    };

    // Act
    await store.save('projection-a', snapshotA);
    await store.save('projection-b', snapshotB);

    // Assert
    expect(await store.load('projection-a')).toEqual(snapshotA);
    expect(await store.load('projection-b')).toEqual(snapshotB);
  });
});
