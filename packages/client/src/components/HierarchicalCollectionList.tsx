import type { Collection } from '@squickr/shared';
import { useCollectionHierarchy } from '../hooks/useCollectionHierarchy';
import { CollectionTreeNode } from './CollectionTreeNode';

interface HierarchicalCollectionListProps {
  collections: Collection[];
  selectedCollectionId?: string;
  onNavigate?: (collectionId: string) => void;
}

/**
 * HierarchicalCollectionList Component
 * 
 * Displays collections in a hierarchical tree structure with virtual year/month nodes.
 * 
 * Features:
 * - Groups daily logs by year and month
 * - Shows custom collections at root level
 * - Pins favorited collections to top
 * - Auto-expands current year and month
 * - Persists expand/collapse state
 */
export function HierarchicalCollectionList({
  collections,
  selectedCollectionId,
  onNavigate,
}: HierarchicalCollectionListProps) {
  const { nodes, toggleExpand } = useCollectionHierarchy(collections);
  
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
    <div className="w-full max-w-2xl mx-auto pb-32">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {collections.length} {collectionText}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {nodes.map(node => (
          <CollectionTreeNode
            key={node.id}
            node={node}
            depth={0}
            onToggleExpand={toggleExpand}
            onNavigate={onNavigate}
            selectedCollectionId={selectedCollectionId}
          />
        ))}
      </div>
    </div>
  );
}
