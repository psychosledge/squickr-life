import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventEntryItem } from './EventEntryItem';
import type { Entry } from '@squickr/domain';

describe('EventEntryItem', () => {
  const mockOnUpdateEventContent = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent: Entry & { type: 'event' } = {
    type: 'event',
    id: 'event-1',
    content: 'Team meeting',
    createdAt: '2026-01-24T10:00:00.000Z',
    eventDate: '2026-02-15',
  };

  it('should render event content', () => {
    render(
      <EventEntryItem
        entry={mockEvent}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Team meeting')).toBeInTheDocument();
  });

  it('should not display event date in view mode', () => {
    render(
      <EventEntryItem
        entry={mockEvent}
        onDelete={mockOnDelete}
      />
    );

    // The date text should not be rendered even when eventDate is present in the entry
    expect(screen.queryByText(/February 15, 2026/i)).not.toBeInTheDocument();
  });

  it('should call onDelete when Delete is clicked from menu', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    // Open the actions menu
    const menuButton = screen.getByRole('button', { name: /entry actions/i });
    fireEvent.click(menuButton);

    // Click Delete from the menu
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('event-1');
  });

  it('should enter edit mode on double-click when update handler provided', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onUpdateEventContent={mockOnUpdateEventContent}
        onDelete={mockOnDelete}
      />
    );
    
    const content = screen.getByText('Team meeting');
    fireEvent.doubleClick(content);
    
    const textarea = screen.getByDisplayValue('Team meeting');
    expect(textarea).toBeInTheDocument();
  });

  it('should not enter edit mode if no update handler is provided', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    const content = screen.getByText('Team meeting');
    fireEvent.doubleClick(content);
    
    expect(screen.queryByDisplayValue('Team meeting')).not.toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const recentEvent: Entry & { type: 'event' } = {
      type: 'event',
      id: 'event-1',
      content: 'Recent event',
      createdAt: new Date().toISOString(),
    };

    render(
      <EventEntryItem 
        entry={recentEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });

  it('should not show Complete/Reopen buttons', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('should not display a date input in edit mode', () => {
    render(
      <EventEntryItem
        entry={mockEvent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onDelete={mockOnDelete}
      />
    );

    // Enter edit mode
    const content = screen.getByText('Team meeting');
    fireEvent.doubleClick(content);

    // Textarea should appear (edit mode active)
    expect(screen.getByDisplayValue('Team meeting')).toBeInTheDocument();

    // Date input should NOT appear in edit mode
    expect(screen.queryByRole('textbox', { name: /date/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  describe('URL linkification', () => {
    it('renders a link when content contains a URL', () => {
      const eventWithUrl: Entry & { type: 'event' } = {
        ...mockEvent,
        content: 'See https://example.com for event info',
      };
      render(
        <EventEntryItem
          entry={eventWithUrl}
          onDelete={mockOnDelete}
        />
      );
      const link = screen.getByRole('link', { name: /https:\/\/example\.com/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render a link in edit mode', () => {
      const eventWithUrl: Entry & { type: 'event' } = {
        ...mockEvent,
        content: 'See https://example.com for event info',
      };
      render(
        <EventEntryItem
          entry={eventWithUrl}
          onUpdateEventContent={mockOnUpdateEventContent}
          onDelete={mockOnDelete}
        />
      );
      // Double-click to enter edit mode
      const link = screen.getByRole('link', { name: /https:\/\/example\.com/i });
      fireEvent.doubleClick(link);
      // In edit mode textarea should appear, no links
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
