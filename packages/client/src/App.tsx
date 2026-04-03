import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Joyride, { type CallBackProps, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { Step } from 'react-joyride';
import {
  CreateCollectionHandler,
  ReorderCollectionHandler,
  RestoreCollectionHandler,
  MigrateTaskHandler,
  AddTaskToCollectionHandler,
  RemoveTaskFromCollectionHandler,
  MoveTaskToCollectionHandler,
  AddNoteToCollectionHandler,
  RemoveNoteFromCollectionHandler,
  MoveNoteToCollectionHandler,
  AddEventToCollectionHandler,
  RemoveEventFromCollectionHandler,
  MoveEventToCollectionHandler,
  BulkMigrateEntriesHandler,
  RestoreTaskHandler,
  RestoreNoteHandler,
  RestoreEventHandler,
  EntryListProjection,
  TaskListProjection,
  CollectionListProjection,
  UserPreferencesProjection,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
  // Habit handlers (Phase 2)
  CreateHabitHandler,
  UpdateHabitTitleHandler,
  UpdateHabitFrequencyHandler,
  CompleteHabitHandler,
  RevertHabitCompletionHandler,
  ArchiveHabitHandler,
  RestoreHabitHandler as RestoreHabitHandlerClass,
  ReorderHabitHandler,
  // Habit notification handlers (Phase 3.3)
  SetHabitNotificationTimeHandler,
  ClearHabitNotificationTimeHandler,
} from '@squickr/domain';
import { IndexedDBEventStore, FirestoreEventStore, IndexedDBSnapshotStore, FirestoreSnapshotStore } from '@squickr/infrastructure';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DebugProvider } from './context/DebugContext';
import { TutorialProvider } from './context/TutorialContext';
import { useTutorial } from './hooks/useTutorial';
import { TUTORIAL_STEP_COUNT } from './context/TutorialContext';
import { CollectionIndexView } from './views/CollectionIndexView';
import { CollectionDetailView } from './views/CollectionDetailView';
import { ReviewView } from './views/ReviewView';
import { HabitsView } from './views/HabitsView';
import { HabitDetailView } from './views/HabitDetailView';
import { SignInView } from './views/SignInView';
import { SyncManager } from './firebase/SyncManager';
import { SnapshotManager } from './snapshot-manager';
import { firestore } from './firebase/config';
import { registerFcmToken } from './firebase/fcm';
import { ROUTES } from './routes';
import { logger } from './utils/logger';

// ─── ADR-024: Cold-start phase type ───────────────────────────────────────────
// 'checking'  — auth resolved, determining whether remote restore is needed
// 'restoring' — fetching / seeding remote snapshot into local store
// 'syncing'   — SyncManager initial sync in progress (overlay shown)
// 'ready'     — app ready for user interaction
export type ColdStartPhase = 'checking' | 'restoring' | 'syncing' | 'ready';

// ─── Tutorial Step Definitions ────────────────────────────────────────────────
// Real DOM anchors use data-tutorial-id attributes added in Commit 3.
// Steps 4–6 use Option A: tutorial pauses after Step 3 until user enters a
// collection (see TutorialJoyride pause/resume logic below).

const TUTORIAL_STEPS: Step[] = [
  {
    target: '[data-tutorial-id="tutorial-welcome"]',
    title: 'Welcome to Squickr Life',
    content:
      'Squickr Life is a bullet journal app built for getting things done — ' +
      'faster. This quick tour shows you the essentials. Takes about 60 seconds.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-collection-list"]',
    title: 'Collections are your journal pages',
    content:
      'Each collection is a page in your journal. You might have a page for ' +
      'Today, one for Work Projects, one for Home. ' +
      'Pinned (★) collections stay at the top. Daily logs are grouped by year and month.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-fab"]',
    title: 'Create your first collection',
    content:
      'Tap this button to create a collection. You can make a Daily Log ' +
      '(linked to a date), or a Custom collection for any topic — projects, ' +
      'habits, reading lists, whatever you need.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-fab"]',
    title: 'Three entry types: tasks, notes, events',
    content: (
      <div style={{ textAlign: 'left' }}>
        <p style={{ margin: '0 0 8px 0' }}>Tap + to add an entry. Choose your type:</p>
        <ul style={{ margin: '0 0 8px 0', paddingLeft: 0, listStyle: 'none' }}>
          <li style={{ marginBottom: 4 }}>☐ Task — something to do (check the box to complete it)</li>
          <li style={{ marginBottom: 4 }}>📝 Note — a thought, reference, or observation</li>
          <li>📅 Event — something happening on a date</li>
        </ul>
        <p style={{ margin: '8px 0 0 0' }}>Type your entry and press Enter or tap Save.</p>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-collection-menu"]',
    title: 'Manage your collection',
    content:
      'Tap ⋮ to rename, delete, or adjust settings for this collection. ' +
      'Use Settings to control how completed tasks are displayed. ' +
      'Use Add to Favorites to pin a collection to the top of your list.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-collection-menu"]',
    title: 'Migrate entries between collections',
    content:
      'Tap ⋮ → Select Entries to choose multiple entries at once, ' +
      'then migrate them to another collection. ' +
      'You can also tap ⋮ on any individual entry row to migrate, edit, or delete it. ' +
      'Ghost entries (→) show where tasks originally came from.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial-id="tutorial-navigation"]',
    title: 'Flip between pages like a real journal',
    content:
      'Use the ‹ › arrows to flip between collections — or swipe left/right on mobile. ' +
      "You're all set! Tap your profile picture any time to access Help, Settings, " +
      'and to restart this tour.',
    placement: 'bottom',
    disableBeacon: true,
  },
];

// Verify step count matches the shared constant used by TutorialContext's nextStep() guard.
// If this throws, update TUTORIAL_STEP_COUNT in TutorialContext.tsx to match.
if (TUTORIAL_STEPS.length !== TUTORIAL_STEP_COUNT) {
  throw new Error(
    `TUTORIAL_STEPS has ${TUTORIAL_STEPS.length} steps but TUTORIAL_STEP_COUNT is ${TUTORIAL_STEP_COUNT}. Keep them in sync.`,
  );
}

// ─── Tutorial Joyride Wrapper ─────────────────────────────────────────────────

/**
 * Renders the react-joyride component in controlled mode.
 * Must live inside TutorialProvider so it can read/write tutorial state.
 *
 * Option A pause/resume: after Step 3 (index 2, the FAB step), the tutorial
 * advances to stepIndex 3 then immediately pauses. CollectionDetailView
 * resumes when the user first navigates into a collection.
 */
function TutorialJoyride() {
  const tutorial = useTutorial();

  // Index of the last step shown on the index page (FAB step)
  const PAUSE_AFTER_STEP_INDEX = 2;

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, status, type, index } = data;

    // Advance step on NEXT action (controlled mode: we manage stepIndex)
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      // Option A: pause after Step 3 (FAB step, index 2).
      // Do NOT advance stepIndex yet — keep stepIndex=2 while paused so Joyride
      // never tries to render a step targeting elements that don't exist on the
      // index page. CollectionDetailView calls resumeTutorial() on mount, which
      // triggers a nextStep() there to advance to step 3 before restarting Joyride.
      if (index === PAUSE_AFTER_STEP_INDEX) {
        tutorial.pauseTutorial();
        return;
      }

      // Last step: clicking Finish fires STEP_AFTER+NEXT before STATUS.FINISHED.
      // Complete here so the tooltip closes immediately.
      if (index === TUTORIAL_STEP_COUNT - 1) {
        tutorial.completeTutorial();
        return;
      }

      tutorial.nextStep();
      return;
    }

    // Back button is disabled via hideBackButton={true} prop on <Joyride>
    // (prevStep() not yet implemented — desync risk if Back were enabled)

    // Tutorial finished (reached last step) or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      tutorial.completeTutorial();
      return;
    }

    // Close button pressed mid-tour (dismiss without completing)
    if (action === ACTIONS.CLOSE) {
      tutorial.stopTutorial();
    }
  };

  return (
    <Joyride
      steps={TUTORIAL_STEPS}
      run={tutorial.isRunning}
      stepIndex={tutorial.stepIndex}
      continuous
      showSkipButton
      hideBackButton
      locale={{ skip: 'Skip Tour', last: 'Finish' }}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 10000,
          width: 340,
        },
      }}
    />
  );
}

/**
 * Main App Component
 * 
 * Phase 2D: Collection-first interface
 * Phase 3: Authentication UI
 * - Shows SignInView for unauthenticated users
 * - Shows Collections for authenticated users
 * Phase 4-6: Background Sync (Issue #2)
 * - Auto-sync every 5 minutes
 * - Sync on window focus, network reconnect, tab visibility
 */
function AppContent() {
  const { user, loading: authLoading } = useAuth();
  
  // Initialize event sourcing infrastructure with IndexedDB persistence
  const [eventStore] = useState(() => new IndexedDBEventStore());
  const [snapshotStore] = useState(() => new IndexedDBSnapshotStore());
  const [entryProjection] = useState(() => new EntryListProjection(eventStore, snapshotStore));
  const [taskProjection] = useState(() => new TaskListProjection(eventStore));
  const [collectionProjection] = useState(() => new CollectionListProjection(eventStore));
  const [userPreferencesProjection] = useState(() => new UserPreferencesProjection(eventStore));
  
  // Collection handlers
  const [createCollectionHandler] = useState(() => new CreateCollectionHandler(eventStore, collectionProjection));
  const [reorderCollectionHandler] = useState(() => new ReorderCollectionHandler(eventStore, collectionProjection));
  const [restoreCollectionHandler] = useState(() => new RestoreCollectionHandler(eventStore, collectionProjection));
  
  // Migration handlers (legacy single-collection — tasks only)
  const [migrateTaskHandler] = useState(() => new MigrateTaskHandler(eventStore, entryProjection));
  
  // Multi-collection handlers (Phase 3)
  const [addTaskToCollectionHandler] = useState(() => new AddTaskToCollectionHandler(eventStore, entryProjection));
  const [removeTaskFromCollectionHandler] = useState(() => new RemoveTaskFromCollectionHandler(eventStore, entryProjection));
  const [moveTaskToCollectionHandler] = useState(() => {
    const addHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
    return new MoveTaskToCollectionHandler(eventStore, addHandler, entryProjection);
  });
  
  // Note multi-collection handlers
  const [addNoteToCollectionHandler] = useState(() => new AddNoteToCollectionHandler(eventStore, entryProjection));
  const [removeNoteFromCollectionHandler] = useState(() => new RemoveNoteFromCollectionHandler(eventStore, entryProjection));
  const [moveNoteToCollectionHandler] = useState(() => {
    const addHandler = new AddNoteToCollectionHandler(eventStore, entryProjection);
    const removeHandler = new RemoveNoteFromCollectionHandler(eventStore, entryProjection);
    return new MoveNoteToCollectionHandler(addHandler, removeHandler, entryProjection);
  });

  // Event entry multi-collection handlers
  const [addEventToCollectionHandler] = useState(() => new AddEventToCollectionHandler(eventStore, entryProjection));
  const [removeEventFromCollectionHandler] = useState(() => new RemoveEventFromCollectionHandler(eventStore, entryProjection));
  const [moveEventToCollectionHandler] = useState(() => {
    const addHandler = new AddEventToCollectionHandler(eventStore, entryProjection);
    const removeHandler = new RemoveEventFromCollectionHandler(eventStore, entryProjection);
    return new MoveEventToCollectionHandler(addHandler, removeHandler, entryProjection);
  });
  
  // Bulk migration handler (Phase 4: ADR-013)
  const [bulkMigrateEntriesHandler] = useState(() => new BulkMigrateEntriesHandler(eventStore, entryProjection));
  
  // Restore handlers (Item 3: Recoverable Deleted Entries)
  const [restoreTaskHandler] = useState(() => new RestoreTaskHandler(eventStore, entryProjection));
  const [restoreNoteHandler] = useState(() => new RestoreNoteHandler(eventStore, entryProjection));
  const [restoreEventHandler] = useState(() => new RestoreEventHandler(eventStore, entryProjection));

  // Habit handlers (Phase 2)
  const [createHabitHandler] = useState(() => new CreateHabitHandler(eventStore));
  const [updateHabitTitleHandler] = useState(() => new UpdateHabitTitleHandler(eventStore));
  const [updateHabitFrequencyHandler] = useState(() => new UpdateHabitFrequencyHandler(eventStore));
  const [completeHabitHandler] = useState(() => new CompleteHabitHandler(eventStore));
  const [revertHabitCompletionHandler] = useState(() => new RevertHabitCompletionHandler(eventStore));
  const [archiveHabitHandler] = useState(() => new ArchiveHabitHandler(eventStore));
  const [restoreHabitHandler] = useState(() => new RestoreHabitHandlerClass(eventStore));
  const [reorderHabitHandler] = useState(() => new ReorderHabitHandler(eventStore));
  // Habit notification handlers (Phase 3.3)
  const [setHabitNotificationTimeHandler] = useState(() => new SetHabitNotificationTimeHandler(eventStore));
  const [clearHabitNotificationTimeHandler] = useState(() => new ClearHabitNotificationTimeHandler(eventStore));
  
  // User preferences (reactive)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  
  // UI state (for loading indicator only)
  const [isLoading, setIsLoading] = useState(true);

  // ── ADR-024: Cold-start phase state machine ─────────────────────────────────
  // Replaces the previous isRemoteRestoring + isSyncing boolean pair.
  // Type is declared at module scope (exported) so tests can reference it.
  const [coldStartPhase, setColdStartPhase] = useState<ColdStartPhase>('checking');

  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Track if app is initialized (prevents double-init in React StrictMode)
  const isInitialized = useRef(false);
  
  // Background sync manager
  const syncManagerRef = useRef<SyncManager | null>(null);

  // Snapshot manager
  const snapshotManagerRef = useRef<SnapshotManager | null>(null);

  // Track if a remote snapshot was restored (skips sync overlay on cold-start)
  const restoredFromRemoteRef = useRef(false);

  // Initialize IndexedDB and load tasks on mount
  useEffect(() => {
    // Prevent double initialization in React StrictMode (dev mode)
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    initializeApp().then(() => {
      const sm = new SnapshotManager(
        entryProjection,
        snapshotStore,
        null,
        eventStore,
        collectionProjection,
        50,
        entryProjection.habitProjection,
        userPreferencesProjection,
      );
      sm.start();
      snapshotManagerRef.current = sm;
    });

    return () => {
      snapshotManagerRef.current?.stop();
    };
  }, []);

  // When there is no user, SignInView is rendered via the `if (!user)` guard in
  // the render path — isAppReady plays no role.  We intentionally leave
  // coldStartPhase as 'checking' so that when the user later signs in,
  // isAppReady starts as false and cannot trigger the tutorial prematurely
  // before startSync() has run (ADR-024 bug fix).

  // Start/stop background sync when user signs in/out
  useEffect(() => {
    if (!user || isLoading) {
      // User signed out or still loading - stop sync
      syncManagerRef.current?.stop();
      syncManagerRef.current = null;
      return;
    }
    
    // User signed in - start background sync.
    // Reset to 'checking' synchronously: the no-user guard may have left
    // coldStartPhase as 'ready' (and therefore isAppReady=true) while
    // SignInView was shown. If we don't reset here, CollectionIndexView's
    // tutorial effect fires before startSync() can set the session flag.
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
      entryProjection.habitProjection,
      userPreferencesProjection,
    );
    sm.start();
    snapshotManagerRef.current = sm;

    let cancelled = false;

    const startSync = async () => {
      // ── ADR-024: Cold-start sequencer ──────────────────────────────────────
      // Read the emptiness flag captured by initializeApp()'s hydrate() call.
      // This is the single check that decides whether to fetch a remote snapshot.
      const isEmptyLocalStore = entryProjection.wasLocalStoreEmptyAtHydration();
      logger.info('[App] Cold-start: isEmptyLocalStore =', isEmptyLocalStore);

      // Set the tutorial-suppression flag synchronously — before any await — so it
      // is guaranteed to be in sessionStorage before isAppReady can become true,
      // regardless of which cold-start path executes (ADR-024).
      if (isEmptyLocalStore) {
        sessionStorage.setItem('squickr_cold_start_restored', 'true');
      }

      if (!isEmptyLocalStore) {
        // ── Fast path: local store has data — skip Firestore round-trip ──────
        // Advance to 'ready' synchronously before starting background sync so
        // there is no render cycle where the app is "checking" but not ready.
        if (!cancelled) setColdStartPhase('ready');
        const manager = new SyncManager(
          eventStore,
          remoteEventStore,
          undefined,
          () => entryProjection.getLastSnapshotCursor(),
        );
        manager.onSyncStateChange = (_syncing: boolean, error?: string) => {
          if (error) setSyncError(error);
        };
        manager.start();
        syncManagerRef.current = manager;
        logger.info('[App] Cold-start fast path: background sync started (local store non-empty)');
        return;
      }

      // ── Slow path: local store is empty — attempt remote snapshot restore ──
      // Uses a 10-second timeout (ADR-024: increased from 5s — see Rationale).
      logger.info('[App] Cold-start: local store empty — attempting remote snapshot restore…');
      try {
        const remoteSnapshot = await Promise.race([
          remoteSnapshotStore.load('entry-list-projection'),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 10_000)),
        ]);

        logger.info('[App] Cold-start: remote snapshot result =', remoteSnapshot ? `found (savedAt=${remoteSnapshot.savedAt}, lastEventId=${remoteSnapshot.lastEventId})` : 'null (not found or timed out)');

        if (cancelled) {
          logger.info('[App] Cold-start: cancelled before snapshot check');
          return;
        }

        if (remoteSnapshot) {
          // Remote snapshot found — seed local store and re-hydrate
          if (!cancelled) setColdStartPhase('restoring');
          await snapshotStore.save('entry-list-projection', remoteSnapshot);
          await entryProjection.hydrate();
          // Seed collection list from snapshot if available (ADR-024)
          if (remoteSnapshot.collections?.length) {
            collectionProjection.seedFromSnapshot(remoteSnapshot.collections);
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
            '[App] Cold-start: remote snapshot restored — cache populated:',
            restoredFromRemoteRef.current,
          );
        }
      } catch (err) {
        logger.warn('[App] Remote snapshot restore failed, falling back to normal sync:', err);
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
        // event log to download.  Sync continues in the background; errors surface
        // via syncError state (non-blocking "Show local data" button).
        if (!cancelled) setColdStartPhase('ready');
        manager.onSyncStateChange = (_syncing: boolean, error?: string) => {
          if (error) setSyncError(error);
        };
      } else {
        // Normal path (null / timed-out snapshot): show overlay until initial sync
        // completes so the user never sees an empty state while events download.
        if (!cancelled) setColdStartPhase('syncing');
        let initialSnapshotSaved = false;
        manager.onSyncStateChange = (syncing: boolean, error?: string) => {
          setSyncError(error ?? null);
          if (!syncing) {
            setColdStartPhase('ready');
            // After initial sync completes, proactively save a snapshot so Firestore
            // has one available for future cold-starts on new devices / incognito.
            if (!initialSnapshotSaved) {
              initialSnapshotSaved = true;
              void snapshotManagerRef.current?.saveSnapshot('post-initial-sync');
            }
          }
        };
      }

      manager.start();
      syncManagerRef.current = manager;

      logger.info('[App] Background sync started');
    };

    void startSync();
    
    return () => {
      cancelled = true;
      restoredFromRemoteRef.current = false;
      syncManagerRef.current?.stop();
      syncManagerRef.current = null;
      logger.info('[App] Background sync stopped');
    };
  }, [user, isLoading, eventStore, snapshotStore, entryProjection]);

  const initializeApp = async () => {
    try {
      // Initialize IndexedDB connection
      await eventStore.initialize();

      // Initialize snapshot store and hydrate projection from snapshot
      await snapshotStore.initialize();
      await entryProjection.hydrate();

      // Load initial preferences (uses userPreferencesProjection created above)
      const prefs = await userPreferencesProjection.getUserPreferences();
      setUserPreferences(prefs);

      // Subscribe to changes
      userPreferencesProjection.subscribe(async () => {
        const updatedPrefs = await userPreferencesProjection.getUserPreferences();
        setUserPreferences(updatedPrefs);
      });
    } catch (error) {
      logger.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // The app is "ready" once IndexedDB has loaded AND the cold-start phase has
  // reached 'ready' AND there is no unacknowledged sync error.
  // Background syncs after the first do not block (coldStartPhase stays 'ready').
  // When a sync error occurs, the overlay stays visible until the user dismisses
  // it with "Show local data".
  const isAppReady =
    !isLoading &&
    coldStartPhase === 'ready' &&
    syncError === null;

  // Register FCM token once the app is ready and the user is signed in.
  // 2-second delay keeps it off the critical path so it doesn't compete with
  // the initial render. Silent fail — registerFcmToken never throws.
  useEffect(() => {
    if (!isAppReady || !user) return;
    const timer = setTimeout(() => {
      registerFcmToken(user.uid).catch(() => { /* silent fail */ });
    }, 2000);
    return () => clearTimeout(timer);
  }, [isAppReady, user?.uid]);

  // Show loading while auth state or IndexedDB is initializing
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show sign-in view if user is not authenticated
  if (!user) {
    return <SignInView />;
  }

  // Create context value for AppProvider
  const contextValue = {
    eventStore,
    entryProjection,
    taskProjection,
    collectionProjection,
    createCollectionHandler,
    reorderCollectionHandler,
    restoreCollectionHandler,
    migrateTaskHandler,
    addTaskToCollectionHandler,
    removeTaskFromCollectionHandler,
    moveTaskToCollectionHandler,
    addNoteToCollectionHandler,
    removeNoteFromCollectionHandler,
    moveNoteToCollectionHandler,
    addEventToCollectionHandler,
    removeEventFromCollectionHandler,
    moveEventToCollectionHandler,
    bulkMigrateEntriesHandler,
    restoreTaskHandler,
    restoreNoteHandler,
    restoreEventHandler,
    userPreferences,
    isAppReady,
    // Habit handlers (Phase 2)
    createHabitHandler,
    updateHabitTitleHandler,
    updateHabitFrequencyHandler,
    completeHabitHandler,
    revertHabitCompletionHandler,
    archiveHabitHandler,
    restoreHabitHandler,
    reorderHabitHandler,
    // Habit notification handlers (Phase 3.3)
    setHabitNotificationTimeHandler,
    clearHabitNotificationTimeHandler,
  };

  // Show main app for authenticated users
  return (
    <AppProvider value={contextValue}>
      <DebugProvider>
        <TutorialJoyride />

        {/* ── Cold-start overlay ───────────────────────────────────────────────
            Shown while the cold-start sequencer is in progress.
            Prevents the empty-state flash and premature tutorial trigger
            on new devices downloading 900+ events for the first time.       */}
        {!isAppReady && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4
                       bg-gray-50 dark:bg-gray-900"
            role="status"
            aria-live="polite"
            data-testid="sync-overlay"
          >
            {syncError ? (
              /* ── Timeout / error state ── */
              <>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-xs">
                  {syncError}
                </p>
                <button
                  onClick={() => setSyncError(null)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                             hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  Show local data
                </button>
              </>
            ) : (
              /* ── Default spinner state ── */
              <>
                <div
                  className="w-8 h-8 border-4 border-blue-600 border-t-transparent
                             rounded-full animate-spin"
                  aria-hidden="true"
                />
                <p className="text-gray-600 dark:text-gray-400">
                  {coldStartPhase === 'checking' || coldStartPhase === 'restoring'
                    ? 'Restoring your journal…'
                    : 'Syncing your journal…'}
                </p>
              </>
            )}
          </div>
        )}

        <BrowserRouter>
          <Routes>
            {/* Temporal paths - use date prop instead of TemporalRoute components */}
            <Route path="/today" element={<CollectionDetailView date="today" />} />
            <Route path="/yesterday" element={<CollectionDetailView date="yesterday" />} />
            <Route path="/tomorrow" element={<CollectionDetailView date="tomorrow" />} />
            <Route path="/this-month" element={<CollectionDetailView date="this-month" />} />
            <Route path="/last-month" element={<CollectionDetailView date="last-month" />} />
            <Route path="/next-month" element={<CollectionDetailView date="next-month" />} />
            
            {/* Phase 2D: Collection Index is now the default */}
            <Route path={ROUTES.index} element={<CollectionIndexView />} />
            <Route path={ROUTES.collection} element={<CollectionDetailView />} />
            <Route path={ROUTES.review} element={<ReviewView />} />
            <Route path={ROUTES.habits} element={<HabitsView />} />
            <Route path={ROUTES.habitDetail} element={<HabitDetailView />} />
          </Routes>
        </BrowserRouter>
      </DebugProvider>
    </AppProvider>
  );
}

/**
 * Root App component with AuthProvider and TutorialProvider
 */
function App() {
  return (
    <AuthProvider>
      <TutorialProvider>
        <AppContent />
      </TutorialProvider>
    </AuthProvider>
  );
}

export default App;
