/**
 * Hook: useEntryOperations
 * 
 * Provides all entry-related operations for the collection detail view.
 * This includes:
 * - Creating tasks, notes, and events
 * - Updating entry content and state
 * - Deleting entries
 * - Reordering entries
 * - Migrating entries between collections
 * - Managing collection operations (rename, delete, settings, favorites)
 * 
 * All operations are pre-bound with the necessary handlers and context.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Entry, Collection, CollectionSettings, MigrateTaskHandler, MigrateNoteHandler, MigrateEventHandler, CreateCollectionHandler } from '@squickr/domain';
import type { CollectionHandlers } from './useCollectionHandlers';
import { ROUTES, UNCATEGORIZED_COLLECTION_ID } from '../routes';

export interface UseEntryOperationsParams {
  handlers: CollectionHandlers;
  entries: Entry[];
  collection: Collection | null;
  migrateTaskHandler: MigrateTaskHandler;
  migrateNoteHandler: MigrateNoteHandler;
  migrateEventHandler: MigrateEventHandler;
  createCollectionHandler: CreateCollectionHandler;
}

export interface EntryOperations {
  // Entry creation operations
  handleCreateTask: (title: string) => Promise<void>;
  handleCreateNote: (content: string) => Promise<void>;
  handleCreateEvent: (content: string, eventDate?: string) => Promise<void>;
  
  // Task state operations
  handleCompleteTask: (taskId: string) => Promise<void>;
  handleReopenTask: (taskId: string) => Promise<void>;
  
  // Entry update operations
  handleUpdateTaskTitle: (taskId: string, title: string) => Promise<void>;
  handleUpdateNoteContent: (noteId: string, content: string) => Promise<void>;
  handleUpdateEventContent: (eventId: string, content: string) => Promise<void>;
  handleUpdateEventDate: (eventId: string, eventDate: string | null) => Promise<void>;
  
  // Entry deletion operations
  handleDelete: (entryId: string) => Promise<void>;
  
  // Entry reordering operations
  handleReorder: (entryId: string, previousEntryId: string | null, nextEntryId: string | null) => Promise<void>;
  
  // Entry migration operations
  handleMigrate: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  handleBulkMigrate: (entryIds: string[], targetCollectionId: string | null) => Promise<void>;
  handleNavigateToMigrated: (targetCollectionId: string | null) => void;
  handleCreateCollection: (name: string, type?: import('@squickr/domain').CollectionType, date?: string) => Promise<string>;
  
  // Collection operations
  handleRenameCollection: () => Promise<void>;
  handleRenameSubmit: (name: string) => Promise<void>;
  handleDeleteCollection: () => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleOpenSettings: () => Promise<void>;
  handleSettingsSubmit: (settings: CollectionSettings) => Promise<void>;
  handleToggleFavorite: () => Promise<void>;
}

export interface UseEntryOperationsConfig {
  collectionId?: string;
  onOpenRenameModal: () => void;
  onCloseDeleteModal: () => void;
  onOpenDeleteModal: () => void;
  onOpenSettingsModal: () => void;
}

/**
 * Provides all entry and collection operations for the collection detail view
 */
export function useEntryOperations(
  {
    handlers,
    entries,
    collection,
    migrateTaskHandler,
    migrateNoteHandler,
    migrateEventHandler,
    createCollectionHandler,
  }: UseEntryOperationsParams,
  config: UseEntryOperationsConfig
): EntryOperations {
  const navigate = useNavigate();
  const collectionId = collection?.id;

  // Entry creation operations
  const handleCreateTask = useCallback(async (title: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await handlers.createTaskHandler.handle({ title, collectionId: actualCollectionId });
  }, [handlers.createTaskHandler, collectionId]);

  const handleCreateNote = useCallback(async (content: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await handlers.createNoteHandler.handle({ content, collectionId: actualCollectionId });
  }, [handlers.createNoteHandler, collectionId]);

  const handleCreateEvent = useCallback(async (content: string, eventDate?: string) => {
    // If in uncategorized view, don't set collectionId (keep entries truly uncategorized)
    const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    await handlers.createEventHandler.handle({ content, eventDate, collectionId: actualCollectionId });
  }, [handlers.createEventHandler, collectionId]);

  // Task state operations
  const handleCompleteTask = useCallback(async (taskId: string) => {
    await handlers.completeTaskHandler.handle({ taskId });
  }, [handlers.completeTaskHandler]);

  const handleReopenTask = useCallback(async (taskId: string) => {
    await handlers.reopenTaskHandler.handle({ taskId });
  }, [handlers.reopenTaskHandler]);

  // Entry update operations
  const handleUpdateTaskTitle = useCallback(async (taskId: string, title: string) => {
    await handlers.updateTaskTitleHandler.handle({ taskId, title });
  }, [handlers.updateTaskTitleHandler]);

  const handleUpdateNoteContent = useCallback(async (noteId: string, content: string) => {
    await handlers.updateNoteContentHandler.handle({ noteId, content });
  }, [handlers.updateNoteContentHandler]);

  const handleUpdateEventContent = useCallback(async (eventId: string, content: string) => {
    await handlers.updateEventContentHandler.handle({ eventId, content });
  }, [handlers.updateEventContentHandler]);

  const handleUpdateEventDate = useCallback(async (eventId: string, eventDate: string | null) => {
    await handlers.updateEventDateHandler.handle({ eventId, eventDate });
  }, [handlers.updateEventDateHandler]);

  // Entry deletion operations
  const handleDelete = useCallback(async (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await handlers.deleteTaskHandler.handle({ taskId: entryId });
    } else if (entry.type === 'note') {
      await handlers.deleteNoteHandler.handle({ noteId: entryId });
    } else if (entry.type === 'event') {
      await handlers.deleteEventHandler.handle({ eventId: entryId });
    }
  }, [entries, handlers.deleteTaskHandler, handlers.deleteNoteHandler, handlers.deleteEventHandler]);

  // Entry reordering operations
  const handleReorder = useCallback(async (
    entryId: string,
    previousEntryId: string | null,
    nextEntryId: string | null
  ) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    if (entry.type === 'task') {
      await handlers.reorderTaskHandler.handle({
        taskId: entryId,
        previousTaskId: previousEntryId,
        nextTaskId: nextEntryId,
      });
    } else if (entry.type === 'note') {
      await handlers.reorderNoteHandler.handle({
        noteId: entryId,
        previousNoteId: previousEntryId,
        nextNoteId: nextEntryId,
      });
    } else if (entry.type === 'event') {
      await handlers.reorderEventHandler.handle({
        eventId: entryId,
        previousEventId: previousEntryId,
        nextEventId: nextEntryId,
      });
    }
  }, [entries, handlers.reorderTaskHandler, handlers.reorderNoteHandler, handlers.reorderEventHandler]);

  // Entry migration operations
  const handleMigrate = useCallback(async (entryId: string, targetCollectionId: string | null) => {
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
  }, [entries, migrateTaskHandler, migrateNoteHandler, migrateEventHandler]);

  const handleBulkMigrate = useCallback(async (entryIds: string[], targetCollectionId: string | null) => {
    // Migrate all entries sequentially
    // Note: This could be optimized with batch operations in the future
    for (const entryId of entryIds) {
      const entry = entries.find(e => e.id === entryId);
      if (!entry) continue;

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
    }
  }, [entries, migrateTaskHandler, migrateNoteHandler, migrateEventHandler]);

  const handleNavigateToMigrated = useCallback((targetCollectionId: string | null) => {
    if (targetCollectionId) {
      navigate(`/collection/${targetCollectionId}`);
    } else {
      navigate(`/collection/${UNCATEGORIZED_COLLECTION_ID}`);
    }
  }, [navigate]);

  const handleCreateCollection = useCallback(async (name: string, type?: import('@squickr/domain').CollectionType, date?: string): Promise<string> => {
    return await createCollectionHandler.handle({ name, type, date });
  }, [createCollectionHandler]);

  // Collection operations
  const handleRenameCollection = useCallback(async () => {
    config.onOpenRenameModal();
  }, [config]);

  const handleRenameSubmit = useCallback(async (name: string) => {
    if (!collectionId) return;
    await handlers.renameCollectionHandler.handle({
      collectionId,
      name: name.trim(),
    });
  }, [collectionId, handlers.renameCollectionHandler]);

  const handleDeleteCollection = useCallback(async () => {
    config.onOpenDeleteModal();
  }, [config]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!collectionId) return;
    await handlers.deleteCollectionHandler.handle({ collectionId });
    config.onCloseDeleteModal();
    navigate(ROUTES.index); // Navigate back to index after delete
  }, [collectionId, handlers.deleteCollectionHandler, config, navigate]);

  const handleOpenSettings = useCallback(async () => {
    config.onOpenSettingsModal();
  }, [config]);

  const handleSettingsSubmit = useCallback(async (settings: CollectionSettings) => {
    if (!collectionId) return;
    await handlers.updateSettingsHandler.handle({
      collectionId,
      settings,
    });
  }, [collectionId, handlers.updateSettingsHandler]);

  const handleToggleFavorite = useCallback(async () => {
    if (!collection) return;
    
    if (collection.isFavorite) {
      await handlers.unfavoriteCollectionHandler.handle({ collectionId: collection.id });
    } else {
      await handlers.favoriteCollectionHandler.handle({ collectionId: collection.id });
    }
  }, [collection, handlers.favoriteCollectionHandler, handlers.unfavoriteCollectionHandler]);

  return {
    handleCreateTask,
    handleCreateNote,
    handleCreateEvent,
    handleCompleteTask,
    handleReopenTask,
    handleUpdateTaskTitle,
    handleUpdateNoteContent,
    handleUpdateEventContent,
    handleUpdateEventDate,
    handleDelete,
    handleReorder,
    handleMigrate,
    handleBulkMigrate,
    handleNavigateToMigrated,
    handleCreateCollection,
    handleRenameCollection,
    handleRenameSubmit,
    handleDeleteCollection,
    handleDeleteConfirm,
    handleOpenSettings,
    handleSettingsSubmit,
    handleToggleFavorite,
  };
}
