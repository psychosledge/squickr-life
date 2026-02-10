/**
 * SelectableEntryItem Component
 * 
 * Wraps entry items with selection checkbox when in selection mode.
 * Provides visual feedback for selected state.
 * 
 * Features:
 * - Shows checkbox on the left when in selection mode
 * - Highlights selected entries
 * - Prevents checkbox click from triggering entry actions
 */

import type { Entry } from '@squickr/domain';
import { ReactNode } from 'react';

interface SelectableEntryItemProps {
  entry: Entry;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (entryId: string) => void;
  children: ReactNode;
}

export function SelectableEntryItem({
  entry,
  isSelectionMode,
  isSelected,
  onToggleSelection,
  children,
}: SelectableEntryItemProps) {
  // If not in selection mode, just render children
  if (!isSelectionMode) {
    return <>{children}</>;
  }

  // In selection mode, wrap with checkbox and selection styling
  return (
    <div
      className={`
        flex items-start gap-3 rounded-lg transition-colors
        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
      `}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 pt-3 pl-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(entry.id)}
          className="
            w-5 h-5
            text-blue-600
            border-gray-300 dark:border-gray-600
            rounded
            focus:ring-2 focus:ring-blue-500
            cursor-pointer
          "
          aria-label={`Select entry ${entry.id}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Entry content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
