/**
 * SnapshotManager - Projection Snapshot Lifecycle Service
 *
 * Automatically persists projection snapshots to avoid expensive full event-log
 * replays on startup. Triggers a save when:
 *
 * 1. Count trigger  — every N events appended to the event store
 * 2. Tab hidden     — document visibilitychange → visibilityState === 'hidden'
 * 3. Page unload    — window beforeunload
 *
 * ADR-016 Step 6: Snapshot Manager
 */

import type { ISnapshotStore, IEventStore } from '@squickr/domain';
import type { EntryListProjection } from '@squickr/domain';

export class SnapshotManager {
  private eventCounter = 0;
  private unsubscribeFromEventStore: (() => void) | null = null;

  // Event handler references (for cleanup)
  private handleVisibilityChange?: () => void;
  private handleBeforeUnload?: () => void;

  constructor(
    private readonly projection: EntryListProjection,
    private readonly snapshotStore: ISnapshotStore,
    private readonly remoteStore: ISnapshotStore | null,
    private readonly eventStore: IEventStore,
    private readonly eventsBeforeSnapshot: number = 50
  ) {}

  /**
   * Start the snapshot manager.
   * - Subscribe to the event store (count trigger)
   * - Add document visibilitychange listener
   * - Add window beforeunload listener
   */
  start(): void {
    // Count trigger
    this.unsubscribeFromEventStore = this.eventStore.subscribe(() => {
      this.eventCounter++;
      if (this.eventCounter >= this.eventsBeforeSnapshot) {
        this.eventCounter = 0;
        void this.saveSnapshot('count');
      }
    });

    // Lifecycle: save when tab goes hidden
    this.handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void this.saveSnapshot('visibility');
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Lifecycle: save on page unload
    this.handleBeforeUnload = () => {
      void this.saveSnapshot('beforeunload');
    };
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Stop the snapshot manager.
   * - Unsubscribe from the event store
   * - Remove all event listeners
   */
  stop(): void {
    if (this.unsubscribeFromEventStore) {
      this.unsubscribeFromEventStore();
      this.unsubscribeFromEventStore = null;
    }

    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.handleVisibilityChange = undefined;
    }

    if (this.handleBeforeUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      this.handleBeforeUnload = undefined;
    }
  }

  /**
   * Create and persist a projection snapshot.
   *
   * @param trigger - Human-readable label for the trigger source (for logging)
   */
  async saveSnapshot(trigger: string): Promise<void> {
    try {
      const snapshot = await this.projection.createSnapshot();
      if (snapshot === null) {
        return;
      }
      await this.snapshotStore.save('entry-list-projection', snapshot);
      // Fire-and-forget: remote save is an optimisation; local is the reliable path.
      // Errors are swallowed so a remote failure never blocks the local save.
      this.remoteStore?.save('entry-list-projection', snapshot).catch(err =>
        console.warn('[SnapshotManager] remote snapshot save failed:', err)
      );
      // Reset counter so the next save window starts fresh regardless of trigger source
      this.eventCounter = 0;
    } catch (error) {
      console.error(`[SnapshotManager] saveSnapshot(${trigger}) failed:`, error);
    }
  }
}
