import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CreateCollectionModal } from './CreateCollectionModal';

describe('CreateCollectionModal', () => {
  it('should not render when closed', () => {
    render(
      <CreateCollectionModal 
        isOpen={false} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(screen.queryByText('Create Collection')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(screen.getByText('Create Collection')).toBeInTheDocument();
    expect(screen.getByLabelText('Collection Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should auto-focus input when opened', () => {
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name') as HTMLInputElement;
    expect(input).toHaveFocus();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={onClose} 
        onSubmit={vi.fn()} 
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit with collection name when create button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'My New Collection');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    expect(onSubmit).toHaveBeenCalledWith('My New Collection', undefined, undefined);
  });

  it('should disable create button when input is empty', () => {
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();
  });

  it('should disable create button when input is only whitespace', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, '   ');
    
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();
  });

  it('should enable create button when input has content', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'Projects');
    
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeEnabled();
  });

  it('should clear input after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name') as HTMLInputElement;
    await user.type(input, 'Test Collection');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should call onClose after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={onClose} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'Test Collection');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should submit when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'Quick Collection{Enter}');
    
    expect(onSubmit).toHaveBeenCalledWith('Quick Collection', undefined, undefined);
  });

  it('should not submit on Enter when input is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, '{Enter}');
    
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should display error message on submit failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Collection name already exists'));
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    await waitFor(() => {
      expect(screen.getByText('Collection name already exists')).toBeInTheDocument();
    });
  });

  it('should clear error when user starts typing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Some error'));
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    await waitFor(() => {
      expect(screen.getByText('Some error')).toBeInTheDocument();
    });

    await user.type(input, 'X');
    
    expect(screen.queryByText('Some error')).not.toBeInTheDocument();
  });

  it('should trim whitespace from collection name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.type(input, '  Trimmed Name  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    
    expect(onSubmit).toHaveBeenCalledWith('Trimmed Name', undefined, undefined);
  });

  it('should close when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={onClose} 
        onSubmit={vi.fn()} 
      />
    );

    await user.keyboard('{Escape}');
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should prevent body scroll when open', () => {
    const originalOverflow = document.body.style.overflow;
    
    const { rerender } = render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <CreateCollectionModal 
        isOpen={false} 
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('should close when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <CreateCollectionModal 
        isOpen={true} 
        onClose={onClose} 
        onSubmit={vi.fn()} 
      />
    );

    const backdrop = screen.getByText('Create Collection').closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  describe('Monthly Logs', () => {
    it('should show month/year selectors when Monthly Log type is selected', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={vi.fn()} 
        />
      );

      // Click monthly log radio button
      const monthlyRadio = screen.getByLabelText(/Monthly Log/);
      await user.click(monthlyRadio);

      // Verify month/year selectors appear
      expect(screen.getByText('Month and Year')).toBeInTheDocument();
      expect(screen.getByText(/Preview:/)).toBeInTheDocument();
    });

    it('should show preview of monthly log name', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={vi.fn()} 
        />
      );

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Preview should show current month/year by default
      const preview = screen.getByText(/Preview:/);
      expect(preview).toBeInTheDocument();
      expect(preview.textContent).toMatch(/Preview: \w+ \d{4}/);
    });

    it('should create monthly log with correct name and date format', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={onSubmit} 
        />
      );

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Select February 2026
      const monthSelect = screen.getAllByRole('combobox')[0];
      const yearSelect = screen.getAllByRole('combobox')[1];
      
      await user.selectOptions(monthSelect, '1'); // February (0-indexed)
      await user.selectOptions(yearSelect, '2026');

      // Submit
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Verify onSubmit called with correct parameters
      expect(onSubmit).toHaveBeenCalledWith('February 2026', 'monthly', '2026-02');
    });

    it('should enable create button for monthly logs without custom name', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={vi.fn()} 
        />
      );

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Create button should be enabled (no name input required)
      const createButton = screen.getByRole('button', { name: 'Create' });
      expect(createButton).toBeEnabled();
    });

    it('should hide collection name input when monthly log type is selected', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={vi.fn()} 
        />
      );

      // Initially custom is selected, input should be visible
      expect(screen.getByLabelText('Collection Name')).toBeInTheDocument();

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Name input should be hidden
      expect(screen.queryByLabelText('Collection Name')).not.toBeInTheDocument();
    });

    it('should update preview when month/year changes', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={vi.fn()} 
        />
      );

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Change to December 2025
      const monthSelect = screen.getAllByRole('combobox')[0];
      const yearSelect = screen.getAllByRole('combobox')[1];
      
      await user.selectOptions(monthSelect, '11'); // December
      await user.selectOptions(yearSelect, '2025');

      // Preview should update
      expect(screen.getByText('Preview: December 2025')).toBeInTheDocument();
    });

    it('should display error when monthly log creation fails', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockRejectedValue(new Error('Monthly log for 2026-02 already exists'));
      
      render(
        <CreateCollectionModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onSubmit={onSubmit} 
        />
      );

      // Switch to monthly log
      await user.click(screen.getByLabelText(/Monthly Log/));

      // Submit
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText('Monthly log for 2026-02 already exists')).toBeInTheDocument();
      });
    });
  });
});
