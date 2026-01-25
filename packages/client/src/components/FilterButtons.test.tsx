import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterButtons } from './FilterButtons';
import type { TaskFilter } from '@squickr/shared';

describe('FilterButtons', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    mockOnFilterChange.mockClear();
  });

  it('should render all three filter buttons', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument();
  });

  it('should highlight the "all" button when currentFilter is "all"', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /all/i });
    expect(allButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "open" button when currentFilter is "open"', () => {
    render(<FilterButtons currentFilter="open" onFilterChange={mockOnFilterChange} />);
    
    const openButton = screen.getByRole('button', { name: /open/i });
    expect(openButton).toHaveClass('bg-blue-600');
  });

  it('should highlight the "completed" button when currentFilter is "completed"', () => {
    render(<FilterButtons currentFilter="completed" onFilterChange={mockOnFilterChange} />);
    
    const completedButton = screen.getByRole('button', { name: /completed/i });
    expect(completedButton).toHaveClass('bg-blue-600');
  });

  it('should call onFilterChange with "all" when All button is clicked', () => {
    render(<FilterButtons currentFilter="open" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /all/i });
    fireEvent.click(allButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('all');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "open" when Open button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const openButton = screen.getByRole('button', { name: /open/i });
    fireEvent.click(openButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('open');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should call onFilterChange with "completed" when Completed button is clicked', () => {
    render(<FilterButtons currentFilter="all" onFilterChange={mockOnFilterChange} />);
    
    const completedButton = screen.getByRole('button', { name: /completed/i });
    fireEvent.click(completedButton);
    
    expect(mockOnFilterChange).toHaveBeenCalledWith('completed');
    expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
  });

  it('should not highlight inactive buttons', () => {
    render(<FilterButtons currentFilter="open" onFilterChange={mockOnFilterChange} />);
    
    const allButton = screen.getByRole('button', { name: /all/i });
    const completedButton = screen.getByRole('button', { name: /completed/i });
    
    expect(allButton).toHaveClass('bg-gray-200');
    expect(completedButton).toHaveClass('bg-gray-200');
  });
});
