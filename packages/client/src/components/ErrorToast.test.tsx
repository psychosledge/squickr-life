import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ErrorToast } from './ErrorToast';

describe('ErrorToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should display the provided error message', () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="Something went wrong" onDismiss={onDismiss} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have role="alert" for screen reader accessibility', () => {
    render(<ErrorToast message="Error" onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should render a dismiss button', () => {
    render(<ErrorToast message="Error" onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /dismiss error/i })).toBeInTheDocument();
  });

  it('should call onDismiss when the dismiss button is clicked', async () => {
    // Use real timers for click interaction — fake timers can cause userEvent to hang
    vi.useRealTimers();
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<ErrorToast message="Error" onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after 5 seconds', () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="Error" onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not auto-dismiss before 5 seconds have elapsed', () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="Error" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(4999);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should reset the auto-dismiss timer when the message changes', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<ErrorToast message="First error" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Message changes — timer should restart
    rerender(<ErrorToast message="Second error" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // 3s after the re-render, timer hasn't fired again yet
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should clear the timer on unmount', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<ErrorToast message="Error" onDismiss={onDismiss} />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
