/**
 * useSwipeProgress Hook
 * 
 * Tracks swipe progress for visual feedback during navigation gestures.
 * Provides state for rendering swipe indicators (arrows, collection names, progress bar).
 */

import { useState, useRef, useCallback } from 'react';

const SWIPE_THRESHOLD = 100; // Must match threshold in useCollectionNavigation
const ACTIVATION_THRESHOLD = 5; // Minimum pixels to activate indicator

export interface UseSwipeProgressResult {
  isSwipeActive: boolean;
  swipeProgress: number; // -100 to 100 (negative = left/next, positive = right/prev)
  handleTouchStart: (event: TouchEvent) => void;
  handleTouchMove: (event: TouchEvent) => void;
  handleTouchEnd: (event: TouchEvent) => void;
}

export function useSwipeProgress(): UseSwipeProgressResult {
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    // Only track single touch
    if (event.touches.length !== 1) {
      return;
    }

    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    // Ignore if no touch start or no touches
    if (touchStartX.current === null || event.touches.length === 0) {
      return;
    }

    const currentX = event.touches[0]?.clientX;
    if (currentX === undefined) {
      return;
    }

    const deltaX = currentX - touchStartX.current;
    const absDeltaX = Math.abs(deltaX);

    // Only activate if movement exceeds activation threshold
    if (absDeltaX < ACTIVATION_THRESHOLD) {
      return;
    }

    // Activate swipe
    setIsSwipeActive(true);

    // Calculate progress as percentage of threshold (-100 to 100)
    const progress = (deltaX / SWIPE_THRESHOLD) * 100;
    
    // Cap at -100 to 100
    const cappedProgress = Math.max(-100, Math.min(100, progress));
    
    setSwipeProgress(cappedProgress);
  }, []);

  const handleTouchEnd = useCallback((_event: TouchEvent) => {
    // Reset state
    setIsSwipeActive(false);
    setSwipeProgress(0);
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  return {
    isSwipeActive,
    swipeProgress,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
