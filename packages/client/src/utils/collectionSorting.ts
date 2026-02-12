/**
 * Collection Sorting Utilities
 * 
 * Provides consistent ordering logic for collections across the app.
 * This ensures navigation order matches the index page hierarchy.
 * 
 * Ordering Rules (ADR-014 - oldest first, like physical bullet journal):
 * 1. Favorited customs (by order field, lexicographic)
 * 2. Auto-favorited daily logs (Yesterday → Today → Tomorrow)
 * 3. Auto-favorited monthly logs (chronologically, oldest first)
 * 4. Other customs (by order field, lexicographic)
 * 5. Older daily logs (calendar hierarchy, before recent days)
 * 6. Future daily logs (calendar hierarchy, after recent days)
 * 7. Monthly logs (interwoven with daily logs in calendar hierarchy)
 */

import type { Collection, UserPreferences } from '@squickr/domain';
import { isEffectivelyFavorited, isAutoFavorited } from './collectionUtils';

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
 * Get sort key for auto-favorited temporal collection (daily or monthly log).
 * 
 * Priority tiers ensure chronological ordering with monthly logs before their days:
 * - 0: Last Month
 * - 1: Current Month
 * - 2: Yesterday
 * - 3: Today
 * - 4: Tomorrow (unless tomorrow is in next month, then it gets priority 6)
 * - 5: Next Month
 * - 6: Tomorrow (when tomorrow is in next month, comes AFTER next month)
 * 
 * Key format: "{priority}-{date}" ensures stable lexicographic sorting.
 * 
 * @param collection - Daily or monthly log collection
 * @param now - Current date for calculating relative positions
 * @returns Sort key string (e.g., "1-2026-02" for current month, "3-2026-02-10" for today)
 */
function getSortKey(collection: Collection, now: Date): string {
  // Use local timezone (not UTC) to match how collections are created
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayStr = getLocalDateString(now);
  const tomorrowDate = new Date(now.getTime() + 86400000);
  const tomorrowStr = getLocalDateString(tomorrowDate);
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = getLocalDateString(yesterdayDate);
  
  const currentYearMonth = todayStr.substring(0, 7); // "2026-02"
  const tomorrowYearMonth = tomorrowStr.substring(0, 7); // "2026-02" or "2026-03" if month boundary
  
  // Calculate last month and next month year-months
  const currentDate = new Date(now);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based
  
  // Last month: handle year boundary
  let lastYear = currentYear;
  let lastMonth = currentMonth - 1;
  if (lastMonth < 0) {
    lastMonth = 11;
    lastYear--;
  }
  const lastYearMonth = `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}`;
  
  // Next month: handle year boundary
  let nextYear = currentYear;
  let nextMonth = currentMonth + 1;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }
  const nextYearMonth = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
  
  const date = collection.date || '';
  
  // Handle monthly logs
  if (collection.type === 'monthly') {
    if (date === lastYearMonth) return `0-${date}`;
    if (date === currentYearMonth) return `1-${date}`;
    if (date === nextYearMonth) return `5-${date}`;
    // Shouldn't happen for auto-favorited, but fallback
    return `9-${date}`;
  }
  
  // Handle daily logs
  if (collection.type === 'daily') {
    if (date === yesterdayStr) return `2-${date}`;
    if (date === todayStr) return `3-${date}`;
    if (date === tomorrowStr) {
      // Edge case: If tomorrow is in next month, it should come AFTER next month
      // This ensures monthly log appears before days of that month
      if (tomorrowYearMonth !== currentYearMonth) {
        return `6-${date}`; // After next month (priority 5)
      }
      return `4-${date}`; // Normal tomorrow priority
    }
    // Shouldn't happen for auto-favorited, but fallback
    return `9-${date}`;
  }
  
  // Fallback (shouldn't happen)
  return `9-${date}`;
}

/**
 * Sort auto-favorited collections (daily + monthly logs) chronologically.
 * 
 * This combines favorited dailies and monthlies into a single chronological order
 * with monthly logs appearing BEFORE the days of that month.
 * 
 * Priority order (oldest first):
 * 1. Last Month (Jan)
 * 2. Current Month (Feb)
 * 3. Yesterday (Feb 9)
 * 4. Today (Feb 10)
 * 5. Tomorrow (Feb 11)
 * 6. Next Month (Mar)
 * 
 * Edge case: When tomorrow is in next month (Jan 31 → Feb 1):
 * - Next Month (Feb) comes BEFORE Tomorrow (Feb 1)
 * - This ensures monthly log appears before days of that month
 * 
 * @param collections - Array of auto-favorited daily and monthly logs
 * @param now - Current date for calculating relative positions
 * @returns Sorted array (does not mutate input)
 */
export function sortAutoFavoritedChronologically(
  collections: Collection[],
  now: Date
): Collection[] {
  return [...collections].sort((a, b) => {
    const aKey = getSortKey(a, now);
    const bKey = getSortKey(b, now);
    return aKey.localeCompare(bKey);
  });
}

/**
 * Sort collections according to the hierarchical display order.
 * 
 * This function ensures that navigation order matches the collection index:
 * - Favorited custom collections first (sorted by order)
 * - Auto-favorited daily logs (Yesterday → Today → Tomorrow)
 * - Auto-favorited monthly logs (chronologically, oldest first)
 * - Other custom collections (sorted by order)
 * - Older calendar daily logs (before yesterday)
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
  
  // Separate favorited from non-favorited (for customs, dailies, and monthlies)
  const favoritedCustoms = customCollections.filter(c => isEffectivelyFavorited(c, userPreferences, now));
  const unfavoritedCustoms = customCollections.filter(c => !isEffectivelyFavorited(c, userPreferences, now));
  
  const favoritedDailies = dailyLogs.filter(c => isEffectivelyFavorited(c, userPreferences, now));
  // For calendar: include all dailies EXCEPT manually favorited ones
  // (manually favorited appear once in favorites section, auto-favorited appear twice)
  const allDailiesForCalendar = dailyLogs.filter(c => !c.isFavorite);
  
  const favoritedMonthlies = monthlyLogs.filter(c => isEffectivelyFavorited(c, userPreferences, now));
  // For calendar: include all monthlies EXCEPT manually favorited ones
  const allMonthliesForCalendar = monthlyLogs.filter(c => !c.isFavorite);
  
  // Separate manually favorited temporal collections from auto-favorited
  const manuallyFavoritedTemporals = [
    ...favoritedDailies.filter(c => c.isFavorite),
    ...favoritedMonthlies.filter(c => c.isFavorite)
  ];
  const autoFavoritedTemporals = [
    ...favoritedDailies.filter(c => isAutoFavorited(c, userPreferences, now)),
    ...favoritedMonthlies.filter(c => isAutoFavorited(c, userPreferences, now))
  ];
  
  // Sort favorited customs by order field (includes manually favorited temporal collections)
  // Combine favorited customs with manually favorited temporal collections
  const allManuallyFavorited = [...favoritedCustoms, ...manuallyFavoritedTemporals];
  allManuallyFavorited.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort auto-favorited temporal collections (dailies + monthlies) chronologically
  // This ensures: Last Month → Current Month → Yesterday → Today → Tomorrow → Next Month
  const sortedAutoFavoritedTemporals = sortAutoFavoritedChronologically(
    autoFavoritedTemporals,
    now
  );
  
  // Sort unfavorited customs by order field
  unfavoritedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort all daily logs for calendar by date (oldest first = ascending)
  allDailiesForCalendar.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  
  // Build calendar hierarchy (interwoven monthly and daily logs)
  // Split into: older (before yesterday), and future (after tomorrow)
  const yesterday = now.toISOString().split('T')[0]!;
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayYearMonth = yesterdayDate.toISOString().substring(0, 7);
  const tomorrowDate = new Date(now.getTime() + 86400000);
  const tomorrowYearMonth = tomorrowDate.toISOString().substring(0, 7);
  
  const olderCalendarLogs: Collection[] = [];
  const futureCalendarLogs: Collection[] = [];
  
  // Group dailies by year-month
  const dailiesByYearMonth = new Map<string, Collection[]>();
  for (const daily of allDailiesForCalendar) {
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
  for (const monthly of allMonthliesForCalendar) {
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
  // 1. Manually favorited collections (customs + manually favorited temporals, sorted by order)
  // 2. Auto-favorited temporal collections (dailies + monthlies, sorted chronologically)
  // 3. Unfavorited customs  
  // 4. Older calendar (before yesterday)
  // 5. Future calendar (after tomorrow)
  return [
    ...allManuallyFavorited,
    ...sortedAutoFavoritedTemporals,
    ...unfavoritedCustoms,
    ...olderCalendarLogs,
    ...futureCalendarLogs,
  ];
}
