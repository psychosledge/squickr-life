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
  // Phase 2: Optional batch sub-task fetcher (performance optimization)
  getSubTasksForMultipleParents?: (parentIds: string[]) => Promise<Map<string, Task[]>>;
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
  getSubTasksForMultipleParents,
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
  // UNLESS the parent is not in the current collection (migrated sub-tasks appear as flat entries)
  const topLevelEntries = useMemo(() => {
    // Get all parent task IDs in current entry list
    const parentIdsInList = new Set(
      entries
        .filter(e => e.type === 'task' && !e.parentTaskId)
        .map(e => e.id)
    );
    
    return entries.filter(entry => {
      // Only tasks can be sub-tasks
      if (entry.type !== 'task') return true;
      
      // Top-level task (no parent) - always show
      if (!entry.parentTaskId) return true;
      
      // Sub-task: Only show as flat entry if parent is NOT in current list
      // If parent is in list, sub-task will be shown indented under parent
      // If parent is NOT in list, sub-task is migrated and should appear as flat entry (symlink)
      return !parentIdsInList.has(entry.parentTaskId);
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
  
  // Phase 2: Store migration status for each sub-task
  const [subTaskMigrationMap, setSubTaskMigrationMap] = useState<Map<string, boolean>>(new Map());
  
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
      const migrationMapTemp = new Map<string, boolean>();
      
      // Get all task entries
      const taskEntries = topLevelEntries.filter(entry => entry.type === 'task');
      
      // Calculate status for all task entries in parallel (if getCompletionStatus provided)
      if (getCompletionStatus) {
        const statusPromises = taskEntries.map(async (entry) => {
          const status = await getCompletionStatus(entry.id);
          return { entryId: entry.id, status };
        });
        
        const results = await Promise.all(statusPromises);
        
        // Early exit if component unmounted during Promise.all
        if (isCancelled) return;
        
        // Only store status for tasks with children
        results.forEach(({ entryId, status }) => {
          if (status.total > 0) {
            statusMap.set(entryId, status);
          }
        });
      }
      
      // Fetch sub-tasks for all task entries (if getSubTasks provided)
      // Use batch query if available (performance optimization), otherwise fall back to individual queries
      if (getSubTasksForMultipleParents) {
        // Batch query - single event replay for all parents (O(n))
        const parentIds = taskEntries.map(e => e.id);
        const subTasksMapBatch = await getSubTasksForMultipleParents(parentIds);
        
        // Early exit if component unmounted during batch query
        if (isCancelled) return;
        
        // Process the batch results
        for (const entry of taskEntries) {
          const subTasks = subTasksMapBatch.get(entry.id) || [];
          if (subTasks.length > 0) {
            subTasksMapTemp.set(entry.id, subTasks);
            
            // Phase 2: Calculate migration status for each sub-task
            subTasks.forEach(subTask => {
              const parentCollectionId = entry.collectionId ?? null;
              const subTaskCollectionId = subTask.collectionId ?? null;
              const isMigrated = parentCollectionId !== subTaskCollectionId;
              migrationMapTemp.set(subTask.id, isMigrated);
            });
          }
        }
      } else if (getSubTasks) {
        // Fallback: Individual queries - N event replays (O(n²))
        const subTaskPromises = taskEntries.map(async (entry) => {
          const subTasks = await getSubTasks(entry.id);
          return { parentId: entry.id, subTasks };
        });
        
        const subTaskResults = await Promise.all(subTaskPromises);
        
        // Early exit if component unmounted during Promise.all
        if (isCancelled) return;
        
        // Store sub-tasks for each parent
        subTaskResults.forEach(({ parentId, subTasks }) => {
          if (subTasks.length > 0) {
            subTasksMapTemp.set(parentId, subTasks);
            
            // Phase 2: Calculate migration status for each sub-task
            // Compare sub-task's collectionId with parent's collectionId
            const parent = taskEntries.find(e => e.id === parentId);
            if (parent) {
              subTasks.forEach(subTask => {
                const parentCollectionId = parent.collectionId ?? null;
                const subTaskCollectionId = subTask.collectionId ?? null;
                const isMigrated = parentCollectionId !== subTaskCollectionId;
                migrationMapTemp.set(subTask.id, isMigrated);
              });
            }
          }
        });
      }
      
      // Final check before updating state
      if (isCancelled) return;
      
      setCompletionStatusMap(statusMap);
      setSubTasksMap(subTasksMapTemp);
      setSubTaskMigrationMap(migrationMapTemp);
    };
    
    calculateStatusAndFetchSubTasks();
    
    // Cleanup: mark this effect as cancelled on unmount/re-render
    return () => {
      isCancelled = true;
    };
  }, [topLevelEntries, getCompletionStatus, getSubTasks, getSubTasksForMultipleParents]);

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
              
              // Check if this top-level entry is actually a migrated sub-task
              const isSubTask = entry.type === 'task' && !!entry.parentTaskId;
              const isMigratedSubTask = isSubTask; // If it's in topLevelEntries, parent is NOT in list (migrated)
              
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
                    // Phase 2: Pass sub-task props for migrated sub-tasks rendered as flat entries
                    isSubTaskMigrated={isMigratedSubTask}
                    onNavigateToParent={isMigratedSubTask && onNavigateToMigrated ? () => {
                      // Find the parent task by looking through ALL entries (not just topLevelEntries)
                      const parentTask = entries.find(e => e.type === 'task' && e.id === entry.parentTaskId);
                      if (parentTask && onNavigateToMigrated) {
                        onNavigateToMigrated(parentTask.collectionId || null);
                      }
                    } : undefined}
                  />
                  
                  {/* Render sub-tasks indented (non-draggable) - Phase 3 */}
                  {subTasks.length > 0 && (
                    <div className="pl-8 space-y-2 mt-2">
                      {subTasks.map((subTask) => {
                        const isMigrated = subTaskMigrationMap.get(subTask.id) || false;
                        const subTaskCollectionId = subTask.collectionId;
                        const subTaskCollection = collections?.find(c => c.id === subTaskCollectionId);
                        const subTaskCollectionName = subTaskCollection?.name || 'Uncategorized';
                        
                        return (
                          <div key={subTask.id} className="relative">
                            {/* Phase 2: Migration indicator for migrated sub-tasks */}
                            {isMigrated && (
                              <div className="absolute -left-6 top-0 text-xs text-blue-600 dark:text-blue-400" title={`Migrated to ${subTaskCollectionName}`}>
                                →
                              </div>
                            )}
                            
                            <EntryItem
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
                              // When rendered under parent: NO isSubTaskMigrated icon, NO "Go to Parent" menu
                              // User is already viewing the sub-task in context of its parent
                              isSubTaskMigrated={false}
                              onNavigateToSubTaskCollection={isMigrated ? () => {
                                // Only show "Go to Sub-Task Collection" if migrated
                                if (onNavigateToMigrated) {
                                  onNavigateToMigrated(subTaskCollectionId || null);
                                }
                              } : undefined}
                            />
                            
                            {/* Phase 2: Collection name indicator for migrated sub-tasks */}
                            {isMigrated && (
                              <div className="ml-12 mt-1 text-xs text-blue-600 dark:text-blue-400">
                                → {subTaskCollectionName}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
