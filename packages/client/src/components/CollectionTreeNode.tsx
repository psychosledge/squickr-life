import { Link } from 'react-router-dom';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';
import { buildCollectionPath } from '../routes';

interface CollectionTreeNodeProps {
  node: HierarchyNode;
  depth: number;
  onToggleExpand: (nodeId: string) => void;
  onNavigate?: (collectionId: string) => void;
  selectedCollectionId?: string;
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
}: CollectionTreeNodeProps) {
  const isSelected = node.collection?.id === selectedCollectionId;
  const isContainer = node.type === 'year' || node.type === 'month';
  
  // Indentation based on depth
  const paddingLeft = `${depth * 1.5}rem`;
  
  // Icon selection
  let icon = '';
  if (node.type === 'year' || node.type === 'month') {
    icon = node.isExpanded ? '▼' : '▶';
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
          />
        ))}
      </>
    );
  }
  
  // Leaf nodes (day/custom) - navigable
  if (!node.collection) {
    return null; // Should not happen, but guard against it
  }
  
  return (
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
  );
}
