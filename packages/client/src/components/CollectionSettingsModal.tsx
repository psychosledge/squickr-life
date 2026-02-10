import { useState, useEffect, FormEvent } from 'react';
import type { CollectionSettings, CompletedTaskBehavior } from '@squickr/domain';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { BEHAVIOR_LABELS } from '../utils/constants';

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
 * - Dropdown for completed task behavior (use-default, keep-in-place, move-to-bottom, collapse)
 * - "Use default" option shows current global preference
 * - Escape key to close
 * - Displays validation errors
 * - Closes modal after successful save
 * - Migrates legacy collapseCompleted boolean to new enum
 */
export function CollectionSettingsModal({ 
  isOpen, 
  currentSettings, 
  onClose, 
  onSubmit 
}: CollectionSettingsModalProps) {
  const userPreferences = useUserPreferences();
  const [completedTaskBehavior, setCompletedTaskBehavior] = useState<CompletedTaskBehavior | undefined>('keep-in-place');
  const [error, setError] = useState('');

  // Initialize settings when modal opens (with migration from legacy format)
  useEffect(() => {
    if (isOpen) {
      // Migrate from old collapseCompleted boolean to new enum
      // undefined means "use default"
      const behavior: CompletedTaskBehavior | undefined = 
        currentSettings?.completedTaskBehavior !== undefined
          ? currentSettings.completedTaskBehavior as CompletedTaskBehavior // Already using new format
          : currentSettings?.collapseCompleted === true
            ? 'collapse'
            : currentSettings?.collapseCompleted === false
              ? 'keep-in-place'
              : undefined; // Default to "use default"
      
      setCompletedTaskBehavior(behavior);
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

  // Handle back button to close modal
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    // Push state when modal opens
    window.history.pushState({ modal: true }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Clean up state if still there
      if (window.history.state?.modal) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    try {
      await onSubmit({ completedTaskBehavior });
      
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
            <label htmlFor="completed-task-behavior" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Completed Tasks
            </label>
            <select
              id="completed-task-behavior"
              value={completedTaskBehavior ?? 'use-default'}
              onChange={(e) => {
                const value = e.target.value;
                setCompletedTaskBehavior(value === 'use-default' ? undefined : value as CompletedTaskBehavior);
              }}
              className="
                w-full px-3 py-2
                bg-white dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                rounded-lg
                text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500
                cursor-pointer
              "
            >
              <option value="use-default">
                Use default ({BEHAVIOR_LABELS[userPreferences.defaultCompletedTaskBehavior]})
              </option>
              <option value="keep-in-place">Keep in place</option>
              <option value="move-to-bottom">Move to bottom</option>
              <option value="collapse">Collapse</option>
            </select>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {completedTaskBehavior === undefined && `Uses global default: ${BEHAVIOR_LABELS[userPreferences.defaultCompletedTaskBehavior].toLowerCase()}`}
              {completedTaskBehavior === 'keep-in-place' && 'Completed tasks stay where they are'}
              {completedTaskBehavior === 'move-to-bottom' && 'Completed tasks move below a separator'}
              {completedTaskBehavior === 'collapse' && 'Completed tasks hidden in expandable section'}
            </div>
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
