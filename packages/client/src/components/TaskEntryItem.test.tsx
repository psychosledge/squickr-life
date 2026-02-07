import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEntryItem } from './TaskEntryItem';
import type { Entry } from '@squickr/domain';

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
    
    expect(screen.getByText('☐')).toBeInTheDocument();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render completed task with X bullet', () => {
    render(
      <TaskEntryItem 
        entry={mockCompletedTask} 
        onDelete={mockOnDelete}
      />
    );
    
    expect(screen.getByText('✓')).toBeInTheDocument();
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
    expect(bullet).toHaveTextContent('☐');
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
    expect(bullet).toHaveTextContent('✓');
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

  it('should call onDelete when Delete is clicked from menu', () => {
    render(
      <TaskEntryItem 
        entry={mockOpenTask} 
        onDelete={mockOnDelete}
      />
    );
    
    // Open the actions menu
    const menuButton = screen.getByRole('button', { name: /entry actions/i });
    fireEvent.click(menuButton);

    // Click Delete from the menu
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
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
    
    // Task should use bullet icon (☐) not a status badge
    expect(screen.getByText('☐')).toBeInTheDocument();
    
    // Should not have a separate status badge element
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });
});
