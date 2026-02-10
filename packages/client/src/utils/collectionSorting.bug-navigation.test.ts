/**
 * Bug: Navigation skips auto-favorited dailies
 * 
 * When autoFavoriteRecentDailyLogs is enabled, navigation should include
 * Yesterday/Today/Tomorrow in the sequence, but they're being skipped.
 */

import { describe, it, expect } from 'vitest';
import { sortCollectionsHierarchically } from './collectionSorting';
import type { Collection, UserPreferences } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

describe('Bug: Navigation skips auto-favorited dailies', () => {
  it('should include auto-favorited dailies in navigation sequence', () => {
    // Setup: Feb 9, 2026 (Monday)
    const now = new Date('2026-02-09T12:00:00Z');
    const todayStr = '2026-02-09';
    const tomorrowStr = '2026-02-10';
    const yesterdayStr = '2026-02-08';
    
    const autoFavoritePreferences: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      autoFavoriteRecentDailyLogs: true,
    };

    const collections: Collection[] = [
      // Favorited custom
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      
      // Unfavorited custom
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-02T00:00:00Z' },
      
      // Auto-favorited dailies (Yesterday, Today, Tomorrow)
      { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'c0', createdAt: yesterdayStr + 'T00:00:00Z' },
      { id: 'today', name: 'Today', type: 'daily', date: todayStr, order: 'c1', createdAt: todayStr + 'T00:00:00Z' },
      { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, order: 'c2', createdAt: tomorrowStr + 'T00:00:00Z' },
      
      // Older daily (not auto-favorited)
      { id: 'older', name: 'Older', type: 'daily', date: '2026-02-01', order: 'd0', createdAt: '2026-02-01T00:00:00Z' },
      
      // Future daily (not auto-favorited)
      { id: 'future', name: 'Future', type: 'daily', date: '2026-02-15', order: 'd1', createdAt: '2026-02-15T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, autoFavoritePreferences, now);

    // Expected navigation order:
    // 1. Favorited customs (fav1)
    // 2. Auto-favorited dailies: Yesterday → Today → Tomorrow
    // 3. Unfavorited customs (custom1)
    // 4. Older calendar dailies (older)
    // 5. Future calendar dailies (future)
    
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',      // Favorited custom
      'yesterday', // Auto-favorited daily
      'today',     // Auto-favorited daily
      'tomorrow',  // Auto-favorited daily
      'custom1',   // Unfavorited custom
      'older',     // Older calendar daily (before yesterday)
      'future',    // Future calendar daily (after tomorrow)
    ]);
  });

  it('should navigate through favorited customs, then auto-favorited dailies, then other collections', () => {
    // This test simulates the user's reported issue:
    // Navigation was jumping from favorited customs directly to unfavorited customs,
    // skipping Yesterday/Today/Tomorrow
    
    const now = new Date('2026-02-09T12:00:00Z');
    const todayStr = '2026-02-09';
    const tomorrowStr = '2026-02-10';
    const yesterdayStr = '2026-02-08';
    
    const autoFavoritePreferences: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      autoFavoriteRecentDailyLogs: true,
    };

    const collections: Collection[] = [
      // Multiple favorited customs
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'a1', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
      
      // Auto-favorited dailies
      { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, order: 'c0', createdAt: yesterdayStr + 'T00:00:00Z' },
      { id: 'today', name: 'Today', type: 'daily', date: todayStr, order: 'c1', createdAt: todayStr + 'T00:00:00Z' },
      { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, order: 'c2', createdAt: tomorrowStr + 'T00:00:00Z' },
      
      // Unfavorited customs
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-03T00:00:00Z' },
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b1', isFavorite: false, createdAt: '2024-01-04T00:00:00Z' },
    ];

    const sorted = sortCollectionsHierarchically(collections, autoFavoritePreferences, now);

    // The bug was: navigation went fav1 → fav2 → custom1 → custom2 → yesterday → today → tomorrow
    // Expected: fav1 → fav2 → yesterday → today → tomorrow → custom1 → custom2
    
    // According to ADR-014, the order should be:
    // 1. Favorited customs (fav1, fav2)
    // 2. Older daily logs (none in this case)
    // 3. Auto-favorited daily logs (Yesterday → Today → Tomorrow)
    // 4. Future daily logs (none in this case)
    // 5. Other customs (custom1, custom2)
    
    expect(sorted.map(c => c.id)).toEqual([
      'fav1',      // Favorited custom
      'fav2',      // Favorited custom
      'yesterday', // Auto-favorited daily (should be after fav customs!)
      'today',     // Auto-favorited daily
      'tomorrow',  // Auto-favorited daily
      'custom1',   // Unfavorited custom (should be after auto-favorited dailies!)
      'custom2',   // Unfavorited custom
    ]);
  });
});
