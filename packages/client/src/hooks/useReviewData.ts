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

import { useState, useEffect, useCallback } from 'react';
import type { Entry, StalledTask } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { getDateRange } from '../utils/reviewDateRange';
import type { ReviewPeriod } from '../utils/reviewDateRange';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ReviewData {
  completedEntries: Entry[];
  stalledTasks: StalledTask[];
  period: ReviewPeriod;
  dateRange: { from: Date; to: Date };
  isLoading: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReviewData(period: ReviewPeriod = 'weekly'): ReviewData {
  const { entryProjection, collectionProjection } = useApp();

  const [completedEntries, setCompletedEntries] = useState<Entry[]>([]);
  const [stalledTasks, setStalledTasks] = useState<StalledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = getDateRange(period);

  const fetchData = useCallback(async () => {
    // Build getCollection callback fresh on each fetch so the collection
    // map reflects the latest state.
    const collections = await collectionProjection.getCollections();
    const collectionMap = new Map(collections.map(c => [c.id, c]));
    const getCollection = (id: string) => collectionMap.get(id);

    const { from, to } = getDateRange(period);

    const [completed, stalled] = await Promise.all([
      entryProjection.getCompletedInRange(from, to),
      entryProjection.getStalledMonthlyTasks(14, getCollection),
    ]);

    setCompletedEntries(completed);
    setStalledTasks(stalled);
    setIsLoading(false);
  }, [period, entryProjection, collectionProjection]);

  // Initial load + re-fetch when period changes
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Subscribe to projection changes so we re-fetch on any entry mutation
  useEffect(() => {
    const unsubscribe = entryProjection.subscribe(() => {
      fetchData();
    });
    return unsubscribe;
  }, [entryProjection, fetchData]);

  return {
    completedEntries,
    stalledTasks,
    period,
    dateRange,
    isLoading,
  };
}
