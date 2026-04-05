/**
 * Hook: useReviewData
 *
 * Fetches data required for the Review screen (Proactive Squickr):
 *  - Completed entries within the current review period's date range
 *  - Stalled open tasks on monthly collections (no activity for 14+ days)
 *
 * Subscribes to `entryProjection` so the UI re-fetches automatically whenever
 * entries are created, completed, or migrated.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Collection, Entry, StalledTask, HabitReadModel } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { getDateRange } from '../utils/reviewDateRange';
import type { ReviewPeriod } from '../utils/reviewDateRange';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ReviewData {
  completedEntries: Entry[];
  stalledTasks: StalledTask[];
  collectionMap: Map<string, Collection>;
  habits: HabitReadModel[];
  period: ReviewPeriod;
  dateRange: { from: Date; to: Date };
  isLoading: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReviewData(period: ReviewPeriod = 'weekly'): ReviewData {
  const { entryProjection, habitProjection, collectionProjection } = useApp();

  const [completedEntries, setCompletedEntries] = useState<Entry[]>([]);
  const [stalledTasks, setStalledTasks] = useState<StalledTask[]>([]);
  const [collectionMap, setCollectionMap] = useState<Map<string, Collection>>(new Map());
  const [habits, setHabits] = useState<HabitReadModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const fetchData = useCallback(async () => {
    // Build getCollection callback fresh on each fetch so the collection
    // map reflects the latest state.
    const collections = await collectionProjection.getCollections();
    const map = new Map(collections.map(c => [c.id, c]));
    const getCollection = (id: string) => map.get(id);

    const [completed, stalled, activeHabits] = await Promise.all([
      entryProjection.getCompletedInRange(dateRange.from, dateRange.to),
      entryProjection.getStalledMonthlyTasks(14, getCollection),
      habitProjection.getActiveHabits(),
    ]);

    setCollectionMap(map);
    setCompletedEntries(completed);
    setStalledTasks(stalled);
    setHabits(activeHabits);
    setIsLoading(false);
  }, [dateRange, entryProjection, habitProjection, collectionProjection]);

  // Initial load + re-fetch when period changes
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Subscribe to both projections so we re-fetch on any entry or habit mutation
  useEffect(() => {
    const unsubEntry = entryProjection.subscribe(() => {
      fetchData();
    });
    const unsubHabit = habitProjection.subscribe(() => {
      fetchData();
    });
    return () => {
      unsubEntry();
      unsubHabit();
    };
  }, [entryProjection, habitProjection, fetchData]);

  return {
    completedEntries,
    stalledTasks,
    collectionMap,
    habits,
    period,
    dateRange,
    isLoading,
  };
}
