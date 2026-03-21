import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { CreateHabitCommand, HabitFrequency } from '@squickr/domain';

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cmd: CreateHabitCommand) => Promise<void>;
}

type FrequencyType = 'daily' | 'weekly' | 'every-n-days';

/**
 * CreateHabitModal Component
 *
 * Modal for creating a new habit with:
 * - Title input (auto-focused)
 * - Frequency selector (daily / weekly / every-n-days)
 * - Disabled notification time field (Phase 3 placeholder)
 */
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function CreateHabitModal({ isOpen, onClose, onSubmit }: CreateHabitModalProps) {
  const [title, setTitle] = useState('');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([new Date().getDay()]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus title input when modal opens
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

  const buildFrequency = (): HabitFrequency => {
    switch (frequencyType) {
      case 'daily':
        return { type: 'daily' };
      case 'weekly':
        return { type: 'weekly', targetDays: targetDays as Array<0|1|2|3|4|5|6> };
      case 'every-n-days':
        return { type: 'every-n-days', n: 2 };
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) return;

    const cmd: CreateHabitCommand = {
      title: trimmed,
      frequency: buildFrequency(),
      order: new Date().toISOString(),
    };

    try {
      await onSubmit(cmd);
      setTitle('');
      setFrequencyType('daily');
      setTargetDays([new Date().getDay()]);
      setError('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const isCreateDisabled = title.trim().length === 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">New Habit</h2>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="habit-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Habit Name
            </label>
            <input
              ref={inputRef}
              id="habit-name"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Meditate, Exercise, Read"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'habit-name-error' : undefined}
            />
            {error && (
              <div
                id="habit-name-error"
                className="mt-2 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          {/* Frequency */}
          <div className="mb-4">
            <label
              htmlFor="habit-frequency"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Frequency
            </label>
            <select
              id="habit-frequency"
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value as FrequencyType)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="every-n-days">Every N Days</option>
            </select>
          </div>

          {/* Day-of-week picker — shown only for weekly frequency */}
          {frequencyType === 'weekly' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Days of Week
              </label>
              <div className="flex gap-1" role="group" aria-label="Days of week">
                {DAY_LABELS.map((label, dayIndex) => {
                  const isSelected = targetDays.includes(dayIndex);
                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      aria-label={DAY_FULL_LABELS[dayIndex]}
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (isSelected && targetDays.length === 1) {
                          // Prevent de-selecting the last day
                          return;
                        }
                        setTargetDays(prev =>
                          isSelected
                            ? prev.filter(d => d !== dayIndex)
                            : [...prev, dayIndex].sort((a, b) => a - b),
                        );
                      }}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition-colors
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                        ${isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notification Time (disabled - Phase 3) */}
          <div className="mb-6">
            <label
              htmlFor="habit-notification-time"
              className="block text-sm font-medium text-gray-400 dark:text-gray-500 mb-2"
            >
              Notification Time (coming soon)
            </label>
            <input
              id="habit-notification-time"
              type="time"
              disabled
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg
                         bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500
                         cursor-not-allowed"
            />
          </div>

          {/* Actions */}
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
