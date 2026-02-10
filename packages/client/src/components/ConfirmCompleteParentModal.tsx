/**
 * ConfirmCompleteParentModal Component (Phase 4: Completion Cascade)
 * 
 * Shows confirmation dialog when user tries to complete a parent task with incomplete sub-tasks.
 * 
 * Behavior:
 * - Displays count of incomplete sub-tasks
 * - Warns user that completing parent will also complete all sub-tasks
 * - Provides "Cancel" and "Complete All" buttons
 * - Calls onConfirm callback if user confirms
 */

interface ConfirmCompleteParentModalProps {
  isOpen: boolean;
  incompleteCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmCompleteParentModal({
  isOpen,
  incompleteCount,
  onConfirm,
  onClose,
}: ConfirmCompleteParentModalProps) {
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
          Complete Task with Sub-Tasks
        </h2>

        {/* Message */}
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          This will complete the parent task AND all{' '}
          <span className="font-semibold">{incompleteCount}</span> sub-task
          {incompleteCount === 1 ? '' : 's'}. Are you sure?
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
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors font-medium"
          >
            Complete All
          </button>
        </div>
      </div>
    </div>
  );
}
