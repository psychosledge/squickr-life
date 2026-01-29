import type { Collection } from '@squickr/shared';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CollectionListItem } from './CollectionListItem';
import { SortableCollectionItem } from './SortableCollectionItem';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';

interface CollectionListProps {
  collections: Collection[];
  entryCountsByCollection: Map<string, number>;
  onReorder?: (collectionId: string, previousCollectionId: string | null, nextCollectionId: string | null) => void;
}

/**
 * CollectionList Component
 * 
 * Container component that displays all collections with drag-and-drop reordering.
 * Shows collections in user-defined order with entry counts.
 * 
 * Features:
 * - Displays list of collections using SortableCollectionItem
 * - Shows collection count header
 * - Displays empty state when no collections exist
 * - Uses entry counts from projection
 * - Supports drag-and-drop reordering (except for virtual Uncategorized)
 */
export function CollectionList({ collections, entryCountsByCollection, onReorder }: CollectionListProps) {
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

  // Separate virtual Uncategorized from real collections
  const uncategorizedCollection = collections.find(c => c.id === UNCATEGORIZED_COLLECTION_ID);
  const realCollections = collections.filter(c => c.id !== UNCATEGORIZED_COLLECTION_ID);

  // Only real collections can be dragged
  const sortableIds = realCollections.map(c => c.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // If dropped outside or no handler, do nothing
    if (!over || !onReorder) {
      return;
    }

    // If dropped in same position, do nothing
    if (active.id === over.id) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find indices in the real collections array
    const oldIndex = realCollections.findIndex(c => c.id === activeId);
    const newIndex = realCollections.findIndex(c => c.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Calculate previousCollectionId and nextCollectionId for fractional indexing
    let previousCollectionId: string | null = null;
    let nextCollectionId: string | null = null;

    if (newIndex > 0) {
      const prevCollection = realCollections[newIndex - 1];
      if (prevCollection) {
        previousCollectionId = prevCollection.id;
      }
    }

    if (newIndex < realCollections.length - 1) {
      const nextCollection = realCollections[newIndex + 1];
      if (nextCollection) {
        nextCollectionId = nextCollection.id;
      }
    }

    // If moving down, adjust the neighbors
    if (oldIndex < newIndex) {
      const prevCollection = realCollections[newIndex];
      const nextCollection = realCollections[newIndex + 1];
      
      if (prevCollection) {
        previousCollectionId = prevCollection.id;
      }
      if (nextCollection && newIndex < realCollections.length - 1) {
        nextCollectionId = nextCollection.id;
      } else {
        nextCollectionId = null;
      }
    }

    // Call the reorder handler
    onReorder(activeId, previousCollectionId, nextCollectionId);
  };

  // Collection count header
  const collectionText = collections.length === 1 ? 'collection' : 'collections';

  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {collections.length} {collectionText}
      </div>
      
      <div className="space-y-2">
        {/* Render virtual Uncategorized first (not draggable) */}
        {uncategorizedCollection && (
          <CollectionListItem
            key={uncategorizedCollection.id}
            collection={uncategorizedCollection}
            entryCount={entryCountsByCollection.get(uncategorizedCollection.id) ?? 0}
          />
        )}

        {/* Render real collections with drag-and-drop */}
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {realCollections.map((collection) => {
              const entryCount = entryCountsByCollection.get(collection.id) ?? 0;
              return (
                <SortableCollectionItem
                  key={collection.id}
                  collection={collection}
                  entryCount={entryCount}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
