import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntryItem } from './EntryItem';
import type { Entry } from '@squickr/shared';

describe('EntryItem', () => {
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type dispatching', () => {
    it('should render TaskEntryItem for task entries', () => {
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      };

      render(
        <EntryItem 
          entry={mockTask} 
          onDelete={mockOnDelete}
        />
      );
      
      // Task-specific elements
      expect(screen.getByText('☐')).toBeInTheDocument();
      expect(screen.getByText('Buy milk')).toBeInTheDocument();
    });

    it('should render NoteEntryItem for note entries', () => {
      const mockNote: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Important meeting notes',
        createdAt: '2026-01-24T10:00:00.000Z',
      };

      render(
        <EntryItem 
          entry={mockNote} 
          onDelete={mockOnDelete}
        />
      );
      
      // Note-specific elements
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.getByText('Important meeting notes')).toBeInTheDocument();
    });

    it('should render EventEntryItem for event entries', () => {
      const mockEvent: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Team meeting',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
      };

      render(
        <EntryItem 
          entry={mockEvent} 
          onDelete={mockOnDelete}
        />
      );
      
      // Event-specific elements
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('Team meeting')).toBeInTheDocument();
      expect(screen.getByText(/📅/)).toBeInTheDocument();
    });
  });

  describe('Props forwarding', () => {
    it('should forward task-specific props to TaskEntryItem', () => {
      const mockOnCompleteTask = vi.fn();
      const mockTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Test task',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      };

      render(
        <EntryItem 
          entry={mockTask} 
          onCompleteTask={mockOnCompleteTask}
          onDelete={mockOnDelete}
        />
      );
      
      // TaskEntryItem should render Complete button
      expect(screen.getByRole('button', { name: /complete task/i })).toBeInTheDocument();
    });

    it('should forward note-specific props to NoteEntryItem', () => {
      const mockOnUpdateNoteContent = vi.fn();
      const mockNote: Entry = {
        type: 'note',
        id: 'note-1',
        content: 'Test note',
        createdAt: '2026-01-24T10:00:00.000Z',
      };

      render(
        <EntryItem 
          entry={mockNote} 
          onUpdateNoteContent={mockOnUpdateNoteContent}
          onDelete={mockOnDelete}
        />
      );
      
      // NoteEntryItem should render with edit capability
      const content = screen.getByText('Test note');
      expect(content).toHaveClass('cursor-pointer');
    });

    it('should forward event-specific props to EventEntryItem', () => {
      const mockOnUpdateEventContent = vi.fn();
      const mockEvent: Entry = {
        type: 'event',
        id: 'event-1',
        content: 'Test event',
        createdAt: '2026-01-24T10:00:00.000Z',
      };

      render(
        <EntryItem 
          entry={mockEvent} 
          onUpdateEventContent={mockOnUpdateEventContent}
          onDelete={mockOnDelete}
        />
      );
      
      // EventEntryItem should render with edit capability
      const content = screen.getByText('Test event');
      expect(content).toHaveClass('cursor-pointer');
    });
  });
});
