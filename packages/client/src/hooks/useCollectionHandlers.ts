/**
 * Hook: useCollectionHandlers
 * 
 * Initializes and memoizes all handlers required for collection detail operations.
 * This includes handlers for:
 * - Creating tasks, notes, and events
 * - Updating and deleting entries
 * - Reordering entries
 * - Managing collections (rename, delete, settings, favorites)
 * 
 * All handlers are memoized to prevent unnecessary recreations on re-renders.
 */

import { useMemo } from 'react';
import type { IEventStore, CollectionListProjection, EntryListProjection, TaskListProjection } from '@squickr/domain';
import {
  CreateTaskHandler,
  CreateSubTaskHandler,
  CreateNoteHandler,
  CreateEventHandler,
  CompleteTaskHandler,
  CompleteParentTaskHandler,
  ReopenTaskHandler,
  UpdateTaskTitleHandler,
  UpdateNoteContentHandler,
  UpdateEventContentHandler,
  UpdateEventDateHandler,
  DeleteTaskHandler,
  DeleteParentTaskHandler,
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
} from '@squickr/domain';

export interface CollectionHandlers {
  // Entry creation handlers
  createTaskHandler: CreateTaskHandler;
  createSubTaskHandler: CreateSubTaskHandler; // Phase 1: Sub-Tasks
  createNoteHandler: CreateNoteHandler;
  createEventHandler: CreateEventHandler;
  
  // Task state handlers
  completeTaskHandler: CompleteTaskHandler;
  completeParentTaskHandler: CompleteParentTaskHandler; // Phase 4: Completion cascade
  reopenTaskHandler: ReopenTaskHandler;
  
  // Entry update handlers
  updateTaskTitleHandler: UpdateTaskTitleHandler;
  updateNoteContentHandler: UpdateNoteContentHandler;
  updateEventContentHandler: UpdateEventContentHandler;
  updateEventDateHandler: UpdateEventDateHandler;
  
  // Entry deletion handlers
  deleteTaskHandler: DeleteTaskHandler;
  deleteParentTaskHandler: DeleteParentTaskHandler; // Phase 5: Deletion cascade
  deleteNoteHandler: DeleteNoteHandler;
  deleteEventHandler: DeleteEventHandler;
  
  // Entry reorder handlers
  reorderTaskHandler: ReorderTaskHandler;
  reorderNoteHandler: ReorderNoteHandler;
  reorderEventHandler: ReorderEventHandler;
  
  // Collection management handlers
  renameCollectionHandler: RenameCollectionHandler;
  deleteCollectionHandler: DeleteCollectionHandler;
  updateSettingsHandler: UpdateCollectionSettingsHandler;
  favoriteCollectionHandler: FavoriteCollectionHandler;
  unfavoriteCollectionHandler: UnfavoriteCollectionHandler;
}

export interface UseCollectionHandlersParams {
  eventStore: IEventStore;
  collectionProjection: CollectionListProjection;
  entryProjection: EntryListProjection;
  taskProjection: TaskListProjection;
}

/**
 * Initializes and returns all memoized handlers for collection detail operations
 */
export function useCollectionHandlers({
  eventStore,
  collectionProjection,
  entryProjection,
  taskProjection,
}: UseCollectionHandlersParams): CollectionHandlers {
  // Entry creation handlers
  const createTaskHandler = useMemo(
    () => new CreateTaskHandler(eventStore, taskProjection, entryProjection),
    [eventStore, taskProjection, entryProjection]
  );
  
  // Phase 1: Sub-Tasks handler
  const createSubTaskHandler = useMemo(
    () => new CreateSubTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const createNoteHandler = useMemo(
    () => new CreateNoteHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const createEventHandler = useMemo(
    () => new CreateEventHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Task state handlers
  const completeTaskHandler = useMemo(
    () => new CompleteTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Phase 4: Completion cascade handler
  const completeParentTaskHandler = useMemo(
    () => new CompleteParentTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const reopenTaskHandler = useMemo(
    () => new ReopenTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Entry update handlers
  const updateTaskTitleHandler = useMemo(
    () => new UpdateTaskTitleHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const updateNoteContentHandler = useMemo(
    () => new UpdateNoteContentHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const updateEventContentHandler = useMemo(
    () => new UpdateEventContentHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const updateEventDateHandler = useMemo(
    () => new UpdateEventDateHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Entry deletion handlers
  const deleteTaskHandler = useMemo(
    () => new DeleteTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Phase 5: Deletion cascade handler - FINAL PHASE!
  const deleteParentTaskHandler = useMemo(
    () => new DeleteParentTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const deleteNoteHandler = useMemo(
    () => new DeleteNoteHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const deleteEventHandler = useMemo(
    () => new DeleteEventHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Entry reorder handlers
  const reorderTaskHandler = useMemo(
    () => new ReorderTaskHandler(eventStore, entryProjection),
    [eventStore, entryProjection]
  );
  
  const reorderNoteHandler = useMemo(
    () => new ReorderNoteHandler(eventStore, entryProjection, entryProjection),
    [eventStore, entryProjection]
  );
  
  const reorderEventHandler = useMemo(
    () => new ReorderEventHandler(eventStore, entryProjection, entryProjection),
    [eventStore, entryProjection]
  );
  
  // Collection management handlers
  const renameCollectionHandler = useMemo(
    () => new RenameCollectionHandler(eventStore, collectionProjection),
    [eventStore, collectionProjection]
  );
  
  const deleteCollectionHandler = useMemo(
    () => new DeleteCollectionHandler(eventStore, collectionProjection),
    [eventStore, collectionProjection]
  );
  
  const updateSettingsHandler = useMemo(
    () => new UpdateCollectionSettingsHandler(eventStore, collectionProjection),
    [eventStore, collectionProjection]
  );
  
  const favoriteCollectionHandler = useMemo(
    () => new FavoriteCollectionHandler(eventStore, collectionProjection),
    [eventStore, collectionProjection]
  );
  
  const unfavoriteCollectionHandler = useMemo(
    () => new UnfavoriteCollectionHandler(eventStore, collectionProjection),
    [eventStore, collectionProjection]
  );

  return {
    createTaskHandler,
    createSubTaskHandler,
    createNoteHandler,
    createEventHandler,
    completeTaskHandler,
    completeParentTaskHandler,
    reopenTaskHandler,
    updateTaskTitleHandler,
    updateNoteContentHandler,
    updateEventContentHandler,
    updateEventDateHandler,
    deleteTaskHandler,
    deleteParentTaskHandler,
    deleteNoteHandler,
    deleteEventHandler,
    reorderTaskHandler,
    reorderNoteHandler,
    reorderEventHandler,
    renameCollectionHandler,
    deleteCollectionHandler,
    updateSettingsHandler,
    favoriteCollectionHandler,
    unfavoriteCollectionHandler,
  };
}
