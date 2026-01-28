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
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Collection, Entry } from '@squickr/shared';
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
} from '@squickr/shared';
import { useApp } from '../context/AppContext';
import { CollectionHeader } from '../components/CollectionHeader';
import { EntryList } from '../components/EntryList';
import { EntryInputModal } from '../components/EntryInputModal';
import { RenameCollectionModal } from '../components/RenameCollectionModal';
import { DeleteCollectionModal } from '../components/DeleteCollectionModal';
import { FAB } from '../components/FAB';
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';

export function CollectionDetailView() {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { eventStore, collectionProjection, entryProjection, taskProjection } = useApp();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Initialize handlers with required projections
  const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
  const createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
  const createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  const completeTaskHandler = new CompleteTaskHandler(eventStore, taskProjection);
  const reopenTaskHandler = new ReopenTaskHandler(eventStore, taskProjection);
  const updateTaskTitleHandler = new UpdateTaskTitleHandler(eventStore, taskProjection);
  const updateNoteContentHandler = new UpdateNoteContentHandler(eventStore, entryProjection);
  const updateEventContentHandler = new UpdateEventContentHandler(eventStore, entryProjection);
  const updateEventDateHandler = new UpdateEventDateHandler(eventStore, entryProjection);
  const deleteTaskHandler = new DeleteTaskHandler(eventStore, taskProjection);
  const deleteNoteHandler = new DeleteNoteHandler(eventStore, entryProjection);
  const deleteEventHandler = new DeleteEventHandler(eventStore, entryProjection);
  const reorderTaskHandler = new ReorderTaskHandler(eventStore, taskProjection, entryProjection);
  const reorderNoteHandler = new ReorderNoteHandler(eventStore, entryProjection, entryProjection);
  const reorderEventHandler = new ReorderEventHandler(eventStore, entryProjection, entryProjection);
  const renameCollectionHandler = new RenameCollectionHandler(eventStore, collectionProjection);
  const deleteCollectionHandler = new DeleteCollectionHandler(eventStore, collectionProjection);

  // Load collection and entries
  const loadData = async () => {
    if (!collectionId) return;

    setIsLoading(true);
    
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
    const collections = await collectionProjection.getCollections();
    const foundCollection = collections.find(c => c.id === collectionId);
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
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with back button and menu */}
      <CollectionHeader
        collectionName={collection.name}
        onRename={handleRenameCollection}
        onDelete={handleDeleteCollection}
        isVirtual={collection.id === UNCATEGORIZED_COLLECTION_ID}
      />

      {/* Entry list */}
      <div className="py-8 px-4">
        <EntryList
          entries={entries}
          onCompleteTask={handleCompleteTask}
          onReopenTask={handleReopenTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
          onUpdateNoteContent={handleUpdateNoteContent}
          onUpdateEventContent={handleUpdateEventContent}
          onUpdateEventDate={handleUpdateEventDate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
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
    </div>
  );
}
