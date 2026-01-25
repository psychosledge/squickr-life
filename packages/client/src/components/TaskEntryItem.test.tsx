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

  it('should render task with checkbox bullet', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('☐')).toBeInTheDocument();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render completed task with checked bullet', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('☑')).toBeInTheDocument();
  });

  it('should show Complete button for open tasks', () => {
    render(
      <TaskEntryItem 
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
      <TaskEntryItem 
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
      <TaskEntryItem 
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
      <TaskEntryItem 
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

  it('should call onDelete when Delete button is clicked', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    const button = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(button);

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

  it('should display status badge', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('open')).toBeInTheDocument();
  });
});
