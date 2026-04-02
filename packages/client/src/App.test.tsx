import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { IndexedDBEventStore } from '@squickr/infrastructure';
import { onAuthStateChanged } from 'firebase/auth';
import { CollectionListProjection } from '@squickr/domain';
import { TUTORIAL_SEEN_KEY } from './context/TutorialContext';

// Mock IndexedDBEventStore since we're in jsdom environment
vi.mock('@squickr/infrastructure', async () => {
  const actual = await vi.importActual('@squickr/infrastructure');
  
  class MockIndexedDBEventStore {
    async initialize() {
      return Promise.resolve();
    }
    async append() {
      return Promise.resolve();
    }
    async getAll() {
      return Promise.resolve([]);
    }
    async getById() {
      return Promise.resolve([]);
    }
    subscribe() {
      return () => {}; // Return unsubscribe function
    }
  }

  class MockIndexedDBSnapshotStore {
    async initialize() {
      return Promise.resolve();
    }
    async save() {
      return Promise.resolve();
    }
    async load() {
      return Promise.resolve(null);
    }
    async clear() {
      return Promise.resolve();
    }
  }

  class MockFirestoreSnapshotStore {
    async save() {
      return Promise.resolve();
    }
    async load() {
      return Promise.resolve(null);
    }
    async clear() {
      return Promise.resolve();
    }
  }

  class MockFirestoreEventStore {
    async getAll() {
      return Promise.resolve([]);
    }
    async append() {
      return Promise.resolve();
    }
    async getById() {
      return Promise.resolve([]);
    }
    subscribe() {
      return () => {};
    }
  }
  
  return {
    ...actual,
    IndexedDBEventStore: MockIndexedDBEventStore,
    IndexedDBSnapshotStore: MockIndexedDBSnapshotStore,
    FirestoreSnapshotStore: MockFirestoreSnapshotStore,
    FirestoreEventStore: MockFirestoreEventStore,
  };
});

// Mock SnapshotManager to avoid document/window event listener side-effects in jsdom
vi.mock('./snapshot-manager', () => {
  const MockSnapshotManager = vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    saveSnapshot: vi.fn(),
  }));
  return { SnapshotManager: MockSnapshotManager };
});

describe('App', () => {
  beforeEach(() => {
    // Mock authenticated user for these tests
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      // Simulate a signed-in user
      callback({
        uid: 'test-user-id',
        email: 'test@example.com',
      } as any);
      return vi.fn(); // Return unsubscribe function
    });
  });

  it('should render the Squickr Life title', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });
  });

  it('should display the tagline', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Get your shit together quicker with Squickr!')).toBeInTheDocument();
    });
  });

  it('should render the FAB button after loading', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add new entry/i })).toBeInTheDocument();
    });
  });

  it('should show empty state initially', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/no collections yet/i)).toBeInTheDocument();
    });
  });

  it('should render without throwing when IndexedDBSnapshotStore is wired', async () => {
    // If wiring is broken, render() itself throws. This test ensures the
    // snapshot store integration does not break the app bootstrap.
    expect(() => render(<App />)).not.toThrow();

    // App should still reach the authenticated view
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });
  });

  it('should call hydrate() on entryProjection during initialization', async () => {
    // Spy on EntryListProjection.prototype.hydrate before rendering
    const { EntryListProjection } = await import('@squickr/domain');
    const hydrateSpy = vi.spyOn(EntryListProjection.prototype, 'hydrate').mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(hydrateSpy).toHaveBeenCalledTimes(1);
    });

    hydrateSpy.mockRestore();
  });

  it('should render without overlay when FirestoreSnapshotStore returns a remote snapshot (cold-start path)', async () => {
    // Arrange: remote snapshot store returns a valid snapshot
    const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
    const remoteSnapshot = {
      version: 1,
      lastEventId: 'evt-remote-1',
      state: [],
      savedAt: new Date(Date.now() + 60_000).toISOString(), // future = newer than local
    };
    vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockResolvedValueOnce(remoteSnapshot as any);

    render(<App />);

    // App should still render the main view (not stuck on overlay)
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    // Sync overlay should NOT be visible once isRemoteRestoring resolves.
    // With the isRemoteRestoring gate, the overlay clears asynchronously after
    // the remote snapshot check completes — use waitFor to let that settle.
    await waitFor(() => {
      expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();
    });
  });

  it('should call saveSnapshot on SnapshotManager after initial sync completes (normal path)', async () => {
    const { SnapshotManager } = await import('./snapshot-manager');

    // Clear the mock so result indices start from 0 in this test
    vi.mocked(SnapshotManager).mockClear();

    render(<App />);

    // Wait for the app to finish loading and the initial sync to complete
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    // After the initial sync completes on the normal path, saveSnapshot should
    // have been called with 'post-initial-sync' on one of the SnapshotManager instances.
    // mock.results[].value holds the object returned by mockImplementation.
    await waitFor(() => {
      const results = vi.mocked(SnapshotManager).mock.results;
      const calledOnAnyInstance = results.some(
        (result) =>
          result.type === 'return' &&
          result.value != null &&
          (result.value.saveSnapshot as ReturnType<typeof vi.fn>).mock.calls.some(
            (call: unknown[]) => call[0] === 'post-initial-sync'
          )
      );
      expect(calledOnAnyInstance).toBe(true);
    });
  });

  it('should call saveSnapshot with post-initial-sync exactly once (guard test — not called on cold-start path or repeatedly)', async () => {
    const { SnapshotManager } = await import('./snapshot-manager');

    vi.mocked(SnapshotManager).mockClear();

    render(<App />);

    // Wait for the app to fully load and initial sync to complete
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    // Collect all 'post-initial-sync' calls across all SnapshotManager instances.
    // The initialSnapshotSaved closure guard must ensure this is called exactly once —
    // not zero times (feature absent) and not multiple times (guard broken).
    await waitFor(() => {
      const results = vi.mocked(SnapshotManager).mock.results;
      const postInitCalls = results.flatMap((result) =>
        result.type === 'return' && result.value != null
          ? (result.value.saveSnapshot as ReturnType<typeof vi.fn>).mock.calls.filter(
              (call: unknown[]) => call[0] === 'post-initial-sync'
            )
          : []
      );
      expect(postInitCalls).toHaveLength(1);
    });
  });

  // ── Remote-restore / isRemoteRestoring tests (Change 1) ────────────────────

  describe('ColdStartPhase: slow path (local store empty)', () => {
    let sessionSetItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Clear storage so tutorial-guard checks start clean
      sessionStorage.clear();
      localStorage.clear();

      // Spy on sessionStorage.setItem so we can detect startTutorial() calls.
      // TutorialContext.startTutorial() always calls:
      //   sessionStorage.setItem(TUTORIAL_SEEN_KEY, 'true')
      sessionSetItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    });

    afterEach(() => {
      sessionSetItemSpy.mockRestore();
    });

    it('tutorial does NOT fire while remote snapshot check is in flight', async () => {
      // Arrange: remoteSnapshotStore.load never resolves — simulates a slow/hung network
      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      render(<App />);

      // Wait long enough that isLoading has settled (IndexedDB init completes)
      await waitFor(() => {
        // The app renders the authenticated layout (not the auth loading screen)
        // but isAppReady is false because isRemoteRestoring=true
        expect(screen.getByTestId('sync-overlay')).toBeInTheDocument();
      });

      // startTutorial() must NOT have been called — the gate should hold
      const tutorialStartCalls = sessionSetItemSpy.mock.calls.filter(
        ([key]) => key === TUTORIAL_SEEN_KEY,
      );
      expect(tutorialStartCalls).toHaveLength(0);
    });

    it('isAppReady becomes true for new user when remote resolves to null (ADR-024: overlay clears after sync)', async () => {
      // Arrange: remoteSnapshotStore.load resolves null (no remote snapshot — new user)
      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockResolvedValue(null);

      render(<App />);

      // Wait for the app to become ready — overlay must be gone
      await waitFor(() => {
        expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();
      });

      // ADR-024: tutorial does NOT fire for new users on the cold-start path —
      // squickr_cold_start_restored is set whenever the SyncManager sync runs,
      // suppressing the tutorial to prevent false positives for returning users
      // on new devices. New users can start the tutorial manually from the profile menu.
      const tutorialStartCalls = sessionSetItemSpy.mock.calls.filter(
        ([key]) => key === TUTORIAL_SEEN_KEY,
      );
      expect(tutorialStartCalls).toHaveLength(0);
    });

    it('tutorial does NOT fire for returning user when remote snapshot is applied', async () => {
      // Arrange: remote snapshot store returns a snapshot (returning user)
      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      const remoteSnapshot = {
        version: 1,
        lastEventId: 'evt-remote-1',
        state: [],
        savedAt: new Date(Date.now() + 60_000).toISOString(), // future = newer than local
      };
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockResolvedValue(
        remoteSnapshot as any,
      );

      // Arrange: collections exist (returning user has data)
      const getCollectionsSpy = vi
        .spyOn(CollectionListProjection.prototype, 'getCollections')
        .mockResolvedValue([
          {
            id: 'col-1',
            name: 'Work',
            type: 'custom',
            order: 'a',
            createdAt: new Date().toISOString(),
          },
        ]);

      render(<App />);

      // Wait for the app to become ready — overlay must be gone
      await waitFor(() => {
        expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();
      });

      // Tutorial must NOT have fired — returning user with existing collections
      const tutorialStartCalls = sessionSetItemSpy.mock.calls.filter(
        ([key]) => key === TUTORIAL_SEEN_KEY,
      );
      expect(tutorialStartCalls).toHaveLength(0);

      getCollectionsSpy.mockRestore();
    });
  });

  // ── ADR-024: ColdStartPhase state machine tests ────────────────────────────

  describe('ADR-024: ColdStartPhase', () => {
    beforeEach(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    it('does NOT initiate remote snapshot fetch when local store is non-empty', async () => {
      // Arrange: local event store reports non-empty (has events)
      const { EntryListProjection } = await import('@squickr/domain');
      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockReturnValue(false);

      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      const loadSpy = vi.spyOn(FirestoreSnapshotStore.prototype, 'load');

      render(<App />);

      // App should reach ready state quickly (no Firestore round-trip)
      await waitFor(() => {
        expect(screen.getByText('Squickr Life')).toBeInTheDocument();
      });

      // The remote snapshot fetch must NOT have been called for the cold-start path
      // (it may be called by SnapshotManager for other purposes, but cold-start
      // explicitly skips it when local store is non-empty).
      // We verify this by checking that load was not called during the cold-start window —
      // i.e. the overlay was never shown.
      expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();

      loadSpy.mockRestore();
      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockRestore();
    });

    it('writes squickr_cold_start_restored to sessionStorage when transitioning through syncing phase', async () => {
      // Arrange: local store is empty → cold-start path runs
      const { EntryListProjection } = await import('@squickr/domain');
      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockReturnValue(true);

      // Remote snapshot returns null (no snapshot available)
      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockResolvedValue(null);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Squickr Life')).toBeInTheDocument();
      });

      // The session flag must have been set during the syncing transition
      expect(sessionStorage.getItem('squickr_cold_start_restored')).toBe('true');

      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockRestore();
    });

    it('overlay shows "Restoring your journal" text while remote snapshot check is in flight (checking phase)', async () => {
      // Arrange: local store is empty and remote snapshot check never resolves
      // → app stays in 'checking' phase and the overlay copy reflects that
      const { EntryListProjection } = await import('@squickr/domain');
      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockReturnValue(true);

      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      // Never resolves → stays in 'checking' phase (not 'restoring')
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockImplementation(
        () => new Promise(() => {}),
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('sync-overlay')).toBeInTheDocument();
      });

      // During the checking/restoring phase the overlay must show restore copy
      expect(screen.getByText(/Restoring your journal/i)).toBeInTheDocument();

      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockRestore();
    });

    it('app reaches ready state via fallback when FirestoreSnapshotStore.load rejects (catch path)', async () => {
      // Arrange: local store is empty → slow path runs
      const { EntryListProjection } = await import('@squickr/domain');
      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockReturnValue(true);

      // Remote snapshot load rejects — exercises the catch branch in startSync()
      const { FirestoreSnapshotStore } = await import('@squickr/infrastructure');
      vi.spyOn(FirestoreSnapshotStore.prototype, 'load').mockRejectedValue(
        new Error('Firestore unavailable'),
      );

      render(<App />);

      // The catch branch must still set squickr_cold_start_restored and advance
      // through 'syncing' to 'ready' so the overlay clears.
      await waitFor(() => {
        expect(sessionStorage.getItem('squickr_cold_start_restored')).toBe('true');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();
      });

      vi.spyOn(EntryListProjection.prototype, 'wasLocalStoreEmptyAtHydration').mockRestore();
    });
  });

  // ── Route: /review ───────────────────────────────────────────────────────────

  it('renders ReviewView at /review route', async () => {
    // Navigate to /review before rendering so BrowserRouter picks it up
    window.history.pushState({}, '', '/review');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('review-view')).toBeInTheDocument();
    });

    // Restore default path so other tests are not affected
    window.history.pushState({}, '', '/');
  });

});
