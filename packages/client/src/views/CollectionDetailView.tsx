/**
 * Collection Detail View
 * 
 * Displays entries within a specific collection with ability to:
 * - Add new entries to the collection
 * - Edit/delete existing entries
 * - Move entries to other collections
 * - Reorder entries within the collection
 * 
 * Phase 2C: Full implementation with entry list
 * Phase 2 Refactor: Extracted handlers, modals, and operations into dedicated hooks
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Collection, Entry } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useCollectionHandlers } from '../hooks/useCollectionHandlers';
import { useCollectionModals } from '../hooks/useCollectionModals';
import { useEntryOperations } from '../hooks/useEntryOperations';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useCollectionNavigation } from '../hooks/useCollectionNavigation';
import { useTutorial } from '../hooks/useTutorial';
import { CollectionHeader } from '../components/CollectionHeader';
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
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { DEBOUNCE } from '../utils/constants';
import { getDateKeyForTemporal, getMonthKeyForTemporal } from '../utils/temporalUtils';
import { getCollectionDisplayName } from '../utils/formatters';

export function CollectionDetailView({ 
  collectionId: propCollectionId,
  date: temporalDate
}: { 
  collectionId?: string;
  date?: 'today' | 'yesterday' | 'tomorrow' | 'this-month' | 'last-month' | 'next-month';
} = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const collectionId = propCollectionId ?? paramId;
  const { 
    eventStore, 
    collectionProjection, 
    entryProjection, 
    taskProjection, 
    migrateTaskHandler, 
    migrateNoteHandler, 
    migrateEventHandler, 
    createCollectionHandler,
    addTaskToCollectionHandler,
    moveTaskToCollectionHandler,
    bulkMigrateEntriesHandler, // Phase 4: Batch migration
  } = useApp();
  const userPreferences = useUserPreferences();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const [isBulkMigrating, setIsBulkMigrating] = useState(false); // Phase 4: Loading state

  // Sub-task modal state
  const [isSubTaskModalOpen, setIsSubTaskModalOpen] = useState(false);
  const [subTaskParent, setSubTaskParent] = useState<Entry | null>(null);

  // Initialize all handlers (memoized to prevent recreation on every render)
  const handlers = useCollectionHandlers({
    eventStore,
    collectionProjection,
    entryProjection,
    taskProjection,
  });

  // Initialize modal states
  const modals = useCollectionModals();

  // Initialize entry operations
  const operations = useEntryOperations(
    {
      handlers,
      entries,
      collection,
      migrateTaskHandler,
      migrateNoteHandler,
      migrateEventHandler,
      createCollectionHandler,
      entryProjection, // Phase 4: Pass entryProjection for sub-task queries
      addTaskToCollectionHandler, // Phase 3: Multi-collection add
      moveTaskToCollectionHandler, // Phase 3: Multi-collection move
      bulkMigrateEntriesHandler, // Phase 4: Batch migration
    },
    {
      collectionId: resolvedCollectionId,
      onOpenRenameModal: modals.openRenameModal,
      onCloseDeleteModal: modals.closeDeleteModal,
      onOpenDeleteModal: modals.openDeleteModal,
      onOpenSettingsModal: modals.openSettingsModal,
      // Phase 4: Completion cascade confirmation dialog
      onShowConfirmCompleteParent: (taskId, incompleteCount, onConfirm) => {
        modals.openConfirmCompleteParent(taskId, incompleteCount, onConfirm);
      },
      // Phase 5: Deletion cascade confirmation dialog - FINAL PHASE!
      onShowConfirmDeleteParent: (taskId, childCount, onConfirm) => {
        modals.openConfirmDeleteParent(taskId, childCount, onConfirm);
      },
    }
  );

  // Load collection and entries
  const loadData = async () => {
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
        // Phase 2: Use getEntriesForCollectionView to get entries with ghost metadata
        const collectionEntries = await entryProjection.getEntriesForCollectionView(idForEntries);
        setEntries(collectionEntries);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load collection data');
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [collectionId, temporalDate, collectionProjection, entryProjection]);

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
      .filter(e => !(e as any).renderAsGhost)
      .map(e => e.id);
    selection.selectAll(allNonGhost);
  };

  const handleSelectActive = () => {
    // BUG FIX #2: Only select incomplete (open) tasks, not all non-migrated entries
    // Also exclude ghost entries (renderAsGhost: true) — they are visually invisible
    const activeEntries = entries
      .filter(e =>
        e.type === 'task' &&
        e.status === 'open' &&
        !e.migratedTo &&
        !(e as any).renderAsGhost
      )
      .map(e => e.id);
    selection.selectAll(activeEntries);
  };

  const handleSelectNotes = () => {
    const notes = entries
      .filter(e => e.type === 'note')
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

  // Success state - show collection and entries
  // Determine effective completed task behavior (with migration from boolean)
  const settings = collection.settings;
  
  // Migration: convert old collapseCompleted boolean to new behavior enum
  // If undefined, use global default preference
  const completedTaskBehavior = settings?.completedTaskBehavior !== undefined 
    ? settings.completedTaskBehavior 
    : settings?.collapseCompleted === true 
      ? 'collapse' 
      : settings?.collapseCompleted === false 
        ? 'keep-in-place' 
        : userPreferences.defaultCompletedTaskBehavior; // Use global default
  
  // Partition entries based on behavior mode
  const shouldPartition = completedTaskBehavior === 'move-to-bottom' || completedTaskBehavior === 'collapse';

  // Build the set of top-level task IDs present in this collection so we can
  // keep completed sub-tasks with their parent rather than moving them to the
  // completed section (where the parent isn't rendered and they'd show twice).
  const parentIdsInCollection = new Set(
    entries.filter(e => e.type === 'task' && !(e as any).parentEntryId).map(e => e.id)
  );
  const isSubTaskWithParentPresent = (e: Entry): boolean =>
    e.type === 'task' &&
    !!(e as any).parentEntryId &&
    parentIdsInCollection.has((e as any).parentEntryId as string);

  const activeTasks = shouldPartition
    ? entries.filter(e => !(e.type === 'task' && e.status === 'completed' && !isSubTaskWithParentPresent(e)))
    : entries;
  const completedTasks = shouldPartition
    ? entries.filter(e => e.type === 'task' && e.status === 'completed' && !isSubTaskWithParentPresent(e))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button and menu */}
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
      />

      {/* Entry list - dynamic bottom padding when selection toolbar is visible */}
      <div className={`py-8 px-4 ${selection.isSelectionMode ? 'pb-52' : 'pb-20'}`}>
        {/* Active entries (or all entries if not collapsed) */}
        <EntryList
          entries={activeTasks}
          onCompleteTask={operations.handleCompleteTask}
          onReopenTask={operations.handleReopenTask}
          onUpdateTaskTitle={operations.handleUpdateTaskTitle}
          onUpdateNoteContent={operations.handleUpdateNoteContent}
          onUpdateEventContent={operations.handleUpdateEventContent}
          onUpdateEventDate={operations.handleUpdateEventDate}
          onDelete={operations.handleDelete}
          onReorder={operations.handleReorder}
          onMigrate={operations.handleMigrateWithMode}
          collections={allCollections}
          currentCollectionId={resolvedCollectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : resolvedCollectionId}
          onNavigateToMigrated={operations.handleNavigateToMigrated}
          onCreateCollection={operations.handleCreateCollection}
          onAddSubTask={handleOpenSubTaskModal}
          isSelectionMode={selection.isSelectionMode}
          selectedEntryIds={selection.selectedEntryIds}
          onToggleSelection={selection.toggleSelection}
          getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
          getSubTasks={(parentEntryId) => entryProjection.getSubTasks(parentEntryId)}
          getSubTasksForMultipleParents={(parentIds) => entryProjection.getSubTasksForMultipleParents(parentIds)}
          getParentTitlesForSubTasks={(subTaskIds) => entryProjection.getParentTitlesForSubTasks(subTaskIds)}
        />

        {/* Completed tasks section - Mode 2: Move to bottom */}
        {completedTaskBehavior === 'move-to-bottom' && completedTasks.length > 0 && (
          <div className="mt-4 max-w-2xl mx-auto">
            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700" />
            
            <EntryList
              entries={completedTasks}
              onCompleteTask={operations.handleCompleteTask}
              onReopenTask={operations.handleReopenTask}
              onUpdateTaskTitle={operations.handleUpdateTaskTitle}
              onUpdateNoteContent={operations.handleUpdateNoteContent}
              onUpdateEventContent={operations.handleUpdateEventContent}
              onUpdateEventDate={operations.handleUpdateEventDate}
              onDelete={operations.handleDelete}
              onReorder={operations.handleReorder}
              onMigrate={operations.handleMigrateWithMode}
              collections={allCollections}
              currentCollectionId={resolvedCollectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : resolvedCollectionId}
              onNavigateToMigrated={operations.handleNavigateToMigrated}
              onCreateCollection={operations.handleCreateCollection}
              onAddSubTask={handleOpenSubTaskModal}
              isSelectionMode={selection.isSelectionMode}
              selectedEntryIds={selection.selectedEntryIds}
              onToggleSelection={selection.toggleSelection}
              getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
              getSubTasks={(parentEntryId) => entryProjection.getSubTasks(parentEntryId)}
              getSubTasksForMultipleParents={(parentIds) => entryProjection.getSubTasksForMultipleParents(parentIds)}
              getParentTitlesForSubTasks={(subTaskIds) => entryProjection.getParentTitlesForSubTasks(subTaskIds)}
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
              <EntryList
                entries={completedTasks}
                onCompleteTask={operations.handleCompleteTask}
                onReopenTask={operations.handleReopenTask}
                onUpdateTaskTitle={operations.handleUpdateTaskTitle}
                onUpdateNoteContent={operations.handleUpdateNoteContent}
                onUpdateEventContent={operations.handleUpdateEventContent}
                onUpdateEventDate={operations.handleUpdateEventDate}
                onDelete={operations.handleDelete}
                onReorder={operations.handleReorder}
                onMigrate={operations.handleMigrateWithMode}
                collections={allCollections}
                currentCollectionId={resolvedCollectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : resolvedCollectionId}
                onNavigateToMigrated={operations.handleNavigateToMigrated}
                onCreateCollection={operations.handleCreateCollection}
                onAddSubTask={handleOpenSubTaskModal}
                isSelectionMode={selection.isSelectionMode}
                selectedEntryIds={selection.selectedEntryIds}
                onToggleSelection={selection.toggleSelection}
                getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
                getSubTasks={(parentEntryId) => entryProjection.getSubTasks(parentEntryId)}
                getSubTasksForMultipleParents={(parentIds) => entryProjection.getSubTasksForMultipleParents(parentIds)}
                getParentTitlesForSubTasks={(subTaskIds) => entryProjection.getParentTitlesForSubTasks(subTaskIds)}
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
        entryCount={entries.length}
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
        parentTaskTitle={subTaskParent?.type === 'task' ? subTaskParent.title : ''}
        onClose={handleCloseSubTaskModal}
        onSubmit={handleCreateSubTask}
      />

      {/* Confirm complete parent modal (Phase 4: Completion Cascade) */}
      {modals.confirmCompleteParentData && (
        <ConfirmCompleteParentModal
          isOpen={modals.isConfirmCompleteParentOpen}
          incompleteCount={modals.confirmCompleteParentData.incompleteCount}
          onConfirm={modals.confirmCompleteParentData.onConfirm}
          onClose={modals.closeConfirmCompleteParent}
        />
      )}

      {/* Confirm delete parent modal (Phase 5: Deletion Cascade - FINAL PHASE!) */}
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
          isBulkMigrating={isBulkMigrating} // Phase 4: Loading state
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
    </div>
  );
}
