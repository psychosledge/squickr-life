import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { mockCollections, mockTask, mockBulkEntries } from './MigrateEntryDialog.fixtures';
import type { Entry } from '@squickr/domain';

/**
 * MigrateEntryDialog - Bulk Migration Tests
 * 
 * Tests bulk migration behavior, multiple entry selection,
 * and bulk mode vs single mode differences.
 * 
 * Other test suites:
 * - MigrateEntryDialog.test.tsx - Core behavior
 * - MigrateEntryDialog.smartDefaults.test.tsx - Smart default mode selection
 * - MigrateEntryDialog.collectionSorting.test.tsx - Collection ordering
 * - MigrateEntryDialog.errors.test.tsx - Error handling
 */

describe('MigrateEntryDialog - Bulk Migration', () => {
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
  // Bulk Mode Display Tests
  // ============================================================================

  describe('Bulk Mode Display', () => {
    it('should show count for bulk migration with multiple entries', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      expect(screen.getByText('Migrate 3 entries')).toBeInTheDocument();
    });

    it('should show "1 entry" for bulk mode with single entry', () => {
      const singleEntryArray: Entry[] = [mockTask];

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={singleEntryArray}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      expect(screen.getByText('Migrate 1 entry')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Bulk Migration Callbacks
  // ============================================================================

  describe('Bulk Migration Callbacks', () => {
    it('should call onBulkMigrate with correct parameters for multiple entries', async () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(mockOnBulkMigrate).toHaveBeenCalledTimes(1);
        expect(mockOnBulkMigrate).toHaveBeenCalledWith(
          ['task-1', 'task-2', 'task-3'],
          'daily-log',
          'move'
        );
      });
    });

    it('should call onBulkMigrate with "add" mode when selected', async () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      // Switch to add mode
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(mockOnBulkMigrate).toHaveBeenCalledWith(
          ['task-1', 'task-2', 'task-3'],
          'daily-log',
          'add'
        );
      });
    });

    it('should close modal after successful bulk migration', async () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================================
  // Loading State in Bulk Mode
  // ============================================================================

  describe('Loading State in Bulk Mode', () => {
    it('should show "Migrating..." during bulk migration', async () => {
      // Make onBulkMigrate hang to simulate slow network
      let resolvePromise: () => void;
      const hangingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnBulkMigrate.mockReturnValue(hangingPromise);

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Migrating...')).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('should disable buttons during bulk migration', async () => {
      // Make onBulkMigrate hang to simulate slow network
      let resolvePromise: () => void;
      const hangingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnBulkMigrate.mockReturnValue(hangingPromise);

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockBulkEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      // Select a collection first
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });

      fireEvent.click(migrateButton);

      // Buttons should be disabled during submission
      await waitFor(() => {
        expect(migrateButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolvePromise!();
    });
  });
});
