/**
 * SyncManager - Periodic Background Sync Service
 * 
 * Handles automatic bidirectional sync between IndexedDB and Firestore:
 * - Periodic sync every 5 minutes
 * - Sync on window focus (tab switching)
 * - Sync on network reconnection
 * - Pause timer when tab is hidden
 * - Debounce rapid triggers (5-second window)
 * - Prevent concurrent syncs
 * 
 * Issue #2: https://github.com/squickr/life/issues/2
 * ADR-011: Background Sync Strategy
 */

import type { IEventStore } from '@squickr/domain';
import { logger } from '../utils/logger';
import { DEBOUNCE, SYNC_CONFIG } from '../utils/constants';

/** Firestore sync timeout — 15 seconds before we give up and show local data */
const SYNC_TIMEOUT_MS = 15_000;

export class SyncManager {
  private intervalId: number | null = null;
  private isSyncing = false;
  private lastSyncTime: number = 0;
  private syncDebounceMs = DEBOUNCE.SYNC_OPERATION;
  private hasCompletedInitialSync = false;

  // ADR-023: event store subscriber wiring
  private unsubscribeFromLocalStore?: () => void;
  private debounceTimer: number | null = null;

  // Event handler references (for cleanup)
  private handleVisibilityChange?: () => void;
  private handleOnline?: () => void;
  private handleFocus?: () => void;
  
  constructor(
    private localStore: IEventStore,
    private remoteStore: IEventStore,
    public onSyncStateChange?: (syncing: boolean, error?: string) => void,
    private getSnapshotCursor?: () => string | null,
  ) {}

  /** Returns true once the first sync attempt has finished (success or timeout) */
  get initialSyncComplete(): boolean {
    return this.hasCompletedInitialSync;
  }
  
  /**
   * Start the sync manager
   * - Triggers initial sync
   * - Starts periodic interval
   * - Sets up event listeners
   */
  start(): void {
    this.startInterval();
    this.setupEventListeners();

    // ADR-023: subscribe to the local event store so every append triggers a
    // debounced syncNow(). This eliminates the sync lag between IndexedDB and
    // Firestore without any UI component changes.
    this.unsubscribeFromLocalStore = this.localStore.subscribe(() => {
      this.debouncedSyncNow();
    });

    this.syncNow(); // Initial sync on start
  }
  
  /**
   * Stop the sync manager
   * - Stops periodic interval
   * - Removes event listeners
   */
  stop(): void {
    this.stopInterval();
    this.cleanupEventListeners();

    // ADR-023: unsubscribe from event store and clear any pending debounce timer
    this.unsubscribeFromLocalStore?.();
    this.unsubscribeFromLocalStore = undefined;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
  
  /**
   * Trigger sync immediately
   * - Prevents concurrent syncs
   * - Debounces rapid triggers
   * - Handles errors gracefully
   */
  async syncNow(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      return;
    }
    
    // Debounce rapid triggers using fake-timer-friendly approach
    const now = Date.now();
    if (now - this.lastSyncTime < this.syncDebounceMs) {
      return;
    }
    
    let syncError: string | undefined;
    try {
      this.isSyncing = true;
      this.onSyncStateChange?.(true);
      
      // Upload: Get events from localStore, append to remoteStore
      const localEvents = await this.localStore.getAll();

      // Wrap Firestore getAllAfter() in a 15-second timeout guard so a new device
      // never waits forever on a slow/unavailable network.
      const cursor = this.getSnapshotCursor?.() ?? null;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore sync timed out')), SYNC_TIMEOUT_MS)
      );
      const remoteEvents = await Promise.race([
        this.remoteStore.getAllAfter(cursor),
        timeoutPromise,
      ]);

      // ADR-025: scope upload to only events after the snapshot cursor.
      // Without this, when remoteEvents is a delta (cursor was set), remoteIds
      // contains 0 IDs and ALL local events appear as new → permission error on
      // duplicate Firestore writes.
      const localEventsToUpload = cursor !== null
        ? (() => {
            const i = localEvents.findIndex(e => e.id === cursor);
            return i >= 0 ? localEvents.slice(i + 1) : localEvents;
          })()
        : localEvents;
      const remoteIds = new Set(remoteEvents.map(e => e.id));
      const newEvents = localEventsToUpload.filter(e => !remoteIds.has(e.id));
      
      logger.info('[SyncManager]', `Uploading ${newEvents.length} new events...`);
      if (newEvents.length > 0) {
        await this.remoteStore.appendBatch(newEvents);
      }
      
      // Download: Get events from remoteStore, append to localStore  
      const localIds = new Set(localEvents.map(e => e.id));
      const eventsToDownload = remoteEvents.filter(e => !localIds.has(e.id));
      
      logger.info('[SyncManager]', `Downloading ${eventsToDownload.length} new events...`);
      if (eventsToDownload.length > 0) {
        await this.localStore.appendBatch(eventsToDownload);
      }
      
      this.lastSyncTime = Date.now();
    } catch (error) {
      logger.error('[SyncManager] Sync failed:', error);
      if (error instanceof Error && error.message === 'Firestore sync timed out') {
        syncError = "Couldn't reach the server — showing local data";
      }
    } finally {
      this.isSyncing = false;
      this.hasCompletedInitialSync = true;
      this.onSyncStateChange?.(false, syncError);
    }
  }
  
  /**
   * ADR-023: Debounced syncNow() for event store subscriber notifications.
   * Collapses burst writes (e.g. appendBatch of 30 events) into a single
   * syncNow() call. This timer is separate from the lastSyncTime guard in
   * syncNow() — the two are complementary.
   *
   * No-ops if the subscriber is no longer active (i.e. after stop() has been
   * called), which prevents stale subscriber references from triggering uploads.
   */
  private debouncedSyncNow(): void {
    // Guard: if stop() has been called, do not schedule a sync
    if (this.unsubscribeFromLocalStore === undefined) return;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow();
    }, this.syncDebounceMs);
  }

  /**
   * Start periodic sync interval (every 5 minutes)
   */
  private startInterval(): void {
    this.intervalId = window.setInterval(() => {
      this.syncNow();
    }, SYNC_CONFIG.SYNC_INTERVAL);
  }
  
  /**
   * Stop periodic sync interval
   */
  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Setup event listeners for:
   * - Page visibility (pause/resume timer)
   * - Network reconnection
   * - Window focus
   */
  private setupEventListeners(): void {
    // Page visibility (pause/resume timer)
    this.handleVisibilityChange = () => {
      if (document.hidden) {
        this.stopInterval();
      } else {
        this.startInterval();
        this.syncNow();
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Network reconnection
    this.handleOnline = () => this.syncNow();
    window.addEventListener('online', this.handleOnline);
    
    // Window focus
    this.handleFocus = () => this.syncNow();
    window.addEventListener('focus', this.handleFocus);
  }
  
  /**
   * Clean up event listeners (prevents memory leaks)
   */
  private cleanupEventListeners(): void {
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.handleOnline) {
      window.removeEventListener('online', this.handleOnline);
    }
    if (this.handleFocus) {
      window.removeEventListener('focus', this.handleFocus);
    }
  }
}
