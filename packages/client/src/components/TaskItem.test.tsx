import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from './TaskItem';
import type { Task } from '@squickr/shared';

describe('TaskItem', () => {
  const mockOnComplete = vi.fn();
  const mockOnReopen = vi.fn();

  const mockOpenTask: Task = {
    id: 'task-1',
    title: 'Buy milk',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  const mockCompletedTask: Task = {
    id: 'task-2',
    title: 'Write tests',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'completed',
    completedAt: '2026-01-24T10:30:00.000Z',
  };

  it('should render task title', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render task status', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test task',
      createdAt: new Date().toISOString(), // Just now
      status: 'open',
    };

    render(<TaskItem task={task} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    // Should show "just now" or similar
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });

  it('should show Complete button for open tasks', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const button = screen.getByRole('button', { name: /complete task/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Complete');
  });

  it('should show Reopen button for completed tasks', () => {
    render(<TaskItem task={mockCompletedTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const button = screen.getByRole('button', { name: /reopen task/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Reopen');
  });

  it('should call onComplete when Complete button is clicked', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const button = screen.getByRole('button', { name: /complete task/i });
    fireEvent.click(button);

    expect(mockOnComplete).toHaveBeenCalledWith('task-1');
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('should call onReopen when Reopen button is clicked', () => {
    render(<TaskItem task={mockCompletedTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const button = screen.getByRole('button', { name: /reopen task/i });
    fireEvent.click(button);

    expect(mockOnReopen).toHaveBeenCalledWith('task-2');
    expect(mockOnReopen).toHaveBeenCalledTimes(1);
  });

  it('should apply strikethrough to completed task title', () => {
    render(<TaskItem task={mockCompletedTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const title = screen.getByText('Write tests');
    expect(title).toHaveClass('line-through');
  });

  it('should not apply strikethrough to open task title', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    const title = screen.getByText('Buy milk');
    expect(title).not.toHaveClass('line-through');
  });

  it('should display completion timestamp for completed tasks', () => {
    render(<TaskItem task={mockCompletedTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    // Look for the specific completion timestamp text
    expect(screen.getByText(/• Completed/i)).toBeInTheDocument();
  });

  it('should not display completion timestamp for open tasks', () => {
    render(<TaskItem task={mockOpenTask} onComplete={mockOnComplete} onReopen={mockOnReopen} />);
    
    // Look for the specific completion timestamp text
    expect(screen.queryByText(/• Completed/i)).not.toBeInTheDocument();
  });
});
