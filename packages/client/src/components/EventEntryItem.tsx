import { useState, useRef, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/shared';
import { formatTimestamp, formatDate } from '../utils/formatters';
import { MoveEntryToCollectionModal } from './MoveEntryToCollectionModal';
import { BulletIcon } from './BulletIcon';

interface EventEntryItemProps {
  entry: Entry & { type: 'event' };
  onUpdateEventContent?: (eventId: string, newContent: string) => void | Promise<void>;
  onUpdateEventDate?: (eventId: string, newDate: string | null) => void | Promise<void>;
  onDelete: (entryId: string) => void;
  onMigrate?: (eventId: string, targetCollectionId: string | null) => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
}

/**
 * EventEntryItem Component
 * 
 * Displays an Event entry with:
 * - Circle bullet (○)
 * - Content with inline editing
 * - Date display and editing (📅)
 */
export function EventEntryItem({
  entry,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onMigrate,
  collections,
  currentCollectionId
}: EventEntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (onUpdateEventContent) {
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
      if (trimmedValue !== entry.content && onUpdateEventContent) {
        await onUpdateEventContent(entry.id, trimmedValue);
      }
      
      // Also save date if it changed
      const trimmedDate = editDate.trim();
      const newDate = trimmedDate || null;
      const currentDate = entry.eventDate || null;
      if (newDate !== currentDate && onUpdateEventDate) {
        await onUpdateEventDate(entry.id, newDate);
      }
      
      setIsEditing(false);
      setEditError('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update event');
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

  const canEdit = !!onUpdateEventContent;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Bullet and Content */}
        <div className="flex-1 flex gap-3 min-w-0">
          <BulletIcon entry={entry} />
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
                {entry.eventDate && (
                  <div className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                    📅 {formatDate(entry.eventDate)}
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(entry.createdAt)}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Move button - only show if onMigrate provided and not already migrated */}
        {onMigrate && !entry.migratedTo && (
          <button
            onClick={() => setShowMoveModal(true)}
            className="text-xl text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
            aria-label="Move to collection"
            title="Move to collection"
          >
            ↗️
          </button>
        )}
        
        {/* Compact Trash Icon */}
        <button
          onClick={() => onDelete(entry.id)}
          className="text-xl text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          aria-label="Delete entry"
        >
          🗑️
        </button>
      </div>
      
      {/* Move modal */}
      {onMigrate && collections && (
        <MoveEntryToCollectionModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          entry={entry}
          currentCollectionId={currentCollectionId}
          collections={collections}
          onMigrate={onMigrate}
        />
      )}
    </div>
  );
}
