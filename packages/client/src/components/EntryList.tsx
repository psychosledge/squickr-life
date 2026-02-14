import type { Entry, Collection } from '@squickr/domain';
import { useMemo, useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableEntryItem } from './SortableEntryItem';
import { EntryItem } from './EntryItem';
import { GhostEntry } from './GhostEntry';
import { DRAG_SENSOR_CONFIG } from '../utils/constants';
import type { Task } from '@squickr/domain';
import { useCollapsedTasks } from '../hooks/useCollapsedTasks';

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
  onMigrate?: (entryId: string, targetCollectionId: string | null, mode?: 'move' | 'add') => Promise<void>;
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
  // Phase 2 Feature: Optional parent title fetcher (for migrated sub-tasks)
  getParentTitlesForSubTasks?: (subTaskIds: string[]) => Promise<Map<string, string>>;
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
  getParentTitlesForSubTasks,
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
  
  // Phase 4: Collapse/expand state management
  const { isCollapsed, toggleCollapsed } = useCollapsedTasks();
  
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
  
  // Phase 2 Feature: Store parent titles for sub-tasks
  // This map stores parent task title by sub-task ID (for migrated sub-tasks)
  const [parentTitlesMap, setParentTitlesMap] = useState<Map<string, string>>(new Map());
  
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
          }
        });
      }
      
      // Fetch parent titles for all task entries (if getParentTitlesForSubTasks provided)
      // This is used to show parent context for migrated sub-tasks
      const parentTitlesTemp = new Map<string, string>();
      if (getParentTitlesForSubTasks) {
        // Get all task IDs from task entries
        const taskIds = taskEntries.map(e => e.id);
        
        if (taskIds.length > 0) {
          const parentTitles = await getParentTitlesForSubTasks(taskIds);
          
          // Early exit if component unmounted during batch query
          if (isCancelled) return;
          
          // Store parent titles
          for (const [subTaskId, parentTitle] of parentTitles.entries()) {
            parentTitlesTemp.set(subTaskId, parentTitle);
          }
        }
      }
      
      // Final check before updating state
      if (isCancelled) return;
      
      setCompletionStatusMap(statusMap);
      setSubTasksMap(subTasksMapTemp);
      setParentTitlesMap(parentTitlesTemp);
    };
    
    calculateStatusAndFetchSubTasks();
    
    // Cleanup: mark this effect as cancelled on unmount/re-render
    return () => {
      isCancelled = true;
    };
  }, [topLevelEntries, getCompletionStatus, getSubTasks, getSubTasksForMultipleParents, getParentTitlesForSubTasks]);

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
              // Check if this is a ghost entry
              const isGhost = 'renderAsGhost' in entry && entry.renderAsGhost === true;
              
              // Render ghost entry (non-interactive, crossed-out)
              if (isGhost) {
                return (
                  <GhostEntry
                    key={entry.id}
                    entry={entry as Entry & { renderAsGhost: true; ghostNewLocation?: string }}
                    onNavigateToCollection={(collectionId) => {
                      if (onNavigateToMigrated) {
                        onNavigateToMigrated(collectionId);
                      }
                    }}
                    onDelete={() => onDelete(entry.id)}
                    collections={collections || []}
                  />
                );
              }
              
              // Get sub-tasks for this entry (if it's a task)
              const subTasks = entry.type === 'task' ? (subTasksMap.get(entry.id) || []) : [];
              
              // Check if this top-level entry is actually a migrated sub-task
              const isSubTask = entry.type === 'task' && !!entry.parentTaskId;
              const isMigratedSubTask = isSubTask; // If it's in topLevelEntries, parent is NOT in list (migrated)
              
              // Phase 4: Check collapse state
              const collapsed = isCollapsed(entry.id);
              
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
                    // Phase 2 Feature: Pass parent title for migrated sub-tasks
                    parentTitle={parentTitlesMap.get(entry.id)}
                    // Phase 4: Pass collapse props
                    isCollapsed={collapsed}
                    onToggleCollapse={() => toggleCollapsed(entry.id)}
                  />
                  
                  {/* Render sub-tasks indented (non-draggable) - Phase 3 */}
                  {/* Phase 4: Only show sub-tasks if parent is not collapsed */}
                  {subTasks.length > 0 && !collapsed && (
                    <div className="pl-8 space-y-2 mt-2 
                                    bg-gray-50/50 dark:bg-gray-900/30 
                                    border-l-2 border-gray-200 dark:border-gray-700 
                                    rounded-br-lg pb-2">
                      {subTasks.map((subTask) => {
                        // Phase 3: Detect migration chains
                        // A sub-task is part of a migration chain if it has migratedFrom pointing to a different collection
                        // than where the parent originally came from
                        const hasIncomingMigration = !!subTask.migratedFrom && !!subTask.migratedFromCollectionId;
                        const isPartOfMigrationChain = hasIncomingMigration && 
                          subTask.migratedFromCollectionId !== entry.migratedFromCollectionId;
                        
                        return (
                          <div key={subTask.id}>
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
                              // Phase 3: Show 🔗 icon if sub-task is part of a migration chain
                              // This happens when parent migrates after child was already migrated
                              isSubTaskMigrated={isPartOfMigrationChain}
                            />
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
