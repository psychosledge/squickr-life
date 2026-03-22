/**
 * CreateHabitModal Component
 *
 * Modal for creating a new habit with:
 * - Title input (auto-focused)
 * - FrequencyPicker (daily / weekly / every-n-days)
 * - Notification time field (optional, Phase 3)
 */
import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import type { CreateHabitCommand, HabitFrequency } from '@squickr/domain';
import { FrequencyPicker } from './FrequencyPicker';
import type { FrequencyType } from './FrequencyPicker';

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (cmd: CreateHabitCommand) => Promise<void>;
}

export function CreateHabitModal({ isOpen, onClose, onSubmit }: CreateHabitModalProps) {
  const [title, setTitle] = useState('');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([new Date().getDay()]);
  const [nDays, setNDays] = useState(2);
  const [notificationTime, setNotificationTime] = useState('');
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
        return { type: 'every-n-days', n: nDays };
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
      ...(notificationTime ? { notificationTime } : {}),
    };

    try {
      await onSubmit(cmd);
      setTitle('');
      setFrequencyType('daily');
      setTargetDays([new Date().getDay()]);
      setNDays(2);
      setNotificationTime('');
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4"
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
          <FrequencyPicker
            frequencyType={frequencyType}
            onFrequencyTypeChange={setFrequencyType}
            targetDays={targetDays}
            onTargetDaysChange={setTargetDays}
            nDays={nDays}
            onNDaysChange={setNDays}
          />

          {/* Notification Time (optional) */}
          <div className="mb-6">
            <label
              htmlFor="habit-notification-time"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Notification Time
              <span className="ml-1 text-xs text-gray-400">(optional)</span>
            </label>
            <input
              id="habit-notification-time"
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
