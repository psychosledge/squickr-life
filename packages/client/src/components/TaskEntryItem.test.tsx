import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEntryItem } from './TaskEntryItem';
import type { Entry } from '@squickr/shared';

describe('TaskEntryItem', () => {
  const mockOnCompleteTask = vi.fn();
  const mockOnReopenTask = vi.fn();
  const mockOnUpdateTaskTitle = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOpenTask: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-1',
    title: 'Buy milk',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  const mockCompletedTask: Entry & { type: 'task' } = {
    type: 'task',
    id: 'task-2',
    title: 'Write tests',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'completed',
    completedAt: '2026-01-24T10:30:00.000Z',
  };

  it('should render task with bullet icon', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('•')).toBeInTheDocument();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render completed task with X bullet', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('should show bullet for open tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onCompleteTask={mockOnCompleteTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /open task.*complete/i });
    expect(bullet).toBeInTheDocument();
    expect(bullet).toHaveTextContent('•');
  });

  it('should show X bullet for completed tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onReopenTask={mockOnReopenTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /completed task.*reopen/i });
    expect(bullet).toBeInTheDocument();
    expect(bullet).toHaveTextContent('×');
  });

  it('should call onCompleteTask when bullet is clicked for open task', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onCompleteTask={mockOnCompleteTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /open task.*complete/i });
    fireEvent.click(bullet);

    expect(mockOnCompleteTask).toHaveBeenCalledWith('task-1');
  });

  it('should call onReopenTask when bullet is clicked for completed task', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onReopenTask={mockOnReopenTask}
        onDelete={mockOnDelete}
      />
    );
    
    const bullet = screen.getByRole('button', { name: /completed task.*reopen/i });
    fireEvent.click(bullet);

    expect(mockOnReopenTask).toHaveBeenCalledWith('task-2');
  });

  it('should apply strikethrough to completed task', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const title = screen.getByText('Write tests');
    expect(title).toHaveClass('line-through');
  });

  it('should show completion timestamp for completed tasks', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/• Completed/i)).toBeInTheDocument();
  });

  it('should call onDelete when trash icon is clicked', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete entry/i });
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('task-1');
  });

  it('should enter edit mode on double-click when update handler provided', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onDelete={mockOnDelete}
      />
    );
    
    const title = screen.getByText('Buy milk');
    fireEvent.doubleClick(title);
    
    const input = screen.getByDisplayValue('Buy milk');
    expect(input).toBeInTheDocument();
  });

  it('should not enter edit mode if no update handler is provided', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const title = screen.getByText('Buy milk');
    fireEvent.doubleClick(title);
    
    expect(screen.queryByDisplayValue('Buy milk')).not.toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const recentTask: Entry & { type: 'task' } = {
      type: 'task',
      id: 'task-1',
      title: 'Recent task',
      createdAt: new Date().toISOString(),
      status: 'open',
    };

    render(
      <TaskEntryItem 
        entry={recentTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });

  it('should not display status badge', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    // Status badge should not be present
    expect(screen.queryByText('open')).not.toBeInTheDocument();
    
    // But bullet should still be visible
    expect(screen.getByText('•')).toBeInTheDocument();
  });
});
