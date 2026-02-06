/**
 * SelectionModeToggle Component
 * 
 * Button to enter selection mode. Appears in the collection header menu.
 * When in selection mode, the SelectionToolbar handles the exit functionality.
 */

interface SelectionModeToggleProps {
  isSelectionMode: boolean;
  onEnter: () => void;
  onExit: () => void;
}

export function SelectionModeToggle({
  isSelectionMode,
  onEnter,
}: SelectionModeToggleProps) {
  // When in selection mode, the toolbar handles the UI
  if (isSelectionMode) {
    return null;
  }

  // Render as menu item (will be integrated into CollectionHeader menu)
  return (
    <button
      onClick={onEnter}
      className="
        w-full px-4 py-2
        text-left text-gray-700 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-colors
        focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
      "
      type="button"
    >
      Select Entries
    </button>
  );
}
