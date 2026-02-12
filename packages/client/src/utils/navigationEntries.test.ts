/**
 * Navigation Entries Tests
 * 
 * Tests for building navigation entries with dual URLs for auto-favorited collections.
 * 
 * Key behavior:
 * - Auto-favorited collections appear TWICE in navigation
 * - First occurrence uses temporal URL (/today, /tomorrow, etc.)
 * - Second occurrence uses stable URL (/collection/daily-2026-02-11)
 */

import { describe, it, expect } from 'vitest';
import { buildNavigationEntries, type NavigationEntry } from './navigationEntries';
import type { Collection, UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES, getLocalDateKey } from '@squickr/domain';

describe('buildNavigationEntries', () => {
  const now = new Date('2026-02-11T12:00:00Z');
  
  const userPreferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    autoFavoriteRecentDailyLogs: true,
    autoFavoriteRecentMonthlyLogs: true,
  };

  it('should assign temporal URL to first occurrence of auto-favorited today collection', () => {
    const collections: Collection[] = [
      {
        id: 'daily-2026-02-11',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-11',
        createdAt: '2026-02-11T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    // Should appear twice (once in auto-favorites, once in calendar)
    const todayEntries = entries.filter((e: NavigationEntry) => e.collection.id === 'daily-2026-02-11');
    expect(todayEntries).toHaveLength(2);
    
    // First occurrence should use temporal URL
    expect(todayEntries[0]?.url).toBe('/today');
    expect(todayEntries[0]?.context).toBe('auto-favorite');
    
    // Second occurrence should use stable URL
    expect(todayEntries[1]?.url).toBe('/collection/daily-2026-02-11');
    expect(todayEntries[1]?.context).toBe('calendar');
  });

  it('should assign temporal URLs to yesterday and tomorrow', () => {
    const collections: Collection[] = [
      {
        id: 'daily-2026-02-10',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-10',
        createdAt: '2026-02-10T00:00:00Z',
        order: '',
      },
      {
        id: 'daily-2026-02-12',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-12',
        createdAt: '2026-02-12T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    // Yesterday
    const yesterdayEntries = entries.filter((e: NavigationEntry) => e.collection.id === 'daily-2026-02-10');
    expect(yesterdayEntries).toHaveLength(2);
    expect(yesterdayEntries[0]?.url).toBe('/yesterday');
    expect(yesterdayEntries[0]?.context).toBe('auto-favorite');
    expect(yesterdayEntries[1]?.url).toBe('/collection/daily-2026-02-10');
    
    // Tomorrow
    const tomorrowEntries = entries.filter((e: NavigationEntry) => e.collection.id === 'daily-2026-02-12');
    expect(tomorrowEntries).toHaveLength(2);
    expect(tomorrowEntries[0]?.url).toBe('/tomorrow');
    expect(tomorrowEntries[0]?.context).toBe('auto-favorite');
    expect(tomorrowEntries[1]?.url).toBe('/collection/daily-2026-02-12');
  });

  it('should assign temporal URL to current month', () => {
    const collections: Collection[] = [
      {
        id: 'monthly-2026-02',
        name: 'Monthly Log',
        type: 'monthly',
        date: '2026-02',
        createdAt: '2026-02-01T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    const monthEntries = entries.filter((e: NavigationEntry) => e.collection.id === 'monthly-2026-02');
    expect(monthEntries).toHaveLength(2);
    
    expect(monthEntries[0]?.url).toBe('/this-month');
    expect(monthEntries[0]?.context).toBe('auto-favorite');
    expect(monthEntries[1]?.url).toBe('/collection/monthly-2026-02');
    expect(monthEntries[1]?.context).toBe('calendar');
  });

  it('should use stable URLs for manually favorited collections', () => {
    const collections: Collection[] = [
      {
        id: 'daily-2026-02-11',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-11',
        isFavorite: true,
        createdAt: '2026-02-11T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    // Manually favorited should appear ONCE with stable URL
    const todayEntries = entries.filter((e: NavigationEntry) => e.collection.id === 'daily-2026-02-11');
    expect(todayEntries).toHaveLength(1);
    expect(todayEntries[0]?.url).toBe('/collection/daily-2026-02-11');
    expect(todayEntries[0]?.context).toBe('custom');
  });

  it('should use stable URLs for custom collections', () => {
    const collections: Collection[] = [
      {
        id: 'custom-1',
        name: 'My Collection',
        type: 'custom',
        isFavorite: true,
        createdAt: '2026-02-11T00:00:00Z',
        order: 'a0',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe('/collection/custom-1');
    expect(entries[0]?.context).toBe('custom');
  });

  it('should maintain hierarchical order from sortCollectionsHierarchically', () => {
    const collections: Collection[] = [
      {
        id: 'custom-fav',
        name: 'Favorited Custom',
        type: 'custom',
        isFavorite: true,
        order: 'a0',
        createdAt: '2026-02-11T00:00:00Z',
      },
      {
        id: 'daily-2026-02-10',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-10',
        createdAt: '2026-02-10T00:00:00Z',
        order: '',
      },
      {
        id: 'daily-2026-02-11',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-11',
        createdAt: '2026-02-11T00:00:00Z',
        order: '',
      },
      {
        id: 'daily-2026-02-12',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-12',
        createdAt: '2026-02-12T00:00:00Z',
        order: '',
      },
      {
        id: 'custom-unfav',
        name: 'Unfavorited Custom',
        type: 'custom',
        order: 'b0',
        createdAt: '2026-02-11T00:00:00Z',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    // Extract collection IDs in order
    const collectionIds = entries.map((e: NavigationEntry) => e.collection.id);
    
    // Expected order:
    // 1. Favorited custom
    // 2. Auto-favorited dailies (yesterday, today, tomorrow) - first occurrence
    // 3. Unfavorited custom
    // 4. Auto-favorited dailies - second occurrence (in calendar)
    expect(collectionIds).toEqual([
      'custom-fav',
      'daily-2026-02-10', // yesterday (auto-fav)
      'daily-2026-02-11', // today (auto-fav)
      'daily-2026-02-12', // tomorrow (auto-fav)
      'custom-unfav',
      'daily-2026-02-10', // yesterday (calendar)
      'daily-2026-02-11', // today (calendar)
      'daily-2026-02-12', // tomorrow (calendar)
    ]);
  });

  it('should handle collections without auto-favorite enabled', () => {
    const prefsWithoutAutoFav: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      autoFavoriteRecentDailyLogs: false,
      autoFavoriteRecentMonthlyLogs: false,
    };

    const collections: Collection[] = [
      {
        id: 'daily-2026-02-11',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-02-11',
        createdAt: '2026-02-11T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, prefsWithoutAutoFav, now);
    
    // Should appear ONCE with stable URL (not auto-favorited)
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe('/collection/daily-2026-02-11');
    expect(entries[0]?.context).toBe('calendar');
  });

  it('should handle non-recent daily logs with stable URLs only', () => {
    const collections: Collection[] = [
      {
        id: 'daily-2026-01-01',
        name: 'Daily Log',
        type: 'daily',
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00Z',
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, now);
    
    // Should appear ONCE (not auto-favorited, so only calendar)
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe('/collection/daily-2026-01-01');
    expect(entries[0]?.context).toBe('calendar');
  });

  it('should use local timezone when matching temporal URLs', () => {
    // Create a date and verify we're comparing local dates, not UTC dates
    const testNow = new Date('2026-02-11T12:00:00Z');
    
    // Get what the local date key would be for this testNow
    // This ensures our test works regardless of machine timezone
    const expectedLocalDate = getLocalDateKey(testNow);
    
    // Collection was created using the same local date key
    const collections: Collection[] = [
      {
        id: `daily-${expectedLocalDate}`,
        name: 'Daily Log',
        type: 'daily',
        date: expectedLocalDate, // Local date
        createdAt: testNow.toISOString(),
        order: '',
      },
    ];

    const entries = buildNavigationEntries(collections, userPreferences, testNow);
    
    // Should match as /today using local timezone
    const todayEntries = entries.filter((e: NavigationEntry) => e.collection.id === `daily-${expectedLocalDate}`);
    expect(todayEntries).toHaveLength(2);
    
    // First occurrence should use temporal URL /today
    expect(todayEntries[0]?.url).toBe('/today');
    expect(todayEntries[0]?.context).toBe('auto-favorite');
  });
});
