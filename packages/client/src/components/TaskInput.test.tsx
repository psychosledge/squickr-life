import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskInput } from './TaskInput';

describe('TaskInput', () => {
  it('should render input field and add button', () => {
    render(<TaskInput onSubmit={async () => {}} />);
    
    expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('should call onSubmit with title when form is submitted', async () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith('Buy milk');
    });
  });

  it('should call onSubmit when Enter key is pressed', async () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    
    fireEvent.change(input, { target: { value: 'Test task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith('Test task');
    });
  });

  it('should clear input after submission', async () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i) as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: 'Test task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should not submit empty title', () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.click(button);
    
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should not submit whitespace-only title', () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(button);
    
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should trim title before submitting', async () => {
    const handleSubmit = vi.fn(async () => {});
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith('Buy milk');
    });
  });

  it('should focus input on mount', () => {
    render(<TaskInput onSubmit={async () => {}} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    expect(document.activeElement).toBe(input);
  });

  it('should display error message when onSubmit throws', async () => {
    const handleSubmit = vi.fn(async () => {
      throw new Error('Title must be between 1 and 500 characters');
    });
    
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(button);
    
    expect(await screen.findByText(/title must be between 1 and 500 characters/i)).toBeInTheDocument();
  });

  it('should clear error message when typing', async () => {
    const handleSubmit = vi.fn(async () => {
      throw new Error('Title cannot be empty');
    });
    
    render(<TaskInput onSubmit={handleSubmit} />);
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(button);
    
    // Error should appear
    expect(await screen.findByText(/title cannot be empty/i)).toBeInTheDocument();
    
    // Type to clear error
    fireEvent.change(input, { target: { value: 'New value' } });
    
    expect(screen.queryByText(/title cannot be empty/i)).not.toBeInTheDocument();
  });
});
