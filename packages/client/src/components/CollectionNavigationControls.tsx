/**
 * CollectionNavigationControls Component
 * 
 * Displays Previous/Next navigation buttons for flipping between collections.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Collection } from '@squickr/shared';

export interface CollectionNavigationControlsProps {
  previousCollection: Collection | null;
  nextCollection: Collection | null;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
}

export function CollectionNavigationControls({
  previousCollection,
  nextCollection,
  onNavigatePrevious,
  onNavigateNext,
}: CollectionNavigationControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Previous button */}
      <button
        onClick={onNavigatePrevious}
        disabled={!previousCollection}
        aria-label={previousCollection ? `Previous: ${previousCollection.name}` : 'No previous collection'}
        title={previousCollection?.name}
        className="
          p-2
          text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white
          hover:bg-gray-100 dark:hover:bg-gray-700
          rounded-lg
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
          disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400
        "
        type="button"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Next button */}
      <button
        onClick={onNavigateNext}
        disabled={!nextCollection}
        aria-label={nextCollection ? `Next: ${nextCollection.name}` : 'No next collection'}
        title={nextCollection?.name}
        className="
          p-2
          text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white
          hover:bg-gray-100 dark:hover:bg-gray-700
          rounded-lg
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
          disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400
        "
        type="button"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
