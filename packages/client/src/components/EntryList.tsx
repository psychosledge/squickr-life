import type { Entry, Collection } from '@squickr/shared';
import { useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableEntryItem } from './SortableEntryItem';
import { DRAG_SENSOR_CONFIG } from '../utils/constants';

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
  // Navigation handler for migrated entries
  onNavigateToMigrated?: (collectionId: string | null) => void;
  // Collection creation handler
  onCreateCollection?: (name: string) => Promise<string>;
  // Selection mode
  isSelectionMode?: boolean;
  selectedEntryIds?: Set<string>;
  onToggleSelection?: (entryId: string) => void;
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
  currentCollectionId,
  onNavigateToMigrated,
  onCreateCollection,
  isSelectionMode = false,
  selectedEntryIds = new Set(),
  onToggleSelection,
}: EntryListProps) {
  // Memoize sensor configuration to prevent recreation on every render
  const mouseSensor = useMemo(() => MouseSensor, []);
  const touchSensor = useMemo(() => TouchSensor, []);
  const keyboardSensor = useMemo(() => KeyboardSensor, []);
  
  const sensors = useSensors(
    useSensor(mouseSensor, {
      activationConstraint: {
        distance: DRAG_SENSOR_CONFIG.MOUSE_DRAG_DISTANCE,
      },
    }),
    useSensor(touchSensor, {
      activationConstraint: {
        delay: DRAG_SENSOR_CONFIG.TOUCH_DRAG_DELAY,
        tolerance: DRAG_SENSOR_CONFIG.TOUCH_DRAG_TOLERANCE,
      },
    }),
    useSensor(keyboardSensor, {
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
    <div className="w-full max-w-2xl mx-auto pb-32">
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
                onNavigateToMigrated={onNavigateToMigrated}
                onCreateCollection={onCreateCollection}
                isSelectionMode={isSelectionMode}
                isSelected={selectedEntryIds.has(entry.id)}
                onToggleSelection={onToggleSelection}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
