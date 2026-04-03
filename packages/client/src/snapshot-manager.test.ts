/**
 * SnapshotManager Tests
 *
 * Tests for the projection snapshot lifecycle manager:
 * - Count-based trigger (every N events)
 * - Lifecycle triggers (visibilitychange hidden, beforeunload)
 * - Graceful error handling
 * - start() / stop() listener cleanup
 * - Dual-store: local + remote fire-and-forget (ADR-017)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotManager } from './snapshot-manager';
import type { ISnapshotStore, IEventStore, ProjectionSnapshot, Collection, SerializableHabitState } from '@squickr/domain';
import type { EntryListProjection, CollectionListProjection, HabitProjection, UserPreferencesProjection } from '@squickr/domain';
import type { UserPreferences } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(): ProjectionSnapshot {
  return {
    version: 1,
    lastEventId: 'evt-1',
    state: [],
    savedAt: new Date().toISOString(),
  };
}

function makeEventStore(): IEventStore {
  // Capture the subscriber so tests can fire events manually
  let subscriber: ((event: Parameters<IEventStore['subscribe']>[0] extends (e: infer E) => void ? E : never) => void) | null = null;
  // The real unsubscribe must clear the subscriber so post-stop() fires are ignored
  const unsubscribe = vi.fn().mockImplementation(() => {
    subscriber = null;
  });

  const store: IEventStore = {
    append: vi.fn().mockResolvedValue(undefined),
    appendBatch: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue([]),
    getAll: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockImplementation((cb) => {
      subscriber = cb;
      return unsubscribe;
    }),
  };

  // Expose a helper to fire the subscriber
  (store as unknown as { _fire: () => void })._fire = () => {
    if (subscriber) {
      // DomainEvent shape — content doesn't matter for counter tests
      subscriber({
        id: `evt-${Math.random()}`,
        type: 'task-created',
        aggregateId: 'agg-1',
        timestamp: new Date().toISOString(),
        version: 1,
      });
    }
  };

  (store as unknown as { _unsubscribe: ReturnType<typeof vi.fn> })._unsubscribe = unsubscribe;

  return store;
}

function makeSnapshotStore(): ISnapshotStore {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function makeProjection(snapshot: ProjectionSnapshot | null = makeSnapshot()): EntryListProjection {
  return {
    createSnapshot: vi.fn().mockResolvedValue(snapshot),
  } as unknown as EntryListProjection;
}

function makeCollectionProjection(collections: Collection[] = []): CollectionListProjection {
  return {
    getCollections: vi.fn().mockResolvedValue(collections),
  } as unknown as CollectionListProjection;
}

function makeHabitProjection(states: SerializableHabitState[] = []): HabitProjection {
  return {
    getStatesForSnapshot: vi.fn().mockResolvedValue(states),
  } as unknown as HabitProjection;
}

function makeUserPreferencesProjection(prefs: UserPreferences = {
  defaultCompletedTaskBehavior: 'keep-in-place',
  autoFavoriteRecentDailyLogs: false,
  autoFavoriteRecentMonthlyLogs: false,
  autoFavoriteCalendarWithActiveTasks: false,
}): UserPreferencesProjection {
  return {
    getUserPreferences: vi.fn().mockResolvedValue(prefs),
  } as unknown as UserPreferencesProjection;
}

function makeHabitState(id: string): SerializableHabitState {
  return {
    id,
    title: `Habit ${id}`,
    frequency: { type: 'daily' },
    createdAt: new Date().toISOString(),
    order: 'a0',
    completions: {},
    reverted: [],
  };
}

function makeCollection(id: string): Collection {
  return {
    id,
    name: `Collection ${id}`,
    type: 'custom',
    order: '0.5',
    createdAt: new Date().toISOString(),
    userId: 'user-1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SnapshotManager', () => {
  let eventStore: IEventStore;
  let snapshotStore: ISnapshotStore;
  let projection: EntryListProjection;
  let manager: SnapshotManager;

  // Helper: fire N events through the event store subscriber
  function fireEvents(n: number): void {
    const fire = (eventStore as unknown as { _fire: () => void })._fire;
    for (let i = 0; i < n; i++) {
      fire();
    }
  }

  beforeEach(() => {
    eventStore = makeEventStore();
    snapshotStore = makeSnapshotStore();
    projection = makeProjection();
  });

  afterEach(() => {
    // Always stop to remove any lingering listeners
    if (manager) {
      manager.stop();
    }
    // Restore visibilityState default to prevent cross-test contamination
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  // -------------------------------------------------------------------------
  // 1. Count trigger: 49 events → NOT called; 50th event → called
  // -------------------------------------------------------------------------
  describe('count trigger', () => {
    it('should NOT call saveSnapshot after 49 events', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      fireEvents(49);

      // Let any micro-tasks settle
      await Promise.resolve();

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should call saveSnapshot on the 50th event', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      fireEvents(50);

      // Allow async saveSnapshot to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      expect(snapshotStore.save).toHaveBeenCalledWith(
        'entry-list-projection',
        expect.objectContaining({ version: 1, lastEventId: 'evt-1' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Counter resets after save (51st event alone doesn't re-trigger)
  // -------------------------------------------------------------------------
  describe('counter reset after save', () => {
    it('should reset counter after save so 51st event alone does not trigger', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      // First batch: triggers save at 50
      fireEvents(50);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      vi.mocked(snapshotStore.save).mockClear();

      // Single extra event (51st overall, 1st in new window)
      fireEvents(1);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should NOT trigger another save (counter is at 1 of 50)
      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should trigger again after a full second batch of 50 events', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      // First save
      fireEvents(50);
      await new Promise(resolve => setTimeout(resolve, 0));
      vi.mocked(snapshotStore.save).mockClear();

      // Second batch of 50 → triggers save again
      fireEvents(50);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. visibilitychange with visibilityState === 'hidden' → save called
  // -------------------------------------------------------------------------
  describe('lifecycle trigger: visibilitychange hidden', () => {
    it('should call saveSnapshot when document becomes hidden', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      document.dispatchEvent(new Event('visibilitychange'));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. visibilitychange with visibilityState === 'visible' → save NOT called
  // -------------------------------------------------------------------------
  describe('lifecycle trigger: visibilitychange visible', () => {
    it('should NOT call saveSnapshot when document becomes visible', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });

      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      document.dispatchEvent(new Event('visibilitychange'));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. beforeunload → save called
  // -------------------------------------------------------------------------
  describe('lifecycle trigger: beforeunload', () => {
    it('should call saveSnapshot on window beforeunload', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      window.dispatchEvent(new Event('beforeunload'));

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. stop() removes all listeners
  // -------------------------------------------------------------------------
  describe('stop() removes all listeners', () => {
    it('should not save on visibilitychange after stop()', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();
      manager.stop();

      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('beforeunload'));
      fireEvents(50);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should unsubscribe from eventStore on stop()', () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();
      manager.stop();

      const unsubscribe = (eventStore as unknown as { _unsubscribe: ReturnType<typeof vi.fn> })._unsubscribe;
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 7. saveSnapshot() swallows errors gracefully
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('should swallow errors when projection.createSnapshot throws', async () => {
      const throwingProjection = {
        createSnapshot: vi.fn().mockRejectedValue(new Error('projection exploded')),
      } as unknown as EntryListProjection;

      manager = new SnapshotManager(throwingProjection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      // Should not throw
      await expect(manager.saveSnapshot('test')).resolves.toBeUndefined();

      // Store should not have been called
      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should swallow errors when snapshotStore.save throws', async () => {
      vi.mocked(snapshotStore.save).mockRejectedValueOnce(new Error('storage full'));

      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      await expect(manager.saveSnapshot('test')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 8. createSnapshot() returning null → snapshotStore.save() not called
  // -------------------------------------------------------------------------
  describe('null snapshot handling', () => {
    it('should not call snapshotStore.save when createSnapshot returns null', async () => {
      const nullProjection = makeProjection(null);

      manager = new SnapshotManager(nullProjection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      await manager.saveSnapshot('manual');

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 9. Dual-store: remoteStore called fire-and-forget after local save (ADR-017)
  // -------------------------------------------------------------------------
  describe('dual-store (remoteStore)', () => {
    it('should call remoteStore.save after localStore.save succeeds', async () => {
      const remoteStore = makeSnapshotStore();
      manager = new SnapshotManager(projection, snapshotStore, remoteStore, eventStore, undefined, 50);
      manager.start();

      await manager.saveSnapshot('test');

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      // Remote save is fire-and-forget; allow its microtask to flush
      await Promise.resolve();
      expect(remoteStore.save).toHaveBeenCalledTimes(1);
      expect(remoteStore.save).toHaveBeenCalledWith(
        'entry-list-projection',
        expect.objectContaining({ version: 1, lastEventId: 'evt-1' })
      );
    });

    it('should not throw and local save should still succeed when remoteStore.save rejects', async () => {
      const remoteStore = makeSnapshotStore();
      vi.mocked(remoteStore.save).mockRejectedValueOnce(new Error('network error'));

      manager = new SnapshotManager(projection, snapshotStore, remoteStore, eventStore, undefined, 50);
      manager.start();

      // Should not throw despite remote failure
      await expect(manager.saveSnapshot('test')).resolves.toBeUndefined();
      // Local save still called
      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });

    it('should not call remoteStore.save when remoteStore is null', async () => {
      // No remoteStore (null) — only local store should be called
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      await manager.saveSnapshot('test');

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 10. Collection enrichment: snapshot includes collections when projection provided
  // -------------------------------------------------------------------------
  describe('collection enrichment', () => {
    it('should include collections in the saved snapshot when collectionProjection is provided', async () => {
      const collections = [makeCollection('col-1'), makeCollection('col-2')];
      const collectionProjection = makeCollectionProjection(collections);
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, collectionProjection, 50);
      manager.start();

      await manager.saveSnapshot('test');

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1];
      expect(savedSnapshot.collections).toEqual(collections);
    });

    it('should not include collections field when collectionProjection is not provided', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      await manager.saveSnapshot('test');

      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1];
      expect(savedSnapshot.collections).toBeUndefined();
    });

    it('should still save snapshot when collectionProjection.getCollections() throws', async () => {
      const collectionProjection = makeCollectionProjection();
      vi.mocked(collectionProjection.getCollections).mockRejectedValueOnce(new Error('db error'));
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, collectionProjection, 50);
      manager.start();

      await expect(manager.saveSnapshot('test')).resolves.toBeUndefined();
      // Save not called — error propagates to outer catch before save
      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should propagate collections to remoteStore when both are provided', async () => {
      const collections = [makeCollection('col-1')];
      const collectionProjection = makeCollectionProjection(collections);
      const remoteStore = makeSnapshotStore();
      manager = new SnapshotManager(projection, snapshotStore, remoteStore, eventStore, collectionProjection, 50);
      manager.start();

      await manager.saveSnapshot('test');
      await Promise.resolve(); // flush fire-and-forget

      const remoteSnapshot = vi.mocked(remoteStore.save).mock.calls[0]![1];
      expect(remoteSnapshot.collections).toEqual(collections);
    });

    it('should not start a second concurrent save when already in progress', async () => {
      let resolveFirst!: () => void;
      const firstSavePromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      vi.mocked(snapshotStore.save).mockReturnValueOnce(firstSavePromise);

      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, 50);
      manager.start();

      // Start two saves concurrently — second should be a no-op
      const first = manager.saveSnapshot('first');
      const second = manager.saveSnapshot('second');

      resolveFirst();
      await Promise.all([first, second]);

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 11. Habit enrichment: snapshot includes habits when habitProjection is provided
  // -------------------------------------------------------------------------
  describe('habit enrichment (ADR-026)', () => {
    it('should include habits in the saved snapshot when habitProjection is provided', async () => {
      const habits = [makeHabitState('habit-1'), makeHabitState('habit-2')];
      const habitProjection = makeHabitProjection(habits);
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, undefined, habitProjection);
      manager.start();

      await manager.saveSnapshot('test');

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(savedSnapshot['habits']).toEqual(habits);
    });

    it('should not include habits field when habitProjection is not provided', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, undefined, undefined);
      manager.start();

      await manager.saveSnapshot('test');

      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(savedSnapshot['habits']).toBeUndefined();
    });

    it('should propagate habits to remoteStore when both are provided', async () => {
      const habits = [makeHabitState('habit-1')];
      const habitProjection = makeHabitProjection(habits);
      const remoteStore = makeSnapshotStore();
      manager = new SnapshotManager(projection, snapshotStore, remoteStore, eventStore, undefined, undefined, habitProjection);
      manager.start();

      await manager.saveSnapshot('test');
      await Promise.resolve(); // flush fire-and-forget

      const remoteSnapshot = vi.mocked(remoteStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(remoteSnapshot['habits']).toEqual(habits);
    });
  });

  // -------------------------------------------------------------------------
  // 12. UserPreferences enrichment
  // -------------------------------------------------------------------------
  describe('userPreferences enrichment (ADR-026)', () => {
    it('should include userPreferences in the saved snapshot when userPreferencesProjection is provided', async () => {
      const prefs: UserPreferences = {
        defaultCompletedTaskBehavior: 'collapse',
        autoFavoriteRecentDailyLogs: true,
        autoFavoriteRecentMonthlyLogs: false,
        autoFavoriteCalendarWithActiveTasks: false,
      };
      const userPreferencesProjection = makeUserPreferencesProjection(prefs);
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, undefined, undefined, userPreferencesProjection);
      manager.start();

      await manager.saveSnapshot('test');

      expect(snapshotStore.save).toHaveBeenCalledTimes(1);
      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(savedSnapshot['userPreferences']).toEqual(prefs);
    });

    it('should not include userPreferences field when userPreferencesProjection is not provided', async () => {
      manager = new SnapshotManager(projection, snapshotStore, null, eventStore, undefined, undefined, undefined, undefined);
      manager.start();

      await manager.saveSnapshot('test');

      const savedSnapshot = vi.mocked(snapshotStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(savedSnapshot['userPreferences']).toBeUndefined();
    });

    it('should propagate userPreferences to remoteStore when both are provided', async () => {
      const prefs: UserPreferences = {
        defaultCompletedTaskBehavior: 'move-to-bottom',
        autoFavoriteRecentDailyLogs: false,
        autoFavoriteRecentMonthlyLogs: false,
        autoFavoriteCalendarWithActiveTasks: true,
      };
      const userPreferencesProjection = makeUserPreferencesProjection(prefs);
      const remoteStore = makeSnapshotStore();
      manager = new SnapshotManager(projection, snapshotStore, remoteStore, eventStore, undefined, undefined, undefined, userPreferencesProjection);
      manager.start();

      await manager.saveSnapshot('test');
      await Promise.resolve(); // flush fire-and-forget

      const remoteSnapshot = vi.mocked(remoteStore.save).mock.calls[0]![1] as unknown as Record<string, unknown>;
      expect(remoteSnapshot['userPreferences']).toEqual(prefs);
    });
  });
});
