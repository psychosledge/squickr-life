/**
 * Collection Sorting Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { sortCollectionsHierarchically } from './collectionSorting';
import type { Collection, UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

describe('sortCollectionsHierarchically', () => {
  // Default preferences for most tests (auto-favorite disabled)
  const defaultPreferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    autoFavoriteRecentDailyLogs: false,
  };

  it('should sort collections in hierarchical order: favorited customs, daily logs (oldest first), other customs', () => {
    const collections: Collection[] = [
      // Other customs (should appear last)
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-06T00:00:00Z' },
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b1', isFavorite: false, createdAt: '2024-01-07T00:00:00Z' },
      
      // Daily logs (should appear in middle, oldest first)
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'daily3', name: 'Jan 31', type: 'daily', date: '2026-01-31', createdAt: '2024-01-05T00:00:00Z' },
      
      // Favorited customs (should appear first)
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'a1', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    // Expected order (REVERSED): fav customs → unfav customs → dailies (oldest first)
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',    // Favorited custom (order: a0)
      'fav2',    // Favorited custom (order: a1)
      'custom1', // Other custom (order: b0)
      'custom2', // Other custom (order: b1)
      'daily3',  // Daily log (2026-01-31, oldest)
      'daily1',  // Daily log (2026-02-01)
      'daily2',  // Daily log (2026-02-02, newest)
    ]);
  });

  it('should sort favorited customs by order field', () => {
    const collections: Collection[] = [
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'b', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'fav3', name: 'Favorite 3', type: 'custom', order: 'c', isFavorite: true, createdAt: '2024-01-03T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['fav1', 'fav2', 'fav3']);
  });

  it('should sort daily logs by date in ascending order (oldest first)', () => {
    const collections: Collection[] = [
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'daily3', name: 'Feb 3', type: 'daily', date: '2026-02-03', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['daily1', 'daily2', 'daily3']);
  });

  it('should sort other customs by order field', () => {
    const collections: Collection[] = [
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b', isFavorite: false, createdAt: '2024-01-02T00:00:00Z' },
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'a', isFavorite: false, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'custom3', name: 'Custom 3', type: 'custom', order: 'c', isFavorite: false, createdAt: '2024-01-03T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['custom1', 'custom2', 'custom3']);
  });

  it('should handle empty array', () => {
    const sorted = sortCollectionsHierarchically([], defaultPreferences);
    expect(sorted).toEqual([]);
  });

  it('should handle only favorited customs', () => {
    const collections: Collection[] = [
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'b', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['fav1', 'fav2']);
  });

  it('should handle only daily logs', () => {
    const collections: Collection[] = [
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['daily1', 'daily2']);
  });

  it('should handle only other customs', () => {
    const collections: Collection[] = [
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b', isFavorite: false, createdAt: '2024-01-02T00:00:00Z' },
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'a', isFavorite: false, createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['custom1', 'custom2']);
  });

  it('should treat collections without type as custom', () => {
    const collections: Collection[] = [
      { id: 'legacy2', name: 'Legacy 2', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'legacy1', name: 'Legacy 1', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['legacy1', 'legacy2']);
  });

  it('should treat log and tracker types as custom', () => {
    const collections: Collection[] = [
      { id: 'tracker', name: 'Habit Tracker', type: 'tracker', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'log', name: 'Work Log', type: 'log', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['log', 'tracker']);
  });

  it('should handle collections with missing order field', () => {
    const collections: Collection[] = [
      { id: 'custom2', name: 'Custom 2', type: 'custom', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    // Empty order string comes before 'a' in lexicographic comparison
    expect(sorted.map(c => c.id)).toEqual(['custom2', 'custom1']);
  });

  it('should not mutate input array', () => {
    const collections: Collection[] = [
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const original = [...collections];
    sortCollectionsHierarchically(collections, defaultPreferences);

    expect(collections).toEqual(original);
  });

  // Bug #1: Monthly logs navigation tests - interwoven by year/month
  it('should interweave monthly logs BEFORE their respective month\'s daily logs', () => {
    const collections: Collection[] = [
      // Favorited customs (should appear first)
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      
      // Monthly logs
      { id: 'monthly1', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'monthly2', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-03T00:00:00Z' },
      
      // Daily logs
      { id: 'daily1', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'daily2', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-05T00:00:00Z' },
      { id: 'daily3', name: 'Jan 31', type: 'daily', date: '2026-01-31', createdAt: '2024-01-06T00:00:00Z' },
      { id: 'daily4', name: 'Jan 30', type: 'daily', date: '2026-01-30', createdAt: '2024-01-07T00:00:00Z' },
      
      // Other customs (should appear after favorited)
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-08T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    // Expected order (REVERSED): fav customs → unfav customs → calendar hierarchy (interwoven, oldest first)
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',     // Favorited custom
      'custom1',  // Other custom
      // January 2026 (oldest month)
      'monthly2', // January 2026 monthly log
      'daily4',   // Jan 30, 2026
      'daily3',   // Jan 31, 2026
      // February 2026
      'monthly1', // February 2026 monthly log
      'daily2',   // Feb 1, 2026
      'daily1',   // Feb 2, 2026
    ]);
  });

  it('should sort monthly logs by date in ascending order (oldest first)', () => {
    const collections: Collection[] = [
      { id: 'monthly1', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'monthly3', name: 'March 2026', type: 'monthly', date: '2026-03', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'monthly2', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['monthly1', 'monthly2', 'monthly3']);
  });

  it('should handle only monthly logs', () => {
    const collections: Collection[] = [
      { id: 'monthly1', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'monthly2', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['monthly2', 'monthly1']);
  });

  it('should handle mix of all collection types with interwoven calendar hierarchy', () => {
    const collections: Collection[] = [
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b1', isFavorite: false, createdAt: '2024-01-08T00:00:00Z' },
      { id: 'monthly1', name: 'March 2026', type: 'monthly', date: '2026-03', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'a1', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
      { id: 'daily1', name: 'Feb 5', type: 'daily', date: '2026-02-05', createdAt: '2024-01-05T00:00:00Z' },
      { id: 'monthly2', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-07T00:00:00Z' },
      { id: 'daily2', name: 'Feb 4', type: 'daily', date: '2026-02-04', createdAt: '2024-01-06T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    // Expected order (REVERSED): fav customs → unfav customs → calendar hierarchy (interwoven by month, oldest first)
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',     // Favorited customs (by order)
      'fav2',
      'custom1',  // Other customs (by order)
      'custom2',
      // February 2026 (oldest month with dailies)
      'monthly2', // February 2026 monthly log
      'daily2',   // Feb 4, 2026
      'daily1',   // Feb 5, 2026
      // March 2026 (newest month, monthly only, no dailies)
      'monthly1', // March 2026 monthly log
    ]);
  });

  it('should handle monthly logs without date field', () => {
    const collections: Collection[] = [
      { id: 'monthly1', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'monthly2', name: 'No Date', type: 'monthly', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    
    // Monthly without date should sort before those with dates (empty string < '2026-02')
    expect(sorted.map(c => c.id)).toEqual(['monthly1', 'monthly2']);
  });

  // Casey's Review: Tomorrow → Today → Yesterday sorting tests with bidirectional comparison
  describe('Tomorrow → Today → Yesterday sorting (bidirectional comparison)', () => {
    it('should sort auto-favorited daily logs: Tomorrow → Today → Yesterday → Older', () => {
      const autoFavoritePreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Create date strings in local timezone (matching how getLocalDateKey() works)
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
      const olderDate = new Date(now.getTime() - 5 * 86400000);
      const olderStr = getLocalDateString(olderDate);

      const collections: Collection[] = [
        { id: 'older', name: 'Older', type: 'daily', date: olderStr, order: 'a', createdAt: olderStr + 'T00:00:00Z' },
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'b', createdAt: yesterdayStr + 'T00:00:00Z' },
        { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, order: 'c', createdAt: tomorrowStr + 'T00:00:00Z' },
        { id: 'today', name: 'Today', type: 'daily', date: todayStr, order: 'd', createdAt: todayStr + 'T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, autoFavoritePreferences, now);

      // Auto-favorited dailies (Yesterday → Today → Tomorrow) come before older calendar (oldest first)
      expect(sorted.map(c => c.id)).toEqual(['yesterday', 'today', 'tomorrow', 'older']);
    });

    it('should use bidirectional comparison (regression test for Casey bug #1)', () => {
      const autoFavoritePreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Create date strings in local timezone (matching how getLocalDateKey() works)
      const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const tomorrowDate = new Date(now.getTime() + 86400000);
      const tomorrowStr = getLocalDateString(tomorrowDate);
      const yesterdayDate = new Date(now.getTime() - 86400000);
      const yesterdayStr = getLocalDateString(yesterdayDate);

      const collections: Collection[] = [
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'a', createdAt: yesterdayStr + 'T00:00:00Z' },
        { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, order: 'b', createdAt: tomorrowStr + 'T00:00:00Z' },
      ];

      // Sort in both directions to verify bidirectional comparison
      const sorted1 = sortCollectionsHierarchically(collections, autoFavoritePreferences, now);
      const sorted2 = sortCollectionsHierarchically([...collections].reverse(), autoFavoritePreferences, now);

      // Both should produce same order: Yesterday → Tomorrow (oldest first)
      expect(sorted1.map(c => c.id)).toEqual(['yesterday', 'tomorrow']);
      expect(sorted2.map(c => c.id)).toEqual(['yesterday', 'tomorrow']);
    });

    it('should separate favorited and non-favorited daily logs with proper sorting', () => {
      const autoFavoritePreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Create date strings in local timezone (matching how getLocalDateKey() works)
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
      const olderDate = new Date(now.getTime() - 5 * 86400000);
      const olderStr = getLocalDateString(olderDate);

      const collections: Collection[] = [
        // Non-favorited older daily (should appear after customs)
        { id: 'older', name: 'Older', type: 'daily', date: olderStr, order: 'a', createdAt: olderStr + 'T00:00:00Z' },
        // Auto-favorited (Today, Yesterday, Tomorrow)
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'b', createdAt: yesterdayStr + 'T00:00:00Z' },
        { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, order: 'c', createdAt: tomorrowStr + 'T00:00:00Z' },
        { id: 'today', name: 'Today', type: 'daily', date: todayStr, order: 'd', createdAt: todayStr + 'T00:00:00Z' },
        // Custom collection
        { id: 'custom', name: 'Custom', type: 'custom', order: 'e', createdAt: todayStr + 'T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, autoFavoritePreferences, now);

      // Auto-favorited dailies (Y→T→T, oldest first), then unfav customs, then older calendar
      expect(sorted.map(c => c.id)).toEqual(['yesterday', 'today', 'tomorrow', 'custom', 'older']);
  });

  // Bug: Favorited monthly logs don't appear in navigation order
  describe('Favorited monthly logs', () => {
    it('should include auto-favorited monthly logs in navigation order', () => {
      const autoFavoriteMonthlyPreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Get current month in YYYY-MM format
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 0-based
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      
      // Get last month
      const lastMonthDate = new Date(now);
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Get next month
      const nextMonthDate = new Date(now);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Get old month (not auto-favorited)
      const oldMonthDate = new Date(now);
      oldMonthDate.setMonth(oldMonthDate.getMonth() - 5);
      const oldMonthStr = `${oldMonthDate.getFullYear()}-${String(oldMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const collections: Collection[] = [
        // Old monthly log (should appear in calendar hierarchy)
        { id: 'old-month', name: 'Old Month', type: 'monthly', date: oldMonthStr, order: 'z0', createdAt: '2024-01-01T00:00:00Z' },
        // Auto-favorited monthly logs (should appear in favorites section)
        { id: 'last-month', name: 'Last Month', type: 'monthly', date: lastMonthStr, order: 'z1', createdAt: '2024-01-02T00:00:00Z' },
        { id: 'current-month', name: 'Current Month', type: 'monthly', date: currentMonthStr, order: 'z2', createdAt: '2024-01-03T00:00:00Z' },
        { id: 'next-month', name: 'Next Month', type: 'monthly', date: nextMonthStr, order: 'z3', createdAt: '2024-01-04T00:00:00Z' },
        // Custom collection (should appear after auto-favorited monthlies)
        { id: 'custom', name: 'Custom', type: 'custom', order: 'a', createdAt: '2024-01-05T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, autoFavoriteMonthlyPreferences, now);

      // Expected order: auto-favorited monthlies → unfav customs → old calendar
      // Auto-favorited monthlies should be sorted chronologically (oldest first)
      expect(sorted.map(c => c.id)).toEqual([
        'last-month',
        'current-month', 
        'next-month',
        'custom',
        'old-month',
      ]);
    });

    it('should include manually favorited monthly logs in navigation order', () => {
      const collections: Collection[] = [
        // Manually favorited monthly log
        { id: 'fav-month', name: 'Favorite Month', type: 'monthly', date: '2026-01', isFavorite: true, order: 'a0', createdAt: '2024-01-01T00:00:00Z' },
        // Unfavorited monthly log
        { id: 'unfav-month', name: 'Unfavorited Month', type: 'monthly', date: '2026-02', order: 'z0', createdAt: '2024-01-02T00:00:00Z' },
        // Custom collection
        { id: 'custom', name: 'Custom', type: 'custom', order: 'a', createdAt: '2024-01-03T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

      // Expected order: fav monthly → unfav customs → unfav calendar
      expect(sorted.map(c => c.id)).toEqual([
        'fav-month',
        'custom',
        'unfav-month',
      ]);
    });

    it('should sort favorited monthly logs chronologically with favorited dailies', () => {
      const autoFavoriteAllPreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
        autoFavoriteRecentMonthlyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Create date strings in local timezone
      const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const todayStr = getLocalDateString(now);
      const yesterdayDate = new Date(now.getTime() - 86400000);
      const yesterdayStr = getLocalDateString(yesterdayDate);
      
      // Get current month in YYYY-MM format
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      const collections: Collection[] = [
        // Auto-favorited daily logs
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'y0', createdAt: yesterdayStr + 'T00:00:00Z' },
        { id: 'today', name: 'Today', type: 'daily', date: todayStr, order: 'y1', createdAt: todayStr + 'T00:00:00Z' },
        // Auto-favorited monthly log
        { id: 'current-month', name: 'Current Month', type: 'monthly', date: currentMonthStr, order: 'z0', createdAt: '2024-01-01T00:00:00Z' },
        // Custom collection
        { id: 'custom', name: 'Custom', type: 'custom', order: 'a', createdAt: '2024-01-02T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, autoFavoriteAllPreferences, now);

      // Expected: favorited dailies sorted first (Yesterday → Today), then favorited monthly (current month)
      // Monthlies come after dailies in the favorited section
      expect(sorted.map(c => c.id)).toEqual([
        'yesterday',
        'today',
        'current-month',
        'custom',
      ]);
    });

    it('should handle mix of manually and auto-favorited monthly logs', () => {
      const autoFavoriteMonthlyPreferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      // Use actual current time for the test
      const now = new Date();
      
      // Get current month in YYYY-MM format
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      
      // Get old month (not auto-favorited, but manually favorited)
      const oldMonthDate = new Date(now);
      oldMonthDate.setMonth(oldMonthDate.getMonth() - 5);
      const oldMonthStr = `${oldMonthDate.getFullYear()}-${String(oldMonthDate.getMonth() + 1).padStart(2, '0')}`;

      const collections: Collection[] = [
        // Manually favorited old monthly log
        { id: 'manual-fav', name: 'Manual Favorite', type: 'monthly', date: oldMonthStr, isFavorite: true, order: 'a', createdAt: '2024-01-01T00:00:00Z' },
        // Auto-favorited current monthly log
        { id: 'auto-fav', name: 'Auto Favorite', type: 'monthly', date: currentMonthStr, order: 'z0', createdAt: '2024-01-02T00:00:00Z' },
        // Custom collection
        { id: 'custom', name: 'Custom', type: 'custom', order: 'b', createdAt: '2024-01-03T00:00:00Z' },
      ];

      const sorted = sortCollectionsHierarchically(collections, autoFavoriteMonthlyPreferences, now);

      // Manual favorites sorted by order, then auto-favorites sorted chronologically
      expect(sorted.map(c => c.id)).toEqual([
        'manual-fav',
        'auto-fav',
        'custom',
      ]);
    });
  });
});
});
