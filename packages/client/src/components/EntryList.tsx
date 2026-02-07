import type { Entry, Collection } from '@squickr/domain';
import { useMemo, useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableEntryItem } from './SortableEntryItem';
import { EntryItem } from './EntryItem';
import { DRAG_SENSOR_CONFIG } from '../utils/constants';
import type { Task } from '@squickr/domain';

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
  // Sub-task handler
  onAddSubTask?: (entry: Entry) => void;
  // Phase 2: Optional completion status calculator (for parent tasks)
  getCompletionStatus?: (taskId: string) => Promise<{
    total: number;
    completed: number;
    allComplete: boolean;
  }>;
  // Phase 3: Optional sub-task fetcher (for rendering sub-tasks under parents)
  getSubTasks?: (parentTaskId: string) => Promise<Task[]>;
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
  onAddSubTask,
  getCompletionStatus,
  getSubTasks,
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
  
  // Phase 2: Filter out sub-tasks from top-level list
  // Sub-tasks will be rendered indented under their parent tasks
  const topLevelEntries = useMemo(() => {
    return entries.filter(entry => {
      // Only tasks can be sub-tasks
      if (entry.type !== 'task') return true;
      // Filter out entries with parentTaskId (sub-tasks)
      return !entry.parentTaskId;
    });
  }, [entries]);
  
  // Phase 2: Calculate completion status for each parent task
  // This map stores completion status by task ID
  const [completionStatusMap, setCompletionStatusMap] = useState<Map<string, {
    total: number;
    completed: number;
    allComplete: boolean;
  }>>(new Map());
  
  // Phase 3: Store sub-tasks for each parent task
  // This map stores sub-task arrays by parent task ID
  const [subTasksMap, setSubTasksMap] = useState<Map<string, Task[]>>(new Map());
  
  // Recalculate completion status and fetch sub-tasks when entries change
  useEffect(() => {
    // Race condition guard: prevent state updates after unmount/re-render
    let isCancelled = false;
    
    const calculateStatusAndFetchSubTasks = async () => {
      const statusMap = new Map<string, {
        total: number;
        completed: number;
        allComplete: boolean;
      }>();
      const subTasksMapTemp = new Map<string, Task[]>();
      
      // Get all task entries
      const taskEntries = topLevelEntries.filter(entry => entry.type === 'task');
      
      // Calculate status for all task entries in parallel (if getCompletionStatus provided)
      if (getCompletionStatus) {
        const statusPromises = taskEntries.map(async (entry) => {
          const status = await getCompletionStatus(entry.id);
          return { entryId: entry.id, status };
        });
        
        const results = await Promise.all(statusPromises);
        
        // Only store status for tasks with children
        results.forEach(({ entryId, status }) => {
          if (status.total > 0) {
            statusMap.set(entryId, status);
          }
        });
      }
      
      // Fetch sub-tasks for all task entries in parallel (if getSubTasks provided)
      if (getSubTasks) {
        const subTaskPromises = taskEntries.map(async (entry) => {
          const subTasks = await getSubTasks(entry.id);
          return { parentId: entry.id, subTasks };
        });
        
        const subTaskResults = await Promise.all(subTaskPromises);
        
        // Store sub-tasks for each parent
        subTaskResults.forEach(({ parentId, subTasks }) => {
          if (subTasks.length > 0) {
            subTasksMapTemp.set(parentId, subTasks);
          }
        });
      }
      
      // Check if component unmounted or effect re-triggered
      if (isCancelled) return;
      
      setCompletionStatusMap(statusMap);
      setSubTasksMap(subTasksMapTemp);
    };
    
    calculateStatusAndFetchSubTasks();
    
    // Cleanup: mark this effect as cancelled on unmount/re-render
    return () => {
      isCancelled = true;
    };
  }, [topLevelEntries, getCompletionStatus, getSubTasks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Type-safe conversion: entry IDs are strings
    const activeId = String(active.id);
    const overId = String(over.id);

    const oldIndex = topLevelEntries.findIndex(entry => entry.id === activeId);
    const newIndex = topLevelEntries.findIndex(entry => entry.id === overId);

    // Determine previousEntryId and nextEntryId based on new position
    let previousEntryId: string | null = null;
    let nextEntryId: string | null = null;

    if (oldIndex < newIndex) {
      // Moving down: item will go AFTER the item we're hovering over
      previousEntryId = topLevelEntries[newIndex]?.id || null;
      nextEntryId = topLevelEntries[newIndex + 1]?.id || null;
    } else {
      // Moving up: item will go BEFORE the item we're hovering over
      previousEntryId = topLevelEntries[newIndex - 1]?.id || null;
      nextEntryId = topLevelEntries[newIndex]?.id || null;
    }

    onReorder(activeId, previousEntryId, nextEntryId);
  };

  if (topLevelEntries.length === 0) {
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
        {topLevelEntries.length} {topLevelEntries.length === 1 ? 'entry' : 'entries'}
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={topLevelEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {topLevelEntries.map((entry) => {
              // Get sub-tasks for this entry (if it's a task)
              const subTasks = entry.type === 'task' ? (subTasksMap.get(entry.id) || []) : [];
              
              return (
                <div key={entry.id}>
                  {/* Render parent entry (draggable) */}
                  <SortableEntryItem
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
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedEntryIds.has(entry.id)}
                    onToggleSelection={onToggleSelection}
                    completionStatus={completionStatusMap.get(entry.id)}
                  />
                  
                  {/* Render sub-tasks indented (non-draggable) - Phase 3 */}
                  {subTasks.length > 0 && (
                    <div className="pl-8 space-y-2 mt-2">
                      {subTasks.map((subTask) => (
                        <EntryItem
                          key={subTask.id}
                          entry={{ ...subTask, type: 'task' as const }}
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
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
