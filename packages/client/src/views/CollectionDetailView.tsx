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
 * 
 * TODO: Refactor - This file is 476 lines and approaching the 500-line threshold.
 * Consider extracting handler initialization, modal state, and entry operations into separate hooks.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Collection, Entry, CollectionSettings } from '@squickr/shared';
import {
  CreateTaskHandler,
  CreateNoteHandler,
  CreateEventHandler,
  CompleteTaskHandler,
  ReopenTaskHandler,
  UpdateTaskTitleHandler,
  UpdateNoteContentHandler,
  UpdateEventContentHandler,
  UpdateEventDateHandler,
  DeleteTaskHandler,
  DeleteNoteHandler,
  DeleteEventHandler,
  ReorderTaskHandler,
  ReorderNoteHandler,
  ReorderEventHandler,
  RenameCollectionHandler,
  DeleteCollectionHandler,
  UpdateCollectionSettingsHandler,
  FavoriteCollectionHandler,
  UnfavoriteCollectionHandler,
} from '@squickr/shared';
import { useApp } from '../context/AppContext';
import { CollectionHeader } from '../components/CollectionHeader';
import { EntryList } from '../components/EntryList';
import { EntryInputModal } from '../components/EntryInputModal';
import { RenameCollectionModal } from '../components/RenameCollectionModal';
import { DeleteCollectionModal } from '../components/DeleteCollectionModal';
import { CollectionSettingsModal } from '../components/CollectionSettingsModal';
import { FAB } from '../components/FAB';
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';

export function CollectionDetailView() {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventStore, collectionProjection, entryProjection, taskProjection, migrateTaskHandler, migrateNoteHandler, migrateEventHandler, createCollectionHandler } = useApp();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  // Initialize handlers with required projections
  const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
  const createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
  const createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  const completeTaskHandler = new CompleteTaskHandler(eventStore, entryProjection);
  const reopenTaskHandler = new ReopenTaskHandler(eventStore, entryProjection);
  const updateTaskTitleHandler = new UpdateTaskTitleHandler(eventStore, entryProjection);
  const updateNoteContentHandler = new UpdateNoteContentHandler(eventStore, entryProjection);
  const updateEventContentHandler = new UpdateEventContentHandler(eventStore, entryProjection);
  const updateEventDateHandler = new UpdateEventDateHandler(eventStore, entryProjection);
  const deleteTaskHandler = new DeleteTaskHandler(eventStore, entryProjection);
  const deleteNoteHandler = new DeleteNoteHandler(eventStore, entryProjection);
  const deleteEventHandler = new DeleteEventHandler(eventStore, entryProjection);
  const reorderTaskHandler = new ReorderTaskHandler(eventStore, entryProjection);
  const reorderNoteHandler = new ReorderNoteHandler(eventStore, entryProjection, entryProjection);
  const reorderEventHandler = new ReorderEventHandler(eventStore, entryProjection, entryProjection);
  const renameCollectionHandler = new RenameCollectionHandler(eventStore, collectionProjection);
  const deleteCollectionHandler = new DeleteCollectionHandler(eventStore, collectionProjection);
  const updateSettingsHandler = new UpdateCollectionSettingsHandler(eventStore, collectionProjection);
  const favoriteCollectionHandler = new FavoriteCollectionHandler(eventStore, collectionProjection);
  const unfavoriteCollectionHandler = new UnfavoriteCollectionHandler(eventStore, collectionProjection);

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

  // Subscribe to projection changes (reactive updates)
  useEffect(() => {
    loadData();

    const unsubscribeCollection = collectionProjection.subscribe(() => {
      loadData();
    });

    const unsubscribeEntry = entryProjection.subscribe(() => {
      loadData();
    });

    return () => {
      unsubscribeCollection();
      unsubscribeEntry();
    };
  }, [collectionId, collectionProjection, entryProjection]);

  // Handlers for entry operations
  const handleCreateTask = async (title: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await createTaskHandler.handle({ title, collectionId: actualCollectionId });
  };

  const handleCreateNote = async (content: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await createNoteHandler.handle({ content, collectionId: actualCollectionId });
  };

  const handleCreateEvent = async (content: string, eventDate?: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await createEventHandler.handle({ content, eventDate, collectionId: actualCollectionId });
  };

  const handleCompleteTask = async (taskId: string) => {
    await completeTaskHandler.handle({ taskId });
  };

  const handleReopenTask = async (taskId: string) => {
    await reopenTaskHandler.handle({ taskId });
  };

  const handleUpdateTaskTitle = async (taskId: string, title: string) => {
    await updateTaskTitleHandler.handle({ taskId, title });
  };

  const handleUpdateNoteContent = async (noteId: string, content: string) => {
    await updateNoteContentHandler.handle({ noteId, content });
  };

  const handleUpdateEventContent = async (eventId: string, content: string) => {
    await updateEventContentHandler.handle({ eventId, content });
  };

  const handleUpdateEventDate = async (eventId: string, eventDate: string | null) => {
    await updateEventDateHandler.handle({ eventId, eventDate });
  };

  const handleDelete = async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await deleteTaskHandler.handle({ taskId: entryId });
    } else if (entry.type === 'note') {
      await deleteNoteHandler.handle({ noteId: entryId });
    } else if (entry.type === 'event') {
      await deleteEventHandler.handle({ eventId: entryId });
    }
  };

  const handleReorder = async (
    entryId: string,
    previousEntryId: string | null,
    nextEntryId: string | null
  ) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await reorderTaskHandler.handle({
        taskId: entryId,
        previousTaskId: previousEntryId,
        nextTaskId: nextEntryId,
      });
    } else if (entry.type === 'note') {
      await reorderNoteHandler.handle({
        noteId: entryId,
        previousNoteId: previousEntryId,
        nextNoteId: nextEntryId,
      });
    } else if (entry.type === 'event') {
      await reorderEventHandler.handle({
        eventId: entryId,
        previousEventId: previousEntryId,
        nextEventId: nextEntryId,
      });
    }
  };

  const handleRenameCollection = async () => {
    setIsRenameModalOpen(true);
  };

  const handleRenameSubmit = async (name: string) => {
    if (!collection) return;
    await renameCollectionHandler.handle({
      collectionId: collection.id,
      name: name.trim(),
    });
  };

  const handleDeleteCollection = async () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!collection) return;
    await deleteCollectionHandler.handle({ collectionId: collection.id });
    setIsDeleteModalOpen(false);
    navigate(ROUTES.index); // Navigate back to index after delete
  };

  const handleOpenSettings = async () => {
    setIsSettingsModalOpen(true);
  };

  const handleSettingsSubmit = async (settings: CollectionSettings) => {
    if (!collection) return;
    await updateSettingsHandler.handle({
      collectionId: collection.id,
      settings,
    });
  };

  const handleMigrate = async (entryId: string, targetCollectionId: string | null) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    switch (entry.type) {
      case 'task':
        await migrateTaskHandler.handle({ taskId: entryId, targetCollectionId });
        break;
      case 'note':
        await migrateNoteHandler.handle({ noteId: entryId, targetCollectionId });
        break;
      case 'event':
        await migrateEventHandler.handle({ eventId: entryId, targetCollectionId });
        break;
    }
  };

  const handleNavigateToMigrated = (targetCollectionId: string | null) => {
    if (targetCollectionId) {
      navigate(`/collection/${targetCollectionId}`);
    } else {
      navigate(`/collection/${UNCATEGORIZED_COLLECTION_ID}`);
    }
  };

  const handleCreateCollection = async (name: string, type?: import('@squickr/shared').CollectionType, date?: string): Promise<string> => {
    return await createCollectionHandler.handle({ name, type, date });
  };

  const handleToggleFavorite = async () => {
    if (!collection) return;
    
    if (collection.isFavorite) {
      await unfavoriteCollectionHandler.handle({ collectionId: collection.id });
    } else {
      await favoriteCollectionHandler.handle({ collectionId: collection.id });
    }
  };

  // Loading state
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
  // Filter entries based on collapse settings
  const collapseCompleted = collection.settings?.collapseCompleted ?? false;
  const activeTasks = collapseCompleted
    ? entries.filter(e => !(e.type === 'task' && e.status === 'completed'))
    : entries;
  const completedTasks = collapseCompleted
    ? entries.filter(e => e.type === 'task' && e.status === 'completed')
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button and menu */}
      <CollectionHeader
        collectionName={collection.name}
        collectionId={collection.id}
        onRename={handleRenameCollection}
        onDelete={handleDeleteCollection}
        onSettings={handleOpenSettings}
        onToggleFavorite={collection.id === UNCATEGORIZED_COLLECTION_ID ? undefined : handleToggleFavorite}
        isFavorite={collection.isFavorite}
        isVirtual={collection.id === UNCATEGORIZED_COLLECTION_ID}
      />

      {/* Entry list */}
      <div className="py-8 px-4">
        {/* Active entries (or all entries if not collapsed) */}
        <EntryList
          entries={activeTasks}
          onCompleteTask={handleCompleteTask}
          onReopenTask={handleReopenTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
          onUpdateNoteContent={handleUpdateNoteContent}
          onUpdateEventContent={handleUpdateEventContent}
          onUpdateEventDate={handleUpdateEventDate}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onMigrate={handleMigrate}
          collections={allCollections}
          currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
          onNavigateToMigrated={handleNavigateToMigrated}
          onCreateCollection={handleCreateCollection}
        />

        {/* Collapsible completed tasks section */}
        {collapseCompleted && completedTasks.length > 0 && (
          <div className="mt-8 max-w-4xl mx-auto">
            <button
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
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
                className={`w-4 h-4 transition-transform ${isCompletedExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isCompletedExpanded && (
              <div className="mt-4">
                <EntryList
                  entries={completedTasks}
                  onCompleteTask={handleCompleteTask}
                  onReopenTask={handleReopenTask}
                  onUpdateTaskTitle={handleUpdateTaskTitle}
                  onUpdateNoteContent={handleUpdateNoteContent}
                  onUpdateEventContent={handleUpdateEventContent}
                  onUpdateEventDate={handleUpdateEventDate}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                  onMigrate={handleMigrate}
                  collections={allCollections}
                  currentCollectionId={collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId}
                  onNavigateToMigrated={handleNavigateToMigrated}
                  onCreateCollection={handleCreateCollection}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB for adding entries to this collection */}
      <FAB onClick={() => setIsModalOpen(true)} />

      {/* Entry input modal - context-aware (adds to this collection) */}
      <EntryInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmitTask={handleCreateTask}
        onSubmitNote={handleCreateNote}
        onSubmitEvent={handleCreateEvent}
      />

      {/* Rename collection modal */}
      <RenameCollectionModal
        isOpen={isRenameModalOpen}
        currentName={collection.name}
        onClose={() => setIsRenameModalOpen(false)}
        onSubmit={handleRenameSubmit}
      />

      {/* Delete collection modal */}
      <DeleteCollectionModal
        isOpen={isDeleteModalOpen}
        collectionName={collection.name}
        entryCount={entries.length}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Collection settings modal */}
      <CollectionSettingsModal
        isOpen={isSettingsModalOpen}
        currentSettings={collection.settings}
        onClose={() => setIsSettingsModalOpen(false)}
        onSubmit={handleSettingsSubmit}
      />
    </div>
  );
}
