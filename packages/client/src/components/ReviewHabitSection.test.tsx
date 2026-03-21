/**
 * ReviewHabitSection Tests
 *
 * Tests for the ReviewHabitSection component showing habit summary on Review screen.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewHabitSection } from './ReviewHabitSection';
import type { HabitReadModel } from '@squickr/domain';

function makeHabit(overrides: Partial<HabitReadModel> = {}): HabitReadModel {
  return {
    id: 'habit-1',
    title: 'Morning Run',
    frequency: { type: 'daily' },
    currentStreak: 5,
    longestStreak: 10,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ReviewHabitSection', () => {
  it('renders "Set up habits" placeholder when habits array is empty', () => {
    render(<ReviewHabitSection habits={[]} />);
    expect(screen.getByText(/set up habits/i)).toBeInTheDocument();
  });

  it('renders section heading "Habits"', () => {
    render(<ReviewHabitSection habits={[]} />);
    expect(screen.getByText('Habits')).toBeInTheDocument();
  });

  it('renders habit title when habits are provided', () => {
    render(<ReviewHabitSection habits={[makeHabit()]} />);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
  });

  it('renders current streak for each habit', () => {
    render(<ReviewHabitSection habits={[makeHabit({ currentStreak: 7 })]} />);
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('renders 30-day completion rate for habit with history', () => {
    const history = [
      { date: '2026-02-20', status: 'completed' as const },
      { date: '2026-02-21', status: 'missed' as const },
      { date: '2026-02-22', status: 'completed' as const },
      { date: '2026-02-23', status: 'completed' as const },
    ];
    render(<ReviewHabitSection habits={[makeHabit({ history })]} />);
    // 3 completed out of 4 scheduled days = 75%
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('renders multiple habits', () => {
    const habits = [
      makeHabit({ id: 'h-1', title: 'Morning Run' }),
      makeHabit({ id: 'h-2', title: 'Meditate' }),
    ];
    render(<ReviewHabitSection habits={habits} />);
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Meditate')).toBeInTheDocument();
  });
});
