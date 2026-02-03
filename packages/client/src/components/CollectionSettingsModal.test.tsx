/**
 * CollectionSettingsModal Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CollectionSettingsModal } from './CollectionSettingsModal';

describe('CollectionSettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    currentSettings: undefined,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };

  function renderModal(props = {}) {
    return render(<CollectionSettingsModal {...defaultProps} {...props} />);
  }

  it('should not render when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText(/collection settings/i)).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    renderModal();
    expect(screen.getByText(/collection settings/i)).toBeInTheDocument();
  });

  it('should show "Completed Tasks" dropdown', () => {
    renderModal();
    expect(screen.getByLabelText(/completed tasks/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should initialize dropdown to "Keep in place" when no settings provided', () => {
    renderModal({ currentSettings: undefined });
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('keep-in-place');
  });

  it('should initialize dropdown to "Keep in place" when collapseCompleted is false (migration)', () => {
    renderModal({ currentSettings: { collapseCompleted: false } });
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('keep-in-place');
  });

  it('should initialize dropdown to "Collapse" when collapseCompleted is true (migration)', () => {
    renderModal({ currentSettings: { collapseCompleted: true } });
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('collapse');
  });

  it('should initialize dropdown to "Move to bottom" when completedTaskBehavior is set', () => {
    renderModal({ currentSettings: { completedTaskBehavior: 'move-to-bottom' } });
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('move-to-bottom');
  });

  it('should change dropdown value when option is selected', async () => {
    const user = userEvent.setup();
    renderModal();
    
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('keep-in-place');
    
    await user.selectOptions(dropdown, 'move-to-bottom');
    expect(dropdown.value).toBe('move-to-bottom');
    
    await user.selectOptions(dropdown, 'collapse');
    expect(dropdown.value).toBe('collapse');
  });

  it('should call onSubmit with correct settings when save is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'collapse');
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    expect(onSubmit).toHaveBeenCalledWith({ completedTaskBehavior: 'collapse' });
  });

  it('should call onClose after successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal({ onSubmit, onClose });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display error message if submit fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Update failed'));
    renderModal({ onSubmit });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });
  });

  it('should not close modal if submit fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Update failed'));
    const onClose = vi.fn();
    renderModal({ onSubmit, onClose });
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close when clicking backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    
    // Click the backdrop (the outer div with fixed class)
    const backdrop = container.querySelector('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should close when pressing Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });
    
    await user.keyboard('{Escape}');
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should submit form when pressing Enter in form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'move-to-bottom');
    
    // Focus on the save button and press Enter
    const saveButton = screen.getByRole('button', { name: /save/i });
    saveButton.focus();
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ completedTaskBehavior: 'move-to-bottom' });
    });
  });

  it('should show description text for "Keep in place" mode', () => {
    renderModal();
    expect(screen.getByText(/completed tasks stay where they are/i)).toBeInTheDocument();
  });

  it('should show description text for "Move to bottom" mode', async () => {
    const user = userEvent.setup();
    renderModal();
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'move-to-bottom');
    
    expect(screen.getByText(/completed tasks move below a separator/i)).toBeInTheDocument();
  });

  it('should show description text for "Collapse" mode', async () => {
    const user = userEvent.setup();
    renderModal();
    
    const dropdown = screen.getByRole('combobox');
    await user.selectOptions(dropdown, 'collapse');
    
    expect(screen.getByText(/completed tasks hidden in expandable section/i)).toBeInTheDocument();
  });

  it('should prefer completedTaskBehavior over collapseCompleted when both present', () => {
    renderModal({ 
      currentSettings: { 
        collapseCompleted: true, // Would be 'collapse'
        completedTaskBehavior: 'move-to-bottom' // But this takes precedence
      } 
    });
    const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
    expect(dropdown.value).toBe('move-to-bottom');
  });
});
