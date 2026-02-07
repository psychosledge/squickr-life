/**
 * useSwipeProgress Hook Tests
 * 
 * Tests for the swipe progress tracking hook that provides visual feedback state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeProgress } from './useSwipeProgress';

describe('useSwipeProgress', () => {
  beforeEach(() => {
    // Clear any existing touch state
  });

  it('should initialize with no swipe active and zero progress', () => {
    const { result } = renderHook(() => useSwipeProgress());

    expect(result.current.isSwipeActive).toBe(false);
    expect(result.current.swipeProgress).toBe(0);
  });

  it('should activate swipe when touch moves more than 5px horizontally', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move 10px to the left (should activate)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 90, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(true);
  });

  it('should not activate swipe when movement is less than 5px', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move only 3px (should not activate)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 97, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(false);
    expect(result.current.swipeProgress).toBe(0);
  });

  it('should calculate negative progress when swiping left (next)', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch at x=200
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move 50px to the left (should be -50% of 100px threshold)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(true);
    expect(result.current.swipeProgress).toBe(-50); // -50px / 100px threshold = -50%
  });

  it('should calculate positive progress when swiping right (previous)', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch at x=100
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move 50px to the right (should be +50% of 100px threshold)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(true);
    expect(result.current.swipeProgress).toBe(50); // +50px / 100px threshold = +50%
  });

  it('should cap progress at 100% when swiping beyond threshold', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move 150px to the right (150% of threshold, should cap at 100)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 250, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.swipeProgress).toBe(100);
  });

  it('should cap negative progress at -100% when swiping beyond threshold', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // Move 150px to the left (-150% of threshold, should cap at -100)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 50, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.swipeProgress).toBe(-100);
  });

  it('should reset to inactive state when touch ends', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start and move touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);

      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(true);

    // End touch
    act(() => {
      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 150, clientY: 100 } as Touch],
      });
      result.current.handleTouchEnd(touchEnd);
    });

    expect(result.current.isSwipeActive).toBe(false);
    expect(result.current.swipeProgress).toBe(0);
  });

  it('should handle multiple touches correctly (only track single touch)', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start with two touches (should ignore)
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [
          { clientX: 100, clientY: 100 } as Touch,
          { clientX: 200, clientY: 100 } as Touch,
        ],
      });
      result.current.handleTouchStart(touchStart);
    });

    expect(result.current.isSwipeActive).toBe(false);
  });

  it('should ignore touch move when no touch start occurred', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Move without starting (should be ignored)
    act(() => {
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 150, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove);
    });

    expect(result.current.isSwipeActive).toBe(false);
    expect(result.current.swipeProgress).toBe(0);
  });

  it('should update progress continuously during swipe', () => {
    const { result } = renderHook(() => useSwipeProgress());

    // Start touch
    act(() => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      result.current.handleTouchStart(touchStart);
    });

    // First move: 20px right
    act(() => {
      const touchMove1 = new TouchEvent('touchmove', {
        touches: [{ clientX: 120, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove1);
    });

    expect(result.current.swipeProgress).toBe(20);

    // Second move: 40px right total
    act(() => {
      const touchMove2 = new TouchEvent('touchmove', {
        touches: [{ clientX: 140, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove2);
    });

    expect(result.current.swipeProgress).toBe(40);

    // Third move: 60px right total
    act(() => {
      const touchMove3 = new TouchEvent('touchmove', {
        touches: [{ clientX: 160, clientY: 100 } as Touch],
      });
      result.current.handleTouchMove(touchMove3);
    });

    expect(result.current.swipeProgress).toBe(60);
  });
});
