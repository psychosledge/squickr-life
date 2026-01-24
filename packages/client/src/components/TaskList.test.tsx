import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskList } from './TaskList';
import type { Task } from '@squickr/shared';

describe('TaskList', () => {
  it('should render empty state when no tasks', () => {
    render(<TaskList tasks={[]} />);
    
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('should render list of tasks', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
      {
        id: 'task-2',
        title: 'Walk the dog',
        createdAt: '2026-01-24T10:01:00.000Z',
        status: 'open',
      },
    ];

    render(<TaskList tasks={tasks} />);
    
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Walk the dog')).toBeInTheDocument();
  });

  it('should display task count', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Task 1',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
      {
        id: 'task-2',
        title: 'Task 2',
        createdAt: '2026-01-24T10:01:00.000Z',
        status: 'open',
      },
    ];

    render(<TaskList tasks={tasks} />);
    
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument();
  });

  it('should display singular "task" for one item', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Single task',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
    ];

    render(<TaskList tasks={tasks} />);
    
    expect(screen.getByText(/1 task/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 tasks/i)).not.toBeInTheDocument();
  });
});
