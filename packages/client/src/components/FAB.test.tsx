import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FAB } from './FAB';

describe('FAB', () => {
  it('should render the FAB button', () => {
    render(<FAB onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add new entry/i })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn();
    const { getByRole } = render(<FAB onClick={onClick} />);
    getByRole('button', { name: /add new entry/i }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  // ─── Tutorial DOM anchor ────────────────────────────────────────────────────
  describe('data-tutorial-id anchor', () => {
    it('should render the button with data-tutorial-id="tutorial-fab"', () => {
      const { container } = render(<FAB onClick={vi.fn()} />);
      const anchor = container.querySelector('[data-tutorial-id="tutorial-fab"]');
      expect(anchor).toBeInTheDocument();
    });

    it('should be the <button> element itself', () => {
      const { container } = render(<FAB onClick={vi.fn()} />);
      const anchor = container.querySelector('[data-tutorial-id="tutorial-fab"]');
      expect(anchor?.tagName.toLowerCase()).toBe('button');
    });
  });
});
