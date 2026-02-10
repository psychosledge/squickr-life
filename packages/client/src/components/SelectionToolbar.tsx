/**
 * SelectionToolbar Component
 * 
 * Toolbar that appears when in selection mode, showing:
 * - Selection count
 * - Quick filter buttons (All, Active, Notes, Clear)
 * - Action buttons (Migrate, Cancel)
 * 
 * Positioned at the bottom of the screen for mobile and top for desktop.
 */

interface SelectionToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onSelectActive: () => void;
  onSelectNotes: () => void;
  onClear: () => void;
  onMigrate: () => void;
  onCancel: () => void;
}

export function SelectionToolbar({
  selectedCount,
  onSelectAll,
  onSelectActive,
  onSelectNotes,
  onClear,
  onMigrate,
  onCancel,
}: SelectionToolbarProps) {
  return (
    <div className="
      fixed bottom-0 left-0 right-0
      bg-white dark:bg-gray-800
      border-t border-gray-200 dark:border-gray-700
      shadow-lg
      p-4
      z-40
      safe-area-inset-bottom
    ">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Selection count */}
        <div className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedCount} selected
        </div>

        {/* Quick filter buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={onSelectAll}
            className="
              px-3 py-1.5
              text-sm
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              rounded
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            All
          </button>

          <button
            onClick={onSelectActive}
            className="
              px-3 py-1.5
              text-sm
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              rounded
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            Active
          </button>

          <button
            onClick={onSelectNotes}
            className="
              px-3 py-1.5
              text-sm
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              rounded
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            Notes
          </button>

          <button
            onClick={onClear}
            className="
              px-3 py-1.5
              text-sm
              bg-gray-100 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              rounded
              hover:bg-gray-200 dark:hover:bg-gray-600
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            Clear
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="
              flex-1 px-4 py-2
              border border-gray-300 dark:border-gray-600
              rounded
              text-gray-700 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-700
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            Cancel
          </button>

          <button
            onClick={onMigrate}
            disabled={selectedCount === 0}
            className="
              flex-1 px-4 py-2
              bg-blue-600 hover:bg-blue-700
              text-white
              rounded
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            type="button"
          >
            Migrate
          </button>
        </div>
      </div>
    </div>
  );
}
