import { useEffect } from 'react';

interface DeleteCollectionModalProps {
  isOpen: boolean;
  collectionName: string;
  entryCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * DeleteCollectionModal Component
 * 
 * Confirmation modal for deleting collections.
 * 
 * Features:
 * - Shows collection name and entry count
 * - Warning message about entries being deleted
 * - Enter key to confirm
 * - Escape key to close
 * - Backdrop click to close
 * - Body scroll prevention
 * - Danger styling for delete action
 */
export function DeleteCollectionModal({ 
  isOpen, 
  collectionName, 
  entryCount, 
  onClose, 
  onConfirm 
}: DeleteCollectionModalProps) {
  
  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  // Handle Enter key to confirm
  useEffect(() => {
    const handleEnter = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Enter' && isOpen) {
        onConfirm();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEnter);
      return () => document.removeEventListener('keydown', handleEnter);
    }
    return undefined;
  }, [isOpen, onConfirm]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  const entryCountText = entryCount === 0 
    ? 'This is an empty collection.' 
    : entryCount === 1 
      ? '1 entry will remain accessible in its other collections.'
      : `${entryCount} entries will remain accessible in their other collections.`;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Delete Collection
        </h2>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            Are you sure you want to delete "{collectionName}"?
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">
            {entryCountText}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            You can restore this collection from the Deleted section in your collections list.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                       hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 
                       focus:ring-offset-2"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
