import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Entry, Collection } from '@squickr/domain';

interface EntryActionsMenuProps {
  entry: Entry;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddSubTask?: () => void; // Phase 1: Sub-Tasks
  collections?: Collection[];
  currentCollectionId?: string; // Current collection we're viewing from
  onNavigateToMigrated?: (collectionId: string | null) => void;
  // Phase 2: Navigation for sub-tasks and migrated sub-tasks
  onNavigateToSubTaskCollection?: () => void; // Navigate to migrated sub-task's collection (from parent view)
  isSubTask?: boolean; // Whether this entry is a sub-task
  isSubTaskMigrated?: boolean; // Whether this sub-task is migrated to a different collection
  // Phase 4: Ghost entries
  isGhost?: boolean; // Whether this entry is a ghost (show only "Go to" and "Delete")
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
  currentCollectionId,
  onNavigateToMigrated,
  onNavigateToSubTaskCollection,
  isSubTask = false,
  isGhost = false,
}: EntryActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Determine if entry is migrated and get target collection name
  const isMigrated = !!entry.migratedTo;
  const targetCollectionId = entry.migratedToCollectionId;
  const targetCollection = collections?.find(c => c.id === targetCollectionId);
  const targetCollectionName = targetCollection?.name || 'Unknown Collection';
  const showGoTo = isMigrated && collections && onNavigateToMigrated;

  // Phase 3: "Go back" option for migrated entries (showing where they came from)
  // Support BOTH legacy migration (migratedFrom) AND multi-collection moves (collectionHistory)
  let sourceCollectionId: string | undefined | null = undefined;
  let showGoBack = false;
  
  if (entry.migratedFrom && entry.migratedFromCollectionId !== undefined) {
    // Legacy migration: Use migratedFrom pointers
    sourceCollectionId = entry.migratedFromCollectionId;
    showGoBack = !!collections && !!onNavigateToMigrated;
  } else if ('collectionHistory' in entry && entry.collectionHistory) {
    // Multi-collection move: Find most recent "removedFrom" collection
    // Look for collections that this entry was removed from (has removedAt timestamp)
    const removedCollections = entry.collectionHistory
      .filter(h => h.removedAt !== undefined)
      .sort((a, b) => (b.removedAt || '').localeCompare(a.removedAt || '')); // Most recent first
    
    if (removedCollections.length > 0 && removedCollections[0]) {
      sourceCollectionId = removedCollections[0].collectionId;
      showGoBack = !!collections && !!onNavigateToMigrated;
    }
  }
  
  const sourceCollection = sourceCollectionId !== undefined 
    ? collections?.find(c => c.id === sourceCollectionId) 
    : undefined;
  const sourceCollectionName = sourceCollection?.name || 'Uncategorized';

  // Phase 1: Sub-Tasks - Check if "Add Sub-Task" should be available
  // Only show for tasks that are NOT already sub-tasks (enforce 2-level limit)
  // Do NOT show for ghost entries
  const isTask = entry.type === 'task';
  const canAddSubTask = isTask && !isSubTask && !isGhost && onAddSubTask;

  // Phase 2: Sub-Task navigation
  // Show "Go to Sub-Task Collection" if the handler is provided (indicates migration)
  const showGoToSubTaskCollection = onNavigateToSubTaskCollection && collections;
  
  // Get sub-task's collection name (for "Go to Collection" option)
  const subTaskCollectionId = entry.collectionId;
  const subTaskCollection = collections?.find(c => c.id === subTaskCollectionId);
  const subTaskCollectionName = subTaskCollection?.name || 'Uncategorized';
  
  // Multi-collection support: Check if entry is in multiple collections
  // If viewing from one collection and entry is in another, show "Go to [Other Collection]"
  const entryCollections = entry.type === 'task' ? entry.collections || [] : [];
  const isInMultipleCollections = entryCollections.length > 1;
  const otherCollectionId = isInMultipleCollections 
    ? entryCollections.find(id => id !== currentCollectionId) 
    : undefined;
  const otherCollection = otherCollectionId 
    ? collections?.find(c => c.id === otherCollectionId) 
    : undefined;
  const otherCollectionName = otherCollection?.name || 'Uncategorized';
  const showGoToOtherCollection = isInMultipleCollections && otherCollectionId && onNavigateToMigrated;
  
  // Phase 4: Ghost entries - Hide Edit/Migrate for ghost entries
  const showEdit = !isGhost;
  const showMigrate = !isGhost;

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the menu
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking on the button or any of its parent containers
      // CRITICAL FIX for sub-tasks: Check if target is the button OR if button contains/is contained by target
      // This handles cases where the click bubbles from wrapper divs (common in sub-task rendering)
      if (buttonRef.current) {
        // Check if click is on button or its children
        if (buttonRef.current.contains(target)) {
          return;
        }
        
        // Check if click is on a parent container of the button (for sub-tasks with wrapper divs)
        // Walk up the DOM tree to see if we hit the button
        let node: Node | null = target;
        while (node) {
          if (node === buttonRef.current) {
            return;
          }
          node = node.parentNode;
        }
      }
      
      // If we get here, the click was outside both menu and button - close the menu
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    // CRITICAL FIX: Defer event listener registration to next tick
    // This prevents the click that opened the menu from immediately closing it
    // The opening click's mousedown event will have already bubbled by the time we register
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      // Use capture phase to catch scroll events on all elements
      // Use passive: true for better scroll performance (handler won't call preventDefault)
      window.addEventListener('scroll', handleScroll, { capture: true, passive: true } as AddEventListenerOptions);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, { capture: true, passive: true } as AddEventListenerOptions);
    };
  }, [isOpen]);

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      
      // CRITICAL FIX: Don't add window.scrollY/scrollX
      // getBoundingClientRect() returns viewport-relative coords
      // position: fixed is ALSO viewport-relative
      // Adding scroll offset would double-count the scroll
      setMenuPosition({
        top: rect.bottom + 4, // 4px gap (mt-1)
        left: rect.right - 160, // 160px = w-40 (menu width)
      });
    } else {
      // Reset position when closed to prevent flash on next open
      setMenuPosition(null);
    }
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    // CRITICAL FIX: Stop event propagation to prevent parent containers
    // from interfering with click-outside detection (especially for sub-tasks)
    e.stopPropagation();
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

  const handleGoToSubTaskCollection = () => {
    if (onNavigateToSubTaskCollection) {
      onNavigateToSubTaskCollection();
      setIsOpen(false);
    }
  };

  const handleGoBack = () => {
    if (onNavigateToMigrated) {
      onNavigateToMigrated(sourceCollectionId || null);
      setIsOpen(false);
    }
  };

  const handleGoToOtherCollection = () => {
    if (onNavigateToMigrated && otherCollectionId) {
      onNavigateToMigrated(otherCollectionId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="text-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
        aria-label="Entry actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        ⋯
      </button>

      {/* Dropdown Menu - Rendered in Portal */}
      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="menu"
          // z-[150]: Higher than entry items (z-[100]) but lower than full-page modals (z-200+)
          // transition-opacity duration-75: Quick fade-in to prevent flash
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[150] w-40 transition-opacity duration-75"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
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
          
          {/* Phase 3: "Go back" option for entries with migratedFrom */}
          {showGoBack && (
            <button
              role="menuitem"
              onClick={handleGoBack}
              className={`w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                showGoTo ? '' : 'rounded-t-lg'
              }`}
            >
              Go back to {sourceCollectionId ? sourceCollectionName : 'Uncategorized'}
            </button>
          )}
          
          {/* Phase 2: "Go to [Collection]" for migrated sub-tasks when viewed in parent's collection */}
          {showGoToSubTaskCollection && (
            <button
              role="menuitem"
              onClick={handleGoToSubTaskCollection}
              className={`w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                showGoTo || showGoBack ? '' : 'rounded-t-lg'
              }`}
            >
              Go to {subTaskCollectionName}
            </button>
          )}
          
          {/* Multi-collection: "Go to [Other Collection]" for entries in multiple collections */}
          {showGoToOtherCollection && (
            <button
              role="menuitem"
              onClick={handleGoToOtherCollection}
              className={`w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                showGoTo || showGoBack || showGoToSubTaskCollection ? '' : 'rounded-t-lg'
              }`}
            >
              Go to {otherCollectionName}
            </button>
          )}
          
          {/* Edit - Hidden for ghost entries */}
          {showEdit && (
            <button
              role="menuitem"
              onClick={handleEdit}
              className={`w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                showGoTo || showGoBack || showGoToSubTaskCollection || showGoToOtherCollection ? '' : 'rounded-t-lg'
              }`}
            >
              Edit
            </button>
          )}
          
          {/* Migrate - Hidden for ghost entries */}
          {showMigrate && (
            <button
              role="menuitem"
              onClick={handleMove}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Migrate
            </button>
          )}
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
        </div>,
        document.body
      )}
    </div>
  );
}
