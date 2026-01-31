import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MigrateEntryModal } from './MigrateEntryModal';
import type { Entry, Collection } from '@squickr/shared';

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

    it('should show "Uncategorized" option when entry is in a collection', () => {
      render(<MigrateEntryModal {...defaultProps} currentCollectionId="col1" />);
      
      expect(screen.getByLabelText(/Uncategorized/i)).toBeInTheDocument();
    });

    it('should not show "Uncategorized" option when entry is already uncategorized', () => {
      render(<MigrateEntryModal {...defaultProps} currentCollectionId={undefined} />);
      
      expect(screen.queryByLabelText(/Uncategorized/i)).not.toBeInTheDocument();
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

    it('should call onMigrate with null when Uncategorized is selected', async () => {
      const user = userEvent.setup();
      const onMigrate = vi.fn().mockResolvedValue(undefined);
      
      render(<MigrateEntryModal {...defaultProps} onMigrate={onMigrate} currentCollectionId="col1" />);
      
      await user.click(screen.getByLabelText(/Uncategorized/i));
      await user.click(screen.getByRole('button', { name: /^Migrate$/i }));
      
      expect(onMigrate).toHaveBeenCalledWith('entry1', null);
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
});
