import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';

interface TaskInputProps {
  onSubmit: (title: string) => Promise<void>;
}

/**
 * TaskInput Component
 * 
 * Allows users to quickly capture a task title.
 * Follows UX decisions from EM-001:
 * - Auto-focus on mount
 * - Enter key submits
 * - Input clears after submission
 * - Validation feedback inline
 */
export function TaskInput({ onSubmit }: TaskInputProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount (EM-001 UX decision)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    // Trim and validate (matches CreateTaskHandler validation)
    const trimmedTitle = title.trim();

    if (trimmedTitle.length === 0) {
      // Don't submit empty titles, but don't show error
      // This allows user to press Enter/click without spam
      return;
    }

    try {
      await onSubmit(trimmedTitle);
      
      // Clear input on success (EM-001 UX decision)
      setTitle('');
      setError('');
      
      // Return focus to input (EM-001 UX decision)
      inputRef.current?.focus();
    } catch (err) {
      // Show validation errors from command handler
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      handleSubmit();
    }
  };

  const handleChange = (value: string) => {
    setTitle(value);
    
    // Clear error when user starts typing (good UX)
    if (error) {
      setError('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task... (press Enter)"
          className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors"
          aria-label="Task title"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                     rounded-lg transition-colors focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-offset-2"
        >
          Add
        </button>
      </form>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
