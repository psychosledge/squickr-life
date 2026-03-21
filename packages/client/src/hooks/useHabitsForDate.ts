/**
 * Hook: useHabitsForDate
 *
 * Fetches habits scheduled for a specific date.
 * Subscribes to `entryProjection` so the UI re-fetches automatically
 * whenever habit events are appended.
 */

import { useState, useEffect, useCallback } from 'react';
import type { HabitReadModel } from '@squickr/domain';
import { useApp } from '../context/AppContext';

// ── Public types ─────────────────────────────────────────────────────────────

export interface HabitsForDateData {
  habits: HabitReadModel[];
  isLoading: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHabitsForDate(date: string): HabitsForDateData {
  const { entryProjection } = useApp();

  const [habits, setHabits] = useState<HabitReadModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!date) {
      setHabits([]);
      setIsLoading(false);
      return;
    }
    const result = await entryProjection.getHabitsForDate(date);
    setHabits(result);
    setIsLoading(false);
  }, [date, entryProjection]);

  // Initial load + re-fetch when date changes
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Subscribe to projection changes so we re-fetch on any habit mutation
  useEffect(() => {
    const unsubscribe = entryProjection.subscribe(() => {
      fetchData();
    });
    return unsubscribe;
  }, [entryProjection, fetchData]);

  return { habits, isLoading };
}
