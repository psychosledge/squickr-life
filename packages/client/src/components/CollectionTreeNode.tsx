import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';
import type { Entry } from '@squickr/shared';
import { buildCollectionPath } from '../routes';
import { CollectionStats } from './CollectionStats';

interface CollectionTreeNodeProps {
  node: HierarchyNode;
  depth: number;
  onToggleExpand: (nodeId: string) => void;
  onNavigate?: (collectionId: string) => void;
  selectedCollectionId?: string;
  isDraggable: boolean;
  entriesByCollection?: Map<string | null, Entry[]>;
}

/**
 * CollectionTreeNode Component
 * 
 * Renders a single node in the hierarchical collection tree.
 * Handles both container nodes (year/month) and leaf nodes (day/custom).
 */
export function CollectionTreeNode({
  node,
  depth,
  onToggleExpand,
  selectedCollectionId,
  isDraggable,
  entriesByCollection,
}: CollectionTreeNodeProps) {
  const isSelected = node.collection?.id === selectedCollectionId;
  const isContainer = node.type === 'year' || node.type === 'month';
  
  // Setup drag-and-drop only for draggable custom collections
  const shouldUseDrag = isDraggable && node.type === 'custom';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: node.id,
    disabled: !shouldUseDrag,
  });

  const style = shouldUseDrag ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;
  
  // Indentation based on depth
  const paddingLeft = `${depth * 1.5}rem`;
  
  // Icon selection
  let icon = '';
  if (node.type === 'year' || node.type === 'month') {
    icon = node.isExpanded ? '▼' : '▶';
  } else if (node.type === 'monthly') {
    icon = '🗓️';
  } else if (node.type === 'day') {
    icon = '📅';
  } else if (node.collection?.isFavorite) {
    icon = '⭐';
  } else {
    icon = '📝';
  }
  
  // Label with count if collapsed
  const label = node.count !== undefined 
    ? `${node.label} (${node.count} ${node.count === 1 ? 'log' : 'logs'})`
    : node.label;
  
  // Container nodes (year/month) - clickable but not navigable
  if (isContainer) {
    return (
      <>
        <button
          onClick={() => onToggleExpand(node.id)}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 
                     transition-colors duration-150 flex items-center gap-2
                     text-gray-700 dark:text-gray-300"
          style={{ paddingLeft }}
        >
          <span className="text-sm w-5 flex-shrink-0">{icon}</span>
          <span className="font-medium">{label}</span>
        </button>
        
        {/* Render children if expanded */}
        {node.isExpanded && node.children.map(child => (
          <CollectionTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            onToggleExpand={onToggleExpand}
            selectedCollectionId={selectedCollectionId}
            isDraggable={false}
            entriesByCollection={entriesByCollection}
          />
        ))}
      </>
    );
  }
  
  // Leaf nodes (day/custom) - navigable
  if (!node.collection) {
    return null; // Should not happen, but guard against it
  }
  
  // Get entries for this collection (if available)
  const collectionEntries = entriesByCollection?.get(node.collection.id) || [];
  
  return (
    <div ref={shouldUseDrag ? setNodeRef : undefined} style={style} className="relative group">
      {/* Drag Handle - visible on hover for draggable items */}
      {shouldUseDrag && (
        <div
          {...attributes}
          {...listeners}
          className="absolute right-0 top-1/2 -translate-y-1/2
                     md:right-auto md:left-0 md:-translate-x-8
                     w-12 h-12 md:w-8 md:h-8 
                     flex items-center justify-center
                     text-gray-500 dark:text-gray-400
                     md:text-gray-400 md:dark:text-gray-500
                     active:text-gray-700 dark:active:text-gray-300
                     md:hover:text-gray-600 md:dark:hover:text-gray-300
                     cursor-grab active:cursor-grabbing
                     opacity-100 md:opacity-30 
                     md:group-hover:opacity-100 md:group-focus-within:opacity-100
                     transition-all duration-200
                     active:scale-95"
          style={{ touchAction: 'none' }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-6 h-6 md:w-5 md:h-5"
          >
            <path d="M7 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM14 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM7 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM14 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM7 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM14 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" />
          </svg>
        </div>
      )}
      
      <div>
        <Link
          to={buildCollectionPath(node.collection.id)}
          className={`
            block px-4 py-2 transition-colors duration-150 flex items-center gap-2
            ${isSelected 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
          style={{ paddingLeft }}
        >
          <span className="text-sm w-5 flex-shrink-0">{icon}</span>
          <span>{label}</span>
        </Link>
        
        {/* Collection Stats - show below collection name */}
        <CollectionStats entries={collectionEntries} />
      </div>
    </div>
  );
}
