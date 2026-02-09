import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MigrateEntryDialog } from './MigrateEntryDialog';
import type { Entry, Collection } from '@squickr/domain';

describe('MigrateEntryDialog', () => {
  const mockCollections: Collection[] = [
    {
      id: 'daily-log',
      name: 'Daily Log',
      type: 'daily',
      date: '2026-01-24', // Daily logs need a date field
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a0',
    },
    {
      id: 'monthly-log',
      name: 'Monthly Log',
      type: 'monthly',
      date: '2026-01', // Monthly logs need a date field
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a1',
    },
    {
      id: 'work-projects',
      name: 'Work Projects',
      type: 'custom',
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a2',
    },
  ];

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

  describe('Smart Defaults', () => {
    it('should default to "move" mode for top-level tasks', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockSubTask: Entry = {
        type: 'task',
        id: 'task-2',
        title: 'Buy organic milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        parentTaskId: 'task-1',
      };

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
      const mockSubTask: Entry = {
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
          entry={mockSubTask}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
        />
      );

      const addRadio = screen.getByRole('radio', { name: /Also show in/i });
      expect(addRadio).toBeChecked();
    });

    it('should default to "move" mode for top-level notes', () => {
      const mockNote: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Important meeting notes',
        createdAt: '2026-01-24T10:00:00.000Z',
      };

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
      const mockEvent: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Team standup',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
      };

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
  // Collection Filtering Tests
  // ============================================================================

  describe('Collection Filtering', () => {
    it('should exclude current collection from available collections', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
  // Mode Switching Tests
  // ============================================================================

  describe('Mode Switching', () => {
    it('should switch from "move" to "add" mode when clicked', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockSubTask: Entry = {
        type: 'task',
        id: 'task-2',
        title: 'Buy organic milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        parentTaskId: 'task-1',
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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

  // ============================================================================
  // Bulk vs Single Migration Tests
  // ============================================================================

  describe('Bulk vs Single Migration', () => {
    it('should show entry-specific title for single task', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockNote: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Important notes',
        createdAt: '2026-01-24T10:00:00.000Z',
      };

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
      const mockEvent: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Team standup',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
      };

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

    it('should show count for bulk migration with multiple entries', () => {
      const mockEntries: Entry[] = [
        {
          type: 'task',
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
          collections: [],
        },
        {
          type: 'task',
          id: 'task-2',
          title: 'Buy eggs',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
          collections: [],
        },
        {
          type: 'task',
          id: 'task-3',
          title: 'Buy bread',
          createdAt: '2026-01-24T10:02:00.000Z',
          status: 'open',
          collections: [],
        },
      ];

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockEntries}
          currentCollectionId="monthly-log"
          collections={mockCollections}
          onMigrate={mockOnMigrate}
          onBulkMigrate={mockOnBulkMigrate}
        />
      );

      expect(screen.getByText('Migrate 3 entries')).toBeInTheDocument();
    });

    it('should show "1 entry" for bulk mode with single entry', () => {
      const mockEntries: Entry[] = [
        {
          type: 'task',
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
          collections: [],
        },
      ];

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockEntries}
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
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should show "No other collections available" when no collections', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should display error message when migration fails', async () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
  });

  // ============================================================================
  // Keyboard Interactions Tests
  // ============================================================================

  describe('Keyboard Interactions', () => {
    it('should close modal when Escape key is pressed', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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

    it('should call onBulkMigrate with correct parameters for multiple entries', async () => {
      const mockEntries: Entry[] = [
        {
          type: 'task',
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
          collections: [],
        },
        {
          type: 'task',
          id: 'task-2',
          title: 'Buy eggs',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
          collections: [],
        },
      ];

      renderWithAppProvider(
        <MigrateEntryDialog
          isOpen={true}
          onClose={mockOnClose}
          entries={mockEntries}
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
          ['task-1', 'task-2'],
          'daily-log',
          'move'
        );
      });
    });

    it('should call onClose when Cancel button is clicked', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
      };

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

      // Expected order:
      // 1. Favorited customs (fav-custom)
      // 2. Auto-favorited dailies (Tomorrow → Today, Yesterday is filtered out as current)
      // 3. Other customs (other-custom)
      // 4. Calendar hierarchy (monthly → older daily)
      expect(collectionOptions.map(opt => opt.value)).toEqual([
        'fav-custom',     // Favorited custom
        'tomorrow',       // Auto-favorited (Tomorrow)
        'today',          // Auto-favorited (Today)
        // 'yesterday' is filtered out (current collection)
        'other-custom',   // Other custom
        'monthly',        // Monthly log (February 2026)
        'older',          // Older daily (not auto-favorited)
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

      // Expected order (WITHOUT auto-favoriting):
      // 1. Favorited customs (fav-custom)
      // 2. Other customs (other-custom)
      // 3. Calendar hierarchy (monthly → tomorrow → today → older, yesterday filtered)
      expect(collectionOptions.map(opt => opt.value)).toEqual([
        'fav-custom',     // Favorited custom
        'other-custom',   // Other custom
        'monthly',        // Monthly log (February 2026)
        'tomorrow',       // Daily (newest, in calendar hierarchy)
        'today',          // Daily (in calendar hierarchy)
        // 'yesterday' is filtered out (current collection)
        'older',          // Older daily
      ]);
    });
  });
});
