/**
 * useColdStartSequencer Hook Tests
 *
 * Verifies the cold-start sequencer state machine:
 * - Fast path: local store is non-empty → skip remote restore, go to ready
 * - Slow path with snapshot: remote snapshot found → seed stores, ready
 * - Slow path without snapshot: no remote snapshot → syncing → ready on sync complete
 * - Idle when user is null or isLoading is true
 * - dismissSyncError clears syncError
 * - SyncManager.stop() is called on unmount (cleanup)
 *
 * IMPORTANT: All params passed to useColdStartSequencer that appear in its
 * useEffect dependency array (user, eventStore, snapshotStore, entryProjection)
 * must be created OUTSIDE the renderHook callback — otherwise each re-render
 * creates new object references, triggering unwanted effect re-runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';

// ── Mock firebase/config ──────────────────────────────────────────────────────
vi.mock('../firebase/config', () => ({
  firestore: {},
}));

// ── Mock SyncManager ──────────────────────────────────────────────────────────
vi.mock('../firebase/SyncManager', () => ({
  SyncManager: vi.fn(),
}));

// ── Mock SnapshotManager ──────────────────────────────────────────────────────
vi.mock('../snapshot-manager', () => ({
  SnapshotManager: vi.fn(),
}));

// ── Mock FirestoreEventStore and FirestoreSnapshotStore ───────────────────────
let mockRemoteSnapshotLoad: ReturnType<typeof vi.fn>;

vi.mock('@squickr/infrastructure', async (importOriginal) => {
  const original = await importOriginal<typeof import('@squickr/infrastructure')>();
  return {
    ...original,
    FirestoreEventStore: vi.fn(),
    FirestoreSnapshotStore: vi.fn(),
  };
});

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useColdStartSequencer } from './useColdStartSequencer';
import { SyncManager } from '../firebase/SyncManager';
import { SnapshotManager } from '../snapshot-manager';
import { FirestoreEventStore, FirestoreSnapshotStore } from '@squickr/infrastructure';
import type { EntryListProjection, HabitProjection, CollectionListProjection, UserPreferencesProjection } from '@squickr/domain';
import type { IndexedDBEventStore, IndexedDBSnapshotStore } from '@squickr/infrastructure';
import type React from 'react';

// ── Shared mock tracking ──────────────────────────────────────────────────────
let mockManagerStart: ReturnType<typeof vi.fn>;
let mockManagerStop: ReturnType<typeof vi.fn>;
// Callback set on SyncManager instance — used by fast-path tests
let mockOnSyncStateChange: ((syncing: boolean, error?: string) => void) | undefined;

function restoreSyncManagerMock() {
  vi.mocked(SyncManager).mockImplementation(() => {
    mockManagerStart = vi.fn();
    mockManagerStop = vi.fn();
    const instance: Record<string, unknown> = {
      start: mockManagerStart,
      stop: mockManagerStop,
    };
    let _cb: ((syncing: boolean, error?: string) => void) | undefined;
    Object.defineProperty(instance, 'onSyncStateChange', {
      get() { return _cb; },
      set(v: ((syncing: boolean, error?: string) => void) | undefined) {
        _cb = v;
        mockOnSyncStateChange = v;
      },
      configurable: true,
    });
    return instance as unknown as SyncManager;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(uid = 'user-123'): FirebaseUser {
  return { uid } as FirebaseUser;
}

function makeEntryProjection(opts: {
  wasEmpty?: boolean;
  isCachePopulated?: boolean;
} = {}): EntryListProjection {
  return {
    wasLocalStoreEmptyAtHydration: vi.fn().mockReturnValue(opts.wasEmpty ?? false),
    isCachePopulated: vi.fn().mockReturnValue(opts.isCachePopulated ?? true),
    getLastSnapshotCursor: vi.fn().mockReturnValue(null),
    hydrate: vi.fn().mockResolvedValue(undefined),
  } as unknown as EntryListProjection;
}

function makeHabitProjection(): HabitProjection {
  return {
    hydrateFromSnapshot: vi.fn(),
  } as unknown as HabitProjection;
}

function makeCollectionProjection(): CollectionListProjection {
  return {
    seedFromSnapshot: vi.fn(),
  } as unknown as CollectionListProjection;
}

function makeUserPreferencesProjection(): UserPreferencesProjection {
  return {
    hydrateFromSnapshot: vi.fn(),
  } as unknown as UserPreferencesProjection;
}

function makeEventStore(): IndexedDBEventStore {
  return {} as IndexedDBEventStore;
}

function makeSnapshotStore(): IndexedDBSnapshotStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
  } as unknown as IndexedDBSnapshotStore;
}

function makeSnapshotManagerRef(
  manager: SnapshotManager | null = null,
): React.RefObject<SnapshotManager | null> {
  return { current: manager } as React.RefObject<SnapshotManager | null>;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSyncStateChange = undefined;
  mockRemoteSnapshotLoad = vi.fn().mockResolvedValue(null);
  sessionStorage.clear();

  restoreSyncManagerMock();

  vi.mocked(SnapshotManager).mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
  } as unknown as SnapshotManager));

  vi.mocked(FirestoreEventStore).mockImplementation(() => ({} as unknown as FirestoreEventStore));
  vi.mocked(FirestoreSnapshotStore).mockImplementation(() => ({
    load: (...args: unknown[]) => mockRemoteSnapshotLoad(...args),
  } as unknown as FirestoreSnapshotStore));
});

afterEach(() => {
  sessionStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useColdStartSequencer', () => {
  // ── Idle states ─────────────────────────────────────────────────────────────

  it('is idle when user is null', () => {
    const entryProjection = makeEntryProjection();
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user: null,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    expect(result.current.coldStartPhase).toBe('checking');
    expect(result.current.isAppReady).toBe(false);
    expect(vi.mocked(SyncManager)).not.toHaveBeenCalled();
  });

  it('is idle when isLoading is true', () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection();
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: true,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    expect(result.current.coldStartPhase).toBe('checking');
    expect(result.current.isAppReady).toBe(false);
    expect(vi.mocked(SyncManager)).not.toHaveBeenCalled();
  });

  // ── Fast path ───────────────────────────────────────────────────────────────

  it('fast path: goes directly to ready when local store is non-empty', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('ready');
    });

    expect(result.current.isAppReady).toBe(true);
    expect(result.current.syncError).toBeNull();
    // Remote snapshot should NOT have been fetched
    expect(mockRemoteSnapshotLoad).not.toHaveBeenCalled();
    // SyncManager should have been started
    expect(mockManagerStart).toHaveBeenCalledTimes(1);
  });

  // ── Slow path with snapshot ──────────────────────────────────────────────────

  it('slow path with snapshot: seeds local stores and goes to ready', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: true, isCachePopulated: true });
    const habitProjection = makeHabitProjection();
    const collectionProjection = makeCollectionProjection();
    const userPreferencesProjection = makeUserPreferencesProjection();
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const remoteSnapshot = {
      savedAt: '2026-01-01T00:00:00.000Z',
      lastEventId: 'evt-999',
      collections: [{ id: 'col-1', name: 'Today' }],
      userPreferences: { theme: 'dark' },
    };

    mockRemoteSnapshotLoad = vi.fn().mockResolvedValue(remoteSnapshot);
    vi.mocked(FirestoreSnapshotStore).mockImplementation(() => ({
      load: (...args: unknown[]) => mockRemoteSnapshotLoad(...args),
    } as unknown as FirestoreSnapshotStore));

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection,
        collectionProjection,
        userPreferencesProjection,
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('ready');
    }, { timeout: 3000 });

    expect(result.current.isAppReady).toBe(true);
    expect(snapshotStore.save).toHaveBeenCalledWith('entry-list-projection', remoteSnapshot);
    expect(collectionProjection.seedFromSnapshot).toHaveBeenCalledWith(remoteSnapshot.collections);
    expect(userPreferencesProjection.hydrateFromSnapshot).toHaveBeenCalledWith(
      remoteSnapshot.userPreferences,
    );
    expect(mockManagerStart).toHaveBeenCalledTimes(1);
  });

  // ── Slow path without snapshot ───────────────────────────────────────────────

  it('slow path without snapshot: enters syncing phase then goes to ready when sync completes', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: true, isCachePopulated: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    // Capture the onSyncStateChange callback from the SyncManager instance
    let capturedCallback: ((syncing: boolean, error?: string) => void) | undefined;
    vi.mocked(SyncManager).mockImplementation(() => {
      mockManagerStart = vi.fn();
      mockManagerStop = vi.fn();
      const instance: Record<string, unknown> = {
        start: mockManagerStart,
        stop: mockManagerStop,
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v: ((syncing: boolean, error?: string) => void) | undefined) {
          _cb = v;
          capturedCallback = v;
        },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    // Should enter 'syncing' phase after async Promise.race resolves with null
    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('syncing');
    }, { timeout: 3000 });

    expect(result.current.isAppReady).toBe(false);
    expect(capturedCallback).toBeDefined();

    // Simulate initial sync completing
    act(() => {
      capturedCallback!(false, undefined);
    });

    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('ready');
    });

    expect(result.current.isAppReady).toBe(true);
  });

  // ── Sync error ───────────────────────────────────────────────────────────────

  it('fast path: surfaces sync error via syncError state', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('ready');
    });

    act(() => {
      mockOnSyncStateChange?.(false, 'Network error');
    });

    await waitFor(() => {
      expect(result.current.syncError).toBe('Network error');
    });

    // isAppReady should be false while syncError is set
    expect(result.current.isAppReady).toBe(false);
  });

  // ── dismissSyncError ─────────────────────────────────────────────────────────

  it('dismissSyncError clears syncError', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));

    act(() => {
      mockOnSyncStateChange?.(false, 'Timeout');
    });

    await waitFor(() => expect(result.current.syncError).toBe('Timeout'));

    act(() => {
      result.current.dismissSyncError();
    });

    expect(result.current.syncError).toBeNull();
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  it('stops SyncManager on unmount', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { unmount } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: makeHabitProjection(),
        collectionProjection: makeCollectionProjection(),
        userPreferencesProjection: makeUserPreferencesProjection(),
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => expect(mockManagerStart).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockManagerStop).toHaveBeenCalledTimes(1);
  });

  // ── User signs out then back in ───────────────────────────────────────────────

  it('resets to checking when user changes from non-null to null', async () => {
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();

    const { result, rerender } = renderHook(
      ({ user }: { user: FirebaseUser | null }) =>
        useColdStartSequencer({
          user,
          isLoading: false,
          entryProjection,
          collectionProjection: makeCollectionProjection(),
          userPreferencesProjection: makeUserPreferencesProjection(),
          eventStore,
          snapshotStore,
          snapshotManagerRef: makeSnapshotManagerRef(),
        }),
      { initialProps: { user: makeUser() } },
    );

    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));

    rerender({ user: null });

    expect(mockManagerStop).toHaveBeenCalled();
  });
});
