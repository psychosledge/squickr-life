import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventEntryItem } from './EventEntryItem';
import type { Entry } from '@squickr/shared';

describe('EventEntryItem', () => {
  const mockOnUpdateEventContent = vi.fn();
  const mockOnUpdateEventDate = vi.fn();
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

  const mockEventNoDate: Entry & { type: 'event' } = {
    type: 'event',
    id: 'event-2',
    content: 'Someday event',
    createdAt: '2026-01-24T10:00:00.000Z',
  };

  it('should render event with circle bullet', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('○')).toBeInTheDocument();
    expect(screen.getByText('Team meeting')).toBeInTheDocument();
  });

  it('should display event date when provided', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/📅/)).toBeInTheDocument();
    expect(screen.getByText(/February 15, 2026/i)).toBeInTheDocument();
  });

  it('should not display date when not provided', () => {
    render(
      <EventEntryItem 
        entry={mockEventNoDate} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.queryByText(/📅/)).not.toBeInTheDocument();
  });

  it('should call onDelete when Delete button is clicked', () => {
    render(
      <EventEntryItem 
        entry={mockEvent} 
        onDelete={mockOnDelete}
      />
    );
    
    const button = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(button);

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
});
