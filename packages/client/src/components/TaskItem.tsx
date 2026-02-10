import { useState, useRef, useEffect } from 'react';
import type { Task } from '@squickr/domain';
import { formatTimestamp } from '../utils/formatters';

interface TaskItemProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, newTitle: string) => void;
}

/**
 * TaskItem Component
 * 
 * Displays a single task with its title, status, timestamp, and action buttons.
 * Supports inline editing via double-click on title.
 */
export function TaskItem({ task, onComplete, onReopen, onDelete, onUpdateTitle }: TaskItemProps) {
  const isCompleted = task.status === 'completed';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (onUpdateTitle) {
      setEditValue(task.title);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== task.title && onUpdateTitle) {
      onUpdateTitle(task.id, trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(task.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
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
          ) : (
            <h3 
              className={`text-lg font-medium cursor-pointer select-none ${
                isCompleted 
                  ? 'text-gray-500 dark:text-gray-400 line-through' 
                  : 'text-gray-900 dark:text-white'
              } ${onUpdateTitle ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
              onDoubleClick={handleDoubleClick}
              title={onUpdateTitle ? 'Double-click to edit' : undefined}
            >
              {task.title}
            </h3>
          )}
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatTimestamp(task.createdAt)}
            {isCompleted && task.completedAt && (
              <span className="ml-2">
                • Completed {formatTimestamp(task.completedAt)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isCompleted
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {task.status}
          </span>
          
          {isCompleted ? (
            <button
              onClick={() => onReopen(task.id)}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 
                         bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                         rounded-md transition-colors"
              aria-label="Reopen task"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => onComplete(task.id)}
              className="px-3 py-1 text-sm font-medium text-white 
                         bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 
                         rounded-md transition-colors"
              aria-label="Complete task"
            >
              Complete
            </button>
          )}
          
          <button
            onClick={() => onDelete(task.id)}
            className="px-3 py-1 text-sm font-medium text-white 
                       bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 
                       rounded-md transition-colors"
            aria-label="Delete task"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
