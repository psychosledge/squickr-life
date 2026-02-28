import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import type { IndexedDBEventStore } from '@squickr/infrastructure';
import { onAuthStateChanged } from 'firebase/auth';

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
  
  return {
    ...actual,
    IndexedDBEventStore: MockIndexedDBEventStore,
    IndexedDBSnapshotStore: MockIndexedDBSnapshotStore,
    FirestoreSnapshotStore: MockFirestoreSnapshotStore,
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

    // Sync overlay should NOT be visible (we restored from remote, skipping it)
    expect(screen.queryByTestId('sync-overlay')).not.toBeInTheDocument();
  });

});
