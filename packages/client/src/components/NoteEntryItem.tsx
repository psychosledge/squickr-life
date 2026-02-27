import { useState, useRef, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/domain';
import { formatTimestamp } from '../utils/formatters';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { BulletIcon } from './BulletIcon';
import { EntryActionsMenu } from './EntryActionsMenu';
import { EventHistoryDebugTool } from './EventHistoryDebugTool';

interface NoteEntryItemProps {
  entry: Entry & { type: 'note' };
  onUpdateNoteContent?: (noteId: string, newContent: string) => void | Promise<void>;
  onDelete: (entryId: string) => void;
  onRestore?: () => void; // Item 3: Restore deleted entry
  onMigrate?: (noteId: string, targetCollectionId: string | null, mode?: 'move' | 'add') => Promise<void>;
  collections?: Collection[];
  currentCollectionId?: string;
  onNavigateToMigrated?: (collectionId: string | null) => void;
  onCreateCollection?: (name: string) => Promise<string>;
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
  onDelete,
  onRestore,
  onMigrate,
  collections,
  currentCollectionId,
  onNavigateToMigrated,
  onCreateCollection: _onCreateCollection, // Not used in new dialog
}: NoteEntryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
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

  const handleEdit = () => {
    if (onUpdateNoteContent) {
      setEditValue(entry.content);
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

  const canEdit = !!onUpdateNoteContent;
  const isLegacyMigrated = !!entry.migratedTo;
  const isDeleted = !!entry.deletedAt;

  return (
    <div className="relative">
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                      rounded-lg p-4 hover:shadow-md transition-shadow ${
                        isLegacyMigrated ? 'opacity-50' : ''
                      } ${
                        isDeleted ? 'line-through opacity-60 text-gray-400 dark:text-gray-600' : ''
                      }`}>
        <div className="flex items-start justify-between gap-3">
          {/* Bullet and Content */}
          <div className="flex-1 flex gap-3 min-w-0 pr-8">
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
                    isDeleted
                      ? 'text-gray-400 dark:text-gray-600 line-through'
                      : isLegacyMigrated
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-900 dark:text-white'
                  } ${canEdit && !isDeleted ? 'hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                  onDoubleClick={handleDoubleClick}
                  title={canEdit && !isDeleted ? 'Double-click to edit' : undefined}
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
        </div>
      </div>
      
      {/* Actions Menu - OUTSIDE opacity container to avoid stacking context trap */}
      <div className="absolute top-4 right-4 z-[100]">
        <EntryActionsMenu
          entry={entry}
          onEdit={handleEdit}
          onMove={handleMove}
          onDelete={handleDelete}
          onRestore={onRestore}
          collections={collections}
          currentCollectionId={currentCollectionId}
          onNavigateToMigrated={onNavigateToMigrated}
          isDeleted={isDeleted}
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
        />
      )}
      
      {/* Debug tool (dev mode only) */}
      <EventHistoryDebugTool entry={entry} />
    </div>
  );
}
