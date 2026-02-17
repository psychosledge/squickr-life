import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GhostEntry } from './GhostEntry';
import type { Entry, Collection } from '@squickr/domain';

describe('GhostEntry', () => {
  const mockCollections: Collection[] = [
    {
      id: 'daily-log',
      name: 'Daily Log',
      type: 'daily',
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a0',
    },
    {
      id: 'monthly-log',
      name: 'Monthly Log',
      type: 'monthly',
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a1',
    },
    {
      id: 'project-alpha',
      name: 'Project Alpha',
      type: 'custom',
      createdAt: '2026-01-24T10:00:00.000Z',
      order: 'a2',
    },
  ];

  const mockOnNavigateToCollection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Visual Rendering Tests
  // ============================================================================

  describe('Visual Rendering', () => {
    it('should render ghost styling with strikethrough', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText('Buy milk');
      expect(entryText).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('should render with muted gray colors', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText('Buy milk');
      expect(entryText).toHaveClass('text-gray-600', 'dark:text-gray-300');
    });

    it('should render with reduced opacity', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const ghostContainer = container.firstChild as HTMLElement;
      const opacityDiv = ghostContainer.children[0] as HTMLElement;
      expect(opacityDiv).toHaveClass('opacity-50');
    });

    it('should display task title correctly', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Complete project documentation',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    it('should display note content correctly', () => {
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: 'Important meeting notes from yesterday',
        createdAt: '2026-01-24T10:00:00.000Z',
        migratedTo: 'migrated-note-id', // Ghost entries are migrated notes
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Important meeting notes from yesterday')).toBeInTheDocument();
    });

    it('should display event content correctly', () => {
      const mockGhostEvent: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'event',
        id: 'event-1',
        content: 'Team standup meeting',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
        migratedTo: 'migrated-event-id', // Ghost entries are migrated events
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Team standup meeting')).toBeInTheDocument();
    });

    it('should show migration arrow (➜)', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('➜')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Context Menu Tests
  // ============================================================================

  describe('Context Menu', () => {
    it('should render EntryActionsMenu (three-dot menu)', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Should show three-dot menu button
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveTextContent('⋯');
    });

    it('should show "Go to [Collection]" option in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should show "Go to" option
      expect(screen.getByRole('menuitem', { name: 'Go to Project Alpha' })).toBeInTheDocument();
    });

    it('should show "Delete" option in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should show Delete option
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should NOT show Edit option in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should NOT show Edit option
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('should NOT show Migrate option in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should NOT show Migrate option
      expect(screen.queryByRole('menuitem', { name: 'Migrate' })).not.toBeInTheDocument();
    });

    it('should NOT show Add Sub-Task option in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should NOT show Add Sub-Task option
      expect(screen.queryByRole('menuitem', { name: 'Add Sub-Task' })).not.toBeInTheDocument();
    });

    it('should call onNavigateToCollection when "Go to" is clicked', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Click "Go to" option
      const goToButton = screen.getByRole('menuitem', { name: 'Go to Project Alpha' });
      fireEvent.click(goToButton);

      expect(mockOnNavigateToCollection).toHaveBeenCalledTimes(1);
      expect(mockOnNavigateToCollection).toHaveBeenCalledWith('project-alpha');
    });

    it('should call onDelete when "Delete" is clicked', () => {
      const mockOnDelete = vi.fn();
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={mockOnDelete}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Click Delete option
      const deleteButton = screen.getByRole('menuitem', { name: 'Delete' });
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('should NOT show "Go to" for current collection in menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        collectionHistory: [
          { 
            collectionId: 'project-alpha', 
            addedAt: '2026-01-20T10:00:00.000Z', 
            removedAt: '2026-01-24T10:00:00.000Z' 
          },
        ],
        migratedTo: 'migrated-task-id',
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
          currentCollectionId="project-alpha"  // Currently viewing Project Alpha
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);

      // Should NOT show "Go to Project Alpha" (we're already there!)
      expect(screen.queryByRole('menuitem', { name: 'Go to Project Alpha' })).not.toBeInTheDocument();
      
      // Should show "Go to Monthly Log" (where it migrated to)
      expect(screen.getByRole('menuitem', { name: 'Go to Monthly Log' })).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Navigation Tests (Legacy - Removed)
  // Navigation is now tested in the Context Menu Tests section above
  // ============================================================================

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should show context menu with "Go to" option when collection name is not found', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'non-existent-collection-id',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);
      
      // Should show "Go to Unknown Collection" as fallback
      expect(screen.getByRole('menuitem', { name: 'Go to Unknown Collection' })).toBeInTheDocument();
    });

    it('should handle empty collections array', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={[]}
        />
      );

      // Should still render with menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      expect(menuButton).toBeInTheDocument();
    });

    it('should handle undefined target collection ID', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation?: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: undefined,
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Should still render with menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      expect(menuButton).toBeInTheDocument();
    });

    it('should handle empty task title', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: '',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Should still render, just with empty text
      const styledDiv = container.querySelector('.break-words');
      expect(styledDiv).toBeInTheDocument();
      expect(styledDiv).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('should handle empty note content', () => {
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: '',
        createdAt: '2026-01-24T10:00:00.000Z',
        migratedTo: 'migrated-note-id', // Ghost entries are migrated notes
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // Should still render, just with empty text
      const styledDiv = container.querySelector('.break-words');
      expect(styledDiv).toBeInTheDocument();
      expect(styledDiv).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('should handle long entry text with word wrapping', () => {
      const longTitle = 'This is a very long task title that should wrap to multiple lines when rendered in the ghost entry component because it exceeds the available width';
      
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: longTitle,
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText(longTitle);
      expect(entryText).toHaveClass('break-words');
    });

    it('should navigate via menu when collection is not found', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'non-existent-collection',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);
      
      // Click "Go to" option (fallback to Unknown Collection)
      const goToButton = screen.getByRole('menuitem', { name: 'Go to Unknown Collection' });
      fireEvent.click(goToButton);

      // Should still call navigation with the ID, even if collection not found
      expect(mockOnNavigateToCollection).toHaveBeenCalledWith('non-existent-collection');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have accessible menu button', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      expect(menuButton).toHaveAttribute('aria-label', 'Entry actions');
      expect(menuButton).toHaveAttribute('aria-haspopup', 'true');
    });

    it('should have accessible menu items', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Open menu
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      fireEvent.click(menuButton);
      
      // Check menu items have proper roles
      expect(screen.getByRole('menuitem', { name: 'Go to Project Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should support keyboard navigation on menu button', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      
      // Button should be focusable
      menuButton.focus();
      expect(document.activeElement).toBe(menuButton);

      // Should be a proper button element
      expect(menuButton.tagName).toBe('BUTTON');
    });

    it('should not have draggable attribute (not interactive for drag-drop)', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      const ghostContainer = container.firstChild as HTMLElement;
      expect(ghostContainer).not.toHaveAttribute('draggable');
    });

    it('should render bullet icon and context menu', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Ghost entries have: bullet icon + context menu button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      
      // Should have the context menu button
      const menuButton = screen.getByRole('button', { name: 'Entry actions' });
      expect(menuButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Entry Type Coverage
  // ============================================================================

  describe('Entry Type Coverage', () => {
    it('should handle completed tasks', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'completed',
        completedAt: '2026-01-24T11:00:00.000Z',
        collections: [],
        migratedTo: 'migrated-task-id', // Ghost entries are migrated tasks
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      // Should render the completed task title
      expect(screen.getByText('Buy milk')).toBeInTheDocument();
      // BulletIcon should show arrow for migrated tasks (migration takes precedence over completion)
      expect(screen.getByText('➜')).toBeInTheDocument();
    });

    it('should handle notes with long content', () => {
      const longContent = 'This is a very long note with lots of important information that was written during a meeting and should wrap properly when displayed in the ghost entry view.';
      
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: longContent,
        createdAt: '2026-01-24T10:00:00.000Z',
        migratedTo: 'migrated-note-id', // Ghost entries are migrated notes
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle events with event dates', () => {
      const mockGhostEvent: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'event',
        id: 'event-1',
        content: 'Team meeting at 2pm',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
        migratedTo: 'migrated-event-id', // Ghost entries are migrated events
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Team meeting at 2pm')).toBeInTheDocument();
    });

    it('should handle events without event dates', () => {
      const mockGhostEvent: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'event',
        id: 'event-1',
        content: 'Undated event',
        createdAt: '2026-01-24T10:00:00.000Z',
        migratedTo: 'migrated-event-id', // Ghost entries are migrated events
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
          onDelete={vi.fn()}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Undated event')).toBeInTheDocument();
    });
  });
});
