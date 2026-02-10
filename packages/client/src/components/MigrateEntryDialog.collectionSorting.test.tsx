import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import type { Entry, Collection } from '@squickr/domain';

/**
 * MigrateEntryDialog - Collection Sorting Tests
 * 
 * Tests collection ordering in the dropdown, including the critical
 * auto-favorited daily logs regression tests.
 * 
 * Other test suites:
 * - MigrateEntryDialog.test.tsx - Core behavior
 * - MigrateEntryDialog.smartDefaults.test.tsx - Smart default mode selection
 * - MigrateEntryDialog.bulk.test.tsx - Bulk migration
 * - MigrateEntryDialog.errors.test.tsx - Error handling
 */

describe('MigrateEntryDialog - Collection Sorting', () => {
  const mockOnMigrate = vi.fn();
  const mockOnBulkMigrate = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnMigrate.mockClear();
    mockOnBulkMigrate.mockClear();
    mockOnClose.mockClear();
    mockOnMigrate.mockResolvedValue(undefined);
    mockOnBulkMigrate.mockResolvedValue(undefined);
  });

  // ============================================================================
  // Auto-Favorited Daily Logs Tests (Bug Fix: auto-favorited dailies in calendar hierarchy)
  // ============================================================================

  describe('Auto-Favorited Daily Logs', () => {
    it('should show auto-favorited dailies (Today, Tomorrow, Yesterday) at top when autoFavoriteRecentDailyLogs is enabled', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-02-07T10:00:00.000Z', // Yesterday
        status: 'open',
        collections: ['yesterday'],
      };

      // Use actual current time for the test (Feb 9, 2026 based on env)
      const now = new Date('2026-02-09T12:00:00.000Z');
      const todayStr = '2026-02-09';
      const tomorrowStr = '2026-02-10';
      const yesterdayStr = '2026-02-08';
      const olderStr = '2026-02-04';

      const collectionsWithDailies: Collection[] = [
        // Favorited custom
        { id: 'fav-custom', name: 'Favorite Custom', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2026-02-01T00:00:00.000Z' },
        
        // Auto-favorited dailies (Today, Tomorrow, Yesterday)
        { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, createdAt: tomorrowStr + 'T00:00:00.000Z' },
        { id: 'today', name: 'Today', type: 'daily', date: todayStr, createdAt: todayStr + 'T00:00:00.000Z' },
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, createdAt: yesterdayStr + 'T00:00:00.000Z' },
        
        // Older daily (not auto-favorited)
        { id: 'older', name: 'Older Daily', type: 'daily', date: olderStr, createdAt: olderStr + 'T00:00:00.000Z' },
        
        // Monthly log
        { id: 'monthly', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2026-02-01T00:00:00.000Z' },
        
        // Other custom
        { id: 'other-custom', name: 'Other Custom', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2026-02-01T00:00:00.000Z' },
      ];

      const userPreferences = {
        defaultCompletedTaskBehavior: 'keep-in-place' as const,
        autoFavoriteRecentDailyLogs: true,
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="yesterday"
          collections={collectionsWithDailies}
          onMigrate={mockOnMigrate}
        />,
        { userPreferences }
      );

      const select = screen.getByRole('combobox', { name: /Collection/i });
      const options = Array.from(select.querySelectorAll('option')).map(opt => ({
        value: opt.value,
        text: opt.textContent,
      }));

      // Filter out the "Select a collection..." placeholder
      const collectionOptions = options.filter(opt => opt.value !== '');

      // Expected order (oldest-first):
      // 1. Favorited customs (fav-custom)
      // 2. Auto-favorited recent dailies (Yesterday/Today/Tomorrow, Yesterday filtered out as current)
      // 3. Unfavorited customs (other-custom)
      // 4. Older calendar (monthly → older daily from Feb, before today)
      expect(collectionOptions.map(opt => opt.value)).toEqual([
        'fav-custom',     // Favorited custom
        // 'yesterday' is filtered out (current collection)
        'today',          // Auto-favorited (Today)
        'tomorrow',       // Auto-favorited (Tomorrow)
        'other-custom',   // Unfavorited custom
        'monthly',        // Monthly log (February 2026, in older section)
        'older',          // Older daily (not auto-favorited, before today)
      ]);
    });

    it('should NOT show Today/Tomorrow/Yesterday at top when autoFavoriteRecentDailyLogs is disabled (DEFAULT)', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-02-07T10:00:00.000Z', // Yesterday
        status: 'open',
        collections: ['yesterday'],
      };

      const now = new Date('2026-02-09T12:00:00.000Z');
      const todayStr = '2026-02-09';
      const tomorrowStr = '2026-02-10';
      const yesterdayStr = '2026-02-08';
      const olderStr = '2026-02-04';

      const collectionsWithDailies: Collection[] = [
        // Favorited custom
        { id: 'fav-custom', name: 'Favorite Custom', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2026-02-01T00:00:00.000Z' },
        
        // Dailies (NOT auto-favorited)
        { id: 'tomorrow', name: 'Tomorrow', type: 'daily', date: tomorrowStr, createdAt: tomorrowStr + 'T00:00:00.000Z' },
        { id: 'today', name: 'Today', type: 'daily', date: todayStr, createdAt: todayStr + 'T00:00:00.000Z' },
        { id: 'yesterday', name: 'Yesterday', type: 'daily', date: yesterdayStr, createdAt: yesterdayStr + 'T00:00:00.000Z' },
        { id: 'older', name: 'Older Daily', type: 'daily', date: olderStr, createdAt: olderStr + 'T00:00:00.000Z' },
        
        // Monthly log
        { id: 'monthly', name: 'February 2026', type: 'monthly', date: '2026-02', createdAt: '2026-02-01T00:00:00.000Z' },
        
        // Other custom
        { id: 'other-custom', name: 'Other Custom', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2026-02-01T00:00:00.000Z' },
      ];

      const userPreferences = {
        defaultCompletedTaskBehavior: 'keep-in-place' as const,
        autoFavoriteRecentDailyLogs: false, // DISABLED (default)
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="yesterday"
          collections={collectionsWithDailies}
          onMigrate={mockOnMigrate}
          userPreferences={userPreferences}
        />
      );

      const select = screen.getByRole('combobox', { name: /Collection/i });
      const options = Array.from(select.querySelectorAll('option')).map(opt => ({
        value: opt.value,
        text: opt.textContent,
      }));

      const collectionOptions = options.filter(opt => opt.value !== '');

      // Expected order (WITHOUT auto-favoriting, oldest-first):
      // 1. Favorited customs (fav-custom)
      // 2. Other customs (other-custom)
      // 3. Older calendar (monthly → older daily from Feb, before yesterday)
      // 4. Future calendar (today → tomorrow, after yesterday)
      expect(collectionOptions.map(opt => opt.value)).toEqual([
        'fav-custom',     // Favorited custom
        'other-custom',   // Other custom
        'monthly',        // Monthly log (February 2026, in older section)
        'older',          // Older daily (before yesterday)
        // 'yesterday' is filtered out (current collection)
        'today',          // Daily (in future calendar, oldest first)
        'tomorrow',       // Daily (in future calendar)
      ]);
    });
  });
});
