import { Link } from 'react-router-dom';
import type { Collection } from '@squickr/shared';
import { buildCollectionPath } from '../routes';

interface CollectionListItemProps {
  collection: Collection;
  entryCount: number;
}

/**
 * CollectionListItem Component
 * 
 * Displays a single collection with name and entry count.
 * Tappable to navigate to collection detail view.
 * 
 * Features:
 * - Shows collection name prominently
 * - Shows entry count with proper pluralization
 * - Links to collection detail page
 * - Card-style layout consistent with EntryList items
 */
export function CollectionListItem({ collection, entryCount }: CollectionListItemProps) {
  const entryText = entryCount === 1 ? 'entry' : 'entries';

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
          {entryCount} {entryText}
        </p>
      </div>
    </Link>
  );
}
