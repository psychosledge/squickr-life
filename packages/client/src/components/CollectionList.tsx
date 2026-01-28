import type { Collection } from '@squickr/shared';
import { CollectionListItem } from './CollectionListItem';

interface CollectionListProps {
  collections: Collection[];
  entryCountsByCollection: Map<string, number>;
}

/**
 * CollectionList Component
 * 
 * Container component that displays all collections.
 * Shows collections in user-defined order with entry counts.
 * 
 * Features:
 * - Displays list of collections using CollectionListItem
 * - Shows collection count header
 * - Displays empty state when no collections exist
 * - Uses entry counts from projection
 */
export function CollectionList({ collections, entryCountsByCollection }: CollectionListProps) {
  // Empty state
  if (collections.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
          No collections yet
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Tap + to create your first collection
        </p>
      </div>
    );
  }

  // Collection count header
  const collectionText = collections.length === 1 ? 'collection' : 'collections';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {collections.length} {collectionText}
      </div>
      
      <div className="space-y-2">
        {collections.map((collection) => {
          const entryCount = entryCountsByCollection.get(collection.id) ?? 0;
          return (
            <CollectionListItem
              key={collection.id}
              collection={collection}
              entryCount={entryCount}
            />
          );
        })}
      </div>
    </div>
  );
}
