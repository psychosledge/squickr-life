/**
 * Collection Detail View
 *
 * Displays entries within a specific collection with ability to:
 * - Add new entries to the collection
 * - Edit/delete existing entries
 * - Move entries to other collections
 * - Reorder entries within the collection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { Collection, Entry } from '@squickr/domain';
import { getLocalDateKey } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useCollectionHandlers } from '../hooks/useCollectionHandlers';
import { useCollectionModals } from '../hooks/useCollectionModals';
import { useEntryOperations } from '../hooks/useEntryOperations';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useCollectionNavigation } from '../hooks/useCollectionNavigation';
import { useTutorial } from '../hooks/useTutorial';
import { useHabitsForDate } from '../hooks/useHabitsForDate';
import { useHabitsManagement } from '../hooks/useHabitsManagement';
import { CollectionHeader } from '../components/CollectionHeader';
import { HabitsSection } from '../components/HabitsSection';
import { EntryList } from '../components/EntryList';
import { EntryInputModal } from '../components/EntryInputModal';
import { RenameCollectionModal } from '../components/RenameCollectionModal';
import { DeleteCollectionModal } from '../components/DeleteCollectionModal';
import { CollectionSettingsModal } from '../components/CollectionSettingsModal';
import { MigrateEntryDialog } from '../components/MigrateEntryDialog';
import { CreateSubTaskModal } from '../components/CreateSubTaskModal';
import { ConfirmCompleteParentModal } from '../components/ConfirmCompleteParentModal';
import { ConfirmDeleteParentModal } from '../components/ConfirmDeleteParentModal';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { SwipeIndicator } from '../components/SwipeIndicator';
import { FAB } from '../components/FAB';
import { ErrorToast } from '../components/ErrorToast';
import { MigrationBanner } from '../components/MigrationBanner';
import { CreateHabitModal } from '../components/CreateHabitModal';
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { DEBOUNCE } from '../utils/constants';
import { getDateKeyForTemporal, getMonthKeyForTemporal, buildDailyCollectionName, buildMonthlyCollectionName } from '../utils/temporalUtils';
import { getCollectionDisplayName } from '../utils/formatters';
import { getCompletedTaskBehavior } from '../utils/collectionSettings';

/** Extended entry type with ghost rendering metadata from the projection */
type EntryWithGhost = Entry & { renderAsGhost?: boolean };
/** Narrowed task entry type for accessing task-specific fields */
type TaskEntry = Extract<Entry, { type: 'task' }>;

/** Shared entry-list operations threaded through every EntryList section */
interface EntryListHandlers {
  handleCompleteTask: (taskId: string) => void;
  handleReopenTask: (taskId: string) => void;
  handleUpdateTaskTitle: (taskId: string, newTitle: string) => void;
  handleUpdateNoteContent: (noteId: string, newContent: string) => void;
  handleUpdateEventContent: (eventId: string, newContent: string) => void;
  handleDelete: (entryId: string) => void;
  handleRestore: (entryId: string, entryType: 'task' | 'note' | 'event') => Promise<void>;
  handleReorder: (entryId: string, previousEntryId: string | null, nextEntryId: string | null) => void;
  handleMigrateWithMode: (entryId: string, targetCollectionId: string | null, mode?: 'move' | 'add') => Promise<void>;
  handleNavigateToMigrated: (collectionId: string | null, migrationContext?: { collectionName: string; count: number }) => void;
  handleCreateCollection: (name: string) => Promise<string>;
  handleRemoveFromCollection: (taskId: string, collectionId: string) => Promise<void>;
}

/** Shared projection methods used to fetch sub-task and completion data */
interface EntryListProjection {
  getParentCompletionStatus: (taskId: string) => Promise<{ total: number; completed: number; allComplete: boolean }>;
  getSubTasks: (parentEntryId: string) => Promise<import('@squickr/domain').Task[]>;
  getSubTasksForMultipleParents: (parentIds: string[]) => Promise<Map<string, import('@squickr/domain').Task[]>>;
  getParentTitlesForSubTasks: (subTaskIds: string[]) => Promise<Map<string, string>>;
}

/** Selection mode state used by every EntryList section */
interface EntryListSelection {
  isSelectionMode: boolean;
  selectedEntryIds: Set<string>;
  toggleSelection: (entryId: string) => void;
}

/** Consolidated props for a single EntryList section in CollectionDetailView */
interface CollectionEntrySectionProps {
  entries: Entry[];
  operations: EntryListHandlers;
  allCollections: Collection[];
  resolvedCollectionId: string;
  selection: EntryListSelection;
  entryProjection: EntryListProjection;
  onAddSubTask: (entry: Entry) => void;
}

function CollectionEntrySection({
  entries,
  operations,
  allCollections,
  resolvedCollectionId,
  selection,
  entryProjection,
  onAddSubTask,
}: CollectionEntrySectionProps) {
  return (
    <EntryList
      entries={entries}
      onCompleteTask={operations.handleCompleteTask}
      onReopenTask={operations.handleReopenTask}
      onUpdateTaskTitle={operations.handleUpdateTaskTitle}
      onUpdateNoteContent={operations.handleUpdateNoteContent}
      onUpdateEventContent={operations.handleUpdateEventContent}
      onDelete={operations.handleDelete}
      onRestore={operations.handleRestore}
      onReorder={operations.handleReorder}
      onMigrate={operations.handleMigrateWithMode}
      collections={allCollections}
      currentCollectionId={resolvedCollectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : resolvedCollectionId}
      onNavigateToMigrated={operations.handleNavigateToMigrated}
      onCreateCollection={operations.handleCreateCollection}
      onAddSubTask={onAddSubTask}
      onRemoveFromCollection={operations.handleRemoveFromCollection}
      isSelectionMode={selection.isSelectionMode}
      selectedEntryIds={selection.selectedEntryIds}
      onToggleSelection={selection.toggleSelection}
      getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
      getSubTasks={(parentEntryId) => entryProjection.getSubTasks(parentEntryId)}
      getSubTasksForMultipleParents={(parentIds) => entryProjection.getSubTasksForMultipleParents(parentIds)}
      getParentTitlesForSubTasks={(subTaskIds) => entryProjection.getParentTitlesForSubTasks(subTaskIds)}
    />
  );
}

export function CollectionDetailView({ 
  collectionId: propCollectionId,
  date: temporalDate
}: { 
  collectionId?: string;
  date?: 'today' | 'yesterday' | 'tomorrow' | 'this-month' | 'last-month' | 'next-month';
} = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const collectionId = propCollectionId ?? paramId;
  const {
    eventStore,
    collectionProjection,
    entryProjection,
    createCollectionHandler,
    addTaskToCollectionHandler,
    moveTaskToCollectionHandler,
    removeTaskFromCollectionHandler,
    addNoteToCollectionHandler,
    moveNoteToCollectionHandler,
    addEventToCollectionHandler,
    moveEventToCollectionHandler,
    bulkMigrateEntriesHandler,
    restoreTaskHandler,
    restoreNoteHandler,
    restoreEventHandler,
  } = useApp();
  const userPreferences = useUserPreferences();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Migration banner state — populated from route location state on mount
  const [migrationNotice, setMigrationNotice] = useState<{ collectionName: string; count: number } | null>(null);

  const didReadLocationStateRef = useRef(false);
  useEffect(() => {
    if (didReadLocationStateRef.current) return;
    didReadLocationStateRef.current = true;
    const state = location.state as { migratedFrom?: { collectionName: string; count: number } } | null;
    if (state?.migratedFrom) {
      setMigrationNotice(state.migratedFrom);
      // Clear the location state immediately so back-navigation doesn't re-show the banner
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  // Habit hooks — only active for daily collections
  const habitDate = collection?.type === 'daily' && collection.date ? collection.date : '';
  const { habits, isLoading: habitsLoading } = useHabitsForDate(habitDate, { asOf: habitDate || undefined });
  const habitsMgmt = useHabitsManagement();
  const [isCreateHabitModalOpen, setIsCreateHabitModalOpen] = useState(false);

  // Tutorial Option A: resume when user first navigates into a collection,
  // but only AFTER loading is complete so Joyride's target elements are in the DOM.
  // Use a ref to ensure we only resume once per mount, even in StrictMode.
  const tutorial = useTutorial();
  const hasResumedRef = useRef(false);
  useEffect(() => {
    if (tutorial.isPaused && !isLoading && !hasResumedRef.current) {
      hasResumedRef.current = true;
      tutorial.resumeTutorial();
    }
  }, [tutorial.isPaused, tutorial.resumeTutorial, isLoading]);
  
  // Track resolved collection ID (actual UUID after temporal route resolution)
  // This ensures navigation and child components use the actual UUID, not temporal identifiers
  const [resolvedCollectionId, setResolvedCollectionId] = useState<string>('');

  // Selection mode state
  const selection = useSelectionMode();

  // Collection navigation with swipe feedback
  // Use resolved ID (actual UUID) instead of temporal identifier like "this-month"
  const navigation = useCollectionNavigation(resolvedCollectionId);

  // Migration modal state for bulk migration
  const [isBulkMigrateModalOpen, setIsBulkMigrateModalOpen] = useState(false);
  const [isBulkMigrating, setIsBulkMigrating] = useState(false);

  // Sub-task modal state
  const [isSubTaskModalOpen, setIsSubTaskModalOpen] = useState(false);
  const [subTaskParent, setSubTaskParent] = useState<Entry | null>(null);

  // Initialize all handlers (memoized to prevent recreation on every render)
  const handlers = useCollectionHandlers({
    eventStore,
    collectionProjection,
    entryProjection,
  });

  // Initialize modal states
  const modals = useCollectionModals();

  // Initialize entry operations
  const operations = useEntryOperations(
    {
      handlers,
      entries,
      collection,
      createCollectionHandler,
      entryProjection,
      addTaskToCollectionHandler,
      moveTaskToCollectionHandler,
      addNoteToCollectionHandler,
      moveNoteToCollectionHandler,
      addEventToCollectionHandler,
      moveEventToCollectionHandler,
      bulkMigrateEntriesHandler,
      restoreTaskHandler,
      restoreNoteHandler,
      restoreEventHandler,
      removeTaskFromCollectionHandler,
    },
    {
      collectionId: resolvedCollectionId,
      onOpenRenameModal: modals.openRenameModal,
      onCloseDeleteModal: modals.closeDeleteModal,
      onOpenDeleteModal: modals.openDeleteModal,
      onOpenSettingsModal: modals.openSettingsModal,
      onShowConfirmCompleteParent: (taskId, incompleteCount, onConfirm) => {
        modals.openConfirmCompleteParent(taskId, incompleteCount, onConfirm);
      },
      onShowConfirmDeleteParent: (taskId, childCount, onConfirm) => {
        modals.openConfirmDeleteParent(taskId, childCount, onConfirm);
      },
    }
  );

  // Ensure a temporal collection exists, creating it if missing
  const ensureCollectionForDate = useCallback(async (
    dateKey: string,
    type: 'daily' | 'monthly',
    collections: Collection[],
  ): Promise<Collection> => {
    const existing = collections.find(c => c.type === type && c.date === dateKey);
    if (existing) return existing;

    const name = type === 'daily'
      ? buildDailyCollectionName(dateKey)
      : buildMonthlyCollectionName(dateKey);

    const newId = await createCollectionHandler.handle({ name, type, date: dateKey });
    const refreshed = await collectionProjection.getCollections();
    const created = refreshed.find(c => c.id === newId);
    if (!created) throw new Error(`Failed to create ${type} collection for ${dateKey}.`);
    return created;
  }, [createCollectionHandler, collectionProjection]);

  // Load collection and entries
  const loadData = useCallback(async () => {
    if (!collectionId && !temporalDate) return;

    setIsLoading(true);
    
    try {
      // Load all collections (for migration modal)
      const collections = await collectionProjection.getCollections();
      setAllCollections(collections);
      
      let foundCollection: Collection | null = null;
      
      // Strategy 1: Temporal date lookup (NEW)
      if (temporalDate) {
        let targetDate: string;
        let targetType: 'daily' | 'monthly';
        
        if (temporalDate === 'this-month' || temporalDate === 'last-month' || temporalDate === 'next-month') {
          targetDate = getMonthKeyForTemporal(temporalDate);
          targetType = 'monthly';
        } else {
          targetDate = getDateKeyForTemporal(temporalDate);
          targetType = 'daily';
        }
        
        foundCollection = collections.find(c =>
          c.type === targetType && c.date === targetDate
        ) || null;

        // Auto-create for "today" silently — no user action required
        if (temporalDate === 'today' && !foundCollection) {
          try {
            foundCollection = await ensureCollectionForDate(targetDate, 'daily', collections);
            const refreshed = await collectionProjection.getCollections();
            setAllCollections(refreshed);
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to create today's daily log.");
            setIsLoading(false);
            return;
          }
        }
      }
      // Strategy 2: Virtual "uncategorized" collection (EXISTING)
      else if (collectionId === UNCATEGORIZED_COLLECTION_ID) {
        // Synthesize virtual collection
        setCollection({
          id: UNCATEGORIZED_COLLECTION_ID,
          name: 'Uncategorized',
          type: 'custom',
          order: '!',
          createdAt: new Date().toISOString(),
        });
        
        // Set resolved ID for uncategorized
        setResolvedCollectionId(UNCATEGORIZED_COLLECTION_ID);
        
        // Load orphaned entries (null collectionId)
        // Note: Uncategorized collection doesn't support ghost entries (no collection history)
        const orphanedEntries = await entryProjection.getEntriesByCollection(null);
        setEntries(orphanedEntries);
        
        setIsLoading(false);
        return;
      }
      // Strategy 3: Regular UUID lookup (EXISTING)
      else if (collectionId) {
        foundCollection = collections.find((c: Collection) => c.id === collectionId) || null;
      }
      
      setCollection(foundCollection);
      
      // Set resolved collection ID (actual UUID after temporal/UUID resolution)
      // This is critical for navigation to work correctly with temporal routes
      if (foundCollection) {
        setResolvedCollectionId(foundCollection.id);
      } else {
        setResolvedCollectionId('');
      }

      // Fetch entries (use collectionId if available, else use found collection's id)
      const idForEntries = collectionId || foundCollection?.id;
      if (idForEntries) {
        const collectionEntries = await entryProjection.getEntriesForCollectionView(idForEntries);
        // Soft-deleted entries are shown separately in a collapsible section
        const deletedEntries = await entryProjection.getDeletedEntries(idForEntries);
        setEntries([...collectionEntries, ...deletedEntries]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load collection data');
    } finally {
      setIsLoading(false);
    }
  }, [collectionId, temporalDate, collectionProjection, entryProjection, ensureCollectionForDate]);

  // Subscribe to projection changes (reactive updates with debouncing to prevent memory leaks)
  useEffect(() => {
    loadData();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoadData = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadData();
      }, DEBOUNCE.UI_UPDATE);
    };

    const unsubscribeCollection = collectionProjection.subscribe(debouncedLoadData);
    const unsubscribeEntry = entryProjection.subscribe(debouncedLoadData);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribeCollection();
      unsubscribeEntry();
    };
  }, [loadData, collectionProjection, entryProjection]);

  // Clear selection when navigating to different collection
  useEffect(() => {
    return () => {
      if (selection.isSelectionMode) {
        selection.exitSelectionMode();
      }
    };
  }, [collectionId]);

  // Selection mode handlers
  const handleSelectAll = () => {
    const allNonGhost = entries
      .filter(e => !(e as EntryWithGhost).renderAsGhost && !e.deletedAt)
      .map(e => e.id);
    selection.selectAll(allNonGhost);
  };

  const handleSelectActive = () => {
    // Only select incomplete (open) tasks — exclude ghost entries and deleted entries which are not actionable
    const activeEntries = entries
      .filter(e =>
        e.type === 'task' &&
        e.status === 'open' &&
        !e.migratedTo &&
        !(e as EntryWithGhost).renderAsGhost &&
        !e.deletedAt
      )
      .map(e => e.id);
    selection.selectAll(activeEntries);
  };

  const handleSelectNotes = () => {
    const notes = entries
      .filter(e => e.type === 'note' && !e.deletedAt)
      .map(e => e.id);
    selection.selectAll(notes);
  };

  const handleBulkMigrate = () => {
    // Open the migration modal with selected entries
    if (selection.selectedCount > 0) {
      setIsBulkMigrateModalOpen(true);
    }
  };

  const handleBulkMigrateSubmit = async (entryIds: string[], targetCollectionId: string, mode: 'move' | 'add') => {
    setIsBulkMigrating(true); // Add loading state
    try {
      await operations.handleBulkMigrateWithMode(entryIds, targetCollectionId, mode);
      setIsBulkMigrateModalOpen(false);
      selection.exitSelectionMode();
    } catch (error) {
      console.error('Bulk migration failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to migrate entries');
    } finally {
      setIsBulkMigrating(false); // Clear loading state
    }
  };

  const handleCloseBulkMigrateModal = () => {
    setIsBulkMigrateModalOpen(false);
  };

  const handleMigrateAllToToday = async () => {
    const todayKey = getLocalDateKey();
    let todayCollection: Collection;
    try {
      todayCollection = await ensureCollectionForDate(todayKey, 'daily', allCollections);
    } catch (error) {
      setErrorMessage("Failed to create today's daily log.");
      return;
    }
    const activeTaskIds = entries
      .filter(e =>
        e.type === 'task' &&
        e.status === 'open' &&
        !e.migratedTo &&
        !(e as EntryWithGhost).renderAsGhost &&
        !e.deletedAt
      )
      .map(e => e.id);
    if (activeTaskIds.length === 0) return;
    try {
      await operations.handleBulkMigrateWithMode(activeTaskIds, todayCollection.id, 'move');
      // collection is guaranteed non-null here: the button only renders when collection exists,
      // and the early-return above guards against a null collection state.
      operations.handleNavigateToMigrated(todayCollection.id, {
        collectionName: getCollectionDisplayName(collection!, new Date()),
        count: activeTaskIds.length,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to migrate tasks');
    }
  };

  const handleMigrateAllToTomorrow = async () => {
    const tomorrowKey = getDateKeyForTemporal('tomorrow');
    try {
      const tomorrowCollection = await ensureCollectionForDate(tomorrowKey, 'daily', allCollections);
      const activeTaskIds = entries
        .filter(e =>
          e.type === 'task' &&
          e.status === 'open' &&
          !e.migratedTo &&
          !(e as EntryWithGhost).renderAsGhost &&
          !e.deletedAt
        )
        .map(e => e.id);
      if (activeTaskIds.length === 0) return;
      await operations.handleBulkMigrateWithMode(activeTaskIds, tomorrowCollection.id, 'move');
      // collection is guaranteed non-null here: the button only renders when collection exists,
      // and activeTaskIds.length > 0 guard above already means we have a live collection.
      operations.handleNavigateToMigrated(tomorrowCollection.id, {
        collectionName: getCollectionDisplayName(collection!, new Date()),
        count: activeTaskIds.length,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to migrate tasks to tomorrow.');
    }
  };

  // Sub-task modal handlers
  const handleOpenSubTaskModal = (parentEntry: Entry) => {
    setSubTaskParent(parentEntry);
    setIsSubTaskModalOpen(true);
  };

  const handleCloseSubTaskModal = () => {
    setIsSubTaskModalOpen(false);
    setSubTaskParent(null);
  };

  const handleCreateSubTask = async (title: string) => {
    if (!subTaskParent || subTaskParent.type !== 'task') return;
    await operations.handleCreateSubTask(subTaskParent.id, title);
    handleCloseSubTaskModal();
  };

  const handleCreateTemporalCollection = async () => {
    if (!temporalDate || temporalDate === 'today') return;
    const isMonthly = temporalDate === 'this-month' || temporalDate === 'last-month' || temporalDate === 'next-month';
    const dateKey = isMonthly
      ? getMonthKeyForTemporal(temporalDate)
      : getDateKeyForTemporal(temporalDate);
    const type = isMonthly ? 'monthly' : 'daily';
    try {
      await ensureCollectionForDate(dateKey, type, allCollections);
      // Reactive subscription fires debouncedLoadData automatically — no manual re-fetch needed
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create collection.');
    }
  };

  // Success state - show collection and entries
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 text-lg">
          Loading...
        </div>
      </div>
    );
  }

  // Error state - collection not found (or load error — toast will indicate which)
  if (!collection) {
    const isTemporalCreate = temporalDate && temporalDate !== 'today' && !errorMessage;

    if (isTemporalCreate) {
      const isMonthly = temporalDate === 'this-month' || temporalDate === 'last-month' || temporalDate === 'next-month';
      const label = isMonthly ? 'monthly log' : 'daily log';

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No {label} yet
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              There's no {label} for this period.
            </p>
            <button
              onClick={handleCreateTemporalCollection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              type="button"
            >
              Create {label}
            </button>
            <button
              onClick={() => navigate(ROUTES.index)}
              className="ml-3 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-lg transition-colors"
              type="button"
            >
              Back to Collections
            </button>
          </div>
          {errorMessage && <ErrorToast message={errorMessage} onDismiss={() => setErrorMessage(null)} />}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Collection Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The collection you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate(ROUTES.index)}
            className="
              px-4 py-2
              bg-blue-600 text-white
              rounded-lg
              hover:bg-blue-700
              transition-colors
            "
            type="button"
          >
            Back to Collections
          </button>
        </div>

        {/* Error toast — shown when a load error caused the not-found state */}
        {errorMessage && (
          <ErrorToast
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}
      </div>
    );
  }

  // Determine effective completed task behavior (new enum, legacy boolean migration, global default)
  const completedTaskBehavior = getCompletedTaskBehavior(collection.settings, userPreferences);
  
  // Partition entries based on behavior mode
  const shouldPartition = completedTaskBehavior === 'move-to-bottom' || completedTaskBehavior === 'collapse';

  // Build the set of top-level task IDs present in this collection so we can
  // keep completed sub-tasks with their parent rather than moving them to the
  // completed section (where the parent isn't rendered and they'd show twice).
  const parentIdsInCollection = new Set(
    entries.filter(e => e.type === 'task' && !(e as TaskEntry).parentEntryId).map(e => e.id)
  );
  const isSubTaskWithParentPresent = (e: Entry): boolean =>
    e.type === 'task' &&
    !!(e as TaskEntry).parentEntryId &&
    parentIdsInCollection.has((e as TaskEntry).parentEntryId!);

  // Deleted entries are always shown in their own collapsible bucket, independent of completedTaskBehavior
  const deletedEntries = entries.filter(e => e.deletedAt);

  const activeTasks = shouldPartition
    ? entries.filter(e => {
        if (e.deletedAt) return false; // Deleted entries always go to deletedEntries bucket
        return !(e.type === 'task' && e.status === 'completed' && !isSubTaskWithParentPresent(e));
      })
    : entries.filter(e => !e.deletedAt); // keep-in-place: exclude deleted entries
  const completedTasks = shouldPartition
    ? entries.filter(e => {
        if (e.deletedAt) return false; // Deleted entries always go to deletedEntries bucket
        return e.type === 'task' && e.status === 'completed' && !isSubTaskWithParentPresent(e);
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button and menu */}
      {(() => {
        const todayKey = getLocalDateKey();
        const isTodaysLog = collection.type === 'daily' && collection.date === todayKey;
        const hasActiveTasks = entries.some(e =>
          e.type === 'task' &&
          e.status === 'open' &&
          !e.migratedTo &&
          !(e as EntryWithGhost).renderAsGhost &&
          !e.deletedAt
        );
        const showMigrateAllToToday = !isTodaysLog && hasActiveTasks && collection.id !== UNCATEGORIZED_COLLECTION_ID;
        const showMigrateAllToTomorrow = isTodaysLog && hasActiveTasks;
        return (
          <CollectionHeader
            collectionName={getCollectionDisplayName(collection, new Date())}
            collectionId={collection.id}
            onRename={operations.handleRenameCollection}
            onDelete={operations.handleDeleteCollection}
            onSettings={operations.handleOpenSettings}
            onToggleFavorite={collection.id === UNCATEGORIZED_COLLECTION_ID ? undefined : operations.handleToggleFavorite}
            isFavorite={collection.isFavorite}
            isVirtual={collection.id === UNCATEGORIZED_COLLECTION_ID}
            onEnterSelectionMode={selection.enterSelectionMode}
            onMigrateAllToToday={showMigrateAllToToday ? handleMigrateAllToToday : undefined}
            onMigrateAllToTomorrow={showMigrateAllToTomorrow ? handleMigrateAllToTomorrow : undefined}
          />
        );
      })()}

      {/* Migration banner — shown when navigated here after a bulk migrate-all */}
      {migrationNotice && (
        <MigrationBanner
          count={migrationNotice.count}
          collectionName={migrationNotice.collectionName}
          onDismiss={() => setMigrationNotice(null)}
        />
      )}

      {/* Entry list - dynamic bottom padding when selection toolbar is visible */}
      <div className={`py-8 px-4 ${selection.isSelectionMode ? 'pb-52' : 'pb-20'}`}>
        {/* Habits section — only shown for daily collections, above the entry list */}
        {collection.type === 'daily' && (
          <HabitsSection
            habits={habits}
            isLoading={habitsLoading}
            date={habitDate}
            collectionId={collection.id}
            onComplete={(cmd) => habitsMgmt.completeHabit(cmd)}
            onRevert={(cmd) => habitsMgmt.revertHabitCompletion(cmd)}
            onAddHabit={() => setIsCreateHabitModalOpen(true)}
            onNavigateToHabit={(habitId) => navigate(`/habits/${habitId}`)}
          />
        )}

        {/* Active entries (or all entries if not collapsed) */}
        <CollectionEntrySection
          entries={activeTasks}
          operations={operations}
          allCollections={allCollections}
          resolvedCollectionId={resolvedCollectionId}
          selection={selection}
          entryProjection={entryProjection}
          onAddSubTask={handleOpenSubTaskModal}
        />

        {/* Completed tasks section - Mode 2: Move to bottom */}
        {completedTaskBehavior === 'move-to-bottom' && completedTasks.length > 0 && (
          <div className="mt-4 max-w-2xl mx-auto">
            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700" />
            
            <CollectionEntrySection
              entries={completedTasks}
              operations={operations}
              allCollections={allCollections}
              resolvedCollectionId={resolvedCollectionId}
              selection={selection}
              entryProjection={entryProjection}
              onAddSubTask={handleOpenSubTaskModal}
            />
          </div>
        )}

        {/* Completed tasks section - Mode 3: Collapse */}
        {completedTaskBehavior === 'collapse' && completedTasks.length > 0 && (
          <div className="mt-4 max-w-2xl mx-auto">
            <button
              onClick={modals.toggleCompletedExpanded}
              className="
                w-full py-3 px-4
                flex items-center justify-center gap-2
                text-sm text-gray-500 dark:text-gray-400
                hover:text-gray-700 dark:hover:text-gray-300
                border-t border-b border-gray-200 dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-gray-800
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
              type="button"
            >
              <span>─── {completedTasks.length} completed {completedTasks.length === 1 ? 'task' : 'tasks'}</span>
              <svg
                className={`w-4 h-4 transition-transform ${modals.isCompletedExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {modals.isCompletedExpanded && (
              <div className="mt-4">
                <CollectionEntrySection
                  entries={completedTasks}
                  operations={operations}
                  allCollections={allCollections}
                  resolvedCollectionId={resolvedCollectionId}
                  selection={selection}
                  entryProjection={entryProjection}
                  onAddSubTask={handleOpenSubTaskModal}
                />
              </div>
            )}
          </div>
        )}

        {/* Deleted entries section — always collapsible, independent of completedTaskBehavior */}
        {deletedEntries.length > 0 && (
          <div className="mt-4 max-w-2xl mx-auto">
            <button
              onClick={modals.toggleDeletedExpanded}
              className="
                w-full py-3 px-4
                flex items-center justify-center gap-2
                text-sm text-gray-400 dark:text-gray-500
                hover:text-gray-600 dark:hover:text-gray-400
                border-t border-b border-gray-200 dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-gray-800
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
              type="button"
            >
              <span>─── {deletedEntries.length} deleted {deletedEntries.length === 1 ? 'entry' : 'entries'}</span>
              <svg
                className={`w-4 h-4 transition-transform ${modals.isDeletedExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {modals.isDeletedExpanded && (
              <div className="mt-4">
                <CollectionEntrySection
                  entries={deletedEntries}
                  operations={operations}
                  allCollections={allCollections}
                  resolvedCollectionId={resolvedCollectionId}
                  selection={selection}
                  entryProjection={entryProjection}
                  onAddSubTask={handleOpenSubTaskModal}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB for adding entries to this collection (hidden in selection mode) */}
      {!selection.isSelectionMode && <FAB onClick={modals.openModal} />}

      {/* Entry input modal - context-aware (adds to this collection) */}
      <EntryInputModal
        isOpen={modals.isModalOpen}
        onClose={modals.closeModal}
        onSubmitTask={operations.handleCreateTask}
        onSubmitNote={operations.handleCreateNote}
        onSubmitEvent={operations.handleCreateEvent}
      />

      {/* Rename collection modal */}
      <RenameCollectionModal
        isOpen={modals.isRenameModalOpen}
        currentName={collection.name}
        onClose={modals.closeRenameModal}
        onSubmit={operations.handleRenameSubmit}
      />

      {/* Delete collection modal */}
      <DeleteCollectionModal
        isOpen={modals.isDeleteModalOpen}
        collectionName={collection.name}
        entryCount={entries.filter(e => !e.deletedAt).length}
        onClose={modals.closeDeleteModal}
        onConfirm={operations.handleDeleteConfirm}
      />

      {/* Collection settings modal */}
      <CollectionSettingsModal
        isOpen={modals.isSettingsModalOpen}
        currentSettings={collection.settings}
        onClose={modals.closeSettingsModal}
        onSubmit={operations.handleSettingsSubmit}
      />

      {/* Create sub-task modal */}
      <CreateSubTaskModal
        isOpen={isSubTaskModalOpen}
        parentTaskTitle={subTaskParent?.type === 'task' ? subTaskParent.content : ''}
        onClose={handleCloseSubTaskModal}
        onSubmit={handleCreateSubTask}
      />

      {/* Confirm complete parent modal */}
      {modals.confirmCompleteParentData && (
        <ConfirmCompleteParentModal
          isOpen={modals.isConfirmCompleteParentOpen}
          incompleteCount={modals.confirmCompleteParentData.incompleteCount}
          onConfirm={modals.confirmCompleteParentData.onConfirm}
          onClose={modals.closeConfirmCompleteParent}
        />
      )}

      {/* Confirm delete parent modal */}
      {modals.confirmDeleteParentData && (
        <ConfirmDeleteParentModal
          isOpen={modals.isConfirmDeleteParentOpen}
          childCount={modals.confirmDeleteParentData.childCount}
          onConfirm={modals.confirmDeleteParentData.onConfirm}
          onClose={modals.closeConfirmDeleteParent}
        />
      )}

      {/* Bulk migration modal */}
      {selection.isSelectionMode && selection.selectedCount > 0 && (
        <MigrateEntryDialog
          isOpen={isBulkMigrateModalOpen}
          onClose={handleCloseBulkMigrateModal}
          entries={entries.filter(e => selection.selectedEntryIds.has(e.id))}
          currentCollectionId={resolvedCollectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : resolvedCollectionId}
          collections={allCollections}
          onMigrate={operations.handleMigrateWithMode}
          onBulkMigrate={handleBulkMigrateSubmit}
          onCreateCollection={operations.handleCreateCollection}
          isBulkMigrating={isBulkMigrating}
        />
      )}

      {/* Selection toolbar (appears when in selection mode) */}
      {selection.isSelectionMode && (
        <SelectionToolbar
          selectedCount={selection.selectedCount}
          onSelectAll={handleSelectAll}
          onSelectActive={handleSelectActive}
          onSelectNotes={handleSelectNotes}
          onClear={selection.clearSelection}
          onMigrate={handleBulkMigrate}
          onCancel={selection.exitSelectionMode}
        />
      )}

      {/* Swipe feedback indicator */}
      <SwipeIndicator
        isSwipeActive={navigation.isSwipeActive}
        swipeProgress={navigation.swipeProgress}
        previousCollectionName={navigation.previousCollection?.name ?? null}
        nextCollectionName={navigation.nextCollection?.name ?? null}
      />

      {/* Error toast — shown for load and bulk-migration failures */}
      {errorMessage && (
        <ErrorToast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* CreateHabitModal — opened from HabitsSection "Add habit" button */}
      {isCreateHabitModalOpen && (
        <CreateHabitModal
          isOpen={isCreateHabitModalOpen}
          onClose={() => setIsCreateHabitModalOpen(false)}
          onSubmit={async (cmd) => {
            await habitsMgmt.createHabit(cmd);
            setIsCreateHabitModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
