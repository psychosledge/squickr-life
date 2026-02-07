import { useState, useRef, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/domain';

interface EntryActionsMenuProps {
  entry: Entry;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddSubTask?: () => void; // Phase 1: Sub-Tasks
  collections?: Collection[];
  onNavigateToMigrated?: (collectionId: string | null) => void;
}

/**
 * EntryActionsMenu Component
 * 
 * Displays a three-dot menu (⋯) with Edit, Move to..., and Delete actions.
 * Replaces individual action buttons to save screen space.
 * 
 * Features:
 * - Click outside to close
 * - Escape key to close
 * - Keyboard accessible
 * - ARIA compliant
 * - "Go to" navigation for migrated entries
 */
export function EntryActionsMenu({
  entry,
  onEdit,
  onMove,
  onDelete,
  onAddSubTask,
  collections,
  onNavigateToMigrated,
}: EntryActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine if entry is migrated and get target collection name
  const isMigrated = !!entry.migratedTo;
  const targetCollectionId = entry.migratedToCollectionId;
  const targetCollection = collections?.find(c => c.id === targetCollectionId);
  const targetCollectionName = targetCollection?.name || 'Unknown Collection';
  const showGoTo = isMigrated && collections && onNavigateToMigrated;

  // Phase 1: Sub-Tasks - Check if "Add Sub-Task" should be available
  // Only show for tasks that are NOT already sub-tasks (enforce 2-level limit)
  const isTask = entry.type === 'task';
  const isSubTask = isTask && !!entry.parentTaskId;
  const canAddSubTask = isTask && !isSubTask && onAddSubTask;

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleEdit = () => {
    onEdit();
    setIsOpen(false);
  };

  const handleMove = () => {
    onMove();
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setIsOpen(false);
  };

  const handleGoTo = () => {
    if (onNavigateToMigrated) {
      onNavigateToMigrated(targetCollectionId || null);
      setIsOpen(false);
    }
  };

  const handleAddSubTask = () => {
    if (onAddSubTask) {
      onAddSubTask();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="text-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
        aria-label="Entry actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        ⋯
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
        >
          {/* Go To option for migrated entries */}
          {showGoTo && (
            <button
              role="menuitem"
              onClick={handleGoTo}
              className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg transition-colors"
            >
              Go to {targetCollectionId ? targetCollectionName : 'Uncategorized'}
            </button>
          )}
          <button
            role="menuitem"
            onClick={handleEdit}
            className={`w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              showGoTo ? '' : 'rounded-t-lg'
            }`}
          >
            Edit
          </button>
          <button
            role="menuitem"
            onClick={handleMove}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Migrate
          </button>
          {/* Phase 1: Sub-Tasks - Add Sub-Task option */}
          {canAddSubTask && (
            <button
              role="menuitem"
              onClick={handleAddSubTask}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Add Sub-Task
            </button>
          )}
          <button
            role="menuitem"
            onClick={handleDelete}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
