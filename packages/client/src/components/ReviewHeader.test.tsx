/**
 * ReviewHeader Tests
 *
 * Phase 1 (Proactive Squickr — Review Screen): ReviewHeader component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReviewHeader } from './ReviewHeader';

describe('ReviewHeader', () => {
  const weeklyDateRange = {
    from: new Date('2026-03-17T00:00:00'),
    to: new Date('2026-03-23T00:00:00'),
  };

  const monthlyDateRange = {
    from: new Date('2026-03-01T00:00:00'),
    to: new Date('2026-03-31T00:00:00'),
  };

  let onBack: ReturnType<typeof vi.fn>;
  let onPeriodChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onBack = vi.fn();
    onPeriodChange = vi.fn();
  });

  it('renders "Review" heading', () => {
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const backBtn = screen.getByRole('button', { name: /back/i });
    expect(backBtn).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const backBtn = screen.getByRole('button', { name: /back/i });
    await user.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders "Weekly" and "Monthly" toggle buttons', () => {
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    expect(screen.getByRole('button', { name: /weekly/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monthly/i })).toBeInTheDocument();
  });

  it('highlights Weekly tab when period is weekly', () => {
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const weeklyBtn = screen.getByRole('button', { name: /weekly/i });
    const monthlyBtn = screen.getByRole('button', { name: /monthly/i });
    // Active tab should have aria-pressed="true" or a distinguishing class
    expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('highlights Monthly tab when period is monthly', () => {
    render(
      <ReviewHeader
        period="monthly"
        dateRange={monthlyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const weeklyBtn = screen.getByRole('button', { name: /weekly/i });
    const monthlyBtn = screen.getByRole('button', { name: /monthly/i });
    expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
    expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onPeriodChange("monthly") when Monthly tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const monthlyBtn = screen.getByRole('button', { name: /monthly/i });
    await user.click(monthlyBtn);
    expect(onPeriodChange).toHaveBeenCalledWith('monthly');
  });

  it('calls onPeriodChange("weekly") when Weekly tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReviewHeader
        period="monthly"
        dateRange={monthlyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    const weeklyBtn = screen.getByRole('button', { name: /weekly/i });
    await user.click(weeklyBtn);
    expect(onPeriodChange).toHaveBeenCalledWith('weekly');
  });

  it('does not call onPeriodChange when already-active tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    // Click the already-active "Weekly" button
    const weeklyBtn = screen.getByRole('button', { name: /weekly/i });
    await user.click(weeklyBtn);
    expect(onPeriodChange).not.toHaveBeenCalled();
  });

  it('displays formatted weekly date range', () => {
    render(
      <ReviewHeader
        period="weekly"
        dateRange={weeklyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    // Expect something like "Mar 17 – Mar 23"
    expect(screen.getByText(/Mar 17/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 23/)).toBeInTheDocument();
  });

  it('displays formatted monthly date range', () => {
    render(
      <ReviewHeader
        period="monthly"
        dateRange={monthlyDateRange}
        onPeriodChange={onPeriodChange}
        onBack={onBack}
      />
    );
    // Expect something like "March 2026"
    expect(screen.getByText(/March 2026/)).toBeInTheDocument();
  });
});
