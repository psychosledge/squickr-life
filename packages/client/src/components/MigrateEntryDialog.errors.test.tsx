import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { mockCollections, mockTask } from './MigrateEntryDialog.fixtures';

/**
 * MigrateEntryDialog - Error Handling Tests
 * 
 * Tests error handling, edge cases, and validation failures.
 * 
 * Other test suites:
 * - MigrateEntryDialog.test.tsx - Core behavior
 * - MigrateEntryDialog.smartDefaults.test.tsx - Smart default mode selection
 * - MigrateEntryDialog.collectionSorting.test.tsx - Collection ordering
 * - MigrateEntryDialog.bulk.test.tsx - Bulk migration
 */

describe('MigrateEntryDialog - Error Handling', () => {
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
  // Error Handling Tests
  // ============================================================================

  describe('Migration Errors', () => {
    it('should display error message when migration fails', async () => {
      mockOnMigrate.mockRejectedValue(new Error('Migration failed'));

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(screen.getByText('Migration failed')).toBeInTheDocument();
      });
    });

    it('should keep modal open on error (user can retry)', async () => {
      mockOnMigrate.mockRejectedValue(new Error('Migration failed'));

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(screen.getByText('Migration failed')).toBeInTheDocument();
      });

      // Modal should still be open
      expect(screen.getByText('Migrate task')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should show generic error message for non-Error exceptions', async () => {
      mockOnMigrate.mockRejectedValue('Unknown error');

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to migrate entry')).toBeInTheDocument();
      });
    });

    it('should persist error message when collection changes (allows retry with different collection)', async () => {
      mockOnMigrate.mockRejectedValue(new Error('Migration failed'));

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Select a collection and trigger error
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(screen.getByText('Migration failed')).toBeInTheDocument();
      });

      // Change collection - error should persist (allows user to see what failed)
      fireEvent.change(select, { target: { value: 'work-projects' } });

      // Error persists so user knows previous attempt failed
      expect(screen.getByText('Migration failed')).toBeInTheDocument();
    });

    it('should persist error message when mode changes (allows retry with different mode)', async () => {
      mockOnMigrate.mockRejectedValue(new Error('Migration failed'));

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Select a collection and trigger error
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(screen.getByText('Migration failed')).toBeInTheDocument();
      });

      // Change mode - error should persist (allows user to see what failed)
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);

      // Error persists so user knows previous attempt failed
      expect(screen.getByText('Migration failed')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty entry title gracefully', () => {
      const entryWithEmptyTitle = {
        ...mockTask,
        title: '',
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={entryWithEmptyTitle}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Should still render dialog
      expect(screen.getByText('Migrate task')).toBeInTheDocument();
    });

    it('should handle very long entry titles', () => {
      const longTitle = 'A'.repeat(500);
      const entryWithLongTitle = {
        ...mockTask,
        title: longTitle,
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={entryWithLongTitle}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Should still render dialog
      expect(screen.getByText('Migrate task')).toBeInTheDocument();
    });

    it('should handle collection with missing date field', () => {
      const collectionsWithMissingDate = [
        ...mockCollections,
        {
          id: 'broken-daily',
          name: 'Broken Daily',
          type: 'daily' as const,
          // date field missing!
          createdAt: '2026-01-24T10:00:00.000Z',
          order: 'a3',
        },
      ];

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={collectionsWithMissingDate}
          onMigrate={mockOnMigrate}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('Migrate task')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Form Validation', () => {
    it('should disable Migrate button when no collection selected', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      expect(migrateButton).toBeDisabled();
    });

    it('should enable Migrate button when collection is selected', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      expect(migrateButton).not.toBeDisabled();
    });

    it('should prevent submission when no collection selected (defensive)', async () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Try to click disabled button (should not call onMigrate)
      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      // Wait a bit to ensure no async calls happen
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockOnMigrate).not.toHaveBeenCalled();
    });
  });
});
