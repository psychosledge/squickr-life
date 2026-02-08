import type { Entry, Collection } from '@squickr/domain';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EntryItem } from './EntryItem';
import { SelectableEntryItem } from './SelectableEntryItem';

interface SortableEntryItemProps {
  entry: Entry;
  // Task handlers
  onCompleteTask?: (taskId: string) => void;
  onReopenTask?: (taskId: string) => void;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void;
  // Note handlers
  onUpdateNoteContent?: (noteId: string, newContent: string) => void;
  // Event handlers
  onUpdateEventContent?: (eventId: string, newContent: string) => void;
  onUpdateEventDate?: (eventId: string, newDate: string | null) => void;
  // Common handlers
  onDelete: (entryId: string) => void;
  // Migration handlers
  onMigrate?: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
  // Navigation handler for migrated entries
  onNavigateToMigrated?: (collectionId: string | null) => void;
  // Collection creation handler
  onCreateCollection?: (name: string) => Promise<string>;
  // Selection mode
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (entryId: string) => void;
  // Sub-task handler
  onAddSubTask?: (entry: Entry) => void;
  // Phase 2: Completion status for parent tasks
  completionStatus?: {
    total: number;
    completed: number;
    allComplete: boolean;
  };
  // Phase 2: Sub-task migration indicators and navigation
  isSubTaskMigrated?: boolean;
  onNavigateToParent?: () => void;
  // Phase 4: Expand/collapse control for sub-tasks
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * SortableEntryItem Component
 * 
 * Wrapper around EntryItem that adds drag-and-drop functionality.
 * Provides a drag handle and visual feedback during dragging.
 */
export function SortableEntryItem({ 
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
  onCreateCollection,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onAddSubTask,
  completionStatus,
  isSubTaskMigrated,
  onNavigateToParent,
  isCollapsed,
  onToggleCollapse,
}: SortableEntryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group pr-14 md:pr-0 md:pl-0">
      {/* Drag Handle - visible on hover and focus */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-0 top-1/2 -translate-y-1/2
                   md:right-auto md:left-0 md:-translate-x-8
                   w-12 h-12 md:w-8 md:h-8 
                   flex items-center justify-center
                   text-gray-500 dark:text-gray-400
                   md:text-gray-400 md:dark:text-gray-500
                   active:text-gray-700 dark:active:text-gray-300
                   md:hover:text-gray-600 md:dark:hover:text-gray-300
                   cursor-grab active:cursor-grabbing
                   opacity-100 md:opacity-30 
                   md:group-hover:opacity-100 md:group-focus-within:opacity-100
                   transition-all duration-200
                   active:scale-95"
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-6 h-6 md:w-5 md:h-5"
        >
          <path d="M7 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM14 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM7 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM14 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM7 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM14 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" />
        </svg>
      </div>

      {/* The actual entry item (wrapped with SelectableEntryItem for selection mode) */}
      <SelectableEntryItem
        entry={entry}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelection={onToggleSelection || (() => {})}
      >
        <EntryItem
          entry={entry}
          onCompleteTask={onCompleteTask}
          onReopenTask={onReopenTask}
          onUpdateTaskTitle={onUpdateTaskTitle}
          onUpdateNoteContent={onUpdateNoteContent}
          onUpdateEventContent={onUpdateEventContent}
          onUpdateEventDate={onUpdateEventDate}
          onDelete={onDelete}
          onMigrate={onMigrate}
          collections={collections}
          currentCollectionId={currentCollectionId}
          onNavigateToMigrated={onNavigateToMigrated}
          onCreateCollection={onCreateCollection}
          onAddSubTask={onAddSubTask}
          completionStatus={completionStatus}
          isSubTaskMigrated={isSubTaskMigrated}
          onNavigateToParent={onNavigateToParent}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </SelectableEntryItem>
    </div>
  );
}
