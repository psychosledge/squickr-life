import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { EntryType } from '@squickr/shared';

interface EntryInputProps {
  onSubmitTask: (title: string) => Promise<void>;
  onSubmitNote: (content: string) => Promise<void>;
  onSubmitEvent: (content: string, eventDate?: string) => Promise<void>;
  variant?: 'default' | 'modal';
  onSuccess?: () => void;
}

/**
 * EntryInput Component
 * 
 * Allows users to quickly capture entries of different types:
 * - Task: short title (1-500 characters)
 * - Note: short content (1-500 characters)
 * - Event: content (1-500 characters) + optional date
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
  const [eventDate, setEventDate] = useState('');
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
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

    // Validate date if it's an event with a date
    if (entryType === 'event' && eventDate.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(eventDate.trim())) {
        setDateError('Please enter a valid date in YYYY-MM-DD format');
        return;
      }
      
      // Additional validation: check if it's a valid date
      const dateObj = new Date(eventDate.trim() + 'T00:00:00');
      if (isNaN(dateObj.getTime())) {
        setDateError('Please enter a valid date');
        return;
      }
    }

    try {
      if (entryType === 'task') {
        await onSubmitTask(trimmedValue);
      } else if (entryType === 'note') {
        await onSubmitNote(trimmedValue);
      } else if (entryType === 'event') {
        const trimmedDate = eventDate.trim();
        await onSubmitEvent(trimmedValue, trimmedDate || undefined);
      }
      
      // Clear inputs on success
      setInputValue('');
      setEventDate('');
      setError('');
      setDateError('');
      
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
    setEventDate('');
    setError('');
    setDateError('');
  };

  const getPlaceholder = () => {
    switch (entryType) {
      case 'task':
        return 'Add a task... (press Enter)';
      case 'note':
        return 'Add a note... (press Enter)';
      case 'event':
        return 'Add an event... (press Enter)';
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
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-lg font-medium transition-colors
              ${entryType === 'task' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            aria-pressed={entryType === 'task'}
          >
            <span className="text-lg mr-2">✓</span>
            Task
          </button>
          
          <button
            type="button"
            onClick={() => handleTypeChange('note')}
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
            {/* Only show Add button in default variant */}
            {variant === 'default' && (
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                           rounded-lg transition-colors focus:outline-none focus:ring-2 
                           focus:ring-blue-500 focus:ring-offset-2 self-start"
              >
                Add
              </button>
            )}
          </div>
          
          {/* Character Counter */}
          <div className={`text-xs text-right ${getCharacterCountColor()}`}>
            {inputValue.length}/{getMaxLength()}
          </div>
        </div>

        {/* Event Date Picker (only for events) */}
        {entryType === 'event' && (
          <div>
            <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event Date (optional)
            </label>
            <input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value);
                setDateError(''); // Clear error when user changes date
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-colors"
              aria-label="Event date"
              aria-invalid={dateError ? 'true' : 'false'}
              aria-describedby={dateError ? 'date-error' : undefined}
            />
            {dateError && (
              <div id="date-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {dateError}
              </div>
            )}
          </div>
        )}
      </form>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
