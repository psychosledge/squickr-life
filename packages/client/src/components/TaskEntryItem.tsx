import { useState, useRef, useEffect } from 'react';
import type { Entry } from '@squickr/shared';
import { formatTimestamp } from '../utils/formatters';

interface TaskEntryItemProps {
  entry: Entry & { type: 'task' };
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  onDelete: (entryId: string) => void;
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
  onDelete
}: TaskEntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
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

  const isCompleted = entry.status === 'completed';
  const canEdit = !!onUpdateTaskTitle;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Clickable Checkbox - toggles complete/reopen */}
        <button
          onClick={handleToggleComplete}
          className="text-2xl text-gray-600 dark:text-gray-400 leading-none pt-1 
                     hover:scale-110 transition-transform flex-shrink-0"
          aria-label={isCompleted ? 'Reopen task' : 'Complete task'}
        >
          {isCompleted ? '☑' : '☐'}
        </button>
        
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
        
        {/* Compact Trash Icon */}
        <button
          onClick={() => onDelete(entry.id)}
          className="text-xl text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          aria-label="Delete entry"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
