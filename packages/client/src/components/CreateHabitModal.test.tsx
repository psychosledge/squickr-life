import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    expect(cmd.frequency).toEqual({ type: 'weekly', targetDays: [] });
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

  it('should show a disabled notification time field', () => {
    render(
      <CreateHabitModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const notifInput = screen.getByLabelText(/Notification Time/i);
    expect(notifInput).toBeDisabled();
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
});
