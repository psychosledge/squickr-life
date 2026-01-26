import { useState, useEffect, useRef, FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import type { EntryType } from '@squickr/shared';

interface EntryInputProps {
  onSubmitTask: (title: string) => Promise<void>;
  onSubmitNote: (content: string) => Promise<void>;
  onSubmitEvent: (content: string, eventDate?: string) => Promise<void>;
}

/**
 * EntryInput Component
 * 
 * Allows users to quickly capture entries of different types:
 * - Task: short title (1-500 characters)
 * - Note: longer content (1-5000 characters)
 * - Event: content + optional date
 * 
 * Features:
 * - Auto-focus on mount
 * - Enter key submits (Shift+Enter for new line in textarea)
 * - Input clears after submission
 * - Type selector dropdown
 */
export function EntryInput({ onSubmitTask, onSubmitNote, onSubmitEvent }: EntryInputProps) {
  const [entryType, setEntryType] = useState<EntryType>('task');
  const [inputValue, setInputValue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount and when type changes
  useEffect(() => {
    if (entryType === 'task') {
      inputRef.current?.focus();
    } else {
      textareaRef.current?.focus();
    }
  }, [entryType]);

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
      
      // Return focus
      if (entryType === 'task') {
        inputRef.current?.focus();
      } else {
        textareaRef.current?.focus();
      }
    } catch (err) {
      // Show validation errors from command handler
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // For textarea (notes/events), submit on Enter without Shift
    // For input (tasks), let the form handle Enter naturally
    if (e.key === 'Enter' && !e.shiftKey) {
      if (entryType !== 'task') {
        // Textarea: prevent newline and submit manually
        e.preventDefault();
        handleSubmit();
      }
      // For tasks: Enter triggers form submit naturally, don't call handleSubmit manually
    }
  };

  const handleChange = (value: string) => {
    setInputValue(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setEntryType(e.target.value as EntryType);
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
        return 'Add a note... (press Enter, Shift+Enter for new line)';
      case 'event':
        return 'Add an event... (press Enter, Shift+Enter for new line)';
    }
  };

  const getMaxLength = () => {
    return entryType === 'task' ? 500 : 5000;
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
    <div className="w-full max-w-2xl mx-auto mb-6">
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Type Selector */}
        <div className="flex gap-2">
          <select
            value={entryType}
            onChange={handleTypeChange}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors cursor-pointer"
            aria-label="Entry type"
          >
            <option value="task">☐ Task</option>
            <option value="note">- Note</option>
            <option value="event">○ Event</option>
          </select>
        </div>

        {/* Input Field */}
        <div className="space-y-1">
          <div className="flex gap-2">
            {entryType === 'task' ? (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                maxLength={getMaxLength()}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-colors"
                aria-label="Entry content"
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                maxLength={getMaxLength()}
                rows={3}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-colors resize-y"
                aria-label="Entry content"
              />
            )}
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                         rounded-lg transition-colors focus:outline-none focus:ring-2 
                         focus:ring-blue-500 focus:ring-offset-2 self-start"
            >
              Add
            </button>
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
