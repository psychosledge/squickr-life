/**
 * NotificationsTab Component
 *
 * Displays a per-habit time picker for configuring daily reminder notifications.
 * Pure component — receives habits and handlers via props, no direct context access.
 *
 * Features:
 * - Shows "blocked" banner when Notification.permission === 'denied'
 * - Time picker per habit (fires onSetTime immediately on change)
 * - Clear button per habit (visible only when notificationTime is set)
 * - Filters out archived habits
 * - "No habits yet" empty state
 */

import type { HabitReadModel } from '@squickr/domain';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationsTabProps {
  habits: HabitReadModel[];
  onSetTime: (habitId: string, notificationTime: string) => Promise<void>;
  onClearTime: (habitId: string) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsTab({ habits, onSetTime, onClearTime }: NotificationsTabProps) {
  const isBlocked =
    typeof Notification !== 'undefined' && Notification.permission === 'denied';

  // Filter to active (non-archived) habits only
  const activeHabits = habits.filter((h) => h.archivedAt === undefined);

  return (
    <div>
      {/* Blocked banner */}
      {isBlocked && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300"
        >
          Notifications are blocked in your browser. To enable them, open your
          browser settings and allow notifications for this site.
        </div>
      )}

      {/* Empty state */}
      {activeHabits.length === 0 ? (
        <p className="py-2 text-sm text-gray-400 dark:text-gray-500 italic">
          No habits yet
        </p>
      ) : (
        <ul
          className={`divide-y divide-gray-100 dark:divide-gray-700 ${
            isBlocked ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {activeHabits.map((habit) => (
            <li key={habit.id} className="flex items-center gap-3 py-3">
              {/* Habit title */}
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                {habit.title}
              </span>

              {/* Time picker */}
              <input
                type="time"
                aria-label={`Reminder time for ${habit.title}`}
                value={habit.notificationTime ?? ''}
                onChange={(e) => {
                  void onSetTime(habit.id, e.target.value);
                }}
                className="
                  px-2 py-1
                  text-sm
                  bg-white dark:bg-gray-700
                  border border-gray-300 dark:border-gray-600
                  rounded-lg
                  text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                "
              />

              {/* Clear button — only visible when notificationTime is set */}
              {habit.notificationTime !== undefined && (
                <button
                  type="button"
                  aria-label={`Clear reminder for ${habit.title}`}
                  onClick={() => {
                    void onClearTime(habit.id);
                  }}
                  className="
                    flex-shrink-0
                    p-1
                    text-gray-400 dark:text-gray-500
                    hover:text-red-500 dark:hover:text-red-400
                    rounded
                    transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500
                  "
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 4L4 12M4 4l8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
