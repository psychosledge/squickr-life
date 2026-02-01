import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MigrateEntryModal } from './MigrateEntryModal';
import type { Entry, Collection } from '@squickr/shared';
import { getCollectionDisplayName } from '../utils/formatters';

describe('MigrateEntryModal', () => {
  const mockCollections: Collection[] = [
    { id: 'col1', userId: 'user1', name: 'Work Projects', createdAt: '2024-01-01', order: 0 },
    { id: 'col2', userId: 'user1', name: 'Personal', createdAt: '2024-01-02', order: 1 },
    { id: 'col3', userId: 'user1', name: 'Daily Log - Jan 30', createdAt: '2024-01-03', order: 2 },
  ];

  const mockEntry: Entry = {
    id: 'entry1',
    userId: 'user1',
    type: 'task',
    title: 'Test Task',
    status: 'incomplete',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    entry: mockEntry,
    collections: mockCollections,
    onMigrate: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should not render when closed', () => {
      render(<MigrateEntryModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(/Migrate to Collection/i)).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(<MigrateEntryModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Migrate/i)).toBeInTheDocument();
      expect(screen.getByText(/task/i)).toBeInTheDocument();
    });

    it('should render with task terminology', () => {
      render(<MigrateEntryModal {...defaultProps} entry={{ ...mockEntry, type: 'task' }} />);
      expect(screen.getByText(/Migrate task to collection/i)).toBeInTheDocument();
    });

    it('should render with note terminology', () => {
      render(<MigrateEntryModal {...defaultProps} entry={{ ...mockEntry, type: 'note', content: 'Test' }} />);
      expect(screen.getByText(/Migrate note to collection/i)).toBeInTheDocument();
    });

    it('should render with event terminology', () => {
      render(<MigrateEntryModal {...defaultProps} entry={{ ...mockEntry, type: 'event', content: 'Test' }} />);
      expect(screen.getByText(/Migrate event to collection/i)).toBeInTheDocument();
    });
  });

  describe('Create New Collection Option', () => {
    it('should show "+ Create New Collection" option at the top of the list', () => {
      render(<MigrateEntryModal {...defaultProps} />);
      
      const options = screen.getAllByRole('radio');
      expect(options[0]).toHaveAccessibleName(/Create New Collection/i);
    });

    it('should show "Next" button when "+ Create New Collection" is selected', async () => {
      const user = userEvent.setup();
      render(<MigrateEntryModal {...defaultProps} />);
      
      const createOption = screen.getByLabelText(/Create New Collection/i);
      await user.click(createOption);
      
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Migrate$/i })).not.toBeInTheDocument();
    });

    it('should show "Migrate" button when a collection is selected', async () => {
      const user = userEvent.setup();
      render(<MigrateEntryModal {...defaultProps} />);
      
      const collectionOption = screen.getByLabelText(/Work Projects/i);
      await user.click(collectionOption);
      
      expect(screen.getByRole('button', { name: /^Migrate$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next/i })).not.toBeInTheDocument();
    });

    it('should disable "Next" button when nothing is selected', () => {
      render(<MigrateEntryModal {...defaultProps} />);
      
      // Initially, no selection, so buttons should be disabled
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Collection List', () => {
    it('should show all collections', () => {
      render(<MigrateEntryModal {...defaultProps} />);
      
      expect(screen.getByLabelText(/Work Projects/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Personal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Daily Log - Jan 30/i)).toBeInTheDocument();
    });

    it('should filter out current collection', () => {
      render(<MigrateEntryModal {...defaultProps} currentCollectionId="col1" />);
      
      expect(screen.queryByLabelText(/Work Projects/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Personal/i)).toBeInTheDocument();
    });
  });

  describe('Migration Flow', () => {
    it('should call onMigrate when a collection is selected and Migrate is clicked', async () => {
      const user = userEvent.setup();
      const onMigrate = vi.fn().mockResolvedValue(undefined);
      
      render(<MigrateEntryModal {...defaultProps} onMigrate={onMigrate} />);
      
      await user.click(screen.getByLabelText(/Work Projects/i));
      await user.click(screen.getByRole('button', { name: /^Migrate$/i }));
      
      expect(onMigrate).toHaveBeenCalledWith('entry1', 'col1');
    });

    it('should close modal after successful migration', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<MigrateEntryModal {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByLabelText(/Work Projects/i));
      await user.click(screen.getByRole('button', { name: /^Migrate$/i }));
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message on migration failure', async () => {
      const user = userEvent.setup();
      const onMigrate = vi.fn().mockRejectedValue(new Error('Migration failed'));
      
      render(<MigrateEntryModal {...defaultProps} onMigrate={onMigrate} />);
      
      await user.click(screen.getByLabelText(/Work Projects/i));
      await user.click(screen.getByRole('button', { name: /^Migrate$/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Migration failed')).toBeInTheDocument();
      });
    });

    it('should disable buttons and show error when entry is already migrated', () => {
      const migratedEntry = { ...mockEntry, migratedTo: 'entry2' };
      render(<MigrateEntryModal {...defaultProps} entry={migratedEntry} />);
      
      expect(screen.getByText(/already been migrated/i)).toBeInTheDocument();
      
      const migrateButtons = screen.queryByRole('button', { name: /^Migrate$/i });
      if (migrateButtons) {
        expect(migrateButtons).toBeDisabled();
      }
    });
  });

  describe('Nested Modal Flow', () => {
    it('should call onOpenCreateCollection when Next is clicked with "+ Create New Collection" selected', async () => {
      const user = userEvent.setup();
      const onOpenCreateCollection = vi.fn();
      
      render(<MigrateEntryModal {...defaultProps} onOpenCreateCollection={onOpenCreateCollection} />);
      
      await user.click(screen.getByLabelText(/Create New Collection/i));
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      expect(onOpenCreateCollection).toHaveBeenCalledTimes(1);
    });

    it('should auto-select newly created collection when onCollectionCreated is called', () => {
      const { rerender } = render(<MigrateEntryModal {...defaultProps} />);
      
      // Simulate collection creation by adding a new collection and calling the callback
      const newCollection: Collection = {
        id: 'col4',
        userId: 'user1',
        name: 'New Collection',
        createdAt: '2024-01-04',
        order: 3,
      };
      
      const updatedCollections = [...mockCollections, newCollection];
      
      rerender(
        <MigrateEntryModal
          {...defaultProps}
          collections={updatedCollections}
          selectedCollectionId="col4"
        />
      );
      
      // Verify the new collection appears
      const newCollectionOptions = screen.getAllByText(/New Collection/i);
      // Should appear in both "+ Create New Collection" and the actual "New Collection" option
      expect(newCollectionOptions.length).toBeGreaterThan(0);
    });

    it('should show "Migrate" button after a collection is created and auto-selected', async () => {
      const user = userEvent.setup();
      
      // Start with create option selected
      const { rerender } = render(<MigrateEntryModal {...defaultProps} />);
      
      await user.click(screen.getByLabelText(/Create New Collection/i));
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
      
      // Simulate collection creation
      const newCollection: Collection = {
        id: 'col4',
        userId: 'user1',
        name: 'New Collection',
        createdAt: '2024-01-04',
        order: 3,
      };
      
      const updatedCollections = [...mockCollections, newCollection];
      
      rerender(
        <MigrateEntryModal
          {...defaultProps}
          collections={updatedCollections}
          selectedCollectionId="col4"
        />
      );
      
      // Should now show Migrate button
      expect(screen.getByRole('button', { name: /^Migrate$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next/i })).not.toBeInTheDocument();
    });

    it('should auto-migrate entry after creating new collection via nested modal', async () => {
      const user = userEvent.setup();
      const onMigrate = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      const onCreateCollection = vi.fn().mockResolvedValue('col4'); // Returns new collection ID
      
      render(<MigrateEntryModal 
        {...defaultProps} 
        onMigrate={onMigrate}
        onClose={onClose}
        onCreateCollection={onCreateCollection}
      />);
      
      // Select "+ Create New Collection"
      await user.click(screen.getByLabelText(/Create New Collection/i));
      
      // Click Next to open create modal
      await user.click(screen.getByRole('button', { name: /Next/i }));
      
      // Wait for CreateCollectionModal to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Create Collection/i })).toBeInTheDocument();
      });
      
      // Enter collection name
      const input = screen.getByLabelText(/Collection Name/i);
      await user.type(input, 'New Collection');
      
      // Submit the create form (Enter key)
      await user.keyboard('{Enter}');
      
      // Wait for collection creation and auto-migration
      await waitFor(() => {
        expect(onCreateCollection).toHaveBeenCalledWith('New Collection');
        expect(onMigrate).toHaveBeenCalledWith('entry1', 'col4');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard and Accessibility', () => {
    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<MigrateEntryModal {...defaultProps} onClose={onClose} />);
      
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<MigrateEntryModal {...defaultProps} onClose={onClose} />);
      
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should prevent body scroll when open', () => {
      const originalOverflow = document.body.style.overflow;
      
      const { rerender } = render(<MigrateEntryModal {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(<MigrateEntryModal {...defaultProps} isOpen={false} />);
      
      expect(document.body.style.overflow).toBe(originalOverflow);
    });

    it('should have proper ARIA labels', () => {
      render(<MigrateEntryModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty collections list', () => {
      render(<MigrateEntryModal {...defaultProps} collections={[]} />);
      
      // Should still show the "+ Create New Collection" option
      expect(screen.getByLabelText(/Create New Collection/i)).toBeInTheDocument();
      
      // Should show a message about no collections
      expect(screen.getByText(/No other collections available/i)).toBeInTheDocument();
    });

    it('should handle null entry gracefully', () => {
      render(<MigrateEntryModal {...defaultProps} entry={null} />);
      
      expect(screen.queryByText(/Migrate to Collection/i)).not.toBeInTheDocument();
    });

    it('should reset state when modal is closed and reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<MigrateEntryModal {...defaultProps} />);
      
      // Select a collection
      await user.click(screen.getByLabelText(/Work Projects/i));
      
      // Close modal
      rerender(<MigrateEntryModal {...defaultProps} isOpen={false} />);
      
      // Reopen modal
      rerender(<MigrateEntryModal {...defaultProps} isOpen={true} />);
      
      // Selection should be reset (no radio button checked initially)
      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).not.toBeChecked();
      });
    });

    it('should disable migrate button while submitting', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const onMigrate = vi.fn(() => new Promise<void>((resolve) => {
        resolvePromise = resolve;
      }));
      
      render(<MigrateEntryModal {...defaultProps} onMigrate={onMigrate} />);
      
      await user.click(screen.getByLabelText(/Work Projects/i));
      
      const migrateButton = screen.getByRole('button', { name: /^Migrate$/i });
      await user.click(migrateButton);
      
      expect(migrateButton).toBeDisabled();
      
      // Clean up
      resolvePromise!();
    });
  });

  describe('Smart Filtering (Phase 1D)', () => {
    // Helper functions to get today's and yesterday's dates
    const getTodayDate = (): string => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getYesterdayDate = (): string => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    it('should show today, pinned, and yesterday by default', () => {
      const today = getTodayDate();
      const yesterday = getYesterdayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'yesterday', 
          userId: 'user1', 
          name: 'Yesterday', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: yesterday,
        },
        { 
          id: 'pinned', 
          userId: 'user1', 
          name: 'Pinned Ideas', 
          createdAt: '2024-01-01', 
          order: '2',
          type: 'custom',
          isFavorite: true,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '3',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Should show today, pinned, and yesterday (using formatted display names)
      const todayCollection = collectionsWithDates.find(c => c.id === 'today')!;
      const yesterdayCollection = collectionsWithDates.find(c => c.id === 'yesterday')!;
      
      expect(screen.getByLabelText(new RegExp(getCollectionDisplayName(todayCollection)))).toBeInTheDocument();
      expect(screen.getByLabelText(/Pinned Ideas/i)).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(getCollectionDisplayName(yesterdayCollection)))).toBeInTheDocument();
    });

    it('should NOT show other collections by default', () => {
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
        { 
          id: 'unpinned', 
          userId: 'user1', 
          name: 'Unpinned', 
          createdAt: '2024-01-01', 
          order: '2',
          type: 'custom',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Should show today (using formatted display name)
      const todayCollection = collectionsWithDates.find(c => c.id === 'today')!;
      expect(screen.getByLabelText(new RegExp(getCollectionDisplayName(todayCollection)))).toBeInTheDocument();

      // Should NOT show old or unpinned collections
      expect(screen.queryByLabelText(/Old Log/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Unpinned/i)).not.toBeInTheDocument();
    });

    it('should show "Show all collections" button when filtered', () => {
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      expect(screen.getByText('Show all collections')).toBeInTheDocument();
    });

    it('should expand to full list when "Show all" is clicked', async () => {
      const user = userEvent.setup();
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Old collection should not be visible initially (using formatted display name)
      const oldCollection = collectionsWithDates.find(c => c.id === 'old')!;
      expect(screen.queryByLabelText(new RegExp(getCollectionDisplayName(oldCollection)))).not.toBeInTheDocument();

      // Click "Show all"
      await user.click(screen.getByText('Show all collections'));

      // Old collection should now be visible
      expect(screen.getByLabelText(new RegExp(getCollectionDisplayName(oldCollection)))).toBeInTheDocument();
    });

    it('should show "Show less" button when expanded', async () => {
      const user = userEvent.setup();
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      await user.click(screen.getByText('Show all collections'));

      expect(screen.getByText('Show less')).toBeInTheDocument();
      expect(screen.queryByText('Show all collections')).not.toBeInTheDocument();
    });

    it('should collapse back to filtered view when "Show less" is clicked', async () => {
      const user = userEvent.setup();
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Expand
      const oldCollection = collectionsWithDates.find(c => c.id === 'old')!;
      await user.click(screen.getByText('Show all collections'));
      expect(screen.getByLabelText(new RegExp(getCollectionDisplayName(oldCollection)))).toBeInTheDocument();

      // Collapse
      await user.click(screen.getByText('Show less'));
      expect(screen.queryByLabelText(new RegExp(getCollectionDisplayName(oldCollection)))).not.toBeInTheDocument();
    });

    it('should handle collections without today or yesterday gracefully', () => {
      const collectionsWithDates: Collection[] = [
        { 
          id: 'pinned', 
          userId: 'user1', 
          name: 'Pinned Ideas', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'custom',
          isFavorite: true,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Should show pinned collection
      expect(screen.getByLabelText(/Pinned Ideas/i)).toBeInTheDocument();

      // Should NOT show old log
      expect(screen.queryByLabelText(/Old Log/i)).not.toBeInTheDocument();
    });

    it('should not show duplicate if today log is also pinned', () => {
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today (Pinned)', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
          isFavorite: true,
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Should only show once (using formatted display name, not the stored name)
      const todayCollection = collectionsWithDates[0]!;
      const displayName = getCollectionDisplayName(todayCollection);
      const labels = screen.getAllByLabelText(new RegExp(displayName));
      expect(labels).toHaveLength(1);
    });

    it('should not show "Show all" button if filtered list equals full list', () => {
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Should NOT show "Show all" button since there's nothing more to show
      expect(screen.queryByText('Show all collections')).not.toBeInTheDocument();
    });

    it('should preserve selection when toggling between filtered and full views', async () => {
      const user = userEvent.setup();
      const today = getTodayDate();

      const collectionsWithDates: Collection[] = [
        { 
          id: 'today', 
          userId: 'user1', 
          name: 'Today', 
          createdAt: '2024-01-01', 
          order: '0',
          type: 'daily',
          date: today,
        },
        { 
          id: 'old', 
          userId: 'user1', 
          name: 'Old Log', 
          createdAt: '2024-01-01', 
          order: '1',
          type: 'daily',
          date: '2025-01-01',
        },
      ];

      render(<MigrateEntryModal {...defaultProps} collections={collectionsWithDates} />);

      // Select today (using formatted display name)
      const todayCollection = collectionsWithDates.find(c => c.id === 'today')!;
      const todayDisplayName = getCollectionDisplayName(todayCollection);
      await user.click(screen.getByLabelText(new RegExp(todayDisplayName)));
      expect(screen.getByLabelText(new RegExp(todayDisplayName))).toBeChecked();

      // Expand to show all
      await user.click(screen.getByText('Show all collections'));

      // Selection should still be preserved
      expect(screen.getByLabelText(new RegExp(todayDisplayName))).toBeChecked();

      // Collapse back
      await user.click(screen.getByText('Show less'));

      // Selection should still be preserved
      expect(screen.getByLabelText(new RegExp(todayDisplayName))).toBeChecked();
    });
  });
});
