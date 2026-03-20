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
import type { Collection, Entry, StalledTask } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { getDateRange } from '../utils/reviewDateRange';
import type { ReviewPeriod } from '../utils/reviewDateRange';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ReviewData {
  completedEntries: Entry[];
  stalledTasks: StalledTask[];
  collectionMap: Map<string, Collection>;
  period: ReviewPeriod;
  dateRange: { from: Date; to: Date };
  isLoading: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReviewData(period: ReviewPeriod = 'weekly'): ReviewData {
  const { entryProjection, collectionProjection } = useApp();

  const [completedEntries, setCompletedEntries] = useState<Entry[]>([]);
  const [stalledTasks, setStalledTasks] = useState<StalledTask[]>([]);
  const [collectionMap, setCollectionMap] = useState<Map<string, Collection>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const fetchData = useCallback(async () => {
    // Build getCollection callback fresh on each fetch so the collection
    // map reflects the latest state.
    const collections = await collectionProjection.getCollections();
    const map = new Map(collections.map(c => [c.id, c]));
    const getCollection = (id: string) => map.get(id);

    const [completed, stalled] = await Promise.all([
      entryProjection.getCompletedInRange(dateRange.from, dateRange.to),
      entryProjection.getStalledMonthlyTasks(14, getCollection),
    ]);

    setCollectionMap(map);
    setCompletedEntries(completed);
    setStalledTasks(stalled);
    setIsLoading(false);
  }, [dateRange, entryProjection, collectionProjection]);

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
    collectionMap,
    period,
    dateRange,
    isLoading,
  };
}
