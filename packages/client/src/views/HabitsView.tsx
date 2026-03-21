/**
 * HabitsView
 *
 * Management route for all habits (/habits).
 * Shows active habits, archived habits, and a FAB to create new habits.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HabitReadModel, CreateHabitCommand } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { useHabitsManagement } from '../hooks/useHabitsManagement';
import { CreateHabitModal } from '../components/CreateHabitModal';
import { FAB } from '../components/FAB';
import { ROUTES } from '../routes';

export function HabitsView() {
  const navigate = useNavigate();
  const { entryProjection } = useApp();
  const habitsMgmt = useHabitsManagement();

  const [activeHabits, setActiveHabits] = useState<HabitReadModel[]>([]);
  const [archivedHabits, setArchivedHabits] = useState<HabitReadModel[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = async () => {
    const active = await entryProjection.getActiveHabits();
    const all = await entryProjection.getAllHabits();
    setActiveHabits(active);
    setArchivedHabits(all.filter((h) => !!h.archivedAt));
  };

  useEffect(() => {
    loadData();
    const unsub = entryProjection.subscribe(() => loadData());
    return () => unsub();
  }, [entryProjection]);

  const handleCreateHabit = async (cmd: CreateHabitCommand) => {
    await habitsMgmt.createHabit(cmd);
    setIsCreateModalOpen(false);
  };

  const hasAny = activeHabits.length > 0 || archivedHabits.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(ROUTES.index)}
          className="
            p-2 rounded-lg
            text-gray-600 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-gray-700
            transition-colors
          "
        >
          ←
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Habits</h1>
      </div>

      {/* Content */}
      <div className="pb-20 px-4 py-6 max-w-2xl mx-auto">
        {!hasAny && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-12">
            No habits yet. Tap + to create your first habit.
          </p>
        )}

        {activeHabits.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Active
            </h2>
            <ul className="space-y-2">
              {activeHabits.map((habit) => (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/habits/${habit.id}`)}
                    className="
                      w-full text-left
                      bg-white dark:bg-gray-800
                      border border-gray-200 dark:border-gray-700
                      rounded-lg px-4 py-3
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors
                    "
                  >
                    <span className="text-gray-900 dark:text-white font-medium">{habit.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {archivedHabits.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Archived
            </h2>
            <ul className="space-y-2">
              {archivedHabits.map((habit) => (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/habits/${habit.id}`)}
                    className="
                      w-full text-left
                      bg-white dark:bg-gray-800
                      border border-gray-200 dark:border-gray-700
                      rounded-lg px-4 py-3
                      opacity-60
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors
                    "
                  >
                    <span className="text-gray-900 dark:text-white font-medium">{habit.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={() => setIsCreateModalOpen(true)} />

      {/* Create habit modal */}
      <CreateHabitModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateHabit}
      />
    </div>
  );
}
