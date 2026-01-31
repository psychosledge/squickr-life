/**
 * SyncManager Tests
 * 
 * Tests for periodic background sync functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from './SyncManager';
import type { IEventStore } from '@squickr/shared';

// Mock the sync functions
vi.mock('./syncEvents', () => ({
  uploadLocalEvents: vi.fn().mockResolvedValue(0),
  downloadRemoteEvents: vi.fn().mockResolvedValue(0),
}));

import { uploadLocalEvents, downloadRemoteEvents } from './syncEvents';

describe('SyncManager', () => {
  let eventStore: IEventStore;
  let syncManager: SyncManager;
  let onSyncStateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-30T12:00:00Z'));
    
    // Clear mocks
    vi.mocked(uploadLocalEvents).mockClear();
    vi.mocked(downloadRemoteEvents).mockClear();
    
    // Mock event store
    eventStore = {} as IEventStore;
    
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
      syncManager = new SyncManager('user123', eventStore);
      expect(syncManager).toBeDefined();
    });

    it('should accept optional sync state callback', () => {
      syncManager = new SyncManager('user123', eventStore, onSyncStateChange);
      expect(syncManager).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should trigger initial sync on start', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Wait for async sync to complete
      await Promise.resolve();

      expect(uploadLocalEvents).toHaveBeenCalledWith('user123', eventStore);
      expect(downloadRemoteEvents).toHaveBeenCalledWith('user123', eventStore);
    });

    it('should start periodic sync interval', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(uploadLocalEvents).mockClear();

      // Advance past debounce + Fast-forward 5 minutes
      await vi.advanceTimersByTimeAsync(306000);

      expect(uploadLocalEvents).toHaveBeenCalled();
    });

    it('should trigger multiple periodic syncs', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      
      // Advance through 3 intervals
      await vi.advanceTimersByTimeAsync(306000); // Past debounce +  5 min
      await vi.advanceTimersByTimeAsync(300000); // 10 min
      await vi.advanceTimersByTimeAsync(300000); // 15 min

      // Should have synced 4 times (initial + 3 intervals)
      expect(uploadLocalEvents).toHaveBeenCalledTimes(4);
    });

    it('should setup event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const docAddEventListenerSpy = vi.spyOn(document, 'addEventListener');

      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(docAddEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('stop()', () => {
    it('should stop the periodic sync interval', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      syncManager.stop();
      vi.mocked(uploadLocalEvents).mockClear();

      // Fast-forward 10 minutes
      vi.advanceTimersByTime(600000);
      await Promise.resolve();

      // Should not sync after stop
      expect(uploadLocalEvents).not.toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();
      syncManager.stop();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should handle stop without start gracefully', () => {
      syncManager = new SyncManager('user123', eventStore);
      expect(() => syncManager.stop()).not.toThrow();
    });
  });

  describe('syncNow()', () => {
    it('should call upload and download functions', async () => {
      syncManager = new SyncManager('user123', eventStore);
      await syncManager.syncNow();

      expect(uploadLocalEvents).toHaveBeenCalledWith('user123', eventStore);
      expect(downloadRemoteEvents).toHaveBeenCalledWith('user123', eventStore);
    });

    it('should notify sync state change callback', async () => {
      syncManager = new SyncManager('user123', eventStore, onSyncStateChange);
      await syncManager.syncNow();

      expect(onSyncStateChange).toHaveBeenCalledWith(true); // Start
      expect(onSyncStateChange).toHaveBeenCalledWith(false); // End
    });

    it('should handle sync errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(uploadLocalEvents).mockRejectedValueOnce(new Error('Network error'));

      syncManager = new SyncManager('user123', eventStore, onSyncStateChange);
      await syncManager.syncNow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SyncManager] Sync failed:',
        expect.any(Error)
      );

      // Should still notify end of sync
      expect(onSyncStateChange).toHaveBeenCalledWith(false);
    });
  });

  describe('concurrent sync prevention', () => {
    it('should prevent concurrent syncs', async () => {
      // Make sync take some time
      let resolveSync: () => void;
      vi.mocked(uploadLocalEvents).mockImplementationOnce(
        () => new Promise<number>((resolve) => { resolveSync = () => resolve(0); })
      );

      syncManager = new SyncManager('user123', eventStore);

      // Start two syncs simultaneously
      const sync1Promise = syncManager.syncNow();
      const sync2Promise = syncManager.syncNow();

      // Resolve the first sync
      resolveSync!();
      await Promise.all([sync1Promise, sync2Promise]);

      // Should only call upload once (second call prevented)
      expect(uploadLocalEvents).toHaveBeenCalledTimes(1);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid sync triggers', async () => {
      syncManager = new SyncManager('user123', eventStore);

      // First sync
      await syncManager.syncNow();
      vi.mocked(uploadLocalEvents).mockClear();

      // Try to sync again immediately (within 5 seconds)
      await syncManager.syncNow();

      // Should not sync again (debounced)
      expect(uploadLocalEvents).not.toHaveBeenCalled();
    });

    it('should allow sync after debounce period', async () => {
      syncManager = new SyncManager('user123', eventStore);

      // First sync
      await syncManager.syncNow();
      vi.mocked(uploadLocalEvents).mockClear();

      // Wait 6 seconds (beyond 5-second debounce)
      await vi.advanceTimersByTimeAsync(6000);

      // Try to sync again
      await syncManager.syncNow();

      // Should sync again
      expect(uploadLocalEvents).toHaveBeenCalled();
    });
  });

  describe('window focus event', () => {
    it('should sync when window gains focus', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(uploadLocalEvents).mockClear();

      // Wait for debounce period
      await vi.advanceTimersByTimeAsync(6000);

      // Trigger focus event
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();

      expect(uploadLocalEvents).toHaveBeenCalled();
    });
  });

  describe('online event', () => {
    it('should sync when network reconnects', async () => {
      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(uploadLocalEvents).mockClear();

      // Wait for debounce period
      await vi.advanceTimersByTimeAsync(6000);

      // Trigger online event
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();

      expect(uploadLocalEvents).toHaveBeenCalled();
    });
  });

  describe('visibility change event', () => {
    it('should stop interval when tab becomes hidden', async () => {
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });

      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(uploadLocalEvents).mockClear();

      // Trigger visibility change
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();

      // Fast-forward 10 minutes
      vi.advanceTimersByTime(600000);
      await Promise.resolve();

      // Should not sync while hidden
      expect(uploadLocalEvents).not.toHaveBeenCalled();
    });

    it('should resume interval and sync when tab becomes visible', async () => {
      // Start hidden
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        writable: true,
        value: true,
      });

      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();

      // Initial sync
      await Promise.resolve();
      vi.mocked(uploadLocalEvents).mockClear();

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
      expect(uploadLocalEvents).toHaveBeenCalled();
    });
  });

  describe('memory leak prevention', () => {
    it('should clean up all resources on stop', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      syncManager = new SyncManager('user123', eventStore);
      syncManager.start();
      syncManager.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2); // online, focus
      expect(docRemoveEventListenerSpy).toHaveBeenCalledTimes(1); // visibilitychange
    });

    it('should allow multiple start/stop cycles', async () => {
      syncManager = new SyncManager('user123', eventStore);

      // Cycle 1
      syncManager.start();
      await Promise.resolve();
      syncManager.stop();
      vi.mocked(uploadLocalEvents).mockClear();

      // Wait for debounce to reset
      await vi.advanceTimersByTimeAsync(6000);

      // Cycle 2
      syncManager.start();
      await Promise.resolve();

      // Should sync again
      expect(uploadLocalEvents).toHaveBeenCalled();

      syncManager.stop();
    });
  });
});
