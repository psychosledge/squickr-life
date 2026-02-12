/**
 * Navigation Entries Utilities
 * 
 * Builds navigation entries with URL metadata for dual navigation feature.
 * Auto-favorited collections appear TWICE:
 * - First occurrence: temporal URL (/today, /tomorrow, etc.)
 * - Second occurrence: stable URL (/collection/daily-2026-02-11)
 */

import type { Collection, UserPreferences } from '@squickr/domain';
import { getLocalDateKey } from '@squickr/domain';
import { sortCollectionsHierarchically } from './collectionSorting';
import { isEffectivelyFavorited } from './collectionUtils';

export interface NavigationEntry {
  readonly collection: Collection;
  readonly url: string;
  readonly context: 'auto-favorite' | 'calendar' | 'custom';
}

/**
 * Get temporal URL for a collection if applicable
 * Returns null if collection doesn't have a temporal URL
 */
function getTemporalUrl(collection: Collection, now: Date): string | null {
  if (collection.type === 'daily') {
    // Use local timezone to match how collections are created
    const todayKey = getLocalDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrow);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterday);
    
    if (collection.date === todayKey) return '/today';
    if (collection.date === tomorrowKey) return '/tomorrow';
    if (collection.date === yesterdayKey) return '/yesterday';
  }
  
  if (collection.type === 'monthly') {
    // Monthly temporal URLs: /this-month, /last-month, /next-month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    
    if (collection.date === thisMonthKey) return '/this-month';
    if (collection.date === lastMonthKey) return '/last-month';
    if (collection.date === nextMonthKey) return '/next-month';
  }
  
  return null;
}

/**
 * Build navigation entries with URL metadata
 * 
 * This function creates NavigationEntry objects for each collection, assigning:
 * - Temporal URLs (/today, /tomorrow) for first occurrence of auto-favorited collections
 * - Stable URLs (/collection/id) for all other cases
 * 
 * Auto-favorited collections appear TWICE in the returned array:
 * 1. First occurrence (in auto-favorites section) - temporal URL
 * 2. Second occurrence (in calendar section) - stable URL
 */
export function buildNavigationEntries(
  collections: Collection[],
  userPreferences: UserPreferences,
  now: Date = new Date()
): NavigationEntry[] {
  const sorted = sortCollectionsHierarchically(collections, userPreferences, now);
  
  // Track first occurrence of each collection ID
  const firstOccurrence = new Map<string, number>();
  sorted.forEach((collection, index) => {
    if (!firstOccurrence.has(collection.id)) {
      firstOccurrence.set(collection.id, index);
    }
  });
  
  return sorted.map((collection, index) => {
    const isFirstOccurrence = firstOccurrence.get(collection.id) === index;
    const isAutoFav = isEffectivelyFavorited(collection, userPreferences, now) 
      && !collection.isFavorite;
    
    let url: string;
    let context: NavigationEntry['context'];
    
    if (isAutoFav && isFirstOccurrence) {
      // First occurrence of auto-favorited collection - use temporal URL if available
      const temporalUrl = getTemporalUrl(collection, now);
      url = temporalUrl ?? `/collection/${collection.id}`;
      context = 'auto-favorite';
    } else if (collection.isFavorite || !collection.type || collection.type === 'custom') {
      // Manually favorited or custom collections - always use stable URL
      url = `/collection/${collection.id}`;
      context = 'custom';
    } else {
      // Calendar occurrence (second occurrence or non-favorited) - stable URL
      url = `/collection/${collection.id}`;
      context = 'calendar';
    }
    
    return { collection, url, context };
  });
}
