import { useState, useEffect, FormEvent } from 'react';
import type { CollectionSettings } from '@squickr/shared';

interface CollectionSettingsModalProps {
  isOpen: boolean;
  currentSettings: CollectionSettings | undefined;
  onClose: () => void;
  onSubmit: (settings: CollectionSettings) => Promise<void>;
}

/**
 * CollectionSettingsModal Component
 * 
 * Modal for updating collection settings.
 * 
 * Features:
 * - Checkbox for "Collapse completed tasks"
 * - Escape key to close
 * - Displays validation errors
 * - Closes modal after successful save
 */
export function CollectionSettingsModal({ 
  isOpen, 
  currentSettings, 
  onClose, 
  onSubmit 
}: CollectionSettingsModalProps) {
  const [collapseCompleted, setCollapseCompleted] = useState(false);
  const [error, setError] = useState('');

  // Initialize settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setCollapseCompleted(currentSettings?.collapseCompleted ?? false);
      setError('');
    }
  }, [isOpen, currentSettings]);

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

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    try {
      await onSubmit({ collapseCompleted });
      
      // Clear error and close modal on success
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

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
          Collection Settings
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={collapseCompleted}
                onChange={(e) => setCollapseCompleted(e.target.checked)}
                className="
                  w-5 h-5 
                  text-blue-600 
                  bg-gray-100 dark:bg-gray-700
                  border-gray-300 dark:border-gray-600
                  rounded
                  focus:ring-2 focus:ring-blue-500
                  cursor-pointer
                "
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Collapse completed tasks
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Move completed tasks to a collapsible section at the bottom
                </div>
              </div>
            </label>
            {error && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </div>
            )}
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
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                         transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:ring-offset-2"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
