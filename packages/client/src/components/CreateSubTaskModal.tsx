import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';

interface CreateSubTaskModalProps {
  isOpen: boolean;
  parentTaskTitle: string;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
}

/**
 * CreateSubTaskModal Component (Phase 1: Sub-Tasks)
 * 
 * Modal for creating a sub-task under a parent task.
 * 
 * Features:
 * - Auto-focus input on open
 * - Enter key to submit
 * - Escape key to close
 * - Disabled create button when empty
 * - Clears error after successful submit
 * - Displays validation errors
 * - Closes modal after successful creation
 */
export function CreateSubTaskModal({ isOpen, parentTaskTitle, onClose, onSubmit }: CreateSubTaskModalProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setError('');
      inputRef.current?.focus();
    }
  }, [isOpen]);

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

    const trimmedTitle = title.trim();

    // Don't submit if empty
    if (trimmedTitle.length === 0) {
      return;
    }

    try {
      await onSubmit(trimmedTitle);
      
      // Clear error and close modal on success
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sub-task');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (value: string) => {
    setTitle(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  const isCreateDisabled = title.trim().length === 0;

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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Add Sub-Task
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Creating sub-task for: <span className="font-semibold">{parentTaskTitle}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="subtask-title" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Sub-Task Title
            </label>
            <input
              ref={inputRef}
              id="subtask-title"
              type="text"
              value={title}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Write blog post, Deploy to production"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'title-error' : undefined}
            />
            {error && (
              <div id="title-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
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
              disabled={isCreateDisabled}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                         transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
                         focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Sub-Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
