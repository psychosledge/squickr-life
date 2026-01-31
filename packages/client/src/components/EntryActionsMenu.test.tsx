import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntryActionsMenu } from './EntryActionsMenu';
import type { Entry } from '@squickr/shared';

describe('EntryActionsMenu', () => {
  const mockOnEdit = vi.fn();
  const mockOnMove = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEntry: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    title: 'Test task',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  it('should render menu trigger button', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    expect(trigger).toBeInTheDocument();
  });

  it('should show three-dot icon in trigger', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('⋯')).toBeInTheDocument();
  });

  it('should not show menu initially', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should open menu when trigger is clicked', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('should show Edit option in menu', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
  });

  it('should show Migrate to Collection option in menu', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menuitem', { name: /migrate to collection/i })).toBeInTheDocument();
  });

  it('should show Delete option in menu', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('should call onEdit when Edit is clicked', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const editButton = screen.getByRole('menuitem', { name: /edit/i });
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should call onMove when Migrate to Collection is clicked', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const moveButton = screen.getByRole('menuitem', { name: /migrate to collection/i });
    fireEvent.click(moveButton);

    expect(mockOnMove).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when Delete is clicked', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('should close menu after Edit is clicked', async () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const editButton = screen.getByRole('menuitem', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu after Migrate is clicked', async () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const moveButton = screen.getByRole('menuitem', { name: /migrate to collection/i });
    fireEvent.click(moveButton);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu after Delete is clicked', async () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <EntryActionsMenu
          entry={mockEntry}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
        />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu when Escape key is pressed', async () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes on trigger', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('should update aria-expanded when menu opens', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('should toggle menu when trigger is clicked twice', async () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    
    // First click - open
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Second click - close
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should work with note entries', () => {
    const noteEntry: Entry & { type: 'note' } = {
      type: 'note',
      id: 'note-1',
      content: 'Test note',
      createdAt: '2026-01-24T10:00:00.000Z',
    };

    render(
      <EntryActionsMenu
        entry={noteEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
  });

  it('should work with event entries', () => {
    const eventEntry: Entry & { type: 'event' } = {
      type: 'event',
      id: 'event-1',
      content: 'Test event',
      createdAt: '2026-01-24T10:00:00.000Z',
      eventDate: '2026-02-01',
    };

    render(
      <EntryActionsMenu
        entry={eventEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
  });

  it('should position menu correctly relative to trigger', () => {
    render(
      <EntryActionsMenu
        entry={mockEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu');
    // Menu should be positioned absolutely
    expect(menu).toHaveClass('absolute');
  });

  // ============================================================================
  // "Go To" Navigation Tests for Migrated Entries
  // ============================================================================

  describe('Go To navigation for migrated entries', () => {
    const mockOnNavigateToMigrated = vi.fn();
    
    const mockCollections = [
      { id: 'col-1', name: 'Work Projects', type: 'log' as const, order: 'a0', createdAt: '2026-01-20T10:00:00.000Z' },
      { id: 'col-2', name: 'Personal', type: 'log' as const, order: 'a1', createdAt: '2026-01-21T10:00:00.000Z' },
    ];

    it('should NOT show "Go to" option for non-migrated entries', () => {
      render(
        <EntryActionsMenu
          entry={mockEntry}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.queryByRole('menuitem', { name: /go to/i })).not.toBeInTheDocument();
    });

    it('should show "Go to [Collection]" option for migrated task', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menuitem', { name: /go to work projects/i })).toBeInTheDocument();
    });

    it('should show "Go to Uncategorized" when migrated to uncategorized', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: undefined,
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menuitem', { name: /go to uncategorized/i })).toBeInTheDocument();
    });

    it('should navigate to migrated collection when clicked', () => {
      // When a task is migrated, the projection keeps the original task's collectionId
      // unchanged and sets migratedToCollectionId to point to the target collection
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        collectionId: 'original-collection',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      const goToButton = screen.getByRole('menuitem', { name: /go to work projects/i });
      fireEvent.click(goToButton);

      // Should navigate to the target collection (where the new task lives)
      expect(mockOnNavigateToMigrated).toHaveBeenCalledWith('col-1');
      expect(mockOnNavigateToMigrated).toHaveBeenCalledTimes(1);
    });

    it('should call onNavigateToMigrated with null for uncategorized', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: undefined,
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      const goToButton = screen.getByRole('menuitem', { name: /go to uncategorized/i });
      fireEvent.click(goToButton);

      expect(mockOnNavigateToMigrated).toHaveBeenCalledWith(null);
      expect(mockOnNavigateToMigrated).toHaveBeenCalledTimes(1);
    });

    it('should close menu after "Go to" is clicked', async () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      const goToButton = screen.getByRole('menuitem', { name: /go to work projects/i });
      fireEvent.click(goToButton);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should work with migrated notes', () => {
      const migratedNote: Entry & { type: 'note' } = {
        type: 'note',
        id: 'note-1',
        content: 'Test note',
        createdAt: '2026-01-24T10:00:00.000Z',
        migratedTo: 'note-2',
        migratedToCollectionId: 'col-2',
      };

      render(
        <EntryActionsMenu
          entry={migratedNote}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menuitem', { name: /go to personal/i })).toBeInTheDocument();
    });

    it('should work with migrated events', () => {
      const migratedEvent: Entry & { type: 'event' } = {
        type: 'event',
        id: 'event-1',
        content: 'Test event',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-01',
        migratedTo: 'event-2',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedEvent}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menuitem', { name: /go to work projects/i })).toBeInTheDocument();
    });

    it('should handle missing collection gracefully', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: 'col-999', // Non-existent collection
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      // Should show "Go to Unknown Collection" or similar fallback
      expect(screen.getByRole('menuitem', { name: /go to unknown collection/i })).toBeInTheDocument();
    });

    it('should NOT show "Go to" if onNavigateToMigrated is not provided', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          collections={mockCollections}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.queryByRole('menuitem', { name: /go to/i })).not.toBeInTheDocument();
    });

    it('should NOT show "Go to" if collections is not provided', () => {
      const migratedTask: Entry & { type: 'task' } = {
        ...mockEntry,
        migratedTo: 'task-2',
        migratedToCollectionId: 'col-1',
      };

      render(
        <EntryActionsMenu
          entry={migratedTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.queryByRole('menuitem', { name: /go to/i })).not.toBeInTheDocument();
    });
  });
});
