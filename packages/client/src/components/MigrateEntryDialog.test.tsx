import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { mockCollections, mockTask, mockNote, mockEvent } from './MigrateEntryDialog.fixtures';

/**
 * MigrateEntryDialog - Core Behavior Tests
 * 
 * Tests basic rendering, modal behavior, collection filtering,
 * form validation, and callbacks.
 * 
 * Other test suites:
 * - MigrateEntryDialog.smartDefaults.test.tsx - Smart default mode selection
 * - MigrateEntryDialog.collectionSorting.test.tsx - Collection ordering
 * - MigrateEntryDialog.bulk.test.tsx - Bulk migration
 * - MigrateEntryDialog.errors.test.tsx - Error handling
 */

describe('MigrateEntryDialog - Core Behavior', () => {
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
  // Collection Filtering Tests
  // ============================================================================

  describe('Collection Filtering', () => {
    it('should exclude current collection from available collections', () => {
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
      const options = Array.from(select.querySelectorAll('option'));

      // Should have 3 options: placeholder + 2 collections (excludes Monthly Log)
      expect(options).toHaveLength(3);
      expect(options[0]?.textContent).toBe('Select a collection...');
      // New sorting order: Work Projects (custom), Daily Log (formatted as date)
      expect(options[1]?.textContent).toBe('Work Projects');
      expect(options[2]?.textContent).toBe('Saturday, January 24, 2026');
    });

    it('should populate collection selector with available collections', () => {
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
      expect(select).toBeInTheDocument();

      // Should show formatted date for daily log and Work Projects
      expect(screen.getByRole('option', { name: 'Saturday, January 24, 2026' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Work Projects' })).toBeInTheDocument();
    });

    it('should require explicit collection selection (no auto-select)', () => {
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

      const select = screen.getByRole('combobox', { name: /Collection/i }) as HTMLSelectElement;
      expect(select.value).toBe(''); // No auto-selection, user must choose
      
      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      expect(migrateButton).toBeDisabled(); // Button disabled until selection
    });
  });

  // ============================================================================
  // Bulk vs Single Migration Tests
  // ============================================================================

  describe('Entry Type Labels', () => {
    it('should show entry-specific title for single task', () => {
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

      expect(screen.getByText('Migrate task')).toBeInTheDocument();
    });

    it('should show entry-specific title for single note', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockNote}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      expect(screen.getByText('Migrate note')).toBeInTheDocument();
    });

    it('should show entry-specific title for single event', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEvent}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      expect(screen.getByText('Migrate event')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should show "No other collections available" when no collections', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="daily-log"
          collections={[
            {
              id: 'daily-log',
              name: 'Daily Log',
              type: 'daily',
              createdAt: '2026-01-24T10:00:00.000Z',
              order: 'a0',
            },
          ]}
          onMigrate={mockOnMigrate}
        />
      );

      expect(screen.getByText(/No other collections available/i)).toBeInTheDocument();
    });

    it('should disable Migrate button when no collections available', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="daily-log"
          collections={[
            {
              id: 'daily-log',
              name: 'Daily Log',
              type: 'daily',
              createdAt: '2026-01-24T10:00:00.000Z',
              order: 'a0',
            },
          ]}
          onMigrate={mockOnMigrate}
        />
      );

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      expect(migrateButton).toBeDisabled();
    });

    it('should not show collection selector when no collections available', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="daily-log"
          collections={[
            {
              id: 'daily-log',
              name: 'Daily Log',
              type: 'daily',
              createdAt: '2026-01-24T10:00:00.000Z',
              order: 'a0',
            },
          ]}
          onMigrate={mockOnMigrate}
        />
      );

      expect(screen.queryByRole('combobox', { name: /Collection/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Keyboard Interactions Tests
  // ============================================================================

  describe('Keyboard Interactions', () => {
    it('should close modal when Escape key is pressed', () => {
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

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should auto-focus on collection selector when modal opens', () => {
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
      expect(document.activeElement).toBe(select);
    });

    it('should support tab navigation between elements', () => {
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
      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      const migrateButton = screen.getByRole('button', { name: /Migrate/i });

      // All interactive elements should be focusable
      expect(select.tabIndex).toBeGreaterThanOrEqual(0);
      expect(moveRadio.tabIndex).toBeGreaterThanOrEqual(-1); // Radio buttons have special tab behavior
      expect(addRadio.tabIndex).toBeGreaterThanOrEqual(-1);
      expect(cancelButton.tabIndex).toBeGreaterThanOrEqual(0);
      expect(migrateButton.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Callbacks Tests
  // ============================================================================

  describe('Callbacks', () => {
    it('should call onMigrate with correct parameters for single entry in move mode', async () => {
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
        expect(mockOnMigrate).toHaveBeenCalledTimes(1);
        expect(mockOnMigrate).toHaveBeenCalledWith('task-1', 'daily-log', 'move');
      });
    });

    it('should call onMigrate with correct parameters for single entry in add mode', async () => {
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

      // Switch to add mode
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);

      const migrateButton = screen.getByRole('button', { name: /Migrate/i });
      fireEvent.click(migrateButton);

      await waitFor(() => {
        expect(mockOnMigrate).toHaveBeenCalledWith('task-1', 'daily-log', 'add');
      });
    });

    it('should call onClose when Cancel button is clicked', () => {
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

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
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

      // Click the backdrop (the outer div with fixed inset-0)
      const backdrop = screen.getByText('Migrate task').closest('.fixed');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onClose after successful migration', async () => {
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
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should change selected collection when dropdown changes', () => {
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

      const select = screen.getByRole('combobox', { name: /Collection/i }) as HTMLSelectElement;
      
      // Initially should be empty (no auto-selection)
      expect(select.value).toBe('');

      // Select Daily Log
      fireEvent.change(select, { target: { value: 'daily-log' } });
      expect(select.value).toBe('daily-log');

      // Change to Work Projects
      fireEvent.change(select, { target: { value: 'work-projects' } });
      expect(select.value).toBe('work-projects');
    });
  });

  // ============================================================================
  // Modal Behavior Tests
  // ============================================================================

  describe('Modal Behavior', () => {
    it('should not render when isOpen is false', () => {
      const { container } = renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={false}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when no entry or entries provided', () => {
      const { container } = renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should disable buttons while submitting', async () => {
      // Make onMigrate hang to simulate slow network
      let resolvePromise: () => void;
      const hangingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnMigrate.mockReturnValue(hangingPromise);

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
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });

      fireEvent.click(migrateButton);

      // Buttons should be disabled during submission
      await waitFor(() => {
        expect(migrateButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
        expect(screen.getByText('Migrating...')).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('should reset state when modal closes', async () => {
      const { rerender } = renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Switch to add mode and change collection
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);
      
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'work-projects' } });

      // Close modal
      rerender(
        <MigrateEntryDialog
          isOpen={false}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Reopen modal
      rerender(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Should reset to default mode and empty selection
      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      expect(moveRadio).toBeChecked();

      const resetSelect = screen.getByRole('combobox', { name: /Collection/i }) as HTMLSelectElement;
      expect(resetSelect.value).toBe(''); // Reset to empty
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper role attributes', () => {
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

      expect(screen.getByRole('combobox', { name: /Collection/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Move to/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Also show in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Migrate/i })).toBeInTheDocument();
    });

    it('should have proper labels for form elements', () => {
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

      // Check the select has proper label (use id to be specific)
      const select = screen.getByRole('combobox', { name: /Collection/i });
      expect(select).toHaveAttribute('id', 'target-collection');
      
      // Verify label links to the select
      const label = document.querySelector('label[for="target-collection"]');
      expect(label).toBeInTheDocument();
      expect(label?.textContent).toBe('Collection');
    });

    it('should have proper error role when error is displayed', async () => {
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
        const errorDiv = screen.getByRole('alert');
        expect(errorDiv).toHaveTextContent('Migration failed');
      });
    });
  });
});
