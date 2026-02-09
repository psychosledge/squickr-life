/**
 * Collection Sorting Utilities
 * 
 * Provides consistent ordering logic for collections across the app.
 * This ensures navigation order matches the index page hierarchy.
 * 
 * Ordering Rules:
 * 1. Favorited customs (by order field, lexicographic)
 * 2. Auto-favorited daily logs (Tomorrow → Today → Yesterday → Older)
 * 3. Other customs (by order field, lexicographic)
 * 4. Other daily logs (by date, descending - newest first)
 * 5. Monthly logs (by date, descending - newest first)
 */

import type { Collection, UserPreferences } from '@squickr/domain';
import { isEffectivelyFavorited } from './collectionUtils';

/**
 * Sort daily logs with Tomorrow → Today → Yesterday → Older priority.
 * 
 * Uses bidirectional comparison to ensure consistent ordering regardless of input order.
 * 
 * @param dailyLogs - Array of daily log collections to sort
 * @param now - Current date for calculating Today/Tomorrow/Yesterday
 * @returns Sorted array (does not mutate input)
 */
export function sortDailyLogsByDate(
  dailyLogs: Collection[],
  now: Date = new Date()
): Collection[] {
  const today = now.toISOString().split('T')[0]!;
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]!;
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]!;

  return [...dailyLogs].sort((a, b) => {
    const aDate = a.date || '';
    const bDate = b.date || '';

    // Bidirectional comparison for Tomorrow
    if (aDate === tomorrow && bDate !== tomorrow) return -1;
    if (bDate === tomorrow && aDate !== tomorrow) return 1;

    // Bidirectional comparison for Today
    if (aDate === today && bDate !== today) return -1;
    if (bDate === today && aDate !== today) return 1;

    // Bidirectional comparison for Yesterday
    if (aDate === yesterday && bDate !== yesterday) return -1;
    if (bDate === yesterday && aDate !== yesterday) return 1;

    // Default: sort by date descending (most recent first)
    return bDate.localeCompare(aDate);
  });
}

/**
 * Sort collections according to the hierarchical display order.
 * 
 * This function ensures that navigation order matches the collection index:
 * - Favorited custom collections first (sorted by order)
 * - Auto-favorited daily logs second (Tomorrow → Today → Yesterday → Older)
 * - Other custom collections third (sorted by order)
 * - Calendar hierarchy (interwoven by year/month):
 *   - For each month (newest first): monthly log, then daily logs for that month
 * 
 * @param collections - Array of collections to sort
 * @param userPreferences - User preferences (for auto-favorite logic)
 * @param now - Current date for calculating Today/Tomorrow/Yesterday (defaults to new Date())
 * @returns Sorted array of collections (does not mutate input)
 */
export function sortCollectionsHierarchically(
  collections: Collection[],
  userPreferences: UserPreferences,
  now: Date = new Date()
): Collection[] {
  // Separate collections by type
  const monthlyLogs = collections.filter(c => c.type === 'monthly');
  const dailyLogs = collections.filter(c => c.type === 'daily' && c.date);
  const customCollections = collections.filter(c => 
    !c.type || c.type === 'custom' || c.type === 'log' || c.type === 'tracker'
  );
  
  // Separate favorited from non-favorited (for both customs and dailies)
  const favoritedCustoms = customCollections.filter(c => isEffectivelyFavorited(c, userPreferences));
  const unfavoritedCustoms = customCollections.filter(c => !isEffectivelyFavorited(c, userPreferences));
  
  const favoritedDailies = dailyLogs.filter(c => isEffectivelyFavorited(c, userPreferences));
  const unfavoritedDailies = dailyLogs.filter(c => !isEffectivelyFavorited(c, userPreferences));
  
  // Sort favorited customs by order field
  favoritedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort favorited dailies: Tomorrow → Today → Yesterday → Older
  const sortedFavoritedDailies = sortDailyLogsByDate(favoritedDailies, now);
  
  // Sort unfavorited customs by order field
  unfavoritedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort unfavorited daily logs by date (newest first = descending)
  unfavoritedDailies.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  // Build calendar hierarchy (interwoven monthly and daily logs)
  const calendarLogs: Collection[] = [];
  
  // Group dailies by year-month
  const dailiesByYearMonth = new Map<string, Collection[]>();
  for (const daily of unfavoritedDailies) {
    const yearMonth = daily.date?.substring(0, 7); // "2026-02"
    if (!yearMonth) continue;
    if (!dailiesByYearMonth.has(yearMonth)) {
      dailiesByYearMonth.set(yearMonth, []);
    }
    dailiesByYearMonth.get(yearMonth)!.push(daily);
  }
  
  // Group monthlies by year-month
  const monthliesByYearMonth = new Map<string, Collection>();
  const monthliesWithoutDate: Collection[] = [];
  for (const monthly of monthlyLogs) {
    const yearMonth = monthly.date?.substring(0, 7); // "2026-02"
    if (yearMonth) {
      monthliesByYearMonth.set(yearMonth, monthly);
    } else {
      // Handle monthly logs without a date field
      monthliesWithoutDate.push(monthly);
    }
  }
  
  // Get all unique year-months, sorted descending (newest first)
  const allYearMonths = new Set([
    ...dailiesByYearMonth.keys(),
    ...monthliesByYearMonth.keys()
  ]);
  const sortedYearMonths = Array.from(allYearMonths).sort((a, b) => b.localeCompare(a));
  
  // For each year-month, add: monthly (if exists), then dailies
  for (const yearMonth of sortedYearMonths) {
    // Add monthly log first
    const monthly = monthliesByYearMonth.get(yearMonth);
    if (monthly) {
      calendarLogs.push(monthly);
    }
    
    // Then add daily logs for this month (already sorted descending)
    const dailies = dailiesByYearMonth.get(yearMonth);
    if (dailies) {
      calendarLogs.push(...dailies);
    }
  }
  
  // Add monthly logs without dates at the end
  calendarLogs.push(...monthliesWithoutDate);
  
  // Return in hierarchical order:
  // 1. Favorited customs
  // 2. Favorited dailies (Tomorrow → Today → Yesterday → Older)
  // 3. Unfavorited customs
  // 4. Calendar hierarchy (interwoven by year/month)
  return [
    ...favoritedCustoms,
    ...sortedFavoritedDailies,
    ...unfavoritedCustoms,
    ...calendarLogs,
  ];
}
