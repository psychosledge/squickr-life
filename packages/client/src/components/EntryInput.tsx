import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { EntryType } from '@squickr/domain';
import { ENTRY_ICONS } from '../utils/constants';

interface EntryInputProps {
  onSubmitTask: (title: string) => Promise<void>;
  onSubmitNote: (content: string) => Promise<void>;
  onSubmitEvent: (content: string) => Promise<void>;
  variant?: 'default' | 'modal';
  onSuccess?: () => void;
}

/**
 * EntryInput Component
 * 
 * Allows users to quickly capture entries of different types:
 * - Task: short title (1-500 characters)
 * - Note: short content (1-500 characters)
 * - Event: content (1-500 characters)
 * 
 * Features:
 * - Auto-focus on mount
 * - Enter key submits for all types
 * - Input clears after submission
 * - Icon button type selector
 */
export function EntryInput({ 
  onSubmitTask, 
  onSubmitNote, 
  onSubmitEvent,
  variant = 'default',
  onSuccess
}: EntryInputProps) {
  const [entryType, setEntryType] = useState<EntryType>('task');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and when type changes (default variant only)
  useEffect(() => {
    if (variant === 'default') {
      inputRef.current?.focus();
    }
  }, [entryType, variant]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    // Trim and validate
    const trimmedValue = inputValue.trim();

    if (trimmedValue.length === 0) {
      // Don't submit empty values
      return;
    }

    try {
      if (entryType === 'task') {
        await onSubmitTask(trimmedValue);
      } else if (entryType === 'note') {
        await onSubmitNote(trimmedValue);
      } else if (entryType === 'event') {
        await onSubmitEvent(trimmedValue);
      }

      // Clear inputs on success
      setInputValue('');
      setError('');

      // Call success callback (for modal auto-close)
      onSuccess?.();

      // Return focus
      inputRef.current?.focus();
    } catch (err) {
      // Show validation errors from command handler
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // All types: submit on Enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (value: string) => {
    setInputValue(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleTypeChange = (type: EntryType) => {
    setEntryType(type);
    setInputValue('');
    setError('');
  };

  const getPlaceholder = (): string => {
    switch (entryType) {
      case 'task':
        return 'Add a task... (press Enter)';
      case 'note':
        return 'Add a note... (press Enter)';
      case 'event':
        return 'Add an event... (press Enter)';
      default:
        return 'Add an entry... (press Enter)';
    }
  };

  const getMaxLength = () => {
    return 500;
  };

  const getCharacterCountColor = () => {
    const maxLength = getMaxLength();
    const percentage = (inputValue.length / maxLength) * 100;
    
    if (percentage >= 100) {
      return 'text-red-600 dark:text-red-400';
    } else if (percentage >= 90) {
      return 'text-orange-600 dark:text-orange-400';
    }
    return 'text-gray-500 dark:text-gray-400';
  };

  return (
    <div className={variant === 'default' ? 'w-full max-w-2xl mx-auto mb-6' : 'w-full'}>
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Type Selector - Icon Buttons */}
        <div className="flex gap-2 mb-3" role="group" aria-label="Entry type">
          <button
            type="button"
            onClick={() => handleTypeChange('task')}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-lg font-medium transition-colors
              ${entryType === 'task' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-pressed={entryType === 'task'}
          >
            <span className="text-lg mr-2">{ENTRY_ICONS.TASK_COMPLETED}</span>
            Task
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('note')}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-lg font-medium transition-colors
              ${entryType === 'note' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-pressed={entryType === 'note'}
          >
            <span className="text-lg mr-2">•</span>
            Note
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('event')}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-lg font-medium transition-colors
              ${entryType === 'event' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-pressed={entryType === 'event'}
          >
            <span className="text-lg mr-2">○</span>
            Event
          </button>
        </div>

        {/* Input Field */}
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              maxLength={500}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-colors"
              aria-label="Entry content"
            />
            {/* Save button visible in both default and modal variants (for mobile users) */}
            <button
              type="submit"
              disabled={inputValue.trim().length === 0}
              className="min-h-[44px] min-w-[44px] px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                         rounded-lg transition-colors focus:outline-none focus:ring-2 
                         focus:ring-blue-500 focus:ring-offset-2 self-start
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              Save
            </button>
          </div>
          
          {/* Character Counter */}
          <div className={`text-xs text-right ${getCharacterCountColor()}`}>
            {inputValue.length}/{getMaxLength()}
          </div>
        </div>
      </form>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
