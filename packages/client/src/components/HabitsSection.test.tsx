/**
 * HabitsSection Component Tests
 *
 * Tests for the habit section rendered inside CollectionDetailView for daily collections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HabitsSection } from './HabitsSection';
import type { HabitReadModel } from '@squickr/domain';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeHabit(overrides: Partial<HabitReadModel> = {}): HabitReadModel {
  return {
    id: 'habit-1',
    title: 'Morning Run',
    frequency: { type: 'daily' },
    currentStreak: 0,
    longestStreak: 0,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: 'a0',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HabitsSection', () => {
  const defaultProps = {
    habits: [],
    isLoading: false,
    date: '2026-03-20',
    collectionId: 'col-1',
    onComplete: vi.fn(),
    onRevert: vi.fn(),
    onAddHabit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section heading "Habits"', () => {
    render(<HabitsSection {...defaultProps} />);
    expect(screen.getByText('Habits')).toBeInTheDocument();
  });

  it('renders "+" button to add a habit', () => {
    render(<HabitsSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add habit/i })).toBeInTheDocument();
  });

  it('calls onAddHabit when "+" button is clicked', () => {
    const onAddHabit = vi.fn();
    render(<HabitsSection {...defaultProps} onAddHabit={onAddHabit} />);
    fireEvent.click(screen.getByRole('button', { name: /add habit/i }));
    expect(onAddHabit).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isLoading is true', () => {
    render(<HabitsSection {...defaultProps} isLoading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state message when habits array is empty', () => {
    render(<HabitsSection {...defaultProps} habits={[]} isLoading={false} />);
    expect(screen.getByText(/no habits/i)).toBeInTheDocument();
  });

  it('renders a HabitRow for each habit', () => {
    const habits = [
      makeHabit({ id: 'h1', title: 'Morning Run' }),
      makeHabit({ id: 'h2', title: 'Read 10 pages' }),
    ];
    render(<HabitsSection {...defaultProps} habits={habits} />);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Read 10 pages')).toBeInTheDocument();
  });

  it('passes onComplete to HabitRow', () => {
    const onComplete = vi.fn();
    const habits = [makeHabit({ id: 'h1', isCompletedToday: false })];
    render(<HabitsSection {...defaultProps} habits={habits} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /mark.*complete|complete habit/i }));
    expect(onComplete).toHaveBeenCalledWith({ habitId: 'h1', date: '2026-03-20', collectionId: 'col-1' });
  });

  it('passes onRevert to HabitRow', () => {
    const onRevert = vi.fn();
    const habits = [makeHabit({ id: 'h1', isCompletedToday: true })];
    render(<HabitsSection {...defaultProps} habits={habits} onRevert={onRevert} />);
    fireEvent.click(screen.getByRole('button', { name: /revert|completed/i }));
    expect(onRevert).toHaveBeenCalledWith({ habitId: 'h1', date: '2026-03-20' });
  });

  it('passes onNavigateToHabit to HabitRow when provided', () => {
    const onNavigateToHabit = vi.fn();
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run' })];
    render(
      <HabitsSection
        {...defaultProps}
        habits={habits}
        onNavigateToHabit={onNavigateToHabit}
      />
    );
    fireEvent.click(screen.getByText('Morning Run'));
    expect(onNavigateToHabit).toHaveBeenCalledWith('h1');
  });
});
