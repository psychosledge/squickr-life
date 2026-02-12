/**
 * Collection Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isRecentDailyLog, isRecentMonthlyLog, isEffectivelyFavorited, isAutoFavorited } from './collectionUtils';
import type { Collection, UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

describe('collectionUtils', () => {
  // Save original Date
  let originalDate: typeof Date;
  
  beforeEach(() => {
    originalDate = global.Date;
    // Mock Date to Feb 6, 2026 at noon
    const mockDate = new Date('2026-02-06T12:00:00.000Z');
    vi.setSystemTime(mockDate);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    global.Date = originalDate;
  });

  describe('isRecentMonthlyLog', () => {
    it('should return true for current month', () => {
      const collection: Collection = {
        id: 'current',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(true);
    });

    it('should return true for last month', () => {
      const collection: Collection = {
        id: 'lastmonth',
        name: 'January 2026',
        type: 'monthly',
        date: '2026-01',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(true);
    });

    it('should return true for next month', () => {
      const collection: Collection = {
        id: 'nextmonth',
        name: 'March 2026',
        type: 'monthly',
        date: '2026-03',
        order: 'a',
        createdAt: '2026-03-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(true);
    });

    it('should return false for 2 months ago', () => {
      const collection: Collection = {
        id: 'twomonthsago',
        name: 'December 2025',
        type: 'monthly',
        date: '2025-12',
        order: 'a',
        createdAt: '2025-12-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(false);
    });

    it('should return false for 2 months ahead', () => {
      const collection: Collection = {
        id: 'twomonthsahead',
        name: 'April 2026',
        type: 'monthly',
        date: '2026-04',
        order: 'a',
        createdAt: '2026-04-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(false);
    });

    it('should handle year boundary - current month is January', () => {
      // Mock to January 15, 2026
      vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

      const lastMonth: Collection = {
        id: 'dec2025',
        name: 'December 2025',
        type: 'monthly',
        date: '2025-12',
        order: 'a',
        createdAt: '2025-12-01T00:00:00Z',
      };

      const currentMonth: Collection = {
        id: 'jan2026',
        name: 'January 2026',
        type: 'monthly',
        date: '2026-01',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      };

      const nextMonth: Collection = {
        id: 'feb2026',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(lastMonth)).toBe(true);
      expect(isRecentMonthlyLog(currentMonth)).toBe(true);
      expect(isRecentMonthlyLog(nextMonth)).toBe(true);

      // Reset to Feb 6
      vi.setSystemTime(new Date('2026-02-06T12:00:00.000Z'));
    });

    it('should handle year boundary - current month is December', () => {
      // Mock to December 15, 2025
      vi.setSystemTime(new Date('2025-12-15T12:00:00.000Z'));

      const lastMonth: Collection = {
        id: 'nov2025',
        name: 'November 2025',
        type: 'monthly',
        date: '2025-11',
        order: 'a',
        createdAt: '2025-11-01T00:00:00Z',
      };

      const currentMonth: Collection = {
        id: 'dec2025',
        name: 'December 2025',
        type: 'monthly',
        date: '2025-12',
        order: 'a',
        createdAt: '2025-12-01T00:00:00Z',
      };

      const nextMonth: Collection = {
        id: 'jan2026',
        name: 'January 2026',
        type: 'monthly',
        date: '2026-01',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      };

      expect(isRecentMonthlyLog(lastMonth)).toBe(true);
      expect(isRecentMonthlyLog(currentMonth)).toBe(true);
      expect(isRecentMonthlyLog(nextMonth)).toBe(true);

      // Reset to Feb 6
      vi.setSystemTime(new Date('2026-02-06T12:00:00.000Z'));
    });

    it('should return false for non-monthly collections', () => {
      const collection: Collection = {
        id: 'custom',
        name: 'Custom Collection',
        type: 'custom',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(false);
    });

    it('should return false for daily collections', () => {
      const collection: Collection = {
        id: 'daily',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(false);
    });

    it('should return false for monthly collection without date', () => {
      const collection: Collection = {
        id: 'nodate',
        name: 'No Date',
        type: 'monthly',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentMonthlyLog(collection)).toBe(false);
    });
  });

  describe('isRecentDailyLog', () => {
    it('should return true for today', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(true);
    });

    it('should return true for yesterday', () => {
      const collection: Collection = {
        id: 'yesterday',
        name: 'Wednesday, February 5',
        type: 'daily',
        date: '2026-02-05',
        order: 'a',
        createdAt: '2026-02-05T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(true);
    });

    it('should return true for tomorrow', () => {
      const collection: Collection = {
        id: 'tomorrow',
        name: 'Friday, February 7',
        type: 'daily',
        date: '2026-02-07',
        order: 'a',
        createdAt: '2026-02-07T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(true);
    });

    it('should return false for 2 days ago', () => {
      const collection: Collection = {
        id: 'twodaysago',
        name: 'Tuesday, February 4',
        type: 'daily',
        date: '2026-02-04',
        order: 'a',
        createdAt: '2026-02-04T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for 2 days from now', () => {
      const collection: Collection = {
        id: 'twodaysfromnow',
        name: 'Saturday, February 8',
        type: 'daily',
        date: '2026-02-08',
        order: 'a',
        createdAt: '2026-02-08T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for last week', () => {
      const collection: Collection = {
        id: 'lastweek',
        name: 'Thursday, January 30',
        type: 'daily',
        date: '2026-01-30',
        order: 'a',
        createdAt: '2026-01-30T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for next month', () => {
      const collection: Collection = {
        id: 'nextmonth',
        name: 'Friday, March 6',
        type: 'daily',
        date: '2026-03-06',
        order: 'a',
        createdAt: '2026-03-06T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for non-daily collections', () => {
      const collection: Collection = {
        id: 'custom',
        name: 'Custom Collection',
        type: 'custom',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for monthly collections', () => {
      const collection: Collection = {
        id: 'monthly',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });

    it('should return false for daily collection without date', () => {
      const collection: Collection = {
        id: 'nodate',
        name: 'No Date',
        type: 'daily',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      expect(isRecentDailyLog(collection)).toBe(false);
    });
  });

  describe('isEffectivelyFavorited', () => {
    it('should return true for manually favorited collection', () => {
      const collection: Collection = {
        id: 'manual',
        name: 'Manual Favorite',
        type: 'custom',
        order: 'a',
        isFavorite: true,
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: false,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(true);
    });

    it('should return true for auto-favorited recent daily log when enabled', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(true);
    });

    it('should return false for recent daily log when auto-favorite disabled', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: false,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(false);
    });

    it('should return true for auto-favorited recent monthly log when enabled', () => {
      const collection: Collection = {
        id: 'currentmonth',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(true);
    });

    it('should return false for recent monthly log when auto-favorite disabled', () => {
      const collection: Collection = {
        id: 'currentmonth',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: false,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(false);
    });

    it('should return false for old monthly log even when auto-favorite enabled', () => {
      const collection: Collection = {
        id: 'oldmonth',
        name: 'December 2025',
        type: 'monthly',
        date: '2025-12',
        order: 'a',
        createdAt: '2025-12-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      expect(isEffectivelyFavorited(collection, preferences)).toBe(false);
    });
  });

  describe('isAutoFavorited', () => {
    it('should return false for manually favorited collection', () => {
      const collection: Collection = {
        id: 'manual',
        name: 'Manual Favorite',
        type: 'custom',
        order: 'a',
        isFavorite: true,
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return true for auto-favorited recent daily log', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(true);
    });

    it('should return false when auto-favorite is disabled', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: false,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return false for old daily log', () => {
      const collection: Collection = {
        id: 'oldlog',
        name: 'Monday, February 3',
        type: 'daily',
        date: '2026-02-03',
        order: 'a',
        createdAt: '2026-02-03T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return false for manually favorited recent daily log', () => {
      const collection: Collection = {
        id: 'today',
        name: 'Thursday, February 6',
        type: 'daily',
        date: '2026-02-06',
        order: 'a',
        isFavorite: true,
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return false for non-daily collections', () => {
      const collection: Collection = {
        id: 'custom',
        name: 'Custom Collection',
        type: 'custom',
        order: 'a',
        createdAt: '2026-02-06T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentDailyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return true for auto-favorited recent monthly log', () => {
      const collection: Collection = {
        id: 'currentmonth',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(true);
    });

    it('should return false for old monthly log', () => {
      const collection: Collection = {
        id: 'oldmonth',
        name: 'December 2025',
        type: 'monthly',
        date: '2025-12',
        order: 'a',
        createdAt: '2025-12-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });

    it('should return false for manually favorited recent monthly log', () => {
      const collection: Collection = {
        id: 'currentmonth',
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        order: 'a',
        isFavorite: true,
        createdAt: '2026-02-01T00:00:00Z',
      };

      const preferences: UserPreferences = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      expect(isAutoFavorited(collection, preferences)).toBe(false);
    });
  });
});
