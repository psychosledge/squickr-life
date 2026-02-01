import type { Entry, Collection } from '@squickr/shared';
import { TaskEntryItem } from './TaskEntryItem';
import { NoteEntryItem } from './NoteEntryItem';
import { EventEntryItem } from './EventEntryItem';

interface EntryItemProps {
  entry: Entry;
  // Task handlers
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  // Note handlers
  onUpdateNoteContent?: (noteId: string, newContent: string) => void | Promise<void>;
  // Event handlers
  onUpdateEventContent?: (eventId: string, newContent: string) => void | Promise<void>;
  onUpdateEventDate?: (eventId: string, newDate: string | null) => void | Promise<void>;
  // Common handlers
  onDelete: (entryId: string) => void;
  // Migration handlers
  onMigrate?: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
  // Navigation handler for migrated entries
  onNavigateToMigrated?: (collectionId: string | null) => void;
  // Collection creation handler
  onCreateCollection?: (name: string) => Promise<void>;
}

/**
 * EntryItem Component
 * 
 * Type dispatcher that routes to the appropriate type-specific component:
 * - Tasks → TaskEntryItem
 * - Notes → NoteEntryItem
 * - Events → EventEntryItem
 */
export function EntryItem({ 
  entry, 
  onCompleteTask, 
  onReopenTask, 
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onMigrate,
  collections,
  currentCollectionId,
  onNavigateToMigrated,
  onCreateCollection
}: EntryItemProps) {
  // Route to the appropriate type-specific component
  if (entry.type === 'task') {
    return (
      <TaskEntryItem
        entry={entry}
        onCompleteTask={onCompleteTask}
        onReopenTask={onReopenTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onDelete={onDelete}
        onMigrate={onMigrate}
        collections={collections}
        currentCollectionId={currentCollectionId}
        onNavigateToMigrated={onNavigateToMigrated}
        onCreateCollection={onCreateCollection}
      />
    );
  }

  if (entry.type === 'note') {
    return (
      <NoteEntryItem
        entry={entry}
        onUpdateNoteContent={onUpdateNoteContent}
        onDelete={onDelete}
        onMigrate={onMigrate}
        collections={collections}
        currentCollectionId={currentCollectionId}
        onNavigateToMigrated={onNavigateToMigrated}
        onCreateCollection={onCreateCollection}
      />
    );
  }

  if (entry.type === 'event') {
    return (
      <EventEntryItem
        entry={entry}
        onUpdateEventContent={onUpdateEventContent}
        onUpdateEventDate={onUpdateEventDate}
        onDelete={onDelete}
        onMigrate={onMigrate}
        collections={collections}
        currentCollectionId={currentCollectionId}
        onNavigateToMigrated={onNavigateToMigrated}
        onCreateCollection={onCreateCollection}
      />
    );
  }

  // TypeScript exhaustiveness check
  // This should never be reached if all entry types are handled
  throw new Error(`Unknown entry type: ${(entry as Entry).type}`);
}
