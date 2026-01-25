import { useState, useRef, useEffect } from 'react';
import type { Entry } from '@squickr/shared';
import { formatTimestamp, formatDate } from '../utils/formatters';

interface EntryItemProps {
  entry: Entry;
  // Task handlers
  onCompleteTask?: (taskId: string) => void | Promise<void>;
  onReopenTask?: (taskId: string) => void | Promise<void>;
  onUpdateTaskTitle?: (taskId: string, newTitle: string) => void | Promise<void>;
  // Note handlers
  onUpdateNoteContent?: (noteId: string, newContent: string) => void | Promise<void>;
  // Event handlers
  onUpdateEventContent?: (eventId: string, newContent: string) => void | Promise<void>;
  onUpdateEventDate?: (eventId: string, newDate: string | null) => void | Promise<void>;
  // Common handlers
  onDelete: (entryId: string) => void;
}

/**
 * EntryItem Component
 * 
 * Displays a single entry (Task, Note, or Event) with appropriate UI based on type.
 * - Tasks: checkbox bullet, title, complete/reopen actions
 * - Notes: dash bullet, content, edit action
 * - Events: circle bullet, content, optional date, edit actions
 * 
 * Supports inline editing via double-click.
 */
export function EntryItem({ 
  entry, 
  onCompleteTask, 
  onReopenTask, 
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete 
}: EntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (entry.type === 'task') {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }
    }
  }, [isEditing, entry.type]);

  const handleDoubleClick = () => {
    if (entry.type === 'task' && onUpdateTaskTitle) {
      setEditValue(entry.title);
      setEditError('');
      setIsEditing(true);
    } else if (entry.type === 'note' && onUpdateNoteContent) {
      setEditValue(entry.content);
      setEditError('');
      setIsEditing(true);
    } else if (entry.type === 'event' && onUpdateEventContent) {
      setEditValue(entry.content);
      setEditDate(entry.eventDate || '');
      setEditError('');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue) {
      setEditError('Content cannot be empty');
      return;
    }

    try {
      if (entry.type === 'task' && trimmedValue !== entry.title && onUpdateTaskTitle) {
        await onUpdateTaskTitle(entry.id, trimmedValue);
      } else if (entry.type === 'note' && trimmedValue !== entry.content && onUpdateNoteContent) {
        await onUpdateNoteContent(entry.id, trimmedValue);
      } else if (entry.type === 'event' && onUpdateEventContent) {
        if (trimmedValue !== entry.content) {
          await onUpdateEventContent(entry.id, trimmedValue);
        }
        // Also save date if it changed
        const trimmedDate = editDate.trim();
        const newDate = trimmedDate || null;
        const currentDate = entry.eventDate || null;
        if (newDate !== currentDate && onUpdateEventDate) {
          await onUpdateEventDate(entry.id, newDate);
        }
      }
      
      setIsEditing(false);
      setEditError('');
    } catch (err) {
      // Show validation errors
      setEditError(err instanceof Error ? err.message : 'Failed to update entry');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const getBullet = () => {
    if (entry.type === 'task') {
      return entry.status === 'completed' ? '☑' : '☐';
    } else if (entry.type === 'note') {
      return '-';
    } else {
      return '○';
    }
  };

  const getContent = () => {
    if (entry.type === 'task') {
      return entry.title;
    } else if (entry.type === 'note') {
      return entry.content;
    } else {
      return entry.content;
    }
  };

  const isCompleted = entry.type === 'task' && entry.status === 'completed';
  const canEdit = 
    (entry.type === 'task' && onUpdateTaskTitle) ||
    (entry.type === 'note' && onUpdateNoteContent) ||
    (entry.type === 'event' && onUpdateEventContent);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Bullet and Content */}
        <div className="flex-1 flex gap-3">
          <div className="text-2xl text-gray-600 dark:text-gray-400 leading-none pt-1">
            {getBullet()}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                {entry.type === 'task' ? (
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
                  <textarea
                    ref={textareaRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="w-full text-base px-2 py-1 border-2 border-blue-500 rounded
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    maxLength={5000}
                    rows={3}
                  />
                )}
                {entry.type === 'event' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
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
                  {getContent()}
                </div>
                {entry.type === 'event' && entry.eventDate && (
                  <div className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    📅 {formatDate(entry.eventDate)}
                  </div>
                )}
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {entry.type === 'task' && (
            <>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isCompleted
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {entry.status}
              </span>
              
              {isCompleted ? (
                <button
                  onClick={() => onReopenTask?.(entry.id)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 
                             bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                             rounded-md transition-colors"
                  aria-label="Reopen task"
                >
                  Reopen
                </button>
              ) : (
                <button
                  onClick={() => onCompleteTask?.(entry.id)}
                  className="px-3 py-1 text-sm font-medium text-white 
                             bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 
                             rounded-md transition-colors"
                  aria-label="Complete task"
                >
                  Complete
                </button>
              )}
            </>
          )}
          
          <button
            onClick={() => onDelete(entry.id)}
            className="px-3 py-1 text-sm font-medium text-white 
                       bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 
                       rounded-md transition-colors"
            aria-label={`Delete ${entry.type}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
