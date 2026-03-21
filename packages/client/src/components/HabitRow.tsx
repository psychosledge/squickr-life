/**
 * HabitRow Component
 *
 * Displays a single habit row in the HabitsSection, with:
 * - Completion toggle (complete / revert)
 * - Streak badge
 * - 7-day mini completion grid
 * - Click-to-navigate to habit detail
 */

import type { HabitReadModel } from '@squickr/domain';
import type { CompleteHabitCommand, RevertHabitCompletionCommand } from '@squickr/domain';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HabitRowProps {
  habit: HabitReadModel;
  date: string;
  collectionId: string;
  onComplete: (cmd: CompleteHabitCommand) => void;
  onRevert: (cmd: RevertHabitCompletionCommand) => void;
  onNavigateToHabit?: (habitId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500',
  missed: 'bg-red-300 dark:bg-red-700',
  'not-scheduled': 'bg-gray-200 dark:bg-gray-700',
  future: 'bg-gray-100 dark:bg-gray-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function HabitRow({
  habit,
  date,
  collectionId,
  onComplete,
  onRevert,
  onNavigateToHabit,
}: HabitRowProps) {
  // Last 7 days from history (or fill with empty)
  const last7 = habit.history.slice(-7);

  const handleToggle = () => {
    if (habit.isCompletedToday) {
      onRevert({ habitId: habit.id, date });
    } else {
      onComplete({ habitId: habit.id, date, collectionId });
    }
  };

  const handleTitleClick = () => {
    onNavigateToHabit?.(habit.id);
  };

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      {/* Completion toggle */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={habit.isCompletedToday ? 'Revert completed habit' : 'Mark habit complete'}
        className={`
          flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
          transition-colors
          ${habit.isCompletedToday
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-400 dark:border-gray-500 hover:border-green-400'}
        `}
      >
        {habit.isCompletedToday && (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title (clickable) */}
      <button
        type="button"
        onClick={handleTitleClick}
        className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white truncate hover:text-green-600 dark:hover:text-green-400 transition-colors"
      >
        {habit.title}
      </button>

      {/* 7-day mini grid */}
      <div className="flex gap-0.5 flex-shrink-0" aria-label="7-day history">
        {last7.map((day, i) => (
          <span
            key={`${day.date}-${i}`}
            role="presentation"
            className={`w-3 h-3 rounded-sm ${STATUS_COLORS[day.status] ?? 'bg-gray-200'}`}
            title={day.date}
          />
        ))}
        {/* Pad remaining cells if fewer than 7 history entries */}
        {Array.from({ length: Math.max(0, 7 - last7.length) }).map((_, i) => (
          <span
            key={`pad-${i}`}
            role="presentation"
            className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>

      {/* Streak badge */}
      {habit.currentStreak > 0 && (
        <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          🔥{habit.currentStreak}
        </span>
      )}
    </div>
  );
}
