import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import { mockCollections, mockTask, mockSubTask, mockNote, mockEvent } from './MigrateEntryDialog.fixtures';
import type { Entry } from '@squickr/domain';

/**
 * MigrateEntryDialog - Smart Defaults Tests
 * 
 * Tests smart default mode selection (move vs add) and mode switching behavior.
 * 
 * Other test suites:
 * - MigrateEntryDialog.test.tsx - Core behavior
 * - MigrateEntryDialog.collectionSorting.test.tsx - Collection ordering
 * - MigrateEntryDialog.bulk.test.tsx - Bulk migration
 * - MigrateEntryDialog.errors.test.tsx - Error handling
 */

describe('MigrateEntryDialog - Smart Defaults', () => {
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
  // Smart Defaults Tests
  // ============================================================================

  describe('Default Mode Selection', () => {
    it('should default to "move" mode for top-level tasks', () => {
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

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
    });

    it('should default to "add" mode for sub-tasks with parentTaskId', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(moveRadio).not.toBeChecked();
      expect(addRadio).toBeChecked();
    });

    it('should default to "add" mode for sub-tasks with parentEntryId', () => {
      const mockSubTaskWithParentEntry: Entry = {
        type: 'task',
        id: 'task-2',
        title: 'Buy organic milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        parentEntryId: 'task-1',
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTaskWithParentEntry}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      expect(addRadio).toBeChecked();
    });

    it('should default to "move" mode for top-level notes', () => {
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

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      expect(moveRadio).toBeChecked();
    });

    it('should default to "move" mode for top-level events', () => {
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

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      expect(moveRadio).toBeChecked();
    });
  });

  // ============================================================================
  // Mode Switching Tests
  // ============================================================================

  describe('Mode Switching', () => {
    it('should switch from "move" to "add" mode when clicked', () => {
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

      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);

      expect(addRadio).toBeChecked();
    });

    it('should switch from "add" to "move" mode when clicked', () => {
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      // Initially in "add" mode
      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      fireEvent.click(moveRadio);

      expect(moveRadio).toBeChecked();
    });

    it('should update helper text when mode changes', () => {
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

      // Initially in "move" mode (monthly log formatted as "January 2026")
      expect(screen.getByText(/Crosses out original in January 2026/i)).toBeInTheDocument();

      // Switch to "add" mode
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      fireEvent.click(addRadio);

      expect(screen.getByText(/Keep in January 2026/i)).toBeInTheDocument();
    });

    it('should update collection name in helper text when collection changes', () => {
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

      // Initially shows "selected collection" placeholder text
      expect(screen.getByText(/Move to selected collection/i)).toBeInTheDocument();

      // Select Daily Log (formatted as date)
      const select = screen.getByRole('combobox', { name: /Collection/i });
      fireEvent.change(select, { target: { value: 'daily-log' } });
      expect(screen.getByText(/Move to Saturday, January 24, 2026/i)).toBeInTheDocument();

      // Change collection to Work Projects
      fireEvent.change(select, { target: { value: 'work-projects' } });

      expect(screen.getByText(/Move to Work Projects/i)).toBeInTheDocument();
    });
  });
});
