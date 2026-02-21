/**
 * BulletJournalGuideModal Tests
 *
 * TDD: RED → GREEN → REFACTOR
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BulletJournalGuideModal } from './BulletJournalGuideModal';

describe('BulletJournalGuideModal', () => {
  const mockOnClose = vi.fn();

  afterEach(() => {
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen={false}', () => {
    render(<BulletJournalGuideModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal content when isOpen={true}', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Check heading
    expect(screen.getByText('Bullet Journal Guide')).toBeInTheDocument();

    // Check section headings
    expect(screen.getByText('What is Bullet Journaling?')).toBeInTheDocument();
    expect(screen.getByText('The Three Entry Types')).toBeInTheDocument();
    expect(screen.getByText('The Bullet States')).toBeInTheDocument();
    expect(screen.getByText('Collections (Pages)')).toBeInTheDocument();
    expect(screen.getByText('The Migration Practice')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);

    await user.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);

    // Click the backdrop overlay (the dialog element itself, not the inner card)
    const overlay = screen.getByTestId('modal-overlay');
    await user.click(overlay);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('"bulletjournal.com" link has correct href and opens in new tab', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);

    const link = screen.getByRole('link', { name: /bulletjournal\.com/i });
    expect(link).toHaveAttribute('href', 'https://bulletjournal.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ─── Fix 2: App icons displayed, cancelled state removed ──────────────────

  it('shows app task icon ☐ in the Three Entry Types section', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);
    // The open-task app icon should appear in the entry types table
    expect(screen.getByTestId('entry-type-task-icon')).toHaveTextContent('☐');
  });

  it('shows app completed icon ✓ in the Bullet States section', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('bullet-state-completed-icon')).toHaveTextContent('✓');
  });

  it('shows app open-task icon ☐ in the Bullet States section', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('bullet-state-open-icon')).toHaveTextContent('☐');
  });

  it('does NOT show a cancelled/– row in the Bullet States section', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('bullet-state-cancelled-row')).not.toBeInTheDocument();
  });

  it('migrated state row mentions the migrate action', () => {
    render(<BulletJournalGuideModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId('bullet-state-migrated-row')).toBeInTheDocument();
    // Should mention "migrate" in some form
    expect(screen.getByTestId('bullet-state-migrated-row').textContent).toMatch(/migrat/i);
  });
});
