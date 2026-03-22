import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CreateHabitModal } from './CreateHabitModal';
import type { CreateHabitCommand } from '@squickr/domain';

describe('CreateHabitModal', () => {
  it('should not render when closed', () => {
    render(
      <CreateHabitModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByText('New Habit')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('New Habit')).toBeInTheDocument();
    expect(screen.getByLabelText('Habit Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should auto-focus title input when opened', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Habit Name')).toHaveFocus();
  });

  it('should have Create button disabled when title is empty', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('should enable Create button when title is entered', async () => {
    const user = userEvent.setup();
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('should call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit with daily frequency by default', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.title).toBe('Meditate');
    expect(cmd.frequency).toEqual({ type: 'daily' });
    expect(cmd.order).toBeTruthy();
  });

  it('should show frequency selector with daily, weekly, and every-n-days options', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
    const select = screen.getByLabelText('Frequency') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('daily');
    expect(options).toContain('weekly');
    expect(options).toContain('every-n-days');
  });

  it('should call onSubmit with weekly frequency when selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Run');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.title).toBe('Run');
    expect(cmd.frequency.type).toBe('weekly');
    // targetDays defaults to today's day of week (non-empty)
    expect((cmd.frequency as { type: 'weekly'; targetDays: number[] }).targetDays).toHaveLength(1);
    expect((cmd.frequency as { type: 'weekly'; targetDays: number[] }).targetDays[0]).toBe(new Date().getDay());
  });

  it('should call onSubmit with every-n-days frequency when selected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Water plants');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'every-n-days');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.title).toBe('Water plants');
    expect(cmd.frequency).toEqual({ type: 'every-n-days', n: 2 });
  });

  it('notification time: field is enabled', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const notifInput = screen.getByLabelText(/Notification Time/i);
    expect(notifInput).not.toBeDisabled();
  });

  it('should close modal and reset form after successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Exercise');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should show error message when submit fails', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('should close on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should submit on Enter key in title field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate{Enter}');

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('should trim title whitespace before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), '  Meditate  ');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
      expect(cmd.title).toBe('Meditate');
    });
  });

  it('weekly: default targetDays contains today\'s day of week', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Run');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    const freq = cmd.frequency as { type: 'weekly'; targetDays: number[] };
    expect(freq.type).toBe('weekly');
    expect(freq.targetDays).toContain(new Date().getDay());
  });

  it('weekly: toggling a day adds it to targetDays', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Run');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');

    // Click Monday (day 1) to add it
    await user.click(screen.getByRole('button', { name: 'Monday' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    const freq = cmd.frequency as { type: 'weekly'; targetDays: number[] };
    expect(freq.targetDays).toContain(1);
  });

  it('weekly: cannot de-select the last remaining day', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Run');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');

    // The only selected day is today; clicking it should NOT remove it
    const todayIndex = new Date().getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    await user.click(screen.getByRole('button', { name: dayNames[todayIndex] }));

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    const freq = cmd.frequency as { type: 'weekly'; targetDays: number[] };
    // Still contains today's day — de-select was blocked
    expect(freq.targetDays).toContain(todayIndex);
    expect(freq.targetDays.length).toBeGreaterThanOrEqual(1);
  });

  it('weekly: submit with specific days produces correct targetDays', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Run');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');

    // Add Monday (1) and Wednesday (3) to whatever is already selected
    await user.click(screen.getByRole('button', { name: 'Monday' }));
    await user.click(screen.getByRole('button', { name: 'Wednesday' }));

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    const freq = cmd.frequency as { type: 'weekly'; targetDays: number[] };
    expect(freq.type).toBe('weekly');
    expect(freq.targetDays).toContain(1);  // Monday
    expect(freq.targetDays).toContain(3);  // Wednesday
  });

  it('should have a backdrop with z-[200] to stay above EntryActionsMenu portals (z-[150])', () => {
    const { container } = render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    // The backdrop is the outermost fixed div
    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.className).toContain('z-[200]');
  });

  it('every-n-days: changing interval to 7 submits frequency { type: every-n-days, n: 7 }', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Water plants');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'every-n-days');

    const intervalInput = screen.getByLabelText('Repeat interval (days)');
    fireEvent.change(intervalInput, { target: { value: '7' } });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.frequency).toEqual({ type: 'every-n-days', n: 7 });
  });

  it('notification time: setting a value includes notificationTime in command', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    const notifInput = screen.getByLabelText(/Notification Time/i);
    await user.clear(notifInput);
    await user.type(notifInput, '08:00');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.notificationTime).toBe('08:00');
  });

  it('notification time: leaving empty omits notificationTime from command', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const cmd: CreateHabitCommand = onSubmit.mock.calls[0][0];
    expect(cmd.notificationTime).toBeUndefined();
  });

  it('should reset all fields when cancel is clicked after entering values', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    // Enter a title and switch frequency to every-n-days
    await user.type(screen.getByLabelText('Habit Name'), 'Read');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'every-n-days');

    // Click cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Simulate reopening
    rerender(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    // Fields should be reset to defaults
    expect((screen.getByLabelText('Habit Name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Frequency') as HTMLSelectElement).value).toBe('daily');
  });

  it('should reset all fields when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    // Enter a title and switch frequency to every-n-days
    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    await user.selectOptions(screen.getByLabelText('Frequency'), 'every-n-days');

    // Press Escape
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    // Simulate reopening
    rerender(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
      />
    );

    // Fields should be reset to defaults
    expect((screen.getByLabelText('Habit Name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Frequency') as HTMLSelectElement).value).toBe('daily');
  });

  it('notification time: resets to empty after successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText('Habit Name'), 'Meditate');
    const notifInput = screen.getByLabelText(/Notification Time/i) as HTMLInputElement;
    await user.clear(notifInput);
    await user.type(notifInput, '08:00');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // Re-open modal
    rerender(
      <CreateHabitModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    const reopenedNotifInput = screen.getByLabelText(/Notification Time/i) as HTMLInputElement;
    expect(reopenedNotifInput.value).toBe('');
  });
});
