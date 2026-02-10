/**
 * ConfirmDeleteParentModal Component (Phase 5: Deletion Cascade - FINAL PHASE!)
 * 
 * Shows confirmation dialog when user tries to delete a parent task with sub-tasks.
 * 
 * Behavior:
 * - Displays count of sub-tasks that will be deleted
 * - Warns user that deleting parent will also delete all sub-tasks
 * - Provides "Cancel" and "Delete All" buttons (destructive red styling)
 * - Calls onConfirm callback if user confirms
 * 
 * Differences from ConfirmCompleteParentModal:
 * - Red destructive styling (vs blue for complete)
 * - "Delete All" button text (vs "Complete All")
 * - No filtering by status (deletes ALL children, not just incomplete)
 */

interface ConfirmDeleteParentModalProps {
  isOpen: boolean;
  childCount: number; // Total count (not just incomplete - delete ALL)
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteParentModal({
  isOpen,
  childCount,
  onConfirm,
  onClose,
}: ConfirmDeleteParentModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Delete Task with Sub-Tasks
        </h2>

        {/* Message */}
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          This will delete the parent task AND all{' '}
          <span className="font-semibold">{childCount}</span> sub-task
          {childCount === 1 ? '' : 's'}. Are you sure?
        </p>

        {/* Warning */}
        <p className="text-red-600 dark:text-red-400 text-sm mb-6">
          ⚠️ This action cannot be undone.
        </p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors font-medium"
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
