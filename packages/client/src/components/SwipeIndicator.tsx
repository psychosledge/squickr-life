/**
 * SwipeIndicator Component
 * 
 * Visual feedback during swipe gestures showing:
 * - Arrow indicating direction
 * - Collection name being navigated to
 * - Progress bar showing swipe completion
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SwipeIndicatorProps {
  isSwipeActive: boolean;
  swipeProgress: number; // -100 to 100
  previousCollectionName: string | null;
  nextCollectionName: string | null;
}

export function SwipeIndicator({
  isSwipeActive,
  swipeProgress,
  previousCollectionName,
  nextCollectionName,
}: SwipeIndicatorProps) {
  // Don't render if not actively swiping
  if (!isSwipeActive) {
    return null;
  }

  // Determine direction and which collection to show
  const isSwipingRight = swipeProgress > 0; // Going to previous
  const isSwipingLeft = swipeProgress < 0;  // Going to next

  // Don't render if no collection available in that direction
  if (isSwipingRight && !previousCollectionName) {
    return null;
  }
  if (isSwipingLeft && !nextCollectionName) {
    return null;
  }

  const collectionName = isSwipingRight ? previousCollectionName : nextCollectionName;
  const absProgress = Math.abs(swipeProgress);
  
  // Calculate opacity based on progress (fade in as you swipe)
  const opacity = Math.min(absProgress / 100, 0.9); // Max 90% opacity

  return (
    <div
      data-testid="swipe-indicator"
      className="fixed inset-0 pointer-events-none z-50 flex flex-col items-center justify-center"
      style={{ opacity }}
    >
      {/* Direction indicator and collection name */}
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-6 py-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        {isSwipingRight && (
          <>
            <ChevronLeft 
              data-testid="chevron-left"
              className="w-6 h-6 text-gray-600 dark:text-gray-300" 
            />
            <span className="text-lg font-medium text-gray-900 dark:text-white">
              {collectionName}
            </span>
          </>
        )}
        {isSwipingLeft && (
          <>
            <span className="text-lg font-medium text-gray-900 dark:text-white">
              {collectionName}
            </span>
            <ChevronRight 
              data-testid="chevron-right"
              className="w-6 h-6 text-gray-600 dark:text-gray-300" 
            />
          </>
        )}
      </div>

      {/* Progress bar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
        <div
          data-testid="swipe-progress-bar"
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
          style={{ width: `${absProgress}%` }}
        />
      </div>
    </div>
  );
}
