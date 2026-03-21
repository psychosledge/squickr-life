/**
 * HabitRow Component Tests
 *
 * Tests for the habit row component that displays a single habit in the
 * HabitsSection, with completion toggle, streak badge, and 7-day mini-grid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HabitRow } from './HabitRow';
import type { HabitReadModel } from '@squickr/domain';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeHabit(overrides: Partial<HabitReadModel> = {}): HabitReadModel {
  return {
    id: 'habit-1',
    title: 'Morning Run',
    frequency: { type: 'daily' },
    currentStreak: 3,
    longestStreak: 10,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: 'a0',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HabitRow', () => {
  const defaultProps = {
    habit: makeHabit(),
    date: '2026-03-20',
    collectionId: 'col-1',
    onComplete: vi.fn(),
    onRevert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders habit title', () => {
    render(<HabitRow {...defaultProps} />);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
  });

  it('renders streak badge with current streak count', () => {
    render(<HabitRow {...defaultProps} habit={makeHabit({ currentStreak: 5 })} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('shows completion button as unchecked when habit is not completed', () => {
    render(<HabitRow {...defaultProps} habit={makeHabit({ isCompletedToday: false })} />);
    const btn = screen.getByRole('button', { name: /mark.*complete|complete habit/i });
    expect(btn).toBeInTheDocument();
  });

  it('shows completion button as checked when habit is completed', () => {
    render(<HabitRow {...defaultProps} habit={makeHabit({ isCompletedToday: true })} />);
    const btn = screen.getByRole('button', { name: /revert|completed/i });
    expect(btn).toBeInTheDocument();
  });

  it('calls onComplete when completion button is clicked and habit is not completed', () => {
    const onComplete = vi.fn();
    render(
      <HabitRow
        {...defaultProps}
        habit={makeHabit({ isCompletedToday: false })}
        onComplete={onComplete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /mark.*complete|complete habit/i }));
    expect(onComplete).toHaveBeenCalledWith({
      habitId: 'habit-1',
      date: '2026-03-20',
      collectionId: 'col-1',
    });
  });

  it('calls onRevert when completion button is clicked and habit is already completed', () => {
    const onRevert = vi.fn();
    render(
      <HabitRow
        {...defaultProps}
        habit={makeHabit({ isCompletedToday: true })}
        onRevert={onRevert}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /revert|completed/i }));
    expect(onRevert).toHaveBeenCalledWith({
      habitId: 'habit-1',
      date: '2026-03-20',
    });
  });

  it('calls onNavigateToHabit when row title area is clicked', () => {
    const onNavigateToHabit = vi.fn();
    render(
      <HabitRow
        {...defaultProps}
        onNavigateToHabit={onNavigateToHabit}
      />
    );
    fireEvent.click(screen.getByText('Morning Run'));
    expect(onNavigateToHabit).toHaveBeenCalledWith('habit-1');
  });

  it('does not throw when onNavigateToHabit is not provided and title is clicked', () => {
    expect(() => {
      render(<HabitRow {...defaultProps} />);
      fireEvent.click(screen.getByText('Morning Run'));
    }).not.toThrow();
  });

  it('renders 7-day mini-grid with correct number of cells', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${14 + i}`,
      status: 'completed' as const,
    }));
    render(<HabitRow {...defaultProps} habit={makeHabit({ history })} />);
    // 7 day cells should be rendered
    const cells = screen.getAllByRole('presentation');
    expect(cells.length).toBeGreaterThanOrEqual(7);
  });
});
