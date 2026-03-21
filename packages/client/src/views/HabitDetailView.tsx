/**
 * HabitDetailView
 *
 * Shows detail for a single habit: title, streak stats, frequency, 30-day history grid.
 * Route: /habits/:habitId
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { HabitReadModel } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { HabitHistoryGrid } from '../components/HabitHistoryGrid';
import { ROUTES } from '../routes';

function formatFrequency(habit: HabitReadModel): string {
  const freq = habit.frequency;
  if (freq.type === 'daily') return 'Daily';
  if (freq.type === 'weekly') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const names = freq.targetDays.map((d) => days[d] ?? '').filter(Boolean);
    return `Weekly (${names.join(', ')})`;
  }
  return `Every ${freq.n} days`;
}

export function HabitDetailView() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const { entryProjection } = useApp();

  const [habit, setHabit] = useState<HabitReadModel | null | undefined>(undefined); // undefined = loading

  const loadData = async () => {
    if (!habitId) {
      setHabit(null);
      return;
    }
    const found = await entryProjection.getHabitById(habitId);
    setHabit(found ?? null);
  };

  useEffect(() => {
    loadData();
    const unsub = entryProjection.subscribe(() => loadData());
    return () => unsub();
  }, [habitId, entryProjection]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">{habit.title}</h1>
      </div>

      {/* Content */}
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
      </div>
    </div>
  );
}
