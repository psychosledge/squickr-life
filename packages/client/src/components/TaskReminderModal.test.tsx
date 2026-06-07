import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TaskReminderModal } from './TaskReminderModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A future date that passes validation (>= 1 minute from the mocked "now") */
const FUTURE_DATE = '2099-12-31';
const FUTURE_TIME = '12:00';

function renderModal(props: Partial<React.ComponentProps<typeof TaskReminderModal>> = {}) {
  const defaults = {
    onSave: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  render(<TaskReminderModal {...defaults} />);
  return defaults;
}

// ---------------------------------------------------------------------------

describe('TaskReminderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders date and time pickers', () => {
    renderModal();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time/i)).toBeInTheDocument();
  });

  it('Save button is disabled initially (date pre-populated, time blank)', () => {
    renderModal();
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('Save button is disabled when only date is filled', () => {
    renderModal();
    // Date is pre-populated with today; set a specific future date, leave time empty
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: FUTURE_DATE } });
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('Save button is disabled when only time is filled and date is explicitly cleared', async () => {
    const user = userEvent.setup();
    renderModal();
    // Date starts pre-populated with today; clear it so only time is filled
    await user.clear(screen.getByLabelText(/date/i));
    await user.type(screen.getByLabelText(/time/i), FUTURE_TIME);
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('Save button is enabled when both date and time are filled', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: FUTURE_DATE } });
    fireEvent.change(screen.getByLabelText(/time/i), { target: { value: FUTURE_TIME } });
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onSave with UTC ISO-8601 string when Save clicked', () => {
    const { onSave } = renderModal();

    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: FUTURE_DATE } });
    fireEvent.change(screen.getByLabelText(/time/i), { target: { value: FUTURE_TIME } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledTimes(1);

    // The argument should be a valid ISO string representing the entered datetime
    const arg = (onSave as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(() => new Date(arg)).not.toThrow();
    expect(new Date(arg).toISOString()).toBe(arg); // must be a valid ISO string
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Clear reminder" button is NOT visible when existingReminderAt is not set', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('"Clear reminder" button IS visible when existingReminderAt is provided', () => {
    renderModal({ existingReminderAt: '2026-04-08T10:00:00.000Z' });
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('pre-populates date picker with today\'s date when no existingReminderAt is provided', () => {
    // Freeze system time so `new Date()` inside the lazy initializer is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T09:00:00.000'));

    try {
      renderModal();
      const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
      expect(dateInput.value).toBe('2026-06-06');
    } finally {
      vi.useRealTimers();
    }
  });

  it('pre-populates pickers when existingReminderAt is provided', () => {
    // Use a fixed UTC time and verify that date/time inputs are populated
    renderModal({ existingReminderAt: '2099-06-15T14:30:00.000Z' });
    const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
    const timeInput = screen.getByLabelText(/time/i) as HTMLInputElement;
    // Date/time values should be non-empty (local formatting may vary)
    expect(dateInput.value).not.toBe('');
    expect(timeInput.value).not.toBe('');
  });

  it('calls onClear when "Clear reminder" is clicked', async () => {
    const user = userEvent.setup();
    const { onClear } = renderModal({ existingReminderAt: '2026-04-08T10:00:00.000Z' });
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows validation error when datetime is in the past', () => {
    renderModal();
    act(() => {
      // Override the pre-populated today's date with a past date
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2000-01-01' } });
      fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '00:00' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows validation error when datetime is less than 1 minute in the future', () => {
    // Freeze "now" at 12:00:30 (30 seconds past the minute).
    // The date+time picker has minute precision, so entering "12:01" resolves to
    // 12:01:00 — only 30 seconds in the future, which is < 60 000 ms.
    const frozenNow = new Date('2099-06-15T12:00:30.000').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow);

    renderModal();

    act(() => {
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2099-06-15' } });
      // 12:01:00 is only 30 s ahead of the frozen 12:00:30 now → fails 1-minute guard
      fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '12:01' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/minute/i);

    vi.restoreAllMocks();
  });

  it('does NOT show an error and calls onSave when time is at least 1 minute ahead', () => {
    // Freeze "now" at 12:00 so that 12:02 is 2 minutes in the future (passes validation).
    const frozenNow = new Date('2099-06-15T12:00:00.000').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(frozenNow);

    const { onSave } = renderModal();

    act(() => {
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2099-06-15' } });
      fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '12:02' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
