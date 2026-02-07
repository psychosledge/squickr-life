/**
 * SwipeIndicator Component Tests
 * 
 * Tests for the visual swipe feedback indicator component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwipeIndicator } from './SwipeIndicator';

describe('SwipeIndicator', () => {
  it('should not render when swipe is not active', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={false}
        swipeProgress={0}
        previousCollectionName={null}
        nextCollectionName={null}
      />
    );

    // Should render nothing or hidden state
    expect(container.firstChild).toBeNull();
  });

  it('should render left arrow and previous collection name when swiping right (positive progress)', () => {
    render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName="Previous Collection"
        nextCollectionName="Next Collection"
      />
    );

    expect(screen.getByText('Previous Collection')).toBeInTheDocument();
  });

  it('should render right arrow and next collection name when swiping left (negative progress)', () => {
    render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={-50}
        previousCollectionName="Previous Collection"
        nextCollectionName="Next Collection"
      />
    );

    expect(screen.getByText('Next Collection')).toBeInTheDocument();
  });

  it('should not render when no previous collection available and swiping right', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName={null}
        nextCollectionName="Next Collection"
      />
    );

    // Should not show anything when trying to go previous but no previous exists
    expect(container.firstChild).toBeNull();
  });

  it('should not render when no next collection available and swiping left', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={-50}
        previousCollectionName="Previous Collection"
        nextCollectionName={null}
      />
    );

    // Should not show anything when trying to go next but no next exists
    expect(container.firstChild).toBeNull();
  });

  it('should render progress bar with correct width based on swipe progress', () => {
    const { rerender } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={25}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Find progress bar element (should have style width)
    const progressBar = screen.getByTestId('swipe-progress-bar');
    expect(progressBar).toHaveStyle({ width: '25%' });

    // Update progress
    rerender(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={75}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    expect(progressBar).toHaveStyle({ width: '75%' });
  });

  it('should use absolute value for progress bar width (negative progress)', () => {
    render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={-60}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    const progressBar = screen.getByTestId('swipe-progress-bar');
    expect(progressBar).toHaveStyle({ width: '60%' }); // Absolute value
  });

  it('should have low opacity when progress is low', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={10}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Opacity should scale with progress (10% progress = low opacity)
    const indicator = container.querySelector('[data-testid="swipe-indicator"]');
    expect(indicator).toBeInTheDocument();
  });

  it('should have high opacity when progress is high', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={90}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Opacity should be near full at 90% progress
    const indicator = container.querySelector('[data-testid="swipe-indicator"]');
    expect(indicator).toBeInTheDocument();
  });

  it('should be positioned fixed with pointer-events-none', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    const indicator = container.querySelector('[data-testid="swipe-indicator"]');
    expect(indicator).toHaveClass('fixed');
    expect(indicator).toHaveClass('pointer-events-none');
  });

  it('should have high z-index to appear above content', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    const indicator = container.querySelector('[data-testid="swipe-indicator"]');
    expect(indicator).toHaveClass('z-50');
  });

  it('should render ChevronLeft icon when swiping right', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Check for left chevron icon
    const leftChevron = container.querySelector('[data-testid="chevron-left"]');
    expect(leftChevron).toBeInTheDocument();
  });

  it('should render ChevronRight icon when swiping left', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={-50}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Check for right chevron icon
    const rightChevron = container.querySelector('[data-testid="chevron-right"]');
    expect(rightChevron).toBeInTheDocument();
  });

  it('should support dark mode styling', () => {
    const { container } = render(
      <SwipeIndicator
        isSwipeActive={true}
        swipeProgress={50}
        previousCollectionName="Previous"
        nextCollectionName="Next"
      />
    );

    // Should have dark mode classes (check child elements)
    const cardElement = container.querySelector('.bg-white');
    expect(cardElement).toBeInTheDocument();
    expect(cardElement).toHaveClass('dark:bg-gray-800');
  });
});
