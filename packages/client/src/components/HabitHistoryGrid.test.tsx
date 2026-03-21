/**
 * HabitHistoryGrid Tests
 *
 * 30-day calendar grid showing habit completion history.
 * 7 columns (Mon-Sun), oldest day top-left, today bottom-right direction.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HabitHistoryGrid } from './HabitHistoryGrid';
import type { HabitDayStatus } from '@squickr/domain';

function makeHistory(overrides: Partial<HabitDayStatus>[] = []): HabitDayStatus[] {
  const base: HabitDayStatus[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(2026, 2, 20); // 2026-03-20 as "today"
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    base.push({ date: dateStr, status: 'not-scheduled' });
  }
  return base.map((item, idx) => ({ ...item, ...overrides[idx] }));
}

describe('HabitHistoryGrid', () => {
  it('should render a grid container', () => {
    const { container } = render(<HabitHistoryGrid history={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render 7 column headers (Mon-Sun)', () => {
    render(<HabitHistoryGrid history={[]} />);
    const headers = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    headers.forEach((day) => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it('should render a cell for each day in history', () => {
    const history = makeHistory();
    const { container } = render(<HabitHistoryGrid history={history} />);
    // Each day gets a cell with a title attribute containing the date
    const cells = container.querySelectorAll('[data-date]');
    expect(cells).toHaveLength(30);
  });

  it('should mark completed days with a distinct style', () => {
    const history = makeHistory();
    history[0] = { date: history[0]!.date, status: 'completed' };
    const { container } = render(<HabitHistoryGrid history={history} />);
    const completedCells = container.querySelectorAll('[data-status="completed"]');
    expect(completedCells.length).toBeGreaterThan(0);
  });

  it('should mark missed days with a distinct style', () => {
    const history = makeHistory();
    history[1] = { date: history[1]!.date, status: 'missed' };
    const { container } = render(<HabitHistoryGrid history={history} />);
    const missedCells = container.querySelectorAll('[data-status="missed"]');
    expect(missedCells.length).toBeGreaterThan(0);
  });

  it('should mark not-scheduled days', () => {
    const history = makeHistory();
    const { container } = render(<HabitHistoryGrid history={history} />);
    const notScheduledCells = container.querySelectorAll('[data-status="not-scheduled"]');
    expect(notScheduledCells.length).toBeGreaterThan(0);
  });

  it('should render date as title/aria-label on each cell', () => {
    const history = makeHistory();
    const { container } = render(<HabitHistoryGrid history={history} />);
    const firstCell = container.querySelector('[data-date="2026-02-19"]');
    expect(firstCell).toBeTruthy();
  });
});
