import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { FrequencyPicker } from './FrequencyPicker';

const defaultProps = {
  frequencyType: 'daily' as const,
  onFrequencyTypeChange: vi.fn(),
  targetDays: [0],
  onTargetDaysChange: vi.fn(),
  nDays: 2,
  onNDaysChange: vi.fn(),
};

describe('FrequencyPicker', () => {
  it('renders frequency dropdown with all three options', () => {
    render(<FrequencyPicker {...defaultProps} />);

    const select = screen.getByLabelText('Frequency') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('daily');
    expect(values).toContain('weekly');
    expect(values).toContain('every-n-days');
  });

  it('shows day-of-week picker only when weekly', () => {
    const { rerender } = render(<FrequencyPicker {...defaultProps} frequencyType="daily" />);
    expect(screen.queryByRole('group', { name: 'Days of week' })).not.toBeInTheDocument();

    rerender(<FrequencyPicker {...defaultProps} frequencyType="weekly" />);
    expect(screen.getByRole('group', { name: 'Days of week' })).toBeInTheDocument();

    rerender(<FrequencyPicker {...defaultProps} frequencyType="every-n-days" />);
    expect(screen.queryByRole('group', { name: 'Days of week' })).not.toBeInTheDocument();
  });

  it('shows number input only when every-n-days', () => {
    const { rerender } = render(<FrequencyPicker {...defaultProps} frequencyType="daily" />);
    expect(screen.queryByLabelText('Repeat interval (days)')).not.toBeInTheDocument();

    rerender(<FrequencyPicker {...defaultProps} frequencyType="weekly" />);
    expect(screen.queryByLabelText('Repeat interval (days)')).not.toBeInTheDocument();

    rerender(<FrequencyPicker {...defaultProps} frequencyType="every-n-days" />);
    expect(screen.getByLabelText('Repeat interval (days)')).toBeInTheDocument();
  });

  it('number input has min=2 and max=30', () => {
    render(<FrequencyPicker {...defaultProps} frequencyType="every-n-days" />);

    const input = screen.getByLabelText('Repeat interval (days)') as HTMLInputElement;
    expect(input.min).toBe('2');
    expect(input.max).toBe('30');
  });

  it('number input shows current nDays value', () => {
    render(<FrequencyPicker {...defaultProps} frequencyType="every-n-days" nDays={7} />);

    const input = screen.getByLabelText('Repeat interval (days)') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('calls onNDaysChange when number input changes', () => {
    const onNDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="every-n-days"
        nDays={2}
        onNDaysChange={onNDaysChange}
      />,
    );

    const input = screen.getByLabelText('Repeat interval (days)');
    fireEvent.change(input, { target: { value: '7' } });

    expect(onNDaysChange).toHaveBeenCalledWith(7);
  });

  it('calls onNDaysChange with 2 when input is cleared (NaN fallback)', () => {
    const onNDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="every-n-days"
        nDays={7}
        onNDaysChange={onNDaysChange}
      />,
    );

    const input = screen.getByLabelText('Repeat interval (days)');
    fireEvent.change(input, { target: { value: '' } });

    expect(onNDaysChange).toHaveBeenCalledWith(2);
  });

  it('clamps nDays to minimum of 2', async () => {
    const user = userEvent.setup();
    const onNDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="every-n-days"
        nDays={2}
        onNDaysChange={onNDaysChange}
      />,
    );

    const input = screen.getByLabelText('Repeat interval (days)');
    await user.clear(input);
    await user.type(input, '1');

    // All calls with value < 2 should be clamped to 2
    const calls = onNDaysChange.mock.calls.map((c) => c[0]);
    expect(calls.every((v: number) => v >= 2)).toBe(true);
  });

  it('clamps nDays to maximum of 30', async () => {
    const user = userEvent.setup();
    const onNDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="every-n-days"
        nDays={2}
        onNDaysChange={onNDaysChange}
      />,
    );

    const input = screen.getByLabelText('Repeat interval (days)');
    await user.clear(input);
    await user.type(input, '99');

    // All calls should be clamped to max 30
    const calls = onNDaysChange.mock.calls.map((c) => c[0]);
    expect(calls.every((v: number) => v <= 30)).toBe(true);
  });

  it('calls onFrequencyTypeChange when dropdown changes', async () => {
    const user = userEvent.setup();
    const onFrequencyTypeChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="daily"
        onFrequencyTypeChange={onFrequencyTypeChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');
    expect(onFrequencyTypeChange).toHaveBeenCalledWith('weekly');
  });

  it('calls onTargetDaysChange when a day is toggled on', async () => {
    const user = userEvent.setup();
    const onTargetDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="weekly"
        targetDays={[0]}
        onTargetDaysChange={onTargetDaysChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Monday' }));
    expect(onTargetDaysChange).toHaveBeenCalledWith([0, 1]);
  });

  it('calls onTargetDaysChange when a day is toggled off', async () => {
    const user = userEvent.setup();
    const onTargetDaysChange = vi.fn();
    // Two days selected so removal is allowed
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="weekly"
        targetDays={[0, 1]}
        onTargetDaysChange={onTargetDaysChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Monday' }));
    expect(onTargetDaysChange).toHaveBeenCalledWith([0]);
  });

  it('cannot deselect last remaining day — onTargetDaysChange not called', async () => {
    const user = userEvent.setup();
    const onTargetDaysChange = vi.fn();
    render(
      <FrequencyPicker
        {...defaultProps}
        frequencyType="weekly"
        targetDays={[0]}
        onTargetDaysChange={onTargetDaysChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Sunday' }));
    expect(onTargetDaysChange).not.toHaveBeenCalled();
  });

  it('day buttons have accessible full-name aria-labels', () => {
    render(<FrequencyPicker {...defaultProps} frequencyType="weekly" targetDays={[0]} />);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const name of dayNames) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('day buttons reflect aria-pressed state', () => {
    render(
      <FrequencyPicker {...defaultProps} frequencyType="weekly" targetDays={[1, 3]} />,
    );

    expect(screen.getByRole('button', { name: 'Sunday' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Wednesday' })).toHaveAttribute('aria-pressed', 'true');
  });
});
