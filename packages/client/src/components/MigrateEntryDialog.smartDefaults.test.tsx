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

    it('should default to "move" mode for sub-tasks when parentCollections not provided', () => {
      // When parentCollections is not provided (undefined), parent not found = orphaned = move
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

      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
    });

    it('should default to "move" mode for sub-tasks with parentEntryId when parentCollections not provided', () => {
      // When parentCollections is not provided (undefined), parent not found = orphaned = move
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

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
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
  // Issue #4: Smart Default Migration Mode for Sub-Tasks (Context-Aware)
  // ============================================================================

  describe('Smart Default Mode Based on Parent Location (Issue #4)', () => {
    it('should default to "add" mode for sub-task when parent is in current collection', () => {
      // Parent is in monthly-log, sub-task is also in monthly-log
      // Expected: Default to 'add' (keep with parent)
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={['monthly-log', 'work-projects']}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(addRadio).toBeChecked();
      expect(moveRadio).not.toBeChecked();
    });

    it('should default to "move" mode for sub-task when parent is NOT in current collection', () => {
      // Parent is in monthly-log and work-projects
      // Current collection is daily-log (sub-task migrated away from parent)
      // Expected: Default to 'move' (already separated from parent)
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="daily-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={['monthly-log', 'work-projects']}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
    });

    it('should default to "move" mode for sub-task when parentCollections is undefined (parent not found)', () => {
      // parentCollections === undefined means parent was NOT found in current collection
      // = orphaned sub-task = default to 'move'
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="daily-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={undefined}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
    });

    it('should default to "move" mode for sub-task when currentCollectionId is undefined', () => {
      // Edge case: global view or missing collection context = parent not in current view
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId={undefined}
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={['monthly-log']}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      expect(moveRadio).toBeChecked();
    });

    it('should default to "move" mode for sub-task when parent collections is empty array', () => {
      // Parent exists but has no collections (orphaned/uncategorized parent)
      // Expected: Default to 'move' (parent not in current collection)
      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockSubTask}
          currentCollectionId="daily-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={[]}
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      expect(moveRadio).toBeChecked();
    });

    it('should default to "move" mode for sub-task in multiple collections when parent NOT visible in current view (Case C)', () => {
      // Case C: Sub-task created in "Monthly Log" with parent, then added to "Today"
      // - Sub-task is in: ['monthly-log', 'today']
      // - Parent is only in: ['monthly-log']
      // - Current view: 'today' (daily-log in fixtures)
      // Expected: Default to 'move' (parent NOT visible in current view, sub-task is orphaned)
      const subTaskInMultipleCollections: Entry = {
        ...mockSubTask,
        collections: ['monthly-log', 'daily-log'], // Sub-task in both collections
      };

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={subTaskInMultipleCollections}
          currentCollectionId="daily-log" // Viewing from "Today"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          parentCollections={['monthly-log']} // Parent only in Monthly Log
        />
      );

      const moveRadio = screen.getByRole('radio', { name: /Move to/i });
      const addRadio = screen.getByRole('radio', { name: /Also show in/i });

      // Should default to 'move' because parent is NOT in current view
      expect(moveRadio).toBeChecked();
      expect(addRadio).not.toBeChecked();
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
