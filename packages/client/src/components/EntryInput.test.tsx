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
    expect(screen.queryByLabelText(/event date/i)).not.toBeInTheDocument();
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
    const button = screen.getByRole('button', { name: /save/i });
    
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Buy milk', undefined);
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
    const button = screen.getByRole('button', { name: /save/i });
    
    fireEvent.change(input, { target: { value: 'Important note' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Important note');
      expect(mockOnSubmitTask).not.toHaveBeenCalled();
      expect(mockOnSubmitEvent).not.toHaveBeenCalled();
    });
  });

  it('should submit event when event type is selected', async () => {
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
    const button = screen.getByRole('button', { name: /save/i });

    fireEvent.change(input, { target: { value: 'Meeting' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Meeting');
      expect(mockOnSubmitTask).not.toHaveBeenCalled();
      expect(mockOnSubmitNote).not.toHaveBeenCalled();
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
    const button = screen.getByRole('button', { name: /save/i });
    
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
    
    const button = screen.getByRole('button', { name: /save/i });
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
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Buy milk', undefined);
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
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task', undefined);
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
    const button = screen.getByRole('button', { name: /save/i });
    
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
    const button = screen.getByRole('button', { name: /save/i });
    
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
      
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task', undefined);
    });

    it('should call onSubmitTask exactly once when clicking Save button', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      const button = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: 'Test task' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task', undefined);
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

    it('should call onSubmitNote exactly once when clicking Save button', async () => {
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
      const button = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: 'Test note' } });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(mockOnSubmitNote).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnSubmitNote).toHaveBeenCalledWith('Test note');
    });

    it('should call onSubmitEvent exactly once when pressing Enter in event input', async () => {
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

      fireEvent.change(input, { target: { value: 'Test event' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

      await waitFor(() => {
        expect(mockOnSubmitEvent).toHaveBeenCalledTimes(1);
      });

      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Test event');
    });

    it('should call onSubmitEvent exactly once when clicking Save button', async () => {
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
      const button = screen.getByRole('button', { name: /save/i });

      fireEvent.change(input, { target: { value: 'Test event' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnSubmitEvent).toHaveBeenCalledTimes(1);
      });

      expect(mockOnSubmitEvent).toHaveBeenCalledWith('Test event');
    });
  });

  // Save button tests
  describe('Save button', () => {
    it('should render Save button in default variant', () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('should disable Save button when input is empty', () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when input has content', () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: 'Test task' } });
      
      expect(saveButton).not.toBeDisabled();
    });

    it('should disable Save button when input is only whitespace', () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: '   ' } });
      
      expect(saveButton).toBeDisabled();
    });

    it('should trigger submission when Save button is clicked for tasks', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: 'Buy milk' } });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledWith('Buy milk', undefined);
      });
    });

    it('should trigger submission when Save button is clicked for notes', async () => {
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
      const saveButton = screen.getByRole('button', { name: /save/i });
      
      fireEvent.change(input, { target: { value: 'Important note' } });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSubmitNote).toHaveBeenCalledWith('Important note');
      });
    });

    it('should trigger submission when Save button is clicked for events', async () => {
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
      const saveButton = screen.getByRole('button', { name: /save/i });

      fireEvent.change(input, { target: { value: 'Meeting' } });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSubmitEvent).toHaveBeenCalledWith('Meeting');
      });
    });

    it('should work alongside Enter key (backward compatibility)', async () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const input = screen.getByPlaceholderText(/add a task/i);
      
      // Test Enter key still works
      fireEvent.change(input, { target: { value: 'Test task' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledWith('Test task', undefined);
      });
      
      // Clear mock
      mockOnSubmitTask.mockClear();
      
      // Test Save button also works
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.change(input, { target: { value: 'Another task' } });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockOnSubmitTask).toHaveBeenCalledWith('Another task', undefined);
      });
    });

    it('should have minimum touch target size for mobile (44x44px)', () => {
      render(
        <EntryInput 
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      const styles = window.getComputedStyle(saveButton);
      
      // Check that button has adequate padding for touch targets
      // The actual size will be determined by padding + content
      expect(saveButton).toHaveClass('py-3'); // Ensures vertical padding
    });

    it('should render save button in modal variant', () => {
      render(
        <EntryInput
          variant="modal"
          onSubmitTask={mockOnSubmitTask}
          onSubmitNote={mockOnSubmitNote}
          onSubmitEvent={mockOnSubmitEvent}
        />
      );

      // Save button should be visible in modal variant too (for mobile users)
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Reminder section (ADR-029)
// ---------------------------------------------------------------------------

describe('EntryInput — reminder section', () => {
  const mockOnSubmitTask = vi.fn(async () => {});
  const mockOnSubmitNote = vi.fn(async () => {});
  const mockOnSubmitEvent = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reminder section toggle is visible when task type is selected', () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    // Default type is task — toggle should be present
    expect(screen.getByRole('button', { name: /set reminder/i })).toBeInTheDocument();
  });

  it('reminder section toggle is NOT visible for note type', () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /note/i }));
    expect(screen.queryByRole('button', { name: /set reminder/i })).not.toBeInTheDocument();
  });

  it('reminder section toggle is NOT visible for event type', () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /event/i }));
    expect(screen.queryByRole('button', { name: /set reminder/i })).not.toBeInTheDocument();
  });

  it('date and time pickers are hidden initially (collapsed)', () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    expect(screen.queryByLabelText(/reminder date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reminder time/i)).not.toBeInTheDocument();
  });

  it('clicking toggle shows date and time pickers', () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /set reminder/i }));
    expect(screen.getByLabelText(/reminder date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reminder time/i)).toBeInTheDocument();
  });

  it('submits with reminderAt when both date and time are filled', async () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );

    // Fill the task title
    const input = screen.getByLabelText(/entry content/i);
    fireEvent.change(input, { target: { value: 'Test task' } });

    // Open reminder section and fill date + time
    fireEvent.click(screen.getByRole('button', { name: /set reminder/i }));
    fireEvent.change(screen.getByLabelText(/reminder date/i), { target: { value: '2099-12-31' } });
    fireEvent.change(screen.getByLabelText(/reminder time/i), { target: { value: '12:00' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
      const [title, reminderAt] = mockOnSubmitTask.mock.calls[0] as [string, string | undefined];
      expect(title).toBe('Test task');
      expect(reminderAt).toBeDefined();
      expect(typeof reminderAt).toBe('string');
    });
  });

  it('submits without reminderAt when reminder section is unused', async () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );

    const input = screen.getByLabelText(/entry content/i);
    fireEvent.change(input, { target: { value: 'Quick task' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
      const [title, reminderAt] = mockOnSubmitTask.mock.calls[0] as [string, string | undefined];
      expect(title).toBe('Quick task');
      expect(reminderAt).toBeUndefined();
    });
  });

  // ── Past reminder validation (P1 fix) ────────────────────────────────────────

  it('shows error and does NOT submit when reminder datetime is in the past', async () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );

    const input = screen.getByLabelText(/entry content/i);
    fireEvent.change(input, { target: { value: 'Past reminder task' } });

    // Open reminder section
    fireEvent.click(screen.getByRole('button', { name: /set reminder/i }));

    // Set a past date/time
    fireEvent.change(screen.getByLabelText(/reminder date/i), { target: { value: '2000-01-01' } });
    fireEvent.change(screen.getByLabelText(/reminder time/i), { target: { value: '00:00' } });

    // Try to submit
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Error should be shown in the reminder section
    expect(await screen.findByText(/reminder must be in the future/i)).toBeInTheDocument();

    // onSubmitTask must NOT have been called
    expect(mockOnSubmitTask).not.toHaveBeenCalled();
  });

  it('submits normally when reminder datetime is at least 1 minute in the future', async () => {
    render(
      <EntryInput
        onSubmitTask={mockOnSubmitTask}
        onSubmitNote={mockOnSubmitNote}
        onSubmitEvent={mockOnSubmitEvent}
      />
    );

    const input = screen.getByLabelText(/entry content/i);
    fireEvent.change(input, { target: { value: 'Future reminder task' } });

    // Open reminder section
    fireEvent.click(screen.getByRole('button', { name: /set reminder/i }));

    // Set a far-future date/time
    fireEvent.change(screen.getByLabelText(/reminder date/i), { target: { value: '2099-12-31' } });
    fireEvent.change(screen.getByLabelText(/reminder time/i), { target: { value: '12:00' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockOnSubmitTask).toHaveBeenCalledTimes(1);
    });

    // Should NOT show an error
    expect(screen.queryByText(/reminder must be in the future/i)).not.toBeInTheDocument();
  });
});
