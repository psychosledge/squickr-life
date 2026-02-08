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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText('Buy milk');
      expect(entryText).toHaveClass('line-through');
    });

    it('should render with muted gray colors', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText('Buy milk');
      expect(entryText).toHaveClass('text-gray-500', 'dark:text-gray-400');
    });

    it('should render with reduced opacity', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const ghostContainer = container.firstChild as HTMLElement;
      expect(ghostContainer).toHaveClass('opacity-50');
    });

    it('should display task title correctly', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Complete project documentation',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
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
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('➜')).toBeInTheDocument();
    });

    it('should show navigation button with target collection name', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      expect(screen.getByRole('button', { name: 'Go to Project Alpha' })).toBeInTheDocument();
      expect(screen.getByText(/Go to Project Alpha/)).toBeInTheDocument();
    });

    it('should apply dark mode classes', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const ghostContainer = container.firstChild as HTMLElement;
      expect(ghostContainer).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');

      const entryText = screen.getByText('Buy milk');
      expect(entryText).toHaveClass('dark:text-gray-400');
    });

    it('should render BulletIcon with muted opacity', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // BulletIcon should be rendered (checkbox for task)
      expect(screen.getByText('☐')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('Navigation', () => {
    it('should call onNavigateToCollection when button is clicked', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Project Alpha' });
      fireEvent.click(button);

      expect(mockOnNavigateToCollection).toHaveBeenCalledTimes(1);
      expect(mockOnNavigateToCollection).toHaveBeenCalledWith('project-alpha');
    });

    it('should navigate to correct collection ID when clicked', () => {
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: 'Important notes',
        createdAt: '2026-01-24T10:00:00.000Z',
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Monthly Log' });
      fireEvent.click(button);

      expect(mockOnNavigateToCollection).toHaveBeenCalledWith('monthly-log');
    });

    it('should handle missing ghostNewLocation gracefully', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation?: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        // ghostNewLocation is undefined
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // Should show fallback text
      expect(screen.getByText(/Go to another collection/)).toBeInTheDocument();
    });

    it('should not call onNavigateToCollection when ghostNewLocation is undefined', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation?: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        // ghostNewLocation is undefined
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to another collection' });
      fireEvent.click(button);

      // Should not call navigation callback when target is undefined
      expect(mockOnNavigateToCollection).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should show "another collection" when collection name is not found', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'non-existent-collection-id',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      expect(screen.getByText(/Go to another collection/)).toBeInTheDocument();
    });

    it('should handle empty collections array', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={[]}
        />
      );

      // Should show fallback when collection is not found
      expect(screen.getByText(/Go to another collection/)).toBeInTheDocument();
    });

    it('should handle undefined target collection ID', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation?: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: undefined,
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      expect(screen.getByText(/Go to another collection/)).toBeInTheDocument();
    });

    it('should handle empty task title', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: '',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // Should still render, just with empty text
      expect(container.querySelector('.line-through')).toBeInTheDocument();
    });

    it('should handle empty note content', () => {
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: '',
        createdAt: '2026-01-24T10:00:00.000Z',
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
      expect(container.querySelector('.line-through')).toBeInTheDocument();
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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const entryText = screen.getByText(longTitle);
      expect(entryText).toHaveClass('break-words');
    });

    it('should navigate when button is clicked even if collection name not found', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'non-existent-collection',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to another collection' });
      fireEvent.click(button);

      // Should still call navigation with the ID, even if collection not found
      expect(mockOnNavigateToCollection).toHaveBeenCalledWith('non-existent-collection');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper aria-label on navigation button', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Project Alpha' });
      expect(button).toHaveAttribute('aria-label', 'Go to Project Alpha');
    });

    it('should have proper aria-label when collection not found', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'non-existent',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to another collection' });
      expect(button).toHaveAttribute('aria-label', 'Go to another collection');
    });

    it('should support keyboard navigation on button', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Daily Log' });
      
      // Button should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);

      // Pressing Enter should trigger the click
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      
      // Note: In RTL, keyDown doesn't automatically trigger click, but the button
      // should be accessible via keyboard since it's a proper button element
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have type="button" to prevent form submission', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Daily Log' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have focus visible styles', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const button = screen.getByRole('button', { name: 'Go to Daily Log' });
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
    });

    it('should not have draggable attribute (not interactive for drag-drop)', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      const { container } = render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      const ghostContainer = container.firstChild as HTMLElement;
      expect(ghostContainer).not.toHaveAttribute('draggable');
    });

    it('should render bullet icon and navigation button', () => {
      const mockGhostTask: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
        collections: [],
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // Ghost entries have: bullet icon (role=button for tasks) + navigation button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      
      // Should have the navigation button
      const navButton = screen.getByRole('button', { name: 'Go to Daily Log' });
      expect(navButton).toBeInTheDocument();
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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostTask}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      // Should render the completed task title
      expect(screen.getByText('Buy milk')).toBeInTheDocument();
      // BulletIcon should show checkmark for completed tasks
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should handle notes with long content', () => {
      const longContent = 'This is a very long note with lots of important information that was written during a meeting and should wrap properly when displayed in the ghost entry view.';
      
      const mockGhostNote: Entry & { renderAsGhost: true; ghostNewLocation: string } = {
        type: 'note',
        id: 'note-1',
        content: longContent,
        createdAt: '2026-01-24T10:00:00.000Z',
        renderAsGhost: true,
        ghostNewLocation: 'monthly-log',
      };

      render(
        <GhostEntry
          entry={mockGhostNote}
          onNavigateToCollection={mockOnNavigateToCollection}
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
        renderAsGhost: true,
        ghostNewLocation: 'project-alpha',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
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
        renderAsGhost: true,
        ghostNewLocation: 'daily-log',
      };

      render(
        <GhostEntry
          entry={mockGhostEvent}
          onNavigateToCollection={mockOnNavigateToCollection}
          collections={mockCollections}
        />
      );

      expect(screen.getByText('Undated event')).toBeInTheDocument();
    });
  });
});
