import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Entry, Collection } from '@squickr/domain';
import { getNavigationCollections, getCollectionName } from '../utils/collectionNavigation';

interface EntryActionsMenuProps {
  entry: Entry;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddSubTask?: () => void; // Phase 1: Sub-Tasks
  collections?: Collection[];
  currentCollectionId?: string; // Current collection we're viewing from
  onNavigateToMigrated?: (collectionId: string | null) => void;
  isSubTask?: boolean; // Whether this entry is a sub-task
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
  isSubTask = false,
  isGhost = false,
}: EntryActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  // Get ALL navigation collections (active + ghost) using utility function
  const navigationCollections = getNavigationCollections(entry, currentCollectionId);

  // Phase 1: Sub-Tasks - Check if "Add Sub-Task" should be available
  // Only show for tasks that are NOT already sub-tasks (enforce 2-level limit)
  // Do NOT show for ghost entries
  const isTask = entry.type === 'task';
  const canAddSubTask = isTask && !isSubTask && !isGhost && onAddSubTask;
  
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

  const handleAddSubTask = () => {
    if (onAddSubTask) {
      onAddSubTask();
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
          {/* Navigation: Show ALL collections where entry appears (active or ghost) */}
          {onNavigateToMigrated && collections && navigationCollections.map(({ collectionId, isGhost }, index) => (
            <button
              key={collectionId ?? 'uncategorized'}
              role="menuitem"
              onClick={() => {
                onNavigateToMigrated?.(collectionId);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm ${
                isGhost
                  ? 'text-gray-500 dark:text-gray-400'  // Ghost location (removed from)
                  : 'text-blue-600 dark:text-blue-400'   // Active location (currently in)
              } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                index === 0 && !showEdit && !showMigrate && !canAddSubTask ? 'rounded-t-lg' : ''
              }`}
            >
              Go to {getCollectionName(collectionId, collections)}
            </button>
          ))}
          
          {/* Edit - Hidden for ghost entries */}
          {showEdit && (
            <button
              role="menuitem"
              onClick={handleEdit}
              className={`w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                navigationCollections.length === 0 ? 'rounded-t-lg' : ''
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
