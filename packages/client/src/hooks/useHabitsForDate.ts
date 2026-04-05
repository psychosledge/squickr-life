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

export function useHabitsForDate(
  date: string,
  options?: { asOf?: string },
): HabitsForDateData {
  const { habitProjection } = useApp();

  const [habits, setHabits] = useState<HabitReadModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const asOf = options?.asOf;

  const fetchData = useCallback(async () => {
    if (!date) {
      setHabits([]);
      setIsLoading(false);
      return;
    }
    const result = await habitProjection.getHabitsForDate(date, asOf ? { asOf } : undefined);
    setHabits(result);
    setIsLoading(false);
  }, [date, asOf, habitProjection]);

  // Initial load + re-fetch when date changes
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Subscribe to projection changes so we re-fetch on any habit mutation
  useEffect(() => {
    const unsubscribe = habitProjection.subscribe(() => {
      fetchData();
    });
    return unsubscribe;
  }, [habitProjection, fetchData]);

  return { habits, isLoading };
}
