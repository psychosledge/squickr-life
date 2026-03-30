/**
 * HabitDetailView
 *
 * Shows detail for a single habit: title, streak stats, frequency, 30-day history grid.
 * Route: /habits/:habitId
 *
 * Features:
 * - Inline title editing (pencil button → input → save/cancel)
 * - Collapsible Settings section with frequency editor
 * - Archive with confirmation dialog
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { HabitFrequency, HabitReadModel } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { HabitHistoryGrid } from '../components/HabitHistoryGrid';
import { FrequencyPicker } from '../components/FrequencyPicker';
import type { FrequencyType, ScheduleMode } from '../components/FrequencyPicker';
import { ROUTES } from '../routes';

function formatFrequency(habit: HabitReadModel): string {
  const freq = habit.frequency;
  const relativeSuffix = freq.mode === 'relative' ? ' · Relative' : '';
  if (freq.type === 'daily') return 'Daily';
  if (freq.type === 'weekly') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const names = freq.targetDays.map((d) => days[d] ?? '').filter(Boolean);
    return `Weekly (${names.join(', ')})${relativeSuffix}`;
  }
  return `Every ${freq.n} days${relativeSuffix}`;
}

function frequencyEqual(a: HabitFrequency, b: HabitFrequency): boolean {
  if (a.type !== b.type) return false;
  if ((a.mode ?? 'fixed') !== (b.mode ?? 'fixed')) return false;
  if (a.type === 'weekly' && b.type === 'weekly') {
    return [...a.targetDays].sort().join() === [...b.targetDays].sort().join();
  }
  if (a.type === 'every-n-days' && b.type === 'every-n-days') {
    return a.n === b.n;
  }
  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HabitDetailView() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const {
    entryProjection,
    updateHabitTitleHandler,
    updateHabitFrequencyHandler,
    archiveHabitHandler,
    setHabitNotificationTimeHandler,
    clearHabitNotificationTimeHandler,
  } = useApp();

  const [habit, setHabit] = useState<HabitReadModel | null | undefined>(undefined); // undefined = loading

  // ── Title edit state ──
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaveError, setTitleSaveError] = useState('');

  // ── Settings / frequency edit state ──
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editFreqType, setEditFreqType] = useState<FrequencyType>('daily');
  const [editTargetDays, setEditTargetDays] = useState<number[]>([new Date().getDay()]);
  const [editNDays, setEditNDays] = useState(2);
  const [editScheduleMode, setEditScheduleMode] = useState<ScheduleMode>('fixed');
  const [editNotificationTime, setEditNotificationTime] = useState('');
  const [isFreqSaving, setIsFreqSaving] = useState(false);
  const [freqSaveError, setFreqSaveError] = useState('');

  // ── Archive state ──
  const [isArchiveConfirming, setIsArchiveConfirming] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  // ── Data loading ──
  useEffect(() => {
    const loadData = async () => {
      if (!habitId) {
        setHabit(null);
        return;
      }
      const found = await entryProjection.getHabitById(habitId);
      setHabit(found ?? null);
    };
    loadData();
    const unsub = entryProjection.subscribe(() => loadData());
    return () => unsub();
  }, [habitId, entryProjection]);

  // ── Sync frequency edit state when settings opens ──
  // We use habit?.id (not the full habit object) to avoid re-syncing on every
  // streak/history update — we only want to re-sync when the habit identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isSettingsOpen || !habit) return;
    setEditFreqType(habit.frequency.type);
    setEditTargetDays(
      habit.frequency.type === 'weekly' ? [...habit.frequency.targetDays] : [new Date().getDay()],
    );
    setEditNDays(habit.frequency.type === 'every-n-days' ? habit.frequency.n : 2);
    setEditScheduleMode(
      habit.frequency.type === 'daily' ? 'fixed' : (habit.frequency.mode ?? 'fixed'),
    );
    setEditNotificationTime(habit.notificationTime ?? '');
  }, [isSettingsOpen, habit?.id]);

  // ── Loading / not found ──
  if (habit === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (habit === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Habit Not Found
          </h1>
          <button
            type="button"
            onClick={() => navigate(ROUTES.habits)}
            className="text-blue-600 hover:underline text-sm"
          >
            Back to Habits
          </button>
        </div>
      </div>
    );
  }

  // ── Title edit handlers ──
  const enterTitleEdit = () => {
    setTitleDraft(habit.title);
    setTitleSaveError('');
    setIsTitleEditing(true);
  };

  const cancelTitleEdit = () => {
    setIsTitleEditing(false);
    setTitleSaveError('');
  };

  const saveTitleEdit = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    setTitleSaveError('');
    try {
      await updateHabitTitleHandler.handle({ habitId: habit.id, title: trimmed });
      setIsTitleEditing(false);
    } catch (err) {
      setTitleSaveError(err instanceof Error ? err.message : 'Failed to update title');
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitleEdit();
    } else if (e.key === 'Escape') {
      cancelTitleEdit();
    }
  };

  // ── Frequency edit helpers ──
  const buildEditFrequency = (): HabitFrequency => {
    switch (editFreqType) {
      case 'daily':
        return { type: 'daily' };
      case 'weekly':
        return { type: 'weekly', targetDays: editTargetDays as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>, mode: editScheduleMode };
      case 'every-n-days':
        return { type: 'every-n-days', n: editNDays, mode: editScheduleMode };
    }
  };

  const isNotificationTimeUnchanged = editNotificationTime === (habit.notificationTime ?? '');
  const isFreqBodyUnchanged = frequencyEqual(habit.frequency, buildEditFrequency());
  const isFreqUnchanged = isFreqBodyUnchanged && isNotificationTimeUnchanged;

  const saveFrequency = async () => {
    setIsFreqSaving(true);
    setFreqSaveError('');
    try {
      // Only dispatch frequency event when frequency actually changed
      if (!isFreqBodyUnchanged) {
        await updateHabitFrequencyHandler.handle({
          habitId: habit.id,
          frequency: buildEditFrequency(),
        });
      }

      // Handle notification time changes
      if (!isNotificationTimeUnchanged) {
        if (editNotificationTime) {
          await setHabitNotificationTimeHandler.handle({
            habitId: habit.id,
            notificationTime: editNotificationTime,
          });
        } else {
          await clearHabitNotificationTimeHandler.handle({ habitId: habit.id });
        }
      }

      setIsSettingsOpen(false);
    } catch (err) {
      setFreqSaveError(err instanceof Error ? err.message : 'Failed to update frequency');
    } finally {
      setIsFreqSaving(false);
    }
  };

  // ── Archive handler ──
  const doArchive = async () => {
    setIsArchiving(true);
    setArchiveError('');
    try {
      await archiveHabitHandler.handle({ habitId: habit.id });
      navigate(ROUTES.habits);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive habit');
      setIsArchiving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(ROUTES.habits)}
          className="
            p-2 rounded-lg
            text-gray-600 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
          "
        >
          ←
        </button>

        {isTitleEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              aria-label="Edit habit title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-semibold
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              aria-label="Save title"
              onClick={saveTitleEdit}
              disabled={titleDraft.trim().length === 0}
              className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✓
            </button>
            <button
              type="button"
              aria-label="Cancel edit"
              onClick={cancelTitleEdit}
              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              ✗
            </button>
            {titleSaveError && (
              <span className="text-sm text-red-600 dark:text-red-400" role="alert">
                {titleSaveError}
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              {habit.title}
            </h1>
            <button
              type="button"
              aria-label="Edit habit title"
              onClick={enterTitleEdit}
              className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{habit.currentStreak}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Current Streak</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{habit.longestStreak}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Longest Streak</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatFrequency(habit)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Frequency</p>
          </div>
        </div>

        {/* 30-day history */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Last 30 Days
          </h2>
          <HabitHistoryGrid history={habit.history} />
        </div>

        {/* ── Settings section ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50
                       transition-colors rounded-lg"
          >
            <span>Settings</span>
            <span className="text-gray-400">{isSettingsOpen ? '▲' : '▼'}</span>
          </button>

          {isSettingsOpen && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
              <div className="pt-4">
                <FrequencyPicker
                  frequencyType={editFreqType}
                  onFrequencyTypeChange={setEditFreqType}
                  targetDays={editTargetDays}
                  onTargetDaysChange={setEditTargetDays}
                  nDays={editNDays}
                  onNDaysChange={setEditNDays}
                  scheduleMode={editScheduleMode}
                  onScheduleModeChange={setEditScheduleMode}
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="habit-notification-time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Notification time
                </label>
                <input
                  id="habit-notification-time"
                  type="time"
                  value={editNotificationTime}
                  onChange={(e) => setEditNotificationTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {freqSaveError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">
                  {freqSaveError}
                </p>
              )}

              <button
                type="button"
                aria-label="Save changes"
                onClick={saveFrequency}
                disabled={isFreqUnchanged || isFreqSaving}
                className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                           transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFreqSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* ── Archive section ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          {isArchiveConfirming ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Archive this habit? This cannot be undone.
              </p>
              {archiveError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {archiveError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => setIsArchiveConfirming(false)}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
                             hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-label="Archive"
                  onClick={doArchive}
                  disabled={isArchiving}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg
                             transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isArchiving ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {archiveError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">
                  {archiveError}
                </p>
              )}
              <button
                type="button"
                aria-label="Archive habit"
                onClick={() => setIsArchiveConfirming(true)}
                className="w-full px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Archive Habit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
