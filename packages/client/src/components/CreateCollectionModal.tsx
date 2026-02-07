import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { CollectionType } from '@squickr/domain';
import { formatMonthlyLogName } from '../utils/formatters';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type?: CollectionType, date?: string) => Promise<void>;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Generate year range (±5 years from current year)
 */
function generateYearRange(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
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
  const [monthlyMonth, setMonthlyMonth] = useState(() => new Date().getMonth());
  const [monthlyYear, setMonthlyYear] = useState(() => new Date().getFullYear());
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const typeRadioRef = useRef<HTMLInputElement>(null);

  // Auto-focus type selector when modal opens
  useEffect(() => {
    if (isOpen) {
      typeRadioRef.current?.focus();
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

    // For daily logs, generate name from date; for monthly logs, generate from month/year; for custom, use user input
    let finalName: string;
    let finalDate: string | undefined;
    
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
      finalDate = date;
    } else if (type === 'monthly') {
      // Auto-generate name and date for monthly log (e.g., "February 2026")
      const monthStr = String(monthlyMonth + 1).padStart(2, '0');
      finalDate = `${monthlyYear}-${monthStr}`;
      finalName = formatMonthlyLogName(finalDate);
    } else {
      // For custom collections, use trimmed name
      const trimmedName = name.trim();
      
      // Don't submit if empty (only applies to custom collections)
      if (trimmedName.length === 0) {
        return;
      }
      
      finalName = trimmedName;
      finalDate = undefined;
    }

    try {
      // Pass type and date appropriately
      await onSubmit(
        finalName,
        type === 'custom' ? undefined : type,
        finalDate
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

  // For daily/monthly logs, disable is always false (date is always set)
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
          {/* Collection Type - FIRST field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  ref={typeRadioRef}
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
                  value="monthly"
                  checked={type === 'monthly'}
                  onChange={(e) => setType(e.target.value as CollectionType)}
                  className="mr-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Monthly Log</span>
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">(month-based)</span>
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

          {/* Collection Name - only for custom type */}
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

          {type === 'monthly' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Month and Year
              </label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
                
                <select
                  value={monthlyYear}
                  onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {generateYearRange().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Preview: {formatMonthlyLogName(`${monthlyYear}-${String(monthlyMonth + 1).padStart(2, '0')}`)}
              </div>
            </div>
          )}

          {/* Error message for non-custom types */}
          {error && type !== 'custom' && (
            <div className="mb-4">
              <div className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </div>
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
