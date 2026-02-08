import type { Entry, Collection } from '@squickr/domain';
import { BulletIcon } from './BulletIcon';

interface GhostEntryProps {
  entry: Entry & { 
    renderAsGhost: true; 
    ghostNewLocation?: string; 
  };
  onNavigateToCollection: (collectionId: string) => void;
  collections: Collection[];
}

/**
 * GhostEntry Component
 * 
 * Renders a "ghost" entry - a crossed-out representation of a task that has been
 * migrated/moved to another collection. Shows where the task went and provides
 * navigation to the new location.
 * 
 * Design:
 * - Crossed-out text (strikethrough)
 * - Muted/grayed appearance (lower opacity)
 * - Shows ➜ migration arrow
 * - "Go to [Collection]" button/link
 * - NOT interactive for drag-drop
 * - NO checkbox or edit buttons
 */
export function GhostEntry({ 
  entry, 
  onNavigateToCollection,
  collections,
}: GhostEntryProps) {
  // Find the target collection name
  const targetCollectionId = entry.ghostNewLocation;
  const targetCollection = collections.find(c => c.id === targetCollectionId);
  const targetCollectionName = targetCollection?.name || 'another collection';

  // Get entry title/content based on type
  const getEntryText = () => {
    if (entry.type === 'task') {
      return entry.title;
    }
    if (entry.type === 'note') {
      return entry.content;
    }
    if (entry.type === 'event') {
      return entry.content;
    }
    return '';
  };

  const handleNavigate = () => {
    if (targetCollectionId) {
      onNavigateToCollection(targetCollectionId);
    }
  };

  return (
    <div 
      className="
        py-3 px-4
        bg-white dark:bg-gray-800
        rounded-lg
        border border-gray-200 dark:border-gray-700
        opacity-50
      "
    >
      <div className="flex items-start gap-3">
        {/* Bullet icon - muted */}
        <div className="flex-shrink-0 mt-1 opacity-60">
          <BulletIcon entry={entry} />
        </div>

        {/* Ghost entry content */}
        <div className="flex-1 min-w-0">
          {/* Crossed-out text */}
          <div className="
            text-gray-500 dark:text-gray-400
            line-through
            text-base
            break-words
          ">
            {getEntryText()}
          </div>

          {/* Migration indicator and navigation */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-400 dark:text-gray-500">
              ➜
            </span>
            <button
              onClick={handleNavigate}
              className="
                text-sm text-blue-600 dark:text-blue-400
                hover:text-blue-800 dark:hover:text-blue-300
                hover:underline
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                rounded
                transition-colors
              "
              type="button"
              aria-label={`Go to ${targetCollectionName}`}
            >
              Go to {targetCollectionName}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
