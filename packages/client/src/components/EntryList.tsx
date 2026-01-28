import type { Entry, Collection } from '@squickr/shared';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableEntryItem } from './SortableEntryItem';

interface EntryListProps {
  entries: Entry[];
  // Task handlers
  onCompleteTask: (taskId: string) => void;
  onReopenTask: (taskId: string) => void;
  onUpdateTaskTitle: (taskId: string, newTitle: string) => void;
  // Note handlers
  onUpdateNoteContent: (noteId: string, newContent: string) => void;
  // Event handlers
  onUpdateEventContent: (eventId: string, newContent: string) => void;
  onUpdateEventDate: (eventId: string, newDate: string | null) => void;
  // Common handlers
  onDelete: (entryId: string) => void;
  onReorder: (entryId: string, previousEntryId: string | null, nextEntryId: string | null) => void;
  // Migration handlers
  onMigrate?: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
}

/**
 * EntryList Component
 * 
 * Displays a list of entries from the projection with drag-and-drop reordering.
 * Handles all three entry types (Task, Note, Event).
 * Shows empty state when no entries exist.
 */
export function EntryList({ 
  entries, 
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete, 
  onReorder,
  onMigrate,
  collections,
  currentCollectionId
}: EntryListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay for touch devices
        tolerance: 5, // Allow 5px of movement during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Type-safe conversion: entry IDs are strings
    const activeId = String(active.id);
    const overId = String(over.id);

    const oldIndex = entries.findIndex(entry => entry.id === activeId);
    const newIndex = entries.findIndex(entry => entry.id === overId);

    // Determine previousEntryId and nextEntryId based on new position
    let previousEntryId: string | null = null;
    let nextEntryId: string | null = null;

    if (oldIndex < newIndex) {
      // Moving down: item will go AFTER the item we're hovering over
      previousEntryId = entries[newIndex]?.id || null;
      nextEntryId = entries[newIndex + 1]?.id || null;
    } else {
      // Moving up: item will go BEFORE the item we're hovering over
      previousEntryId = entries[newIndex - 1]?.id || null;
      nextEntryId = entries[newIndex]?.id || null;
    }

    onReorder(activeId, previousEntryId, nextEntryId);
  };

  if (entries.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No entries yet. Add one above to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {entries.map((entry) => (
              <SortableEntryItem
                key={entry.id}
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
