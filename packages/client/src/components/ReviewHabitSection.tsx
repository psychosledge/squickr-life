/**
 * ReviewHabitSection Component
 *
 * Phase 2 Habits: Shows habit summary on the Review screen.
 * Displays each active habit's title, current streak, and 30-day completion rate.
 */

import type { HabitReadModel, HabitDayStatus } from '@squickr/domain';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewHabitSectionProps {
  habits: HabitReadModel[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate 30-day completion rate from habit history.
 * Only counts days that are 'completed' or 'missed' (scheduled days).
 * Returns a percentage string like "75%" or null if no scheduled days.
 */
function calcCompletionRate(history: HabitDayStatus[]): string | null {
  const scheduled = history.filter(d => d.status === 'completed' || d.status === 'missed');
  if (scheduled.length === 0) return null;
  const completed = scheduled.filter(d => d.status === 'completed').length;
  const rate = Math.round((completed / scheduled.length) * 100);
  return `${rate}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewHabitSection({ habits }: ReviewHabitSectionProps) {
  return (
    <section aria-label="Habit summary">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Habits
      </h2>

      {habits.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          Set up habits to see this section
        </p>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const rate = calcCompletionRate(habit.history);
            return (
              <li
                key={habit.id}
                className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="font-medium truncate flex-1 min-w-0">{habit.title}</span>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    🔥 {habit.currentStreak}
                  </span>
                  {rate !== null && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {rate}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
