import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskItem } from './TaskItem';
import type { Task } from '@squickr/shared';

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Buy milk',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  it('should render task title', () => {
    render(<TaskItem task={mockTask} />);
    
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });

  it('should render task status', () => {
    render(<TaskItem task={mockTask} />);
    
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it('should format timestamp as relative time', () => {
    const task: Task = {
      id: 'task-1',
      title: 'Test task',
      createdAt: new Date().toISOString(), // Just now
      status: 'open',
    };

    render(<TaskItem task={task} />);
    
    // Should show "just now" or similar
    expect(screen.getByText(/just now|seconds ago/i)).toBeInTheDocument();
  });
});
