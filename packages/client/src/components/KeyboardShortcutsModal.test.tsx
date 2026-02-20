/**
 * KeyboardShortcutsModal Tests
 *
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  const mockOnClose = vi.fn();

  afterEach(() => {
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen={false}', () => {
    render(<KeyboardShortcutsModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal with shortcuts table when isOpen={true}', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Shortcuts table rows
    expect(screen.getByText('Navigate to next collection')).toBeInTheDocument();
    expect(screen.getByText('Arrow Right')).toBeInTheDocument();
    expect(screen.getByText('Navigate to previous collection')).toBeInTheDocument();
    expect(screen.getByText('Arrow Left')).toBeInTheDocument();
    expect(screen.getByText('Close modal / Go back')).toBeInTheDocument();
    expect(screen.getByText('Escape')).toBeInTheDocument();
    expect(screen.getByText('Submit entry')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);

    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsModal isOpen={true} onClose={mockOnClose} />);

    const overlay = screen.getByTestId('modal-overlay');
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});
