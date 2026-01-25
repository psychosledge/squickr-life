import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterButtons } from './FilterButtons';
import type { EntryFilter } from '@squickr/shared';

describe('FilterButtons', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    mockOnFilterChange.mockClear();
  });

  it('should render all filter buttons', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^tasks$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^notes$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^events$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^completed$/i })).toBeInTheDocument();
  });

  it('should highlight the "all" button when currentFilter is "all"', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /^all$/i });
    expect(allButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "tasks" button when currentFilter is "tasks"', () => {
    render(<FilterButtons currentFilter="tasks" onFilterChange={mockOnFilterChange} />);
    
    const tasksButton = screen.getByRole('button', { name: /^tasks$/i });
    expect(tasksButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "notes" button when currentFilter is "notes"', () => {
    render(<FilterButtons currentFilter="notes" onFilterChange={mockOnFilterChange} />);
    
    const notesButton = screen.getByRole('button', { name: /^notes$/i });
    expect(notesButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "events" button when currentFilter is "events"', () => {
    render(<FilterButtons currentFilter="events" onFilterChange={mockOnFilterChange} />);
    
    const eventsButton = screen.getByRole('button', { name: /^events$/i });
    expect(eventsButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "open-tasks" button when currentFilter is "open-tasks"', () => {
    render(<FilterButtons currentFilter="open-tasks" onFilterChange={mockOnFilterChange} />);
    
    const openTasksButton = screen.getByRole('button', { name: /open tasks/i });
    expect(openTasksButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "completed-tasks" button when currentFilter is "completed-tasks"', () => {
    render(<FilterButtons currentFilter="completed-tasks" onFilterChange={mockOnFilterChange} />);
    
    const completedButton = screen.getByRole('button', { name: /^completed$/i });
    expect(completedButton).toHaveClass('bg-blue-600');
  });

  it('should call onFilterChange with "all" when All button is clicked', () => {
    render(<FilterButtons currentFilter="tasks" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /^all$/i });
    fireEvent.click(allButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('all');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "tasks" when Tasks button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const tasksButton = screen.getByRole('button', { name: /^tasks$/i });
    fireEvent.click(tasksButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('tasks');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "notes" when Notes button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const notesButton = screen.getByRole('button', { name: /^notes$/i });
    fireEvent.click(notesButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('notes');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "events" when Events button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const eventsButton = screen.getByRole('button', { name: /^events$/i });
    fireEvent.click(eventsButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('events');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "completed-tasks" when Completed button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const completedButton = screen.getByRole('button', { name: /^completed$/i });
    fireEvent.click(completedButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('completed-tasks');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should not highlight inactive buttons', () => {
    render(<FilterButtons currentFilter="tasks" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /^all$/i });
    const notesButton = screen.getByRole('button', { name: /^notes$/i });
    
    expect(allButton).toHaveClass('bg-gray-200');
    expect(notesButton).toHaveClass('bg-gray-200');
  });
});
