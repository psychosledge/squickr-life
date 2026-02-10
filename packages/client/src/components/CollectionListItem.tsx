import { Link } from 'react-router-dom';
import type { Collection } from '@squickr/domain';
import { buildCollectionPath } from '../routes';

interface CollectionListItemProps {
  collection: Collection;
  activeTaskCount: number;
}

/**
 * CollectionListItem Component
 * 
 * Displays a single collection with name and active task count.
 * Tappable to navigate to collection detail view.
 * 
 * Features:
 * - Shows collection name prominently
 * - Shows active task count with smart display logic
 * - Links to collection detail page
 * - Card-style layout consistent with EntryList items
 */
export function CollectionListItem({ collection, activeTaskCount }: CollectionListItemProps) {
  // Smart display logic for active task count
  const displayText = activeTaskCount === 0 
    ? 'No active tasks' 
    : activeTaskCount === 1 
      ? '1 active task' 
      : `${activeTaskCount} active tasks`;

  return (
    <Link
      to={buildCollectionPath(collection.id)}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md 
                 transition-shadow duration-200 border border-gray-200 dark:border-gray-700
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {collection.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {displayText}
        </p>
      </div>
    </Link>
  );
}
