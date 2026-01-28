import { useState, useRef, useEffect } from 'react';
import type { Entry } from '@squickr/shared';
import { formatTimestamp } from '../utils/formatters';

interface NoteEntryItemProps {
  entry: Entry & { type: 'note' };
  onUpdateNoteContent?: (noteId: string, newContent: string) => void | Promise<void>;
  onDelete: (entryId: string) => void;
}

/**
 * NoteEntryItem Component
 * 
 * Displays a Note entry with:
 * - Dash bullet (-)
 * - Content with inline editing
 */
export function NoteEntryItem({
  entry,
  onUpdateNoteContent,
  onDelete
}: NoteEntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (onUpdateNoteContent) {
      setEditValue(entry.content);
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
      if (trimmedValue !== entry.content && onUpdateNoteContent) {
        await onUpdateNoteContent(entry.id, trimmedValue);
      }
      
      setIsEditing(false);
      setEditError('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update note');
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

  const canEdit = !!onUpdateNoteContent;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Bullet and Content */}
        <div className="flex-1 flex gap-3 min-w-0">
          <div className="text-2xl text-gray-600 dark:text-gray-400 leading-none pt-1">
            -
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
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
                {editError && (
                  <div className="text-sm text-red-600 dark:text-red-400" role="alert">
                    {editError}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div 
                  className={`text-lg font-medium cursor-pointer select-none text-gray-900 dark:text-white ${
                    canEdit ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''
                  }`}
                  onDoubleClick={handleDoubleClick}
                  title={canEdit ? 'Double-click to edit' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {entry.content}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(entry.createdAt)}
                </div>
              </>
            )}
          </div>
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
