/**
 * useCopyToClipboard Hook Tests
 * ADR-022: Clipboard copy utility hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    // Mock navigator.clipboard (jsdom doesn't implement it)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should call navigator.clipboard.writeText with the correct text', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('hello world');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world');
  });

  it('should set copied=true immediately after copy', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    expect(result.current.copied).toBe(false);

    await act(async () => {
      await result.current.copy('some text');
    });

    expect(result.current.copied).toBe(true);
  });

  it('should revert copied to false after the revert delay', async () => {
    const revertDelayMs = 2000;
    const { result } = renderHook(() => useCopyToClipboard(revertDelayMs));

    await act(async () => {
      await result.current.copy('some text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(revertDelayMs);
    });

    expect(result.current.copied).toBe(false);
  });

  it('should NOT revert copied before the revert delay has elapsed', async () => {
    const revertDelayMs = 2000;
    const { result } = renderHook(() => useCopyToClipboard(revertDelayMs));

    await act(async () => {
      await result.current.copy('some text');
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(revertDelayMs - 1);
    });

    expect(result.current.copied).toBe(true);
  });

  it('rapid double-click: second copy resets the timer so copied stays true until the full delay after the second click', async () => {
    const revertDelayMs = 2000;
    const { result } = renderHook(() => useCopyToClipboard(revertDelayMs));

    // First copy
    await act(async () => {
      await result.current.copy('first');
    });

    expect(result.current.copied).toBe(true);

    // Advance almost to the revert point…
    act(() => {
      vi.advanceTimersByTime(revertDelayMs - 100);
    });

    // …then fire a second copy — this must cancel the first timer
    await act(async () => {
      await result.current.copy('second');
    });

    expect(result.current.copied).toBe(true);

    // Advance by 100 ms: the OLD timer would have fired, but it was cancelled.
    // copied must still be true.
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.copied).toBe(true);

    // Advance the remaining delay — the new timer should now fire.
    act(() => {
      vi.advanceTimersByTime(revertDelayMs - 100);
    });

    expect(result.current.copied).toBe(false);
  });
});
