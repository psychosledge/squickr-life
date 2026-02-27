import type { Entry, Collection } from '@squickr/domain';
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
  // Item 3: Restore deleted entry
  onRestore?: () => void;
  // Migration handlers
  onMigrate?: (entryId: string, targetCollectionId: string | null, mode?: 'move' | 'add') => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
  // Navigation handler for migrated entries
  onNavigateToMigrated?: (collectionId: string | null) => void;
  // Collection creation handler
  onCreateCollection?: (name: string) => Promise<string>;
  // Sub-task handler
  onAddSubTask?: (entry: Entry) => void;
  // Phase 2: Completion status for parent tasks
  completionStatus?: {
    total: number;
    completed: number;
    allComplete: boolean;
  };
  // Phase 2 Feature: Parent title for migrated sub-tasks
  parentTitle?: string;
  // Phase 4: Expand/collapse control for sub-tasks
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Phase 5: Parent collections for smart migration defaults (Issue #4)
  parentCollections?: string[];
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
  onRestore,
  onMigrate,
  collections,
  currentCollectionId,
  onNavigateToMigrated,
  onCreateCollection,
  onAddSubTask,
  completionStatus,
  parentTitle,
  isCollapsed,
  onToggleCollapse,
  parentCollections,
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
        onRestore={onRestore}
        onMigrate={onMigrate}
        collections={collections}
        currentCollectionId={currentCollectionId}
        onNavigateToMigrated={onNavigateToMigrated}
        onCreateCollection={onCreateCollection}
        onAddSubTask={onAddSubTask}
        completionStatus={completionStatus}
        parentTitle={parentTitle}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        parentCollections={parentCollections}
      />
    );
  }

  if (entry.type === 'note') {
    return (
      <NoteEntryItem
        entry={entry}
        onUpdateNoteContent={onUpdateNoteContent}
        onDelete={onDelete}
        onRestore={onRestore}
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
        onRestore={onRestore}
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
