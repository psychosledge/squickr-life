import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntryItem } from './EntryItem';
import type { Entry } from '@squickr/shared';

describe('EntryItem', () => {
  const mockOnCompleteTask = vi.fn();
  const mockOnReopenTask = vi.fn();
  const mockOnUpdateTaskTitle = vi.fn();
  const mockOnUpdateNoteContent = vi.fn();
  const mockOnUpdateEventContent = vi.fn();
  const mockOnUpdateEventDate = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task entries', () => {
    const mockOpenTask: Entry = {
      type: 'task',
      id: 'task-1',
      title: 'Buy milk',
      createdAt: '2026-01-24T10:00:00.000Z',
      status: 'open',
    };

    const mockCompletedTask: Entry = {
      type: 'task',
      id: 'task-2',
      title: 'Write tests',
      createdAt: '2026-01-24T10:00:00.000Z',
      status: 'completed',
      completedAt: '2026-01-24T10:30:00.000Z',
    };

    it('should render task with checkbox bullet', () => {
      render(
        <EntryItem 
          entry={mockOpenTask} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText('☐')).toBeInTheDocument();
      expect(screen.getByText('Buy milk')).toBeInTheDocument();
    });

    it('should render completed task with checked bullet', () => {
      render(
        <EntryItem 
          entry={mockCompletedTask} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText('☑')).toBeInTheDocument();
    });

    it('should show Complete button for open tasks', () => {
      render(
        <EntryItem 
          entry={mockOpenTask} 
          onCompleteTask={mockOnCompleteTask}
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /complete task/i });
      expect(button).toBeInTheDocument();
    });

    it('should show Reopen button for completed tasks', () => {
      render(
        <EntryItem 
          entry={mockCompletedTask} 
          onReopenTask={mockOnReopenTask}
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /reopen task/i });
      expect(button).toBeInTheDocument();
    });

    it('should call onCompleteTask when Complete button is clicked', () => {
      render(
        <EntryItem 
          entry={mockOpenTask} 
          onCompleteTask={mockOnCompleteTask}
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /complete task/i });
      fireEvent.click(button);

      expect(mockOnCompleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should call onReopenTask when Reopen button is clicked', () => {
      render(
        <EntryItem 
          entry={mockCompletedTask} 
          onReopenTask={mockOnReopenTask}
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /reopen task/i });
      fireEvent.click(button);

      expect(mockOnReopenTask).toHaveBeenCalledWith('task-2');
    });

    it('should apply strikethrough to completed task', () => {
      render(
        <EntryItem 
          entry={mockCompletedTask} 
          onDelete={mockOnDelete}
        />
      );
      
      const title = screen.getByText('Write tests');
      expect(title).toHaveClass('line-through');
    });

    it('should show completion timestamp for completed tasks', () => {
      render(
        <EntryItem 
          entry={mockCompletedTask} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText(/• Completed/i)).toBeInTheDocument();
    });
  });

  describe('Note entries', () => {
    const mockNote: Entry = {
      type: 'note',
      id: 'note-1',
      content: 'Important meeting notes',
      createdAt: '2026-01-24T10:00:00.000Z',
    };

    it('should render note with dash bullet', () => {
      render(
        <EntryItem 
          entry={mockNote} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.getByText('Important meeting notes')).toBeInTheDocument();
    });

    it('should not show Complete/Reopen buttons for notes', () => {
      render(
        <EntryItem 
          entry={mockNote} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.queryByRole('button', { name: /complete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
    });
  });

  describe('Event entries', () => {
    const mockEvent: Entry = {
      type: 'event',
      id: 'event-1',
      content: 'Team meeting',
      createdAt: '2026-01-24T10:00:00.000Z',
      eventDate: '2026-02-15',
    };

    const mockEventNoDate: Entry = {
      type: 'event',
      id: 'event-2',
      content: 'Someday event',
      createdAt: '2026-01-24T10:00:00.000Z',
    };

    it('should render event with circle bullet', () => {
      render(
        <EntryItem 
          entry={mockEvent} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('Team meeting')).toBeInTheDocument();
    });

    it('should display event date when provided', () => {
      render(
        <EntryItem 
          entry={mockEvent} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText(/📅/)).toBeInTheDocument();
      expect(screen.getByText(/February 15, 2026/i)).toBeInTheDocument();
    });

    it('should not display date when not provided', () => {
      render(
        <EntryItem 
          entry={mockEventNoDate} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.queryByText(/📅/)).not.toBeInTheDocument();
    });
  });

  describe('Common functionality', () => {
    const mockTask: Entry = {
      type: 'task',
      id: 'task-1',
      title: 'Test task',
      createdAt: '2026-01-24T10:00:00.000Z',
      status: 'open',
    };

    it('should show Delete button for all entry types', () => {
      render(
        <EntryItem 
          entry={mockTask} 
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /delete/i });
      expect(button).toBeInTheDocument();
    });

    it('should call onDelete when Delete button is clicked', () => {
      render(
        <EntryItem 
          entry={mockTask} 
          onDelete={mockOnDelete}
        />
      );
      
      const button = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(button);

      expect(mockOnDelete).toHaveBeenCalledWith('task-1');
    });

    it('should format timestamp as relative time', () => {
      const recentTask: Entry = {
        type: 'task',
        id: 'task-1',
        title: 'Recent task',
        createdAt: new Date().toISOString(),
        status: 'open',
      };

      render(
        <EntryItem 
          entry={recentTask} 
          onDelete={mockOnDelete}
        />
      );
      
      expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
    });
  });

  describe('Editing', () => {
    const mockTask: Entry = {
      type: 'task',
      id: 'task-1',
      title: 'Editable task',
      createdAt: '2026-01-24T10:00:00.000Z',
      status: 'open',
    };

    it('should enter edit mode on double-click for tasks', () => {
      render(
        <EntryItem 
          entry={mockTask} 
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
          onDelete={mockOnDelete}
        />
      );
      
      const title = screen.getByText('Editable task');
      fireEvent.doubleClick(title);
      
      const input = screen.getByDisplayValue('Editable task');
      expect(input).toBeInTheDocument();
    });

    it('should not enter edit mode if no update handler is provided', () => {
      render(
        <EntryItem 
          entry={mockTask} 
          onDelete={mockOnDelete}
        />
      );
      
      const title = screen.getByText('Editable task');
      fireEvent.doubleClick(title);
      
      expect(screen.queryByDisplayValue('Editable task')).not.toBeInTheDocument();
    });
  });
});
