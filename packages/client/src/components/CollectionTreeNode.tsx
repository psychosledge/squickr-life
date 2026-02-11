import { Link } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';
import type { Entry, UserPreferences } from '@squickr/domain';
import { buildCollectionPath } from '../routes';
import { formatCollectionStats } from '../utils/collectionStatsFormatter';
import { ENTRY_ICONS } from '../utils/constants';

interface CollectionTreeNodeProps {
  node: HierarchyNode;
  depth: number;
  onToggleExpand: (nodeId: string) => void;
  selectedCollectionId?: string;
  isDraggable: boolean;
  entriesByCollection?: Map<string | null, Entry[]>;
  userPreferences: UserPreferences;
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
  userPreferences,
}: CollectionTreeNodeProps) {
  // Check if this is a month node with monthlyLog attached
  const monthlyLog = node.type === 'month' ? node.monthlyLog : undefined;
  const isMonthlyLogSelected = monthlyLog?.id === selectedCollectionId;
  
  // For leaf nodes, check if selected
  const isSelected = node.type !== 'year' && node.type !== 'month' && node.collection?.id === selectedCollectionId;
  
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
    icon = ENTRY_ICONS.CALENDAR;
  } else if (node.type === 'day') {
    icon = ENTRY_ICONS.EVENT;
  } else {
    // Custom collections - use note icon (no star)
    icon = ENTRY_ICONS.NOTE;
  }
  
  // Calculate stats text for inline display
  const statsText = formatCollectionStats(node, entriesByCollection);
  
  // Container nodes (year/month)
  if (isContainer) {
    // Special case: month node with monthly log (Feature 3)
    if (node.type === 'month' && monthlyLog) {
      return (
        <>
          <div className="flex items-stretch" style={{ paddingLeft }}>
            {/* Triangle button - expand/collapse */}
            <button
              onClick={() => onToggleExpand(node.id)}
              className="px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 
                         transition-colors duration-150
                         text-gray-700 dark:text-gray-300 flex-shrink-0"
              aria-label={node.isExpanded ? 'Collapse month' : 'Expand month'}
            >
              <span className="text-sm w-5 inline-block">{icon}</span>
            </button>
            
            {/* Clickable text/icon - navigate to monthly log */}
            <Link
              to={buildCollectionPath(monthlyLog.id)}
              className={`
                flex-1 px-2 py-2 transition-colors duration-150
                ${isMonthlyLogSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="text-sm">{ENTRY_ICONS.CALENDAR}</span>
                  <span className="font-medium">{node.label} {new Date(node.date).getFullYear()}</span>
                  {monthlyLog.isFavorite && <span className="text-sm">⭐</span>}
                </div>
                {statsText && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {statsText}
                  </span>
                )}
              </div>
            </Link>
          </div>
          
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
              userPreferences={userPreferences}
            />
          ))}
        </>
      );
    }
    
    // Regular container node (year or month without monthly log)
    return (
      <>
        <button
          onClick={() => onToggleExpand(node.id)}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 
                     transition-colors duration-150
                     text-gray-700 dark:text-gray-300"
          style={{ paddingLeft }}
        >
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <div className="flex items-baseline gap-2 flex-shrink-0">
              <span className="text-sm w-5">{icon}</span>
              <span className="font-medium">{node.label}</span>
            </div>
            {statsText && (
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {statsText}
              </span>
            )}
          </div>
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
            userPreferences={userPreferences}
          />
        ))}
      </>
    );
  }
  
  // Leaf nodes (day/monthly/custom) - navigable
  // Type narrowing: if not a container, must be a leaf node with collection
  if (node.type === 'monthly' || node.type === 'day' || node.type === 'custom') {
    if (!node.collection) {
      return null; // Should not happen, but guard against it
    }
  }
  
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
      
      <Link
        to={buildCollectionPath(node.collection.id)}
        className={`
          block px-4 py-2 transition-colors duration-150
          ${isSelected 
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }
        `}
        style={{ paddingLeft }}
      >
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <div className="flex items-baseline gap-2 flex-shrink-0">
            <span className="text-sm w-5">{icon}</span>
            <span>{node.label}</span>
          </div>
          {statsText && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {statsText}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
