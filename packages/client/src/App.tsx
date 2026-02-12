import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  CreateCollectionHandler,
  ReorderCollectionHandler,
  MigrateTaskHandler,
  MigrateNoteHandler,
  MigrateEventHandler,
  AddTaskToCollectionHandler,
  RemoveTaskFromCollectionHandler,
  MoveTaskToCollectionHandler,
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
import { CollectionIndexView } from './views/CollectionIndexView';
import { CollectionDetailView } from './views/CollectionDetailView';
import { SignInView } from './views/SignInView';
import { SyncManager } from './firebase/SyncManager';
import { firestore } from './firebase/config';
import { ROUTES } from './routes';
import { logger } from './utils/logger';

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
    bulkMigrateEntriesHandler,
    userPreferences,
  };

  // Show main app for authenticated users
  return (
    <AppProvider value={contextValue}>
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
    </AppProvider>
  );
}

/**
 * Root App component with AuthProvider
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
