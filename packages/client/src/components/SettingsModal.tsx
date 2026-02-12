/**
 * SettingsModal Component
 * 
 * Modal for updating user preferences/settings.
 * 
 * Features:
 * - Default completed task behavior dropdown
 * - Auto-favorite recent daily logs checkbox
 * - Escape key to close
 * - Click outside to close
 * - Displays validation errors
 * - Loading state while saving
 * - Dark mode support
 */

import { useState, useEffect, FormEvent } from 'react';
import type { CompletedTaskBehavior } from '@squickr/domain';
import { UpdateUserPreferencesHandler } from '@squickr/domain';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useApp } from '../context/AppContext';
import { BEHAVIOR_LABELS, BEHAVIOR_DESCRIPTIONS } from '../utils/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const currentPreferences = useUserPreferences();
  const { eventStore } = useApp();
  
  const [defaultCompletedTaskBehavior, setDefaultCompletedTaskBehavior] = useState<CompletedTaskBehavior>('move-to-bottom');
  const [autoFavoriteRecentDailyLogs, setAutoFavoriteRecentDailyLogs] = useState(false);
  const [autoFavoriteRecentMonthlyLogs, setAutoFavoriteRecentMonthlyLogs] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize settings when modal opens
  useEffect(() => {
    if (isOpen && currentPreferences) {
      setDefaultCompletedTaskBehavior(currentPreferences.defaultCompletedTaskBehavior);
      setAutoFavoriteRecentDailyLogs(currentPreferences.autoFavoriteRecentDailyLogs);
      setAutoFavoriteRecentMonthlyLogs(currentPreferences.autoFavoriteRecentMonthlyLogs);
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, currentPreferences]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, isSaving, onClose]);

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
      if (!isSaving) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Clean up state if still there
      if (window.history.state?.modal) {
        window.history.back();
      }
    };
  }, [isOpen, isSaving, onClose]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();

    setIsSaving(true);
    setError('');

    try {
      const handler = new UpdateUserPreferencesHandler(eventStore);
      await handler.handle({
        defaultCompletedTaskBehavior,
        autoFavoriteRecentDailyLogs,
        autoFavoriteRecentMonthlyLogs,
      });
      
      // Close modal on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
      onClose();
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
        // Close modal when clicking backdrop (if not saving)
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Settings
        </h2>
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
          User Preferences
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Default Completed Task Behavior */}
          <div className="mb-6">
            <label htmlFor="default-completed-task-behavior" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Default Completed Task Behavior
            </label>
            <select
              id="default-completed-task-behavior"
              value={defaultCompletedTaskBehavior}
              onChange={(e) => setDefaultCompletedTaskBehavior(e.target.value as CompletedTaskBehavior)}
              disabled={isSaving}
              className="
                w-full px-3 py-2
                bg-white dark:bg-gray-700
                border border-gray-300 dark:border-gray-600
                rounded-lg
                text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500
                cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <option value="keep-in-place">{BEHAVIOR_LABELS['keep-in-place']}</option>
              <option value="move-to-bottom">{BEHAVIOR_LABELS['move-to-bottom']}</option>
              <option value="collapse">{BEHAVIOR_LABELS['collapse']}</option>
            </select>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              New collections will use this behavior.
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {BEHAVIOR_DESCRIPTIONS[defaultCompletedTaskBehavior]}
            </div>
          </div>

          {/* Auto-favorite Recent Daily Logs */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoFavoriteRecentDailyLogs}
                onChange={(e) => setAutoFavoriteRecentDailyLogs(e.target.checked)}
                disabled={isSaving}
                className="
                  mt-0.5
                  w-4 h-4
                  text-blue-600
                  border-gray-300 dark:border-gray-600
                  rounded
                  focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Auto-favorite recent daily logs
                </span>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Automatically show Today, Yesterday, and Tomorrow daily logs in Favorites section.
                </p>
              </div>
            </label>
          </div>

          {/* Auto-favorite Recent Monthly Logs */}
          <div className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoFavoriteRecentMonthlyLogs}
                onChange={(e) => setAutoFavoriteRecentMonthlyLogs(e.target.checked)}
                disabled={isSaving}
                className="
                  mt-0.5
                  w-4 h-4
                  text-blue-600
                  border-gray-300 dark:border-gray-600
                  rounded
                  focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Auto-favorite recent monthly logs
                </span>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Automatically show last month, current month, and next month in Favorites section.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="
                px-4 py-2
                text-gray-700 dark:text-gray-300
                bg-gray-100 dark:bg-gray-700 
                hover:bg-gray-200 dark:hover:bg-gray-600
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="
                px-4 py-2
                bg-blue-600 hover:bg-blue-700
                text-white
                rounded-lg 
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                min-w-[80px]
              "
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
