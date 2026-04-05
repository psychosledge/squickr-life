/**
 * useColdStartSequencer
 *
 * Encapsulates the cold-start sequencer state machine that was previously
 * inlined in AppContent (ADR-024). Extracted as part of P2-9.
 *
 * Responsibilities:
 * - Determines fast vs slow cold-start path based on local store emptiness
 * - Manages SyncManager lifecycle (create, start, stop)
 * - Updates SnapshotManager with the remote store once user is known
 * - Exposes coldStartPhase, syncError, isAppReady, and dismissSyncError
 *
 * What stays in AppContent:
 * - initializeApp() and its [] effect
 * - snapshotManagerRef declaration (must exist before user is known)
 * - FCM effect (reads isAppReady from hook output)
 * - All handler/projection useState declarations
 * - All JSX
 */

import { useState, useEffect, useRef } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  EntryListProjection,
  HabitProjection,
  CollectionListProjection,
  UserPreferencesProjection,
} from '@squickr/domain';
import type { IndexedDBEventStore, IndexedDBSnapshotStore } from '@squickr/infrastructure';
import { FirestoreEventStore, FirestoreSnapshotStore } from '@squickr/infrastructure';
import { SyncManager } from '../firebase/SyncManager';
import { SnapshotManager } from '../snapshot-manager';
import { firestore } from '../firebase/config';
import { logger } from '../utils/logger';
import type React from 'react';

// ─── ADR-024: Cold-start phase type ───────────────────────────────────────────
// 'checking'  — auth resolved, determining whether remote restore is needed
// 'restoring' — fetching / seeding remote snapshot into local store
// 'syncing'   — SyncManager initial sync in progress (overlay shown)
// 'ready'     — app ready for user interaction
export type ColdStartPhase = 'checking' | 'restoring' | 'syncing' | 'ready';

// Parsed once at module load — window.location does not change during a session.
const FORCE_FULL_REPLAY =
  typeof window !== 'undefined' &&
  window.location.search.toLowerCase().includes('ignoresnapshot');

export interface UseColdStartSequencerParams {
  user: FirebaseUser | null;
  isLoading: boolean;
  entryProjection: EntryListProjection;
  habitProjection: HabitProjection;
  collectionProjection: CollectionListProjection;
  userPreferencesProjection: UserPreferencesProjection;
  eventStore: IndexedDBEventStore;
  snapshotStore: IndexedDBSnapshotStore;
  snapshotManagerRef: React.MutableRefObject<SnapshotManager | null>;
}

export interface UseColdStartSequencerResult {
  coldStartPhase: ColdStartPhase;
  syncError: string | null;
  isAppReady: boolean;
  dismissSyncError: () => void;
}

export function useColdStartSequencer(
  params: UseColdStartSequencerParams,
): UseColdStartSequencerResult {
  const {
    user,
    isLoading,
    entryProjection,
    habitProjection,
    collectionProjection,
    userPreferencesProjection,
    eventStore,
    snapshotStore,
    snapshotManagerRef,
  } = params;

  const [coldStartPhase, setColdStartPhase] = useState<ColdStartPhase>('checking');
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncManagerRef = useRef<SyncManager | null>(null);
  const restoredFromRemoteRef = useRef(false);

  // Start/stop background sync when user signs in/out
  useEffect(() => {
    if (!user || isLoading) {
      // User signed out or still loading — stop sync
      syncManagerRef.current?.stop();
      syncManagerRef.current = null;
      return;
    }

    // User signed in — reset to 'checking' synchronously so the no-user guard
    // cannot leave coldStartPhase as 'ready' (which would make isAppReady=true
    // while SignInView was shown and trigger the tutorial prematurely).
    setColdStartPhase('checking');

    const remoteEventStore = new FirestoreEventStore(firestore, user.uid);
    const remoteSnapshotStore = new FirestoreSnapshotStore(firestore, user.uid);

    // Update SnapshotManager to include the remote store now that we know the user
    snapshotManagerRef.current?.stop();
    const sm = new SnapshotManager(
      entryProjection,
      snapshotStore,
      remoteSnapshotStore,
      eventStore,
      collectionProjection,
      50,
      habitProjection,
      userPreferencesProjection,
    );
    sm.start();
    // Write back to the ref so the caller's snapshotManagerRef stays current
    snapshotManagerRef.current = sm;

    let cancelled = false;

    const startSync = async () => {
      // ── ADR-024: Cold-start sequencer ──────────────────────────────────────
      const forceFullReplay = FORCE_FULL_REPLAY;
      const isEmptyLocalStore = entryProjection.wasLocalStoreEmptyAtHydration();
      logger.info('[useColdStartSequencer] Cold-start: isEmptyLocalStore =', isEmptyLocalStore);

      // Set the tutorial-suppression flag synchronously — before any await — so
      // it is guaranteed to be in sessionStorage before isAppReady can become
      // true, regardless of which cold-start path executes (ADR-024).
      if (isEmptyLocalStore) {
        sessionStorage.setItem('squickr_cold_start_restored', 'true');
      }

      if (!isEmptyLocalStore) {
        // ── Fast path: local store has data — skip Firestore round-trip ──────
        if (!cancelled) setColdStartPhase('ready');
        const manager = new SyncManager(
          eventStore,
          remoteEventStore,
          undefined,
          () => entryProjection.getLastSnapshotCursor(),
        );
        let initialSnapshotSaved = false;
        manager.onSyncStateChange = (syncing: boolean, error?: string) => {
          if (error) setSyncError(error);
          if (!syncing && !initialSnapshotSaved) {
            initialSnapshotSaved = true;
            void snapshotManagerRef.current?.saveSnapshot('post-initial-sync-fast-path');
          }
        };
        manager.start();
        syncManagerRef.current = manager;
        logger.info(
          '[useColdStartSequencer] Cold-start fast path: background sync started (local store non-empty)',
        );
        return;
      }

      // ── Slow path: local store is empty — attempt remote snapshot restore ──
      logger.info(
        '[useColdStartSequencer] Cold-start: local store empty — attempting remote snapshot restore…',
      );
      try {
        const remoteSnapshot = await Promise.race([
          remoteSnapshotStore.load('entry-list-projection'),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000)),
        ]);

        logger.info(
          '[useColdStartSequencer] Cold-start: remote snapshot result =',
          remoteSnapshot
            ? `found (savedAt=${remoteSnapshot.savedAt}, lastEventId=${remoteSnapshot.lastEventId})`
            : 'null (not found or timed out)',
        );

        if (cancelled) {
          logger.info('[useColdStartSequencer] Cold-start: cancelled before snapshot check');
          return;
        }

        if (remoteSnapshot) {
          // Remote snapshot found — seed local store and re-hydrate
          if (!cancelled) setColdStartPhase('restoring');
          await snapshotStore.save('entry-list-projection', remoteSnapshot);
          await entryProjection.hydrate(forceFullReplay ? { forceFullReplay: true } : undefined);
          // Seed collection list from snapshot if available (ADR-024)
          if (remoteSnapshot.collections?.length) {
            collectionProjection.seedFromSnapshot(remoteSnapshot.collections);
          }
          // Seed habit projection from snapshot if available (P2-10)
          if (remoteSnapshot.habits) {
            habitProjection.hydrateFromSnapshot(remoteSnapshot.habits);
          }
          // Seed user preferences from snapshot if available (ADR-026)
          if (remoteSnapshot.userPreferences) {
            userPreferencesProjection.hydrateFromSnapshot(remoteSnapshot.userPreferences);
          }
          // Skip the blocking overlay if either:
          // (a) hydrate() populated the entry cache from snapshot state, or
          // (b) the snapshot contained collection data (so something is displayable)
          restoredFromRemoteRef.current =
            entryProjection.isCachePopulated() ||
            (remoteSnapshot.collections?.length ?? 0) > 0;
          logger.info(
            '[useColdStartSequencer] Cold-start: remote snapshot restored — cache populated:',
            restoredFromRemoteRef.current,
          );
        }
      } catch (err) {
        logger.warn(
          '[useColdStartSequencer] Remote snapshot restore failed, falling back to normal sync:',
          err,
        );
      }

      if (cancelled) return;

      const manager = new SyncManager(
        eventStore,
        remoteEventStore,
        undefined,
        () => entryProjection.getLastSnapshotCursor(),
      );

      if (restoredFromRemoteRef.current) {
        // Snapshot data (entries + collections) is already in memory — set ready
        // immediately so the UI renders from snapshot without waiting for the full
        // event log to download.
        if (!cancelled) setColdStartPhase('ready');
        manager.onSyncStateChange = (_syncing: boolean, error?: string) => {
          if (error) setSyncError(error);
        };
      } else {
        // Normal path (null / timed-out snapshot): show overlay until initial
        // sync completes so the user never sees an empty state.
        if (!cancelled) setColdStartPhase('syncing');
        let initialSnapshotSaved = false;
        manager.onSyncStateChange = (syncing: boolean, error?: string) => {
          setSyncError(error ?? null);
          if (!syncing) {
            setColdStartPhase('ready');
            if (!initialSnapshotSaved) {
              initialSnapshotSaved = true;
              void snapshotManagerRef.current?.saveSnapshot('post-initial-sync');
            }
          }
        };
      }

      manager.start();
      syncManagerRef.current = manager;

      logger.info('[useColdStartSequencer] Background sync started');
    };

    void startSync();

    return () => {
      cancelled = true;
      restoredFromRemoteRef.current = false;
      syncManagerRef.current?.stop();
      syncManagerRef.current = null;
      logger.info('[useColdStartSequencer] Background sync stopped');
    };
  // collectionProjection, habitProjection, and userPreferencesProjection are intentionally
  // omitted: they are stable useState singletons created once in App.tsx and never reassigned.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, eventStore, snapshotStore, entryProjection]);

  // The app is "ready" once IndexedDB has loaded AND the cold-start phase has
  // reached 'ready' AND there is no unacknowledged sync error.
  const isAppReady = !isLoading && coldStartPhase === 'ready' && syncError === null;

  const dismissSyncError = () => setSyncError(null);

  return { coldStartPhase, syncError, isAppReady, dismissSyncError };
}
