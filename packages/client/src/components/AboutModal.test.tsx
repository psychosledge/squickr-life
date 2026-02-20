/**
 * AboutModal Tests
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * Note: `__APP_VERSION__` is defined as '0.10.1' in tests (from root package.json)
 * via the vitest.config.ts `define` block.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AboutModal } from './AboutModal';
import { GITHUB_BASE_URL, getBugReportUrl } from '../constants/github';

describe('AboutModal', () => {
  const mockOnClose = vi.fn();

  afterEach(() => {
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen={false}', () => {
    render(<AboutModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal with app version when isOpen={true}', () => {
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    // Version should include the current __APP_VERSION__
    expect(screen.getByText(new RegExp(__APP_VERSION__))).toBeInTheDocument();
  });

  it('"GitHub Repository" link points to GITHUB_BASE_URL', () => {
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const link = screen.getByRole('link', { name: /github repository/i });
    expect(link).toHaveAttribute('href', GITHUB_BASE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('"Report an Issue" link points to the bug report URL', () => {
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const link = screen.getByRole('link', { name: /report an issue/i });
    expect(link).toHaveAttribute('href', getBugReportUrl());
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    const overlay = screen.getByTestId('modal-overlay');
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<AboutModal isOpen={true} onClose={mockOnClose} />);

    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledOnce();
  });
});
