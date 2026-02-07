/**
 * Collection Sorting Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { sortCollectionsHierarchically } from './collectionSorting';
import type { Collection, UserPreferences } from '@squickr/shared';
import { DEFAULT_USER_PREFERENCES } from '@squickr/shared';

describe('sortCollectionsHierarchically', () => {
  // Default preferences for most tests (auto-favorite disabled)
  const defaultPreferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    autoFavoriteRecentDailyLogs: false,
  };

  it('should sort collections in hierarchical order: favorited customs, daily logs (newest first), other customs', () => {
    const collections: Collection[] = [
      // Other customs (should appear last)
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-06T00:00:00Z' },
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b1', isFavorite: false, createdAt: '2024-01-07T00:00:00Z' },
      
      // Daily logs (should appear in middle, newest first)
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'daily3', name: 'Jan 31', type: 'daily', date: '2026-01-31', createdAt: '2024-01-05T00:00:00Z' },
      
      // Favorited customs (should appear first)
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'a1', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    // Expected order: fav1, fav2, daily2, daily1, daily3, custom1, custom2
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',    // Favorited custom (order: a0)
      'fav2',    // Favorited custom (order: a1)
      'daily2',  // Daily log (2026-02-02, newest)
      'daily1',  // Daily log (2026-02-01)
      'daily3',  // Daily log (2026-01-31, oldest)
      'custom1', // Other custom (order: b0)
      'custom2', // Other custom (order: b1)
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

  it('should sort daily logs by date in descending order (newest first)', () => {
    const collections: Collection[] = [
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'daily3', name: 'Feb 3', type: 'daily', date: '2026-02-03', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['daily3', 'daily2', 'daily1']);
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
    expect(sorted.map(c => c.id)).toEqual(['daily2', 'daily1']);
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

  // Bug #1: Monthly logs navigation tests
  it('should include monthly logs between favorited customs and daily logs', () => {
    const collections: Collection[] = [
      // Favorited customs (should appear first)
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      
      // Monthly logs (should appear between favorited customs and daily logs)
      { id: 'monthly1', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'monthly2', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-03T00:00:00Z' },
      
      // Daily logs (should appear after monthly logs)
      { id: 'daily1', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'daily2', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-05T00:00:00Z' },
      
      // Other customs (should appear last)
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-06T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    // Expected order: fav1, monthly1, monthly2, daily1, daily2, custom1
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',     // Favorited custom
      'monthly1', // Monthly log (Feb 2026, newest)
      'monthly2', // Monthly log (Jan 2026)
      'daily1',   // Daily log (Feb 2, newest)
      'daily2',   // Daily log (Feb 1)
      'custom1',  // Other custom
    ]);
  });

  it('should sort monthly logs by date in descending order (newest first)', () => {
    const collections: Collection[] = [
      { id: 'monthly1', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'monthly3', name: 'March 2026', type: 'monthly', date: '2026-03', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'monthly2', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);

    expect(sorted.map(c => c.id)).toEqual(['monthly3', 'monthly2', 'monthly1']);
  });

  it('should handle only monthly logs', () => {
    const collections: Collection[] = [
      { id: 'monthly1', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'monthly2', name: 'January 2026', type: 'monthly', date: '2026-01', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, defaultPreferences);
    expect(sorted.map(c => c.id)).toEqual(['monthly1', 'monthly2']);
  });

  it('should handle mix of all collection types including monthly', () => {
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

    // Expected order: fav1, fav2, monthly1, monthly2, daily1, daily2, custom1, custom2
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',     // Favorited customs (by order)
      'fav2',
      'monthly1', // Monthly logs (by date, newest first)
      'monthly2',
      'daily1',   // Daily logs (by date, newest first)
      'daily2',
      'custom1',  // Other customs (by order)
      'custom2',
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
});
