import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntryInput } from './EntryInput';

describe('EntryInput', () => {
  const mockOnSubmitTask = vi.fn(async () => {});
  const mockOnSubmitNote = vi.fn(async () => {});
  const mockOnSubmitEvent = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with task type selected by default', () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const taskButton = screen.getByRole('button', { name: /task/i });
    expect(taskButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
  });

  it('should switch to note type when selected', () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const noteButton = screen.getByRole('button', { name: /note/i });
    fireEvent.click(noteButton);
    
    expect(screen.getByPlaceholderText(/add a note/i)).toBeInTheDocument();
  });

  it('should switch to event type when selected', () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const eventButton = screen.getByRole('button', { name: /event/i });
    fireEvent.click(eventButton);
    
    expect(screen.getByPlaceholderText(/add an event/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event date/i)).toBeInTheDocument();
  });

  it('should submit task when task type is selected', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Buy milk');
      expect(mockOnSubmitNote).not.toHaveBeenCalled();
      expect(mockOnSubmitEvent).not.toHaveBeenCalled();
    });
  });

  it('should submit note when note type is selected', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const noteButton = screen.getByRole('button', { name: /note/i });
    fireEvent.click(noteButton);
    
    const input = screen.getByPlaceholderText(/add a note/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Important note' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Important note');
      expect(mockOnSubmitTask).not.toHaveBeenCalled();
      expect(mockOnSubmitEvent).not.toHaveBeenCalled();
    });
  });

  it('should submit event with date when event type is selected', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const eventButton = screen.getByRole('button', { name: /event/i });
    fireEvent.click(eventButton);
    
    const input = screen.getByPlaceholderText(/add an event/i);
    const dateInput = screen.getByLabelText(/event date/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Meeting' } });
    fireEvent.change(dateInput, { target: { value: '2026-02-15' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Meeting', '2026-02-15');
      expect(mockOnSubmitTask).not.toHaveBeenCalled();
      expect(mockOnSubmitNote).not.toHaveBeenCalled();
    });
  });

  it('should submit event without date when date is not provided', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const eventButton = screen.getByRole('button', { name: /event/i });
    fireEvent.click(eventButton);
    
    const input = screen.getByPlaceholderText(/add an event/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Meeting' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Meeting', undefined);
    });
  });

  it('should clear input after submission', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i) as HTMLInputElement;
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Test task' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should not submit empty content', () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const button = screen.getByRole('button', { name: /add/i });
    fireEvent.click(button);
    
    expect(mockOnSubmitTask).not.toHaveBeenCalled();
    expect(mockOnSubmitNote).not.toHaveBeenCalled();
    expect(mockOnSubmitEvent).not.toHaveBeenCalled();
  });

  it('should trim content before submitting', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const form = input.closest('form');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Buy milk');
    });
  });

  it('should submit task on Enter key press', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const form = input.closest('form');
    fireEvent.change(input, { target: { value: 'Test task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.submit(form!);
    
    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task');
    });
  });

  it('should submit note on Enter key press (not Shift+Enter)', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const noteButton = screen.getByRole('button', { name: /note/i });
    fireEvent.click(noteButton);
    
    const input = screen.getByPlaceholderText(/add a note/i);
    fireEvent.change(input, { target: { value: 'Test note' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    
    await waitFor(() => {
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Test note');
    });
  });

  it('should submit on Enter key press (no need for Shift detection on input)', async () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const noteButton = screen.getByRole('button', { name: /note/i });
    fireEvent.click(noteButton);
    
    const input = screen.getByPlaceholderText(/add a note/i);
    fireEvent.change(input, { target: { value: 'Test note' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    
    await waitFor(() => {
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Test note');
    });
  });

  it('should display error message when submission fails', async () => {
    const errorHandler = vi.fn(async () => {
      throw new Error('Content must be between 1 and 500 characters');
    });
    
    render(
      <EntryInput 
        onSubmitTask={errorHandler}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(button);
    
    expect(await screen.findByText(/content must be between 1 and 500 characters/i)).toBeInTheDocument();
  });

  it('should clear error when typing', async () => {
    const errorHandler = vi.fn(async () => {
      throw new Error('Validation error');
    });
    
    render(
      <EntryInput 
        onSubmitTask={errorHandler}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i);
    const button = screen.getByRole('button', { name: /add/i });
    
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(button);
    
    // Error should appear
    expect(await screen.findByText(/validation error/i)).toBeInTheDocument();
    
    // Type to clear error
    fireEvent.change(input, { target: { value: 'New value' } });
    
    expect(screen.queryByText(/validation error/i)).not.toBeInTheDocument();
  });

  it('should clear input when switching entry types', () => {
    render(
      <EntryInput 
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    
    const input = screen.getByPlaceholderText(/add a task/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test content' } });
    
    const noteButton = screen.getByRole('button', { name: /note/i });
    fireEvent.click(noteButton);
    
    const noteInput = screen.getByPlaceholderText(/add a note/i) as HTMLInputElement;
    expect(noteInput.value).toBe('');
  });

  // REGRESSION TESTS: Prevent double-submit bug
  describe('should call submit handlers exactly once', () => {
    it('should call onSubmitTask exactly once when pressing Enter in task input', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      
      fireEvent.change(input, { target: { value: 'Test task' } });
      
      // Simulate Enter key - this will call handleSubmit internally
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      
      // Wait for async submission
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task');
    });

    it('should call onSubmitTask exactly once when clicking Add button', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      const button = screen.getByRole('button', { name: /add/i });
      
      fireEvent.change(input, { target: { value: 'Test task' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task');
    });

    it('should call onSubmitNote exactly once when pressing Enter in note textarea', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const noteButton = screen.getByRole('button', { name: /note/i });
      fireEvent.click(noteButton);
      
      const input = screen.getByPlaceholderText(/add a note/i);
      fireEvent.change(input, { target: { value: 'Test note' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      
      await waitFor(() => {
        expect(mockOnSubmitNote).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Test note');
    });

    it('should call onSubmitNote exactly once when clicking Add button', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const noteButton = screen.getByRole('button', { name: /note/i });
      fireEvent.click(noteButton);
      
      const input = screen.getByPlaceholderText(/add a note/i);
      const button = screen.getByRole('button', { name: /add/i });
      
      fireEvent.change(input, { target: { value: 'Test note' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSubmitNote).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Test note');
    });

    it('should call onSubmitEvent exactly once when pressing Enter in event textarea', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const eventButton = screen.getByRole('button', { name: /event/i });
      fireEvent.click(eventButton);
      
      const input = screen.getByPlaceholderText(/add an event/i);
      const dateInput = screen.getByLabelText(/event date/i);
      
      fireEvent.change(input, { target: { value: 'Test event' } });
      fireEvent.change(dateInput, { target: { value: '2026-02-15' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      
      await waitFor(() => {
        expect(mockOnSubmitEvent).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Test event', '2026-02-15');
    });

    it('should call onSubmitEvent exactly once when clicking Add button', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const eventButton = screen.getByRole('button', { name: /event/i });
      fireEvent.click(eventButton);
      
      const input = screen.getByPlaceholderText(/add an event/i);
      const dateInput = screen.getByLabelText(/event date/i);
      const button = screen.getByRole('button', { name: /add/i });
      
      fireEvent.change(input, { target: { value: 'Test event' } });
      fireEvent.change(dateInput, { target: { value: '2026-02-15' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSubmitEvent).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Test event', '2026-02-15');
    });
  });
});
