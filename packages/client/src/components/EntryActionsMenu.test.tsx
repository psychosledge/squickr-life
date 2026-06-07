import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EntryActionsMenu } from './EntryActionsMenu';
import type { Entry } from '@squickr/domain';

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
    content: 'Test task',
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

  it('should show Migrate option in menu', () => {
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

    expect(screen.getByRole('menuitem', { name: /^migrate$/i })).toBeInTheDocument();
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

  it('should call onMove when Migrate is clicked', () => {
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

    const moveButton = screen.getByRole('menuitem', { name: /^migrate$/i });
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

    const moveButton = screen.getByRole('menuitem', { name: /^migrate$/i });
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

  it('should NOT close immediately after opening (regression test)', async () => {
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

    // Menu should be open immediately after clicking
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Wait a bit to ensure it doesn't close immediately
    await new Promise(resolve => setTimeout(resolve, 50));

    // Menu should STILL be open
    expect(screen.getByRole('menu')).toBeInTheDocument();
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

    // Flush the setTimeout(0) that registers the outside-click listener
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

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

    // Wait for event listeners to be registered (setTimeout in useEffect)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu when scrolling starts', async () => {
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

    // Wait for event listeners to be registered (setTimeout in useEffect)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Simulate scroll event on window
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close menu when scrolling on a scrollable element', async () => {
    const { container } = render(
      <div style={{ height: '200px', overflow: 'auto' }} data-testid="scrollable">
        <div style={{ height: '500px' }}>
          <EntryActionsMenu
            entry={mockEntry}
            onEdit={mockOnEdit}
            onMove={mockOnMove}
            onDelete={mockOnDelete}
          />
        </div>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Wait for event listeners to be registered (setTimeout in useEffect)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Simulate scroll event on scrollable container
    const scrollable = screen.getByTestId('scrollable');
    fireEvent.scroll(scrollable);

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
    // Menu should be positioned with fixed positioning (rendered in portal)
    expect(menu).toHaveClass('fixed');
  });

  it('should render menu with high z-index to prevent overlapping', () => {
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
    // Menu should have z-[150] to appear above entry items but below full-page modals
    expect(menu).toHaveClass('z-[150]');
  });

  it('should render menu in document.body portal', () => {
    const { container } = render(
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
    // Menu should be rendered in document.body (not in the component's container)
    expect(container.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
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

  // ============================================================================
  // Sub-Task Menu Tests (Regression: Sub-task menus closing immediately)
  // ============================================================================

  describe('Sub-task menus', () => {
    const mockSubTask: Entry & { type: 'task' } = {
      type: 'task',
      id: 'subtask-1',
      content: 'Sub-task',
      createdAt: '2026-01-24T10:00:00.000Z',
      status: 'open',
      parentEntryId: 'parent-1', // This makes it a sub-task
    };

    it('should open menu for sub-task entries', () => {
      render(
        <EntryActionsMenu
          entry={mockSubTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          isSubTask={true}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should NOT close immediately after opening for sub-tasks (regression test)', async () => {
      render(
        <EntryActionsMenu
          entry={mockSubTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          isSubTask={true}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      // Menu should be open immediately after clicking
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Wait for event listeners to be registered and any potential side effects
      await new Promise(resolve => setTimeout(resolve, 50));

      // Menu should STILL be open (regression: used to close immediately for sub-tasks)
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should handle clicks on sub-task menu when rendered with wrapper divs', async () => {
      // Simulate the actual DOM structure from EntryList.tsx where sub-tasks are wrapped
      const { container } = render(
        <div className="pl-8 space-y-2 mt-2">
          <div>
            <EntryActionsMenu
              entry={mockSubTask}
              onEdit={mockOnEdit}
              onMove={mockOnMove}
              onDelete={mockOnDelete}
              isSubTask={true}
            />
          </div>
        </div>
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Wait for event listeners to be registered
      await new Promise(resolve => setTimeout(resolve, 10));

      // Click on the wrapper div (not the button itself)
      const wrapperDiv = container.querySelector('div.pl-8');
      if (wrapperDiv) {
        fireEvent.mouseDown(wrapperDiv);
      }

      // Menu should close when clicking the wrapper (outside the menu/button)
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should NOT show "Add Sub-Task" option for sub-tasks (2-level limit)', () => {
      const mockOnAddSubTask = vi.fn();
      
      render(
        <EntryActionsMenu
          entry={mockSubTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          isSubTask={true}
          onAddSubTask={mockOnAddSubTask}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      // Sub-tasks should NOT have "Add Sub-Task" option (2-level limit)
      expect(screen.queryByRole('menuitem', { name: /add sub-task/i })).not.toBeInTheDocument();
    });

    it('should show all standard options for sub-tasks', () => {
      render(
        <EntryActionsMenu
          entry={mockSubTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          isSubTask={true}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      // Sub-tasks should still have Edit, Migrate, and Delete
      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^migrate$/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
    });

    it('should handle migrated sub-tasks correctly', () => {
      const mockCollections = [
        { id: 'col-1', name: 'Work', type: 'log' as const, order: 'a0', createdAt: '2026-01-20T10:00:00.000Z' },
      ];
      const mockOnNavigateToMigrated = vi.fn();

      const migratedSubTask: Entry & { type: 'task' } = {
        ...mockSubTask,
        collections: ['col-1'],
      };

      render(
        <EntryActionsMenu
          entry={migratedSubTask}
          onEdit={mockOnEdit}
          onMove={mockOnMove}
          onDelete={mockOnDelete}
          isSubTask={true}
          collections={mockCollections}
          onNavigateToMigrated={mockOnNavigateToMigrated}
        />
      );

      const trigger = screen.getByRole('button', { name: /actions/i });
      fireEvent.click(trigger);

      // Should show "Go to [Collection]" for migrated sub-tasks
      expect(screen.getByRole('menuitem', { name: /go to work/i })).toBeInTheDocument();
    });
  });
});

// ============================================================================
// "Remove from this collection" Menu Item Tests (Bug #7)
// ============================================================================

describe('EntryActionsMenu - Remove from this collection', () => {
  const mockOnEdit = vi.fn();
  const mockOnMove = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnRemoveFromCollection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTaskEntry: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    content: 'Test task',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  it('should NOT show "Remove from this collection" when onRemoveFromCollection is not provided', () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole('menuitem', { name: /remove from this collection/i })).not.toBeInTheDocument();
  });

  it('should NOT show "Remove from this collection" for a ghost entry (even if prop provided)', () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onRemoveFromCollection={mockOnRemoveFromCollection}
        isGhost={true}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole('menuitem', { name: /remove from this collection/i })).not.toBeInTheDocument();
  });

  it('should NOT show "Remove from this collection" for a deleted entry (even if prop provided)', () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onRemoveFromCollection={mockOnRemoveFromCollection}
        isDeleted={true}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.queryByRole('menuitem', { name: /remove from this collection/i })).not.toBeInTheDocument();
  });

  it('should show "Remove from this collection" when onRemoveFromCollection is provided and entry is a task (not ghost, not deleted)', () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onRemoveFromCollection={mockOnRemoveFromCollection}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('menuitem', { name: /remove from this collection/i })).toBeInTheDocument();
  });

  it('should call onRemoveFromCollection when the menu item is clicked', () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onRemoveFromCollection={mockOnRemoveFromCollection}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const removeBtn = screen.getByRole('menuitem', { name: /remove from this collection/i });
    fireEvent.click(removeBtn);

    expect(mockOnRemoveFromCollection).toHaveBeenCalledTimes(1);
  });

  it('should close the menu after clicking "Remove from this collection"', async () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onRemoveFromCollection={mockOnRemoveFromCollection}
      />
    );

    const trigger = screen.getByRole('button', { name: /actions/i });
    fireEvent.click(trigger);

    const removeBtn = screen.getByRole('menuitem', { name: /remove from this collection/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Set reminder menu item (ADR-029)
// ---------------------------------------------------------------------------

describe('EntryActionsMenu — Set reminder', () => {
  const mockOnEdit = vi.fn();
  const mockOnMove = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSetReminder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTaskEntry: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    content: 'Test task',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  const mockNoteEntry: Entry & { type: 'note' } = {
    type: 'note',
    id: 'note-1',
    content: 'Test note',
    createdAt: '2026-01-24T10:00:00.000Z',
  };

  it('"Set reminder" is visible when onSetReminder provided for a non-deleted task', async () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onSetReminder={mockOnSetReminder}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /set reminder/i })).toBeInTheDocument();
    });
  });

  it('"Set reminder" is NOT visible when onSetReminder is absent', async () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /set reminder/i })).not.toBeInTheDocument();
    });
  });

  it('"Set reminder" is NOT visible for non-task entries', async () => {
    render(
      <EntryActionsMenu
        entry={mockNoteEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onSetReminder={mockOnSetReminder}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: /set reminder/i })).not.toBeInTheDocument();
    });
  });

  it('calls onSetReminder and closes menu when "Set reminder" is clicked', async () => {
    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
        onSetReminder={mockOnSetReminder}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /set reminder/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /set reminder/i }));
    await waitFor(() => {
      expect(mockOnSetReminder).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// Menu viewport positioning (flip-upward when near the bottom of the screen)
// ============================================================================

describe('EntryActionsMenu — menu viewport positioning', () => {
  const mockOnEdit = vi.fn();
  const mockOnMove = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  const mockTaskEntry: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    content: 'Test task',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  it('positions the menu below the trigger when there is enough space below', () => {
    // Trigger sits near the top of a 768px viewport — plenty of space below.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 132,
      left: 600,
      right: 760,
      width: 160,
      height: 32,
      x: 600,
      y: 100,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /actions/i }));

    const menu = screen.getByRole('menu');
    // Expected downward position: rect.bottom + 4 = 132 + 4 = 136
    expect(menu.style.top).toBe('136px');
  });

  it('flips the menu upward when the trigger is near the bottom of the viewport', () => {
    // Trigger sits near the bottom: rect.bottom = 740 on a 768px viewport.
    // spaceBelow = 768 - 740 - 4 = 24, which is less than MENU_MAX_HEIGHT (300).
    // rect.top = 708, which is greater than spaceBelow (24) → flip upward.
    // Expected upward position: rect.top - MENU_MAX_HEIGHT = 708 - 300 = 408
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 708,
      bottom: 740,
      left: 600,
      right: 760,
      width: 160,
      height: 32,
      x: 600,
      y: 708,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

    render(
      <EntryActionsMenu
        entry={mockTaskEntry}
        onEdit={mockOnEdit}
        onMove={mockOnMove}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /actions/i }));

    const menu = screen.getByRole('menu');
    // Expected upward position: rect.top - MENU_MAX_HEIGHT = 708 - 300 = 408
    expect(menu.style.top).toBe('408px');
  });
});
