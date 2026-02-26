/**
 * App Context
 * 
 * Provides application-wide access to event store and projections.
 * Eliminates props drilling for shared infrastructure.
 * 
 * Phase 2A: Initial setup with CollectionListProjection
 * Phase 2B+: Will be used by Collection views
 * Phase 4: Added userPreferences to eliminate 6-level props drilling
 */

import { createContext, useContext } from 'react';
import type { 
  IEventStore, 
  EntryListProjection,
  TaskListProjection,
  CollectionListProjection,
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
  UserPreferences,
} from '@squickr/domain';

interface AppContextValue {
  eventStore: IEventStore;
  entryProjection: EntryListProjection;
  taskProjection: TaskListProjection;
  collectionProjection: CollectionListProjection;
  createCollectionHandler: CreateCollectionHandler;
  reorderCollectionHandler?: ReorderCollectionHandler;
  migrateTaskHandler: MigrateTaskHandler;
  migrateNoteHandler: MigrateNoteHandler;
  migrateEventHandler: MigrateEventHandler;
  addTaskToCollectionHandler: AddTaskToCollectionHandler;
  removeTaskFromCollectionHandler: RemoveTaskFromCollectionHandler;
  moveTaskToCollectionHandler: MoveTaskToCollectionHandler;
  addNoteToCollectionHandler: AddNoteToCollectionHandler;
  removeNoteFromCollectionHandler: RemoveNoteFromCollectionHandler;
  moveNoteToCollectionHandler: MoveNoteToCollectionHandler;
  addEventToCollectionHandler: AddEventToCollectionHandler;
  removeEventFromCollectionHandler: RemoveEventFromCollectionHandler;
  moveEventToCollectionHandler: MoveEventToCollectionHandler;
  bulkMigrateEntriesHandler: BulkMigrateEntriesHandler;
  userPreferences: UserPreferences;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = AppContext.Provider;

/**
 * Hook to access app context
 * @throws Error if used outside AppProvider
 */
export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

/**
 * Type-safe hook for accessing projections
 */
export function useProjections() {
  const { entryProjection, taskProjection, collectionProjection } = useApp();
  return { entryProjection, taskProjection, collectionProjection };
}
