import { useState, useRef, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/domain';
import { formatTimestamp } from '../utils/formatters';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { BulletIcon } from './BulletIcon';
import { EntryActionsMenu } from './EntryActionsMenu';
import { EventHistoryDebugTool } from './EventHistoryDebugTool';
import { ChevronRight, ChevronDown, Link2 } from 'lucide-react';

interface TaskEntryItemProps {
  entry: Entry & { type: 'task' };
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  onDelete: (entryId: string) => void;
  onMigrate?: (taskId: string, targetCollectionId: string | null, mode?: 'move' | 'add') => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
  onNavigateToMigrated?: (collectionId: string | null) => void;
  onCreateCollection?: (name: string) => Promise<string>;
  onAddSubTask?: (entry: Entry) => void;
  // Phase 2: Completion status for parent tasks with sub-tasks
  completionStatus?: {
    total: number;
    completed: number;
    allComplete: boolean;
  };
  // Phase 2 Feature: Parent title for migrated sub-tasks
  parentTitle?: string; // Parent task title to display inline
  // Phase 4: Expand/collapse control for sub-tasks
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Phase 5: Parent collections for smart migration defaults (Issue #4)
  parentCollections?: string[];
}

/**
 * TaskEntryItem Component
 * 
 * Displays a Task entry with:
 * - Clickable checkbox (☐/☑) to toggle completion
 * - Title with inline editing
 * - Compact trash icon for deletion
 * - Strike-through for completed tasks
 */
export function TaskEntryItem({
  entry,
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onDelete,
  onMigrate,
  collections,
  currentCollectionId,
  onNavigateToMigrated,
  onCreateCollection: _onCreateCollection, // Not used in new dialog
  onAddSubTask,
  completionStatus,
  parentTitle,
  isCollapsed = false,
  onToggleCollapse,
  parentCollections,
}: TaskEntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (onUpdateTaskTitle) {
      setEditValue(entry.title);
      setEditError('');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue) {
      setEditError('Title cannot be empty');
      return;
    }

    try {
      if (trimmedValue !== entry.title && onUpdateTaskTitle) {
        await onUpdateTaskTitle(entry.id, trimmedValue);
      }
      
      setIsEditing(false);
      setEditError('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleToggleComplete = () => {
    if (isCompleted) {
      onReopenTask?.(entry.id);
    } else {
      onCompleteTask?.(entry.id);
    }
  };

  const handleEdit = () => {
    if (onUpdateTaskTitle) {
      setEditValue(entry.title);
      setEditError('');
      setIsEditing(true);
    }
  };

  const handleMove = () => {
    setShowMoveModal(true);
  };

  const handleDelete = () => {
    onDelete(entry.id);
  };

  const handleAddSubTask = () => {
    onAddSubTask?.(entry);
  };

  const isCompleted = entry.status === 'completed';
  const canEdit = !!onUpdateTaskTitle;
  const isSubTask = !!entry.parentEntryId;
  const hasSubTasks = completionStatus && completionStatus.total > 0;
  const isLegacyMigrated = !!entry.migratedTo;
  
  // Check if sub-task is in a different collection than the current view
  // (which would be the parent's collection)
  const isMultiCollection = (entry.collections || []).length > 1;
  const isNotInCurrentCollection = isSubTask && currentCollectionId
    ? !(entry.collections || []).includes(currentCollectionId)
    : false;
  const isSubTaskMigrated = isMultiCollection || isNotInCurrentCollection;

  return (
    <div className="relative">
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                      rounded-lg p-4 hover:shadow-md transition-shadow ${
                        isLegacyMigrated ? 'opacity-50' : ''
                      }`}>
        <div className="flex items-start gap-3">
          {/* Bullet Journal Icon - integrates type + state + migration */}
          <BulletIcon 
            entry={entry} 
            onClick={entry.migratedTo ? undefined : handleToggleComplete}
          />
          
          {/* Content Area */}
          <div className="flex-1 min-w-0 pr-8">
          {isEditing ? (
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-full text-lg font-medium px-2 py-1 border-2 border-blue-500 rounded
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
              />
              {editError && (
                <div className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {editError}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {/* Phase 4: Chevron icon for expand/collapse (only if task has sub-tasks) */}
                {hasSubTasks && onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="flex-shrink-0 text-gray-500 dark:text-gray-400 
                               hover:text-gray-700 dark:hover:text-gray-200 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 
                               rounded transition-colors"
                    aria-label={isCollapsed ? 'Expand sub-tasks' : 'Collapse sub-tasks'}
                    title={isCollapsed ? 'Expand sub-tasks' : 'Collapse sub-tasks'}
                    type="button"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
                
                <div 
                  className={`text-lg font-medium cursor-pointer select-none ${
                    isCompleted || isLegacyMigrated
                      ? 'text-gray-500 dark:text-gray-400 line-through' 
                      : 'text-gray-900 dark:text-white'
                  } ${canEdit ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                  onDoubleClick={handleDoubleClick}
                  title={canEdit ? 'Double-click to edit' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {entry.title}
                  
                  {/* Issue #5: Link icon after title for migrated sub-tasks */}
                  {isSubTaskMigrated && (
                    <span 
                      className="inline-block ml-1.5"
                      title={isMultiCollection 
                        ? "This task exists in multiple collections" 
                        : "This sub-task is in a different collection than its parent"}
                    >
                      <Link2 
                        className="w-4 h-4 align-text-bottom text-blue-600 dark:text-blue-400"
                        aria-label="Linked to different collection"
                      />
                    </span>
                  )}
                  
                  {/* Phase 2 Feature: Show parent title for migrated sub-tasks */}
                  {parentTitle && isSubTaskMigrated && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm font-normal">
                      ({parentTitle})
                    </span>
                  )}
                </div>
                
                {/* Phase 2: Completion Badge for parent tasks */}
                {completionStatus && completionStatus.total > 0 && (
                  <span 
                    className={`text-sm px-2 py-0.5 rounded-full ${
                      completionStatus.allComplete
                        ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                        : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
                    }`}
                    data-testid="completion-badge"
                    title={`${completionStatus.completed} of ${completionStatus.total} sub-tasks complete`}
                  >
                    {completionStatus.completed}/{completionStatus.total}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(entry.createdAt)}
                {isCompleted && entry.completedAt && (
                  <span className="ml-2">
                    • Completed {formatTimestamp(entry.completedAt)}
                  </span>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </div>
      
      {/* Actions Menu - OUTSIDE opacity container to avoid stacking context trap */}
      <div className="absolute top-4 right-4 z-[100]">
        <EntryActionsMenu
          entry={entry}
          onEdit={handleEdit}
          onMove={handleMove}
          onDelete={handleDelete}
          onAddSubTask={onAddSubTask ? handleAddSubTask : undefined}
          collections={collections}
          currentCollectionId={currentCollectionId}
          onNavigateToMigrated={onNavigateToMigrated}
          isSubTask={isSubTask}
          isGhost={false}
        />
      </div>
      
      {/* Migrate modal */}
      {onMigrate && collections && (
        <MigrateEntryDialog
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          entry={entry}
          currentCollectionId={currentCollectionId}
          collections={collections}
          onMigrate={onMigrate}
          onCreateCollection={_onCreateCollection}
          parentCollections={parentCollections}
        />
      )}
      
      {/* Debug tool (dev mode only) */}
      <EventHistoryDebugTool entry={entry} />
    </div>
  );
}
