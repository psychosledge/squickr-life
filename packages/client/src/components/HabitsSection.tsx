/**
 * HabitsSection Component
 *
 * Renders the habits block inside CollectionDetailView for daily collections.
 * Shows a section header with "+" button, loading/empty states, and a list
 * of HabitRow components.
 */

import type { HabitReadModel } from '@squickr/domain';
import type { CompleteHabitCommand, RevertHabitCompletionCommand } from '@squickr/domain';
import { HabitRow } from './HabitRow';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HabitsSectionProps {
  habits: HabitReadModel[];
  isLoading: boolean;
  date: string;
  collectionId: string;
  onComplete: (cmd: CompleteHabitCommand) => void;
  onRevert: (cmd: RevertHabitCompletionCommand) => void;
  onAddHabit: () => void;
  onNavigateToHabit?: (habitId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HabitsSection({
  habits,
  isLoading,
  date,
  collectionId,
  onComplete,
  onRevert,
  onAddHabit,
  onNavigateToHabit,
}: HabitsSectionProps) {
  return (
    <section aria-label="Habits" className="mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between px-1 mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Habits
        </h3>
        <button
          type="button"
          aria-label="Add habit"
          onClick={onAddHabit}
          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div role="status" className="py-2 px-1 text-sm text-gray-400 dark:text-gray-500">
          <span className="sr-only">Loading habits…</span>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && habits.length === 0 && (
        <p className="py-2 px-1 text-sm text-gray-400 dark:text-gray-500 italic">
          No habits yet
        </p>
      )}

      {/* Habit list */}
      {!isLoading && habits.length > 0 && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {habits.map((habit) => (
            <li key={habit.id}>
              <HabitRow
                habit={habit}
                date={date}
                collectionId={collectionId}
                onComplete={onComplete}
                onRevert={onRevert}
                onNavigateToHabit={onNavigateToHabit}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
