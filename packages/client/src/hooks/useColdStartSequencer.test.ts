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

// ── Mock habitReminderIndexWriter ─────────────────────────────────────────────
vi.mock('../firebase/habitReminderIndexWriter', () => ({
  createHabitReminderIndexWriter: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

// ── Mock taskReminderIndexWriter ──────────────────────────────────────────────
vi.mock('../firebase/taskReminderIndexWriter', () => ({
  createTaskReminderIndexWriter: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

// ── Mock bootstrapHabitReminderIndex ──────────────────────────────────────────
vi.mock('../firebase/bootstrapHabitReminderIndex', () => ({
  bootstrapHabitReminderIndex: vi.fn().mockResolvedValue(undefined),
}));

import { useColdStartSequencer } from './useColdStartSequencer';
import { SyncManager } from '../firebase/SyncManager';
import { SnapshotManager } from '../snapshot-manager';
import { FirestoreEventStore, FirestoreSnapshotStore } from '@squickr/infrastructure';
import { bootstrapHabitReminderIndex } from '../firebase/bootstrapHabitReminderIndex';
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
    const habitProjection = makeHabitProjection();
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    const { result } = renderHook(() =>
      useColdStartSequencer({
        user,
        isLoading: false,
        entryProjection,
        habitProjection,
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
    // bootstrapHabitReminderIndex must have been called with (firestore, user.uid, habitProjection)
    expect(vi.mocked(bootstrapHabitReminderIndex)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bootstrapHabitReminderIndex)).toHaveBeenCalledWith(
      expect.any(Object),
      user.uid,
      habitProjection,
    );
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
    // bootstrapHabitReminderIndex must have been called with (firestore, user.uid, habitProjection)
    expect(vi.mocked(bootstrapHabitReminderIndex)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bootstrapHabitReminderIndex)).toHaveBeenCalledWith(
      expect.any(Object),
      user.uid,
      habitProjection,
    );
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

  it('fast path: background sync error does NOT set syncError — isAppReady stays true', async () => {
    // Bug regression: on the fast path the user already has local data, so a
    // background sync timeout must never flip isAppReady back to false by
    // setting syncError. The error should be swallowed silently.
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

    // Confirm baseline: app is ready and no error
    expect(result.current.isAppReady).toBe(true);
    expect(result.current.syncError).toBeNull();

    // Simulate a background sync timeout/error on the fast path
    act(() => {
      mockOnSyncStateChange?.(false, 'Network timeout');
    });

    // syncError must remain null — the error is silent on the fast path
    expect(result.current.syncError).toBeNull();
    // isAppReady must remain true — the overlay must NOT appear
    expect(result.current.isAppReady).toBe(true);
  });

  it('fast path: clears stale syncError left from a prior slow-path cycle', async () => {
    // If a prior slow-path cycle set syncError (e.g. user signed out mid-sync
    // then signed back in with data in IndexedDB), the fast path must clear
    // any lingering syncError so isAppReady becomes true immediately.
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    let currentUser: FirebaseUser | null = user;
    const { result, rerender } = renderHook(() =>
      useColdStartSequencer({
        user: currentUser,
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

    // Simulate user signing out — resets to 'checking'
    currentUser = null;
    rerender();

    // Now sign back in — fast path should clear any stale syncError
    currentUser = user;
    rerender();

    // Fast path should reach ready with no syncError
    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));
    expect(result.current.syncError).toBeNull();
    expect(result.current.isAppReady).toBe(true);
  });

  it('slow path without snapshot: surfaces sync error via syncError state', async () => {
    // On the slow path (no local data), a sync error must still block the app
    // because the user cannot see anything without a successful sync.
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: true, isCachePopulated: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    let capturedSlowCallback: ((syncing: boolean, error?: string) => void) | undefined;
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
          capturedSlowCallback = v;
          mockOnSyncStateChange = v;
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

    await waitFor(() => {
      expect(result.current.coldStartPhase).toBe('syncing');
    }, { timeout: 3000 });

    // Simulate a sync error on the slow path — this MUST propagate
    act(() => {
      capturedSlowCallback?.(false, 'Firestore unavailable');
    });

    await waitFor(() => {
      expect(result.current.syncError).toBe('Firestore unavailable');
    });

    // On the slow path the error blocks the app (user has no local data)
    expect(result.current.isAppReady).toBe(false);
  });

  // ── dismissSyncError ─────────────────────────────────────────────────────────

  it('dismissSyncError clears syncError (slow path)', async () => {
    // dismissSyncError is used on the slow path where the overlay is shown;
    // the "Show local data" button calls dismiss to let the user through.
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: true, isCachePopulated: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    let capturedSlowCallback: ((syncing: boolean, error?: string) => void) | undefined;
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
          capturedSlowCallback = v;
          mockOnSyncStateChange = v;
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

    await waitFor(() => expect(result.current.coldStartPhase).toBe('syncing'), { timeout: 3000 });

    act(() => {
      capturedSlowCallback?.(false, 'Timeout');
    });

    await waitFor(() => expect(result.current.syncError).toBe('Timeout'));

    act(() => {
      result.current.dismissSyncError();
    });

    expect(result.current.syncError).toBeNull();
    expect(result.current.isAppReady).toBe(true);
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

  // ── onEventsUploaded wiring ───────────────────────────────────────────────────

  it('passes onEventsUploaded callback to SyncManager (fast path)', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    // Capture SyncManager constructor arguments
    let capturedArgs: ConstructorParameters<typeof SyncManager> | undefined;
    vi.mocked(SyncManager).mockImplementation((...args) => {
      capturedArgs = args as ConstructorParameters<typeof SyncManager>;
      mockManagerStart = vi.fn();
      mockManagerStop = vi.fn();
      const instance: Record<string, unknown> = {
        start: mockManagerStart,
        stop: mockManagerStop,
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v) { _cb = v; mockOnSyncStateChange = v; },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    renderHook(() =>
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

    // 5th constructor argument (index 4) should be a function (the onEventsUploaded callback)
    expect(capturedArgs).toBeDefined();
    expect(typeof capturedArgs![4]).toBe('function');
  });

  it('passes onEventsUploaded callback to SyncManager (slow path)', async () => {
    const user = makeUser();
    const entryProjection = makeEntryProjection({ wasEmpty: true, isCachePopulated: false });
    const eventStore = makeEventStore();
    const snapshotStore = makeSnapshotStore();
    const snapshotManagerRef = makeSnapshotManagerRef();

    let capturedArgs: ConstructorParameters<typeof SyncManager> | undefined;
    let localSyncStateChange: ((syncing: boolean, error?: string) => void) | undefined;
    vi.mocked(SyncManager).mockImplementation((...args) => {
      capturedArgs = args as ConstructorParameters<typeof SyncManager>;
      mockManagerStart = vi.fn();
      mockManagerStop = vi.fn();
      const instance: Record<string, unknown> = {
        start: mockManagerStart,
        stop: mockManagerStop,
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v) { _cb = v; localSyncStateChange = v; mockOnSyncStateChange = v; },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    renderHook(() =>
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

    // Wait for slow path SyncManager to be created
    await waitFor(() => expect(mockManagerStart).toHaveBeenCalledTimes(1));

    // Simulate sync completing so phase goes to 'ready'
    act(() => { localSyncStateChange?.(false, undefined); });

    expect(capturedArgs).toBeDefined();
    expect(typeof capturedArgs![4]).toBe('function');
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
          habitProjection: makeHabitProjection(),
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

// ── ?clearsnapshot URL parameter ──────────────────────────────────────────────
// CLEAR_SNAPSHOT is a module-level constant read at import time, so we must
// reset modules and re-import dynamically to simulate different URL states.

describe('useColdStartSequencer ?clearsnapshot behaviour', () => {
  // Re-usable helpers that do NOT depend on the module-level import above.

  function makeUserLocal(uid = 'user-123'): FirebaseUser {
    return { uid } as FirebaseUser;
  }

  function makeEntryProjectionLocal(opts: {
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

  function makeSnapshotStoreWithClear(): IndexedDBSnapshotStore {
    return {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
    } as unknown as IndexedDBSnapshotStore;
  }

  function makeSnapshotManagerRefLocal(
    manager: SnapshotManager | null = null,
  ): React.RefObject<SnapshotManager | null> {
    return { current: manager } as React.RefObject<SnapshotManager | null>;
  }

  // Set up fresh mocks for each isolated module load
  function setupMocks() {
    vi.mock('../firebase/config', () => ({ firestore: {} }));
    vi.mock('../firebase/SyncManager', () => ({ SyncManager: vi.fn() }));
    vi.mock('../snapshot-manager', () => ({ SnapshotManager: vi.fn() }));
    vi.mock('../utils/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.mock('../firebase/habitReminderIndexWriter', () => ({
      createHabitReminderIndexWriter: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
    }));
    vi.mock('../firebase/taskReminderIndexWriter', () => ({
      createTaskReminderIndexWriter: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
    }));
    vi.mock('../firebase/bootstrapHabitReminderIndex', () => ({
      bootstrapHabitReminderIndex: vi.fn().mockResolvedValue(undefined),
    }));
    vi.mock('@squickr/infrastructure', async (importOriginal) => {
      const original = await importOriginal<typeof import('@squickr/infrastructure')>();
      return {
        ...original,
        FirestoreEventStore: vi.fn(),
        FirestoreSnapshotStore: vi.fn(),
      };
    });
  }

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('fast path: calls snapshotStore.clear before sync when ?clearsnapshot is in the URL', async () => {
    vi.stubGlobal('location', { search: '?clearsnapshot' });
    setupMocks();
    vi.resetModules();

    const { useColdStartSequencer: hook } = await import('./useColdStartSequencer');
    const { SyncManager: MockSyncManager } = await import('../firebase/SyncManager');
    const { SnapshotManager: MockSnapshotManager } = await import('../snapshot-manager');
    const { FirestoreEventStore: MockFESClass, FirestoreSnapshotStore: MockFSSClass } =
      await import('@squickr/infrastructure');

    let localManagerStart = vi.fn();
    let localManagerStop = vi.fn();
    vi.mocked(MockSyncManager).mockImplementation(() => {
      localManagerStart = vi.fn();
      localManagerStop = vi.fn();
      const instance: Record<string, unknown> = {
        start: localManagerStart,
        stop: localManagerStop,
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v: ((syncing: boolean, error?: string) => void) | undefined) { _cb = v; },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    vi.mocked(MockSnapshotManager).mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
    } as unknown as SnapshotManager));

    vi.mocked(MockFESClass).mockImplementation(() => ({} as unknown as FirestoreEventStore));
    vi.mocked(MockFSSClass).mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(null),
    } as unknown as FirestoreSnapshotStore));

    const user = makeUserLocal();
    const entryProjection = makeEntryProjectionLocal({ wasEmpty: false });
    const eventStore = {} as IndexedDBEventStore;
    const snapshotStore = makeSnapshotStoreWithClear();
    const snapshotManagerRef = makeSnapshotManagerRefLocal();

    const { result } = renderHook(() =>
      hook({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: { hydrateFromSnapshot: vi.fn() } as unknown as HabitProjection,
        collectionProjection: { seedFromSnapshot: vi.fn() } as unknown as CollectionListProjection,
        userPreferencesProjection: { hydrateFromSnapshot: vi.fn() } as unknown as UserPreferencesProjection,
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));

    // snapshotStore.clear must have been called (cursor reset)
    expect(snapshotStore.clear).toHaveBeenCalledWith('entry-list-projection');
    // And sync must have started
    expect(localManagerStart).toHaveBeenCalledTimes(1);
    // clear must have been called BEFORE start (order matters)
    const clearOrder = vi.mocked(snapshotStore.clear).mock.invocationCallOrder[0];
    const startOrder = localManagerStart.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(startOrder);
  });

  it('fast path: does NOT call snapshotStore.clear when ?clearsnapshot is NOT in the URL', async () => {
    vi.stubGlobal('location', { search: '' });
    setupMocks();
    vi.resetModules();

    const { useColdStartSequencer: hook } = await import('./useColdStartSequencer');
    const { SyncManager: MockSyncManager } = await import('../firebase/SyncManager');
    const { SnapshotManager: MockSnapshotManager } = await import('../snapshot-manager');
    const { FirestoreEventStore: MockFESClass, FirestoreSnapshotStore: MockFSSClass } =
      await import('@squickr/infrastructure');

    let localManagerStart = vi.fn();
    vi.mocked(MockSyncManager).mockImplementation(() => {
      localManagerStart = vi.fn();
      const instance: Record<string, unknown> = {
        start: localManagerStart,
        stop: vi.fn(),
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v: ((syncing: boolean, error?: string) => void) | undefined) { _cb = v; },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    vi.mocked(MockSnapshotManager).mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
    } as unknown as SnapshotManager));

    vi.mocked(MockFESClass).mockImplementation(() => ({} as unknown as FirestoreEventStore));
    vi.mocked(MockFSSClass).mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(null),
    } as unknown as FirestoreSnapshotStore));

    const user = makeUserLocal();
    const entryProjection = makeEntryProjectionLocal({ wasEmpty: false });
    const eventStore = {} as IndexedDBEventStore;
    const snapshotStore = makeSnapshotStoreWithClear();
    const snapshotManagerRef = makeSnapshotManagerRefLocal();

    const { result } = renderHook(() =>
      hook({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: { hydrateFromSnapshot: vi.fn() } as unknown as HabitProjection,
        collectionProjection: { seedFromSnapshot: vi.fn() } as unknown as CollectionListProjection,
        userPreferencesProjection: { hydrateFromSnapshot: vi.fn() } as unknown as UserPreferencesProjection,
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));

    // snapshotStore.clear must NOT have been called
    expect(snapshotStore.clear).not.toHaveBeenCalled();
    expect(localManagerStart).toHaveBeenCalledTimes(1);
  });

  it('slow path: does NOT call snapshotStore.clear even when ?clearsnapshot is in the URL', async () => {
    vi.stubGlobal('location', { search: '?clearsnapshot' });
    setupMocks();
    vi.resetModules();

    const { useColdStartSequencer: hook } = await import('./useColdStartSequencer');
    const { SyncManager: MockSyncManager } = await import('../firebase/SyncManager');
    const { SnapshotManager: MockSnapshotManager } = await import('../snapshot-manager');
    const { FirestoreEventStore: MockFESClass, FirestoreSnapshotStore: MockFSSClass } =
      await import('@squickr/infrastructure');

    let localManagerStart = vi.fn();
    let localSyncStateChange: ((syncing: boolean, error?: string) => void) | undefined;
    vi.mocked(MockSyncManager).mockImplementation(() => {
      localManagerStart = vi.fn();
      const instance: Record<string, unknown> = {
        start: localManagerStart,
        stop: vi.fn(),
      };
      let _cb: ((syncing: boolean, error?: string) => void) | undefined;
      Object.defineProperty(instance, 'onSyncStateChange', {
        get() { return _cb; },
        set(v: ((syncing: boolean, error?: string) => void) | undefined) {
          _cb = v;
          localSyncStateChange = v;
        },
        configurable: true,
      });
      return instance as unknown as SyncManager;
    });

    vi.mocked(MockSnapshotManager).mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
    } as unknown as SnapshotManager));

    vi.mocked(MockFESClass).mockImplementation(() => ({} as unknown as FirestoreEventStore));
    vi.mocked(MockFSSClass).mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(null), // no remote snapshot → slow path without snapshot
    } as unknown as FirestoreSnapshotStore));

    const user = makeUserLocal();
    // wasEmpty: true → slow path
    const entryProjection = makeEntryProjectionLocal({ wasEmpty: true, isCachePopulated: false });
    const eventStore = {} as IndexedDBEventStore;
    const snapshotStore = makeSnapshotStoreWithClear();
    const snapshotManagerRef = makeSnapshotManagerRefLocal();

    const { result } = renderHook(() =>
      hook({
        user,
        isLoading: false,
        entryProjection,
        habitProjection: { hydrateFromSnapshot: vi.fn() } as unknown as HabitProjection,
        collectionProjection: { seedFromSnapshot: vi.fn() } as unknown as CollectionListProjection,
        userPreferencesProjection: { hydrateFromSnapshot: vi.fn() } as unknown as UserPreferencesProjection,
        eventStore,
        snapshotStore,
        snapshotManagerRef,
      })
    );

    // Slow path enters 'syncing' before SyncManager calls back
    await waitFor(() => expect(result.current.coldStartPhase).toBe('syncing'), { timeout: 3000 });

    // snapshotStore.clear must NOT have been called on slow path
    expect(snapshotStore.clear).not.toHaveBeenCalled();

    // Complete the sync so the hook reaches 'ready' (clean teardown)
    act(() => { localSyncStateChange?.(false, undefined); });
    await waitFor(() => expect(result.current.coldStartPhase).toBe('ready'));
  });
});
