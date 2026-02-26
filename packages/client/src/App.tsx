import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Joyride, { type CallBackProps, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import type { Step } from 'react-joyride';
import {
  CreateCollectionHandler,
  ReorderCollectionHandler,
  MigrateTaskHandler,
  MigrateNoteHandler,
  MigrateEventHandler,
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
  EntryListProjection,
  TaskListProjection,
  CollectionListProjection,
  UserPreferencesProjection,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from '@squickr/domain';
import { IndexedDBEventStore, FirestoreEventStore } from '@squickr/infrastructure';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DebugProvider } from './context/DebugContext';
import { TutorialProvider } from './context/TutorialContext';
import { useTutorial } from './hooks/useTutorial';
import { TUTORIAL_STEP_COUNT } from './context/TutorialContext';
import { CollectionIndexView } from './views/CollectionIndexView';
import { CollectionDetailView } from './views/CollectionDetailView';
import { SignInView } from './views/SignInView';
import { SyncManager } from './firebase/SyncManager';
import { firestore } from './firebase/config';
import { ROUTES } from './routes';
import { logger } from './utils/logger';

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
  const [entryProjection] = useState(() => new EntryListProjection(eventStore));
  const [taskProjection] = useState(() => new TaskListProjection(eventStore));
  const [collectionProjection] = useState(() => new CollectionListProjection(eventStore));
  
  // Collection handlers
  const [createCollectionHandler] = useState(() => new CreateCollectionHandler(eventStore, collectionProjection));
  const [reorderCollectionHandler] = useState(() => new ReorderCollectionHandler(eventStore, collectionProjection));
  
  // Migration handlers (legacy single-collection)
  const [migrateTaskHandler] = useState(() => new MigrateTaskHandler(eventStore, entryProjection));
  const [migrateNoteHandler] = useState(() => new MigrateNoteHandler(eventStore, entryProjection));
  const [migrateEventHandler] = useState(() => new MigrateEventHandler(eventStore, entryProjection));
  
  // Multi-collection handlers (Phase 3)
  const [addTaskToCollectionHandler] = useState(() => new AddTaskToCollectionHandler(eventStore, entryProjection));
  const [removeTaskFromCollectionHandler] = useState(() => new RemoveTaskFromCollectionHandler(eventStore, entryProjection));
  const [moveTaskToCollectionHandler] = useState(() => {
    const addHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
    const removeHandler = new RemoveTaskFromCollectionHandler(eventStore, entryProjection);
    return new MoveTaskToCollectionHandler(addHandler, removeHandler, entryProjection);
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
  
  // User preferences (reactive)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  
  // UI state (for loading indicator only)
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if app is initialized (prevents double-init in React StrictMode)
  const isInitialized = useRef(false);
  
  // Background sync manager
  const syncManagerRef = useRef<SyncManager | null>(null);

  // Initialize IndexedDB and load tasks on mount
  useEffect(() => {
    // Prevent double initialization in React StrictMode (dev mode)
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;
    
    initializeApp();
  }, []);

  // Start/stop background sync when user signs in/out
  useEffect(() => {
    if (!user || isLoading) {
      // User signed out or still loading - stop sync
      syncManagerRef.current?.stop();
      syncManagerRef.current = null;
      return;
    }
    
    // User signed in - start background sync
    const remoteStore = new FirestoreEventStore(firestore, user.uid);
    const manager = new SyncManager(eventStore, remoteStore);
    manager.start();
    syncManagerRef.current = manager;
    
    logger.info('[App] Background sync started');
    
    return () => {
      manager.stop();
      logger.info('[App] Background sync stopped');
    };
  }, [user, isLoading, eventStore]);

  const initializeApp = async () => {
    try {
      // Initialize IndexedDB connection
      await eventStore.initialize();
      
      // Subscribe to user preferences changes
      const userPrefsProjection = new UserPreferencesProjection(eventStore);
      
      // Load initial preferences
      const prefs = await userPrefsProjection.getUserPreferences();
      setUserPreferences(prefs);
      
      // Subscribe to changes
      userPrefsProjection.subscribe(async () => {
        const updatedPrefs = await userPrefsProjection.getUserPreferences();
        setUserPreferences(updatedPrefs);
      });
    } catch (error) {
      logger.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    migrateTaskHandler,
    migrateNoteHandler,
    migrateEventHandler,
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
    userPreferences,
  };

  // Show main app for authenticated users
  return (
    <AppProvider value={contextValue}>
      <DebugProvider>
        <TutorialJoyride />
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
