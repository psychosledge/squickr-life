/**
 * NotificationsTab Tests
 *
 * Tests for the notifications settings tab component.
 * NotificationsTab is a pure component — no direct context access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { NotificationsTab } from './NotificationsTab';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockNotificationPermission(permission: NotificationPermission) {
  Object.defineProperty(globalThis, 'Notification', {
    value: { permission },
    writable: true,
    configurable: true,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationsTab', () => {
  const defaultProps = {
    habits: [],
    onSetTime: vi.fn(),
    onClearTime: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to 'default' permission
    mockNotificationPermission('default');
  });

  afterEach(() => {
    // Clean up Notification mock
    if ('Notification' in globalThis) {
      // Reset to default
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'default' },
        writable: true,
        configurable: true,
      });
    }
  });

  // ── 1. Blocked banner ───────────────────────────────────────────────────────

  it('renders "blocked" banner when Notification.permission is "denied"', () => {
    mockNotificationPermission('denied');

    render(<NotificationsTab {...defaultProps} />);

    expect(
      screen.getByText(/notifications are blocked/i),
    ).toBeInTheDocument();
  });

  it('banner contains browser settings instructions', () => {
    mockNotificationPermission('denied');

    render(<NotificationsTab {...defaultProps} />);

    expect(screen.getByText(/browser settings/i)).toBeInTheDocument();
  });

  // ── 2. No blocked banner when permission is 'granted' ──────────────────────

  it('does NOT render blocked banner when permission is "granted"', () => {
    mockNotificationPermission('granted');

    render(<NotificationsTab {...defaultProps} />);

    expect(screen.queryByText(/notifications are blocked/i)).not.toBeInTheDocument();
  });

  // ── 3. No blocked banner when permission is 'default' ──────────────────────

  it('does NOT render blocked banner when permission is "default"', () => {
    mockNotificationPermission('default');

    render(<NotificationsTab {...defaultProps} />);

    expect(screen.queryByText(/notifications are blocked/i)).not.toBeInTheDocument();
  });

  // ── 4. Renders a row for each active habit ──────────────────────────────────

  it('renders a row for each habit', () => {
    const habits = [
      makeHabit({ id: 'h1', title: 'Morning Run' }),
      makeHabit({ id: 'h2', title: 'Read 10 pages' }),
      makeHabit({ id: 'h3', title: 'Meditate' }),
    ];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Read 10 pages')).toBeInTheDocument();
    expect(screen.getByText('Meditate')).toBeInTheDocument();
  });

  // ── 5. Time picker pre-filled with notificationTime ────────────────────────

  it('shows time picker pre-filled with notificationTime when set', () => {
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: '07:30' })];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    const timeInput = screen.getByLabelText(/reminder time for morning run/i) as HTMLInputElement;
    expect(timeInput.value).toBe('07:30');
  });

  // ── 6. Empty time picker when notificationTime is undefined ────────────────

  it('shows empty time picker when notificationTime is undefined', () => {
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: undefined })];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    const timeInput = screen.getByLabelText(/reminder time for morning run/i) as HTMLInputElement;
    expect(timeInput.value).toBe('');
  });

  // ── 7. Clear button NOT rendered when notificationTime is undefined ─────────

  it('does NOT render clear button when notificationTime is undefined', () => {
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: undefined })];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    expect(
      screen.queryByRole('button', { name: /clear reminder for morning run/i }),
    ).not.toBeInTheDocument();
  });

  // ── 8. Clear button IS rendered when notificationTime is set ───────────────

  it('renders clear button when notificationTime is set', () => {
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: '07:30' })];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    expect(
      screen.getByRole('button', { name: /clear reminder for morning run/i }),
    ).toBeInTheDocument();
  });

  // ── 9. Changing time input calls onSetTime ──────────────────────────────────

  it('calls onSetTime with correct habitId and time value when time input changes', async () => {
    const onSetTime = vi.fn().mockResolvedValue(undefined);
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run' })];

    render(<NotificationsTab {...defaultProps} habits={habits} onSetTime={onSetTime} />);

    const timeInput = screen.getByLabelText(/reminder time for morning run/i);
    fireEvent.change(timeInput, { target: { value: '08:00' } });

    expect(onSetTime).toHaveBeenCalledWith('h1', '08:00');
  });

  // ── 10. Clear button calls onClearTime ─────────────────────────────────────

  it('calls onClearTime with correct habitId when clear button is clicked', async () => {
    const user = userEvent.setup();
    const onClearTime = vi.fn().mockResolvedValue(undefined);
    const habits = [makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: '07:30' })];

    render(<NotificationsTab {...defaultProps} habits={habits} onClearTime={onClearTime} />);

    await user.click(screen.getByRole('button', { name: /clear reminder for morning run/i }));

    expect(onClearTime).toHaveBeenCalledWith('h1');
  });

  // ── 11. "No habits yet" when empty ─────────────────────────────────────────

  it('shows "No habits yet" message when habits array is empty', () => {
    render(<NotificationsTab {...defaultProps} habits={[]} />);

    expect(screen.getByText(/no habits yet/i)).toBeInTheDocument();
  });

  // ── 12. Does not show archived habits ──────────────────────────────────────

  it('does not show archived habits', () => {
    const habits = [
      makeHabit({ id: 'h1', title: 'Morning Run' }),
      makeHabit({ id: 'h2', title: 'Archived Habit', archivedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.queryByText('Archived Habit')).not.toBeInTheDocument();
  });

  // ── Extra: multiple habits, each with independent time pickers ─────────────

  it('renders independent time pickers for each habit', () => {
    const habits = [
      makeHabit({ id: 'h1', title: 'Morning Run', notificationTime: '07:00' }),
      makeHabit({ id: 'h2', title: 'Evening Walk', notificationTime: '18:00' }),
    ];

    render(<NotificationsTab {...defaultProps} habits={habits} />);

    const input1 = screen.getByLabelText(/reminder time for morning run/i) as HTMLInputElement;
    const input2 = screen.getByLabelText(/reminder time for evening walk/i) as HTMLInputElement;

    expect(input1.value).toBe('07:00');
    expect(input2.value).toBe('18:00');
  });

  it('calls onSetTime with the correct habitId when changing time on second habit', () => {
    const onSetTime = vi.fn().mockResolvedValue(undefined);
    const habits = [
      makeHabit({ id: 'h1', title: 'Morning Run' }),
      makeHabit({ id: 'h2', title: 'Evening Walk' }),
    ];

    render(<NotificationsTab {...defaultProps} habits={habits} onSetTime={onSetTime} />);

    const input2 = screen.getByLabelText(/reminder time for evening walk/i);
    fireEvent.change(input2, { target: { value: '18:00' } });

    expect(onSetTime).toHaveBeenCalledWith('h2', '18:00');
  });
});
