/**
 * Collection Sorting Utilities
 * 
 * Provides consistent ordering logic for collections across the app.
 * This ensures navigation order matches the index page hierarchy.
 * 
 * Ordering Rules (ADR-014 - oldest first, like physical bullet journal):
 * 1. Favorited customs (by order field, lexicographic)
 * 2. Older daily logs (calendar hierarchy, before recent days)
 * 3. Auto-favorited daily logs (Yesterday → Today → Tomorrow)
 * 4. Future daily logs (calendar hierarchy, after recent days)
 * 5. Other customs (by order field, lexicographic)
 * 6. Monthly logs (interwoven with daily logs in calendar hierarchy)
 */

import type { Collection, UserPreferences } from '@squickr/domain';
import { isEffectivelyFavorited } from './collectionUtils';

/**
 * Sort daily logs with Older → Yesterday → Today → Tomorrow → Future priority.
 * 
 * Special handling for Today/Tomorrow/Yesterday ensures they appear in order,
 * with older dates before Yesterday and future dates after Tomorrow.
 * Matches physical bullet journal order (oldest first).
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

    // Check if either is a special date
    const aIsYesterday = aDate === yesterday;
    const aIsToday = aDate === today;
    const aIsTomorrow = aDate === tomorrow;
    const bIsYesterday = bDate === yesterday;
    const bIsToday = bDate === today;
    const bIsTomorrow = bDate === tomorrow;

    // If both are special dates, order: Yesterday → Today → Tomorrow
    if ((aIsYesterday || aIsToday || aIsTomorrow) && (bIsYesterday || bIsToday || bIsTomorrow)) {
      if (aIsYesterday) return -1;
      if (bIsYesterday) return 1;
      if (aIsToday) return -1;
      if (bIsToday) return 1;
      return 0; // both are tomorrow
    }

    // If only one is special, need to check if the other is older or newer
    if (aIsYesterday || aIsToday || aIsTomorrow) {
      // a is special, b is not
      // If b is older than yesterday, b comes first
      if (bDate < yesterday) return 1;
      // Otherwise b is newer than tomorrow, a comes first
      return -1;
    }

    if (bIsYesterday || bIsToday || bIsTomorrow) {
      // b is special, a is not
      // If a is older than yesterday, a comes first
      if (aDate < yesterday) return -1;
      // Otherwise a is newer than tomorrow, b comes first
      return 1;
    }

    // Neither is special, sort by date ascending (oldest first)
    return aDate.localeCompare(bDate);
  });
}

/**
 * Sort collections according to the hierarchical display order.
 * 
 * This function ensures that navigation order matches the collection index:
 * - Favorited custom collections first (sorted by order)
 * - Other custom collections second (sorted by order)
 * - Older calendar daily logs (before yesterday)
 * - Auto-favorited daily logs (Yesterday → Today → Tomorrow)
 * - Future calendar daily logs (after tomorrow)
 * - Calendar hierarchy (interwoven by year/month):
 *   - For each month (oldest first): monthly log, then daily logs for that month
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
  
  // Sort favorited dailies: Yesterday → Today → Tomorrow (oldest first)
  const sortedFavoritedDailies = sortDailyLogsByDate(favoritedDailies, now);
  
  // Sort unfavorited customs by order field
  unfavoritedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort unfavorited daily logs by date (oldest first = ascending)
  unfavoritedDailies.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  
  // Build calendar hierarchy (interwoven monthly and daily logs)
  // Split into: older (before yesterday), and future (after tomorrow)
  const yesterday = now.toISOString().split('T')[0]!;
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayYearMonth = yesterdayDate.toISOString().substring(0, 7);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]!;
  const tomorrowDate = new Date(now.getTime() + 86400000);
  const tomorrowYearMonth = tomorrowDate.toISOString().substring(0, 7);
  
  const olderCalendarLogs: Collection[] = [];
  const futureCalendarLogs: Collection[] = [];
  
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
  
  // Get all unique year-months, sorted ascending (oldest first)
  const allYearMonths = new Set([
    ...dailiesByYearMonth.keys(),
    ...monthliesByYearMonth.keys()
  ]);
  const sortedYearMonths = Array.from(allYearMonths).sort((a, b) => a.localeCompare(b));
  
  // For each year-month, add to appropriate section
  for (const yearMonth of sortedYearMonths) {
    const monthly = monthliesByYearMonth.get(yearMonth);
    const dailies = dailiesByYearMonth.get(yearMonth) || [];
    
    // Determine if this year-month is older, current, or future
    // Older: before yesterday's month OR same month but all dailies before yesterday
    // Future: after tomorrow's month OR same month but all dailies after tomorrow
    
    if (yearMonth < yesterdayYearMonth) {
      // Entire month is older
      if (monthly) olderCalendarLogs.push(monthly);
      olderCalendarLogs.push(...dailies);
    } else if (yearMonth > tomorrowYearMonth) {
      // Entire month is future
      if (monthly) futureCalendarLogs.push(monthly);
      futureCalendarLogs.push(...dailies);
    } else {
      // Month contains yesterday/today/tomorrow - need to split dailies
      const olderDailies = dailies.filter(d => (d.date || '') < yesterday);
      const futureDailies = dailies.filter(d => (d.date || '') >= yesterday);
      
      // Monthly log comes BEFORE the dailies of that month
      // Put monthly in older section if there are any older dailies
      // Otherwise put in future section
      if (olderDailies.length > 0) {
        if (monthly) olderCalendarLogs.push(monthly);
        olderCalendarLogs.push(...olderDailies);
      }
      
      if (futureDailies.length > 0) {
        // Only add monthly if we didn't already add it to older section
        if (olderDailies.length === 0 && monthly) futureCalendarLogs.push(monthly);
        futureCalendarLogs.push(...futureDailies);
      }
      
      // If no dailies at all, put monthly in older section (before auto-favorited)
      if (dailies.length === 0 && monthly) {
        olderCalendarLogs.push(monthly);
      }
    }
  }
  
  // Add monthly logs without dates to future section
  futureCalendarLogs.push(...monthliesWithoutDate);
  
  // Return in hierarchical order:
  // 1. Favorited customs
  // 2. Unfavorited customs  
  // 3. Older calendar (before yesterday)
  // 4. Auto-favorited recent dailies (Yesterday → Today → Tomorrow)
  // 5. Future calendar (after tomorrow)
  return [
    ...favoritedCustoms,
    ...unfavoritedCustoms,
    ...olderCalendarLogs,
    ...sortedFavoritedDailies,
    ...futureCalendarLogs,
  ];
}
