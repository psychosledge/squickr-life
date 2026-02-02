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

import type { IEventStore } from '@squickr/shared';
import { uploadLocalEvents, downloadRemoteEvents } from './syncEvents';
import { logger } from '../utils/logger';

export class SyncManager {
  private intervalId: number | null = null;
  private isSyncing = false;
  private lastSyncTime: number = 0;
  private syncDebounceMs = 5000;
  
  // Event handler references (for cleanup)
  private handleVisibilityChange?: () => void;
  private handleOnline?: () => void;
  private handleFocus?: () => void;
  
  constructor(
    private userId: string,
    private eventStore: IEventStore,
    private onSyncStateChange?: (syncing: boolean) => void
  ) {}
  
  /**
   * Start the sync manager
   * - Triggers initial sync
   * - Starts periodic interval
   * - Sets up event listeners
   */
  start(): void {
    this.startInterval();
    this.setupEventListeners();
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
    
    try {
      this.isSyncing = true;
      this.onSyncStateChange?.(true);
      
      await uploadLocalEvents(this.userId, this.eventStore);
      await downloadRemoteEvents(this.userId, this.eventStore);
      
      this.lastSyncTime = Date.now();
    } catch (error) {
      logger.error('[SyncManager] Sync failed:', error);
    } finally {
      this.isSyncing = false;
      this.onSyncStateChange?.(false);
    }
  }
  
  /**
   * Start periodic sync interval (every 5 minutes)
   */
  private startInterval(): void {
    this.intervalId = window.setInterval(() => {
      this.syncNow();
    }, 5 * 60 * 1000); // 5 minutes
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
