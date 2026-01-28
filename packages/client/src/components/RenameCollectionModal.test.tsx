import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { RenameCollectionModal } from './RenameCollectionModal';

describe('RenameCollectionModal', () => {
  it('should not render when closed', () => {
    render(
      <RenameCollectionModal 
        isOpen={false} 
        currentName="Test Collection"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(screen.queryByText('Rename Collection')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test Collection"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(screen.getByText('Rename Collection')).toBeInTheDocument();
    expect(screen.getByLabelText('Collection Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should auto-focus input when opened with current name pre-filled', () => {
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="My Collection"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name') as HTMLInputElement;
    expect(input).toHaveFocus();
    expect(input.value).toBe('My Collection');
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={onClose} 
        onSubmit={vi.fn()} 
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit with new name when rename button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    
    expect(onSubmit).toHaveBeenCalledWith('New Name');
  });

  it('should disable rename button when input is empty', async () => {
    const user = userEvent.setup();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    
    const renameButton = screen.getByRole('button', { name: 'Rename' });
    expect(renameButton).toBeDisabled();
  });

  it('should disable rename button when input is only whitespace', async () => {
    const user = userEvent.setup();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, '   ');
    
    const renameButton = screen.getByRole('button', { name: 'Rename' });
    expect(renameButton).toBeDisabled();
  });

  it('should enable rename button when input has content', async () => {
    const user = userEvent.setup();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    const renameButton = screen.getByRole('button', { name: 'Rename' });
    expect(renameButton).toBeEnabled(); // Has initial value
  });

  it('should close modal after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={onClose} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should submit when Enter key is pressed', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, 'Quick Rename{Enter}');
    
    expect(onSubmit).toHaveBeenCalledWith('Quick Rename');
  });

  it('should not submit on Enter when input is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, '{Enter}');
    
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should display error message on submit failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Collection name already exists'));
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, 'Duplicate');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    
    await waitFor(() => {
      expect(screen.getByText('Collection name already exists')).toBeInTheDocument();
    });
  });

  it('should clear error when user starts typing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Some error'));
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, 'Test');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    
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
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Old Name"
        onClose={vi.fn()} 
        onSubmit={onSubmit} 
      />
    );

    const input = screen.getByLabelText('Collection Name');
    await user.clear(input);
    await user.type(input, '  Trimmed Name  ');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    
    expect(onSubmit).toHaveBeenCalledWith('Trimmed Name');
  });

  it('should close when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    
    render(
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
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
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={vi.fn()} 
        onSubmit={vi.fn()} 
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <RenameCollectionModal 
        isOpen={false} 
        currentName="Test"
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
      <RenameCollectionModal 
        isOpen={true} 
        currentName="Test"
        onClose={onClose} 
        onSubmit={vi.fn()} 
      />
    );

    const backdrop = screen.getByText('Rename Collection').closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});
