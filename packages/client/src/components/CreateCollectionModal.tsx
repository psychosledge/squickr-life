import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { CollectionType } from '@squickr/shared';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type?: CollectionType, date?: string) => Promise<void>;
}

/**
 * CreateCollectionModal Component
 * 
 * Modal for creating new collections.
 * 
 * Features:
 * - Auto-focus input on open
 * - Enter key to submit
 * - Disabled create button when empty
 * - Clears input after successful submit
 * - Displays validation errors
 * - Closes modal after successful creation
 */
export function CreateCollectionModal({ isOpen, onClose, onSubmit }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CollectionType>('custom');
  const [date, setDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
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

    // For daily logs, generate name from date; for custom, use user input
    let finalName: string;
    if (type === 'daily') {
      // Auto-generate name from date (e.g., "2026-02-01" -> "Saturday, February 1")
      const parts = date.split('-');
      const year = parseInt(parts[0]!, 10);
      const month = parseInt(parts[1]!, 10) - 1; // 0-indexed
      const day = parseInt(parts[2]!, 10);
      
      const dateObj = new Date(year, month, day);
      const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      
      finalName = formatter.format(dateObj);
    } else {
      // For custom collections, use trimmed name
      const trimmedName = name.trim();
      
      // Don't submit if empty (only applies to custom collections)
      if (trimmedName.length === 0) {
        return;
      }
      
      finalName = trimmedName;
    }

    try {
      // For daily collections, pass the date; for custom, type and date are undefined
      await onSubmit(
        finalName,
        type === 'custom' ? undefined : type,
        type === 'daily' ? date : undefined
      );
      
      // Clear input and close modal on success
      setName('');
      setType('custom');
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (value: string) => {
    setName(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  // For daily logs, disable is always false (date is always set)
  // For custom collections, disable if name is empty
  const isCreateDisabled = type === 'custom' ? name.trim().length === 0 : false;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-70 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Create Collection
        </h2>

        <form onSubmit={handleSubmit}>
          {type === 'custom' && (
            <div className="mb-4">
              <label 
                htmlFor="collection-name" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Collection Name
              </label>
              <input
                ref={inputRef}
                id="collection-name"
                type="text"
                value={name}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., Work Projects, Reading List"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'name-error' : undefined}
              />
              {error && (
                <div id="name-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collection-type"
                  value="custom"
                  checked={type === 'custom'}
                  onChange={(e) => setType(e.target.value as CollectionType)}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Custom Collection</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">(topical, e.g., Work, Reading)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="collection-type"
                  value="daily"
                  checked={type === 'daily'}
                  onChange={(e) => setType(e.target.value as CollectionType)}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Daily Log</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">(date-based)</span>
              </label>
            </div>
          </div>

          {type === 'daily' && (
            <div className="mb-4">
              <label 
                htmlFor="collection-date" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Date
              </label>
              <input
                id="collection-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
