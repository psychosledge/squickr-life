import { useState, useRef, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/domain';
import { formatTimestamp } from '../utils/formatters';
import { MigrateEntryModal } from './MigrateEntryModal';
import { BulletIcon } from './BulletIcon';
import { EntryActionsMenu } from './EntryActionsMenu';

interface TaskEntryItemProps {
  entry: Entry & { type: 'task' };
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  onDelete: (entryId: string) => void;
  onMigrate?: (taskId: string, targetCollectionId: string | null) => Promise<void>;
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
  onCreateCollection,
  onAddSubTask,
  completionStatus,
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

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Bullet Journal Icon - integrates type + state + migration */}
        <BulletIcon 
          entry={entry} 
          onClick={entry.migratedTo ? undefined : handleToggleComplete}
        />
        
        {/* Content Area */}
        <div className="flex-1 min-w-0">
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
                <div 
                  className={`text-lg font-medium cursor-pointer select-none ${
                    isCompleted 
                      ? 'text-gray-500 dark:text-gray-400 line-through' 
                      : 'text-gray-900 dark:text-white'
                  } ${canEdit ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                  onDoubleClick={handleDoubleClick}
                  title={canEdit ? 'Double-click to edit' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {entry.title}
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
        
        {/* Actions Menu */}
        <EntryActionsMenu
          entry={entry}
          onEdit={handleEdit}
          onMove={handleMove}
          onDelete={handleDelete}
          onAddSubTask={onAddSubTask ? handleAddSubTask : undefined}
          collections={collections}
          onNavigateToMigrated={onNavigateToMigrated}
        />
      </div>
      
      {/* Migrate modal */}
      {onMigrate && collections && (
        <MigrateEntryModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          entry={entry}
          currentCollectionId={currentCollectionId}
          collections={collections}
          onMigrate={onMigrate}
          onCreateCollection={onCreateCollection}
        />
      )}
    </div>
  );
}
