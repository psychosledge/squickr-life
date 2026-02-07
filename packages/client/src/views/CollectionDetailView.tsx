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

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Collection, Entry } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useCollectionHandlers } from '../hooks/useCollectionHandlers';
import { useCollectionModals } from '../hooks/useCollectionModals';
import { useEntryOperations } from '../hooks/useEntryOperations';
import { useSelectionMode } from '../hooks/useSelectionMode';
import { useCollectionNavigation } from '../hooks/useCollectionNavigation';
import { CollectionHeader } from '../components/CollectionHeader';
import { EntryList } from '../components/EntryList';
import { EntryInputModal } from '../components/EntryInputModal';
import { RenameCollectionModal } from '../components/RenameCollectionModal';
import { DeleteCollectionModal } from '../components/DeleteCollectionModal';
import { CollectionSettingsModal } from '../components/CollectionSettingsModal';
import { MigrateEntryModal } from '../components/MigrateEntryModal';
import { CreateSubTaskModal } from '../components/CreateSubTaskModal';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { SwipeIndicator } from '../components/SwipeIndicator';
import { FAB } from '../components/FAB';
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { DEBOUNCE } from '../utils/constants';

export function CollectionDetailView() {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventStore, collectionProjection, entryProjection, taskProjection, migrateTaskHandler, migrateNoteHandler, migrateEventHandler, createCollectionHandler } = useApp();
  const userPreferences = useUserPreferences();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection mode state
  const selection = useSelectionMode();

  // Collection navigation with swipe feedback
  const navigation = useCollectionNavigation(collectionId || '');

  // Migration modal state for bulk migration
  const [isBulkMigrateModalOpen, setIsBulkMigrateModalOpen] = useState(false);

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
    },
    {
      collectionId,
      onOpenRenameModal: modals.openRenameModal,
      onCloseDeleteModal: modals.closeDeleteModal,
      onOpenDeleteModal: modals.openDeleteModal,
      onOpenSettingsModal: modals.openSettingsModal,
    }
  );

  // Load collection and entries
  const loadData = async () => {
    if (!collectionId) return;

    setIsLoading(true);
    
    // Load all collections (for migration modal)
    const collections = await collectionProjection.getCollections();
    setAllCollections(collections);
    
    // Handle virtual "uncategorized" collection
    if (collectionId === UNCATEGORIZED_COLLECTION_ID) {
      // Synthesize virtual collection
      setCollection({
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        type: 'custom',
        order: '!',
        createdAt: new Date().toISOString(),
      });
      
      // Load orphaned entries (null collectionId)
      const orphanedEntries = await entryProjection.getEntriesByCollection(null);
      setEntries(orphanedEntries);
      
      setIsLoading(false);
      return;
    }
    
    // Handle real collections
    const foundCollection = collections.find((c: Collection) => c.id === collectionId);
    setCollection(foundCollection || null);

    const collectionEntries = await entryProjection.getEntriesByCollection(collectionId);
    setEntries(collectionEntries);

    setIsLoading(false);
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
  }, [collectionId, collectionProjection, entryProjection]);

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
    selection.selectAll(entries.map(e => e.id));
  };

  const handleSelectIncomplete = () => {
    const incompleteTasks = entries
      .filter(e => e.type === 'task' && e.status !== 'completed')
      .map(e => e.id);
    selection.selectAll(incompleteTasks);
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

  const handleBulkMigrateSubmit = async (entryIds: string[], targetCollectionId: string | null) => {
    await operations.handleBulkMigrate(entryIds, targetCollectionId);
    setIsBulkMigrateModalOpen(false);
    selection.exitSelectionMode();
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

  // Error state - collection not found
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
  const activeTasks = shouldPartition
    ? entries.filter(e => !(e.type === 'task' && e.status === 'completed'))
    : entries;
  const completedTasks = shouldPartition
    ? entries.filter(e => e.type === 'task' && e.status === 'completed')
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button and menu */}
      <CollectionHeader
        collectionName={collection.name}
        collectionId={collection.id}
        onRename={operations.handleRenameCollection}
        onDelete={operations.handleDeleteCollection}
        onSettings={operations.handleOpenSettings}
        onToggleFavorite={collection.id === UNCATEGORIZED_COLLECTION_ID ? undefined : operations.handleToggleFavorite}
        isFavorite={collection.isFavorite}
        isVirtual={collection.id === UNCATEGORIZED_COLLECTION_ID}
        onEnterSelectionMode={selection.enterSelectionMode}
      />

      {/* Entry list */}
      <div className="py-8 px-4 pb-20">
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
          onMigrate={operations.handleMigrate}
          collections={allCollections}
          currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
          onNavigateToMigrated={operations.handleNavigateToMigrated}
          onCreateCollection={operations.handleCreateCollection}
          onAddSubTask={handleOpenSubTaskModal}
          isSelectionMode={selection.isSelectionMode}
          selectedEntryIds={selection.selectedEntryIds}
          onToggleSelection={selection.toggleSelection}
          getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
          getSubTasks={(parentTaskId) => entryProjection.getSubTasks(parentTaskId)}
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
              onMigrate={operations.handleMigrate}
              collections={allCollections}
              currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
              onNavigateToMigrated={operations.handleNavigateToMigrated}
              onCreateCollection={operations.handleCreateCollection}
              onAddSubTask={handleOpenSubTaskModal}
              isSelectionMode={selection.isSelectionMode}
              selectedEntryIds={selection.selectedEntryIds}
              onToggleSelection={selection.toggleSelection}
              getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
              getSubTasks={(parentTaskId) => entryProjection.getSubTasks(parentTaskId)}
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
                onMigrate={operations.handleMigrate}
                collections={allCollections}
                currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
                onNavigateToMigrated={operations.handleNavigateToMigrated}
                onCreateCollection={operations.handleCreateCollection}
                onAddSubTask={handleOpenSubTaskModal}
                isSelectionMode={selection.isSelectionMode}
                selectedEntryIds={selection.selectedEntryIds}
                onToggleSelection={selection.toggleSelection}
                getCompletionStatus={(taskId) => entryProjection.getParentCompletionStatus(taskId)}
                getSubTasks={(parentTaskId) => entryProjection.getSubTasks(parentTaskId)}
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

      {/* Bulk migration modal */}
      {selection.isSelectionMode && selection.selectedCount > 0 && (
        <MigrateEntryModal
          isOpen={isBulkMigrateModalOpen}
          onClose={handleCloseBulkMigrateModal}
          entries={entries.filter(e => selection.selectedEntryIds.has(e.id))}
          currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
          collections={allCollections}
          onMigrate={operations.handleMigrate}
          onBulkMigrate={handleBulkMigrateSubmit}
          onCreateCollection={operations.handleCreateCollection}
        />
      )}

      {/* Selection toolbar (appears when in selection mode) */}
      {selection.isSelectionMode && (
        <SelectionToolbar
          selectedCount={selection.selectedCount}
          onSelectAll={handleSelectAll}
          onSelectIncomplete={handleSelectIncomplete}
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
    </div>
  );
}
