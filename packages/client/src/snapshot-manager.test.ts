/**
 * SnapshotManager Tests
 *
 * Tests for the projection snapshot lifecycle manager:
 * - Count-based trigger (every N events)
 * - Lifecycle triggers (visibilitychange hidden, beforeunload)
 * - Graceful error handling
 * - start() / stop() listener cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SnapshotManager } from './snapshot-manager';
import type { ISnapshotStore, IEventStore, ProjectionSnapshot } from '@squickr/domain';
import type { EntryListProjection } from '@squickr/domain';

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
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
      manager.start();

      fireEvents(49);

      // Let any micro-tasks settle
      await Promise.resolve();

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should call saveSnapshot on the 50th event', async () => {
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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

      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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

      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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

      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
      manager.start();
      manager.stop();

      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('beforeunload'));
      fireEvents(50);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should unsubscribe from eventStore on stop()', () => {
      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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

      manager = new SnapshotManager(throwingProjection, snapshotStore, eventStore, 50);
      manager.start();

      // Should not throw
      await expect(manager.saveSnapshot('test')).resolves.toBeUndefined();

      // Store should not have been called
      expect(snapshotStore.save).not.toHaveBeenCalled();
    });

    it('should swallow errors when snapshotStore.save throws', async () => {
      vi.mocked(snapshotStore.save).mockRejectedValueOnce(new Error('storage full'));

      manager = new SnapshotManager(projection, snapshotStore, eventStore, 50);
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

      manager = new SnapshotManager(nullProjection, snapshotStore, eventStore, 50);
      manager.start();

      await manager.saveSnapshot('manual');

      expect(snapshotStore.save).not.toHaveBeenCalled();
    });
  });
});
