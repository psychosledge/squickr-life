import type { Entry } from '@squickr/shared';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableEntryItem } from './SortableEntryItem';

interface DayEntryListProps {
  dayEntries: Entry[];
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
}

/**
 * DayEntryList Component
 * 
 * Displays entries for a single day with drag-and-drop reordering.
 * Each day gets its own SortableContext, which automatically prevents
 * dragging entries between different days (enforced by dnd-kit).
 */
export function DayEntryList({
  dayEntries,
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onReorder
}: DayEntryListProps) {
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

    const oldIndex = dayEntries.findIndex(entry => entry.id === activeId);
    const newIndex = dayEntries.findIndex(entry => entry.id === overId);

    // Determine previousEntryId and nextEntryId based on new position
    let previousEntryId: string | null = null;
    let nextEntryId: string | null = null;

    if (oldIndex < newIndex) {
      // Moving down: item will go AFTER the item we're hovering over
      previousEntryId = dayEntries[newIndex]?.id || null;
      nextEntryId = dayEntries[newIndex + 1]?.id || null;
    } else {
      // Moving up: item will go BEFORE the item we're hovering over
      previousEntryId = dayEntries[newIndex - 1]?.id || null;
      nextEntryId = dayEntries[newIndex]?.id || null;
    }

    onReorder(activeId, previousEntryId, nextEntryId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={dayEntries.map(e => e.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {dayEntries.map((entry) => (
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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
