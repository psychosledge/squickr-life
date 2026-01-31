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

  it('should show "Collapse completed tasks" checkbox', () => {
    renderModal();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/collapse completed tasks/i)).toBeInTheDocument();
  });

  it('should initialize checkbox as unchecked when no settings provided', () => {
    renderModal({ currentSettings: undefined });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('should initialize checkbox as unchecked when collapseCompleted is false', () => {
    renderModal({ currentSettings: { collapseCompleted: false } });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('should initialize checkbox as checked when collapseCompleted is true', () => {
    renderModal({ currentSettings: { collapseCompleted: true } });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('should toggle checkbox when clicked', async () => {
    const user = userEvent.setup();
    renderModal();
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    
    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('should call onSubmit with correct settings when save is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox); // Set to true
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    expect(onSubmit).toHaveBeenCalledWith({ collapseCompleted: true });
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
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    // Press Enter to submit
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ collapseCompleted: true });
    });
  });

  it('should show description text for checkbox', () => {
    renderModal();
    expect(screen.getByText(/move completed tasks to a collapsible section/i)).toBeInTheDocument();
  });
});
