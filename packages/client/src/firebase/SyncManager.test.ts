/**
 * SyncManager Tests
 * 
 * Tests for periodic background sync functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from './SyncManager';
import type { IEventStore, DomainEvent } from '@squickr/domain';

describe('SyncManager', () => {
  let localStore: IEventStore;
  let remoteStore: IEventStore;
  let syncManager: SyncManager;
  let onSyncStateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-30T12:00:00Z'));
    
    // Mock local store
    localStore = {
      append: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    
    // Mock remote store
    remoteStore = {
      append: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    
    // Mock callback
    onSyncStateChange = vi.fn();
    
    // Reset sync manager
    if (syncManager) {
      syncManager.stop();
    }
  });

  afterEach(() => {
    if (syncManager) {
      syncManager.stop();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a SyncManager instance', () => {
      syncManager = new SyncManager(localStore, remoteStore);
      expect(syncManager).toBeDefined();
    });

    it('should accept optional sync state callback', () => {
      syncManager = new SyncManager(localStore, remoteStore, onSyncStateChange);
      expect(syncManager).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should trigger initial sync on start', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      
      // Start sync (triggers syncNow but doesn't wait)
      syncManager.start();

      // Wait just for the initial sync, not the interval
      // Use a short fixed delay to let the async syncNow() complete
      await new Promise(resolve => {
        vi.useRealTimers();
        setTimeout(resolve, 10);
        vi.useFakeTimers();
      });

      expect(localStore.getAll).toHaveBeenCalled();
      expect(remoteStore.getAll).toHaveBeenCalled();
      
      syncManager.stop();
    });

    it('should start periodic sync interval', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(localStore.getAll).mockClear();

      // Advance past debounce + Fast-forward 5 minutes
      await vi.advanceTimersByTimeAsync(306000);

      expect(localStore.getAll).toHaveBeenCalled();
    });

    it('should trigger multiple periodic syncs', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      
      // Advance through 3 intervals
      await vi.advanceTimersByTimeAsync(306000); // Past debounce +  5 min
      await vi.advanceTimersByTimeAsync(300000); // 10 min
      await vi.advanceTimersByTimeAsync(300000); // 15 min

      // Should have synced 4 times (initial + 3 intervals)
      expect(localStore.getAll).toHaveBeenCalledTimes(4);
    });

    it('should setup event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const docAddEventListenerSpy = vi.spyOn(document, 'addEventListener');

      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(docAddEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('stop()', () => {
    it('should stop the periodic sync interval', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      syncManager.stop();
      vi.mocked(localStore.getAll).mockClear();

      // Fast-forward 10 minutes
      vi.advanceTimersByTime(600000);
      await Promise.resolve();

      // Should not sync after stop
      expect(localStore.getAll).not.toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();
      syncManager.stop();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should handle stop without start gracefully', () => {
      syncManager = new SyncManager(localStore, remoteStore);
      expect(() => syncManager.stop()).not.toThrow();
    });
  });

  describe('syncNow()', () => {
    it('should upload local events to remote store', async () => {
      const localEvents: DomainEvent[] = [
        {
          id: 'event-1',
          type: 'task-created',
          aggregateId: 'task-1',
          timestamp: '2026-01-30T10:00:00Z',
          version: 1,
        },
      ];
      
      vi.mocked(localStore.getAll).mockResolvedValue(localEvents);
      vi.mocked(remoteStore.getAll).mockResolvedValue([]);

      syncManager = new SyncManager(localStore, remoteStore);
      await syncManager.syncNow();

      expect(remoteStore.append).toHaveBeenCalledWith(localEvents[0]);
    });

    it('should download remote events to local store', async () => {
      const remoteEvents: DomainEvent[] = [
        {
          id: 'event-2',
          type: 'task-completed',
          aggregateId: 'task-2',
          timestamp: '2026-01-30T11:00:00Z',
          version: 1,
        },
      ];
      
      vi.mocked(localStore.getAll).mockResolvedValue([]);
      vi.mocked(remoteStore.getAll).mockResolvedValue(remoteEvents);

      syncManager = new SyncManager(localStore, remoteStore);
      await syncManager.syncNow();

      expect(localStore.append).toHaveBeenCalledWith(remoteEvents[0]);
    });

    it('should skip events that already exist in remote', async () => {
      const sharedEvent: DomainEvent = {
        id: 'event-1',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-01-30T10:00:00Z',
        version: 1,
      };
      
      vi.mocked(localStore.getAll).mockResolvedValue([sharedEvent]);
      vi.mocked(remoteStore.getAll).mockResolvedValue([sharedEvent]);

      syncManager = new SyncManager(localStore, remoteStore);
      await syncManager.syncNow();

      // Should not append events that already exist
      expect(remoteStore.append).not.toHaveBeenCalled();
      expect(localStore.append).not.toHaveBeenCalled();
    });

    it('should sync bidirectionally', async () => {
      const localOnly: DomainEvent = {
        id: 'event-local',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-01-30T10:00:00Z',
        version: 1,
      };
      
      const remoteOnly: DomainEvent = {
        id: 'event-remote',
        type: 'task-completed',
        aggregateId: 'task-2',
        timestamp: '2026-01-30T11:00:00Z',
        version: 1,
      };
      
      vi.mocked(localStore.getAll).mockResolvedValue([localOnly]);
      vi.mocked(remoteStore.getAll).mockResolvedValue([remoteOnly]);

      syncManager = new SyncManager(localStore, remoteStore);
      await syncManager.syncNow();

      expect(remoteStore.append).toHaveBeenCalledWith(localOnly);
      expect(localStore.append).toHaveBeenCalledWith(remoteOnly);
    });

    it('should notify sync state change callback', async () => {
      syncManager = new SyncManager(localStore, remoteStore, onSyncStateChange);
      await syncManager.syncNow();

      expect(onSyncStateChange).toHaveBeenCalledWith(true); // Start
      expect(onSyncStateChange).toHaveBeenCalledWith(false, undefined); // End (no error)
    });

    it('should handle sync errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(localStore.getAll).mockRejectedValueOnce(new Error('Network error'));

      syncManager = new SyncManager(localStore, remoteStore, onSyncStateChange);
      await syncManager.syncNow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SyncManager] Sync failed:',
        expect.any(Error)
      );

      // Should still notify end of sync (no error string for non-timeout errors)
      expect(onSyncStateChange).toHaveBeenCalledWith(false, undefined);
    });

    it('should pass error message on Firestore timeout', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      // Simulate a timeout by having remoteStore.getAll hang forever
      vi.mocked(localStore.getAll).mockResolvedValue([]);
      vi.mocked(remoteStore.getAll).mockImplementationOnce(
        () => new Promise<never>(() => {}) // never resolves
      );

      syncManager = new SyncManager(localStore, remoteStore, onSyncStateChange);

      // Advance time past the 15-second timeout while syncNow() is running
      const syncPromise = syncManager.syncNow();
      await vi.advanceTimersByTimeAsync(15_001);
      await syncPromise;

      // Should pass the timeout error message to the callback
      expect(onSyncStateChange).toHaveBeenCalledWith(
        false,
        "Couldn't reach the server — showing local data"
      );
    });

    it('should set initialSyncComplete after first sync', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      expect(syncManager.initialSyncComplete).toBe(false);
      await syncManager.syncNow();
      expect(syncManager.initialSyncComplete).toBe(true);
    });

    it('should set initialSyncComplete even after a timeout', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(localStore.getAll).mockResolvedValue([]);
      vi.mocked(remoteStore.getAll).mockImplementationOnce(
        () => new Promise<never>(() => {})
      );

      syncManager = new SyncManager(localStore, remoteStore);
      expect(syncManager.initialSyncComplete).toBe(false);

      const syncPromise = syncManager.syncNow();
      await vi.advanceTimersByTimeAsync(15_001);
      await syncPromise;

      expect(syncManager.initialSyncComplete).toBe(true);
    });
  });

  describe('concurrent sync prevention', () => {
    it('should prevent concurrent syncs', async () => {
      // Make sync take some time
      let resolveSync: () => void;
      vi.mocked(localStore.getAll).mockImplementationOnce(
        () => new Promise<DomainEvent[]>((resolve) => { resolveSync = () => resolve([]); })
      );

      syncManager = new SyncManager(localStore, remoteStore);

      // Start two syncs simultaneously
      const sync1Promise = syncManager.syncNow();
      const sync2Promise = syncManager.syncNow();

      // Resolve the first sync
      resolveSync!();
      await Promise.all([sync1Promise, sync2Promise]);

      // Should only call getAll once (second call prevented)
      expect(localStore.getAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid sync triggers', async () => {
      syncManager = new SyncManager(localStore, remoteStore);

      // First sync
      await syncManager.syncNow();
      vi.mocked(localStore.getAll).mockClear();

      // Try to sync again immediately (within 5 seconds)
      await syncManager.syncNow();

      // Should not sync again (debounced)
      expect(localStore.getAll).not.toHaveBeenCalled();
    });

    it('should allow sync after debounce period', async () => {
      syncManager = new SyncManager(localStore, remoteStore);

      // First sync
      await syncManager.syncNow();
      vi.mocked(localStore.getAll).mockClear();

      // Wait 6 seconds (beyond 5-second debounce)
      await vi.advanceTimersByTimeAsync(6000);

      // Try to sync again
      await syncManager.syncNow();

      // Should sync again
      expect(localStore.getAll).toHaveBeenCalled();
    });
  });

  describe('window focus event', () => {
    it('should sync when window gains focus', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(localStore.getAll).mockClear();

      // Wait for debounce period
      await vi.advanceTimersByTimeAsync(6000);

      // Trigger focus event
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();

      expect(localStore.getAll).toHaveBeenCalled();
    });
  });

  describe('online event', () => {
    it('should sync when network reconnects', async () => {
      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(localStore.getAll).mockClear();

      // Wait for debounce period
      await vi.advanceTimersByTimeAsync(6000);

      // Trigger online event
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();

      expect(localStore.getAll).toHaveBeenCalled();
    });
  });

  describe('visibility change event', () => {
    it('should stop interval when tab becomes hidden', async () => {
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(localStore.getAll).mockClear();

      // Trigger visibility change
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();

      // Fast-forward 10 minutes
      vi.advanceTimersByTime(600000);
      await Promise.resolve();

      // Should not sync while hidden
      expect(localStore.getAll).not.toHaveBeenCalled();
    });

    it('should resume interval and sync when tab becomes visible', async () => {
      // Start hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        writable: true,
        value: true,
      });

      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(localStore.getAll).mockClear();

      // Become visible
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        writable: true,
        value: false,
      });

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(6000);

      // Trigger visibility change
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();

      // Should sync when becoming visible
      expect(localStore.getAll).toHaveBeenCalled();
    });
  });

  describe('memory leak prevention', () => {
    it('should clean up all resources on stop', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      syncManager = new SyncManager(localStore, remoteStore);
      syncManager.start();
      syncManager.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2); // online, focus
      expect(docRemoveEventListenerSpy).toHaveBeenCalledTimes(1); // visibilitychange
    });

    it('should allow multiple start/stop cycles', async () => {
      syncManager = new SyncManager(localStore, remoteStore);

      // Cycle 1
      syncManager.start();
      await Promise.resolve();
      syncManager.stop();
      vi.mocked(localStore.getAll).mockClear();

      // Wait for debounce to reset
      await vi.advanceTimersByTimeAsync(6000);

      // Cycle 2
      syncManager.start();
      await Promise.resolve();

      // Should sync again
      expect(localStore.getAll).toHaveBeenCalled();

      syncManager.stop();
    });
  });
});
