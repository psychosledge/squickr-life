import type { Collection, Entry } from '@squickr/domain';
import { useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionHierarchy, type HierarchyNode } from '../hooks/useCollectionHierarchy';
import { CollectionTreeNode } from './CollectionTreeNode';
import { DRAG_SENSOR_CONFIG } from '../utils/constants';
import { isEffectivelyFavorited } from '../utils/collectionUtils';
import { getCollectionDisplayName } from '../utils/formatters';
import { sortDailyLogsByDate } from '../utils/collectionSorting';
import { useApp } from '../context/AppContext';

interface HierarchicalCollectionListProps {
  collections: Collection[];
  selectedCollectionId?: string;
  onReorder?: (collectionId: string, previousCollectionId: string | null, nextCollectionId: string | null) => void;
  entriesByCollection?: Map<string | null, Entry[]>;
}

/**
 * Helper function to determine if a divider should be shown between two sections
 */
function shouldShowDivider(beforeSection: HierarchyNode[], afterSection: HierarchyNode[]): boolean {
  return beforeSection.length > 0 && afterSection.length > 0;
}

/**
 * SectionDivider component with proper ARIA semantics
 */
function SectionDivider() {
  return (
    <div 
      className="border-t border-gray-200 dark:border-gray-700 my-2" 
      role="separator"
      aria-orientation="horizontal"
    />
  );
}

/**
 * HierarchicalCollectionList Component
 * 
 * Displays collections in a hierarchical tree structure with virtual year/month nodes.
 * 
 * Features:
 * - Groups daily logs by year and month
 * - Drag-and-drop reordering for custom collections
 * - NO section headers (testing flat UI)
 * - Visual dividers always shown between sections
 * - Touch-friendly with 48x48px tap targets and 250ms activation delay
 * - Shows custom collections at root level
 * - Pins favorited collections to top
 * - Auto-expands current year and month
 * - Persists expand/collapse state
 * 
 * TODO: Add tests for drag-and-drop functionality (no coverage currently)
 */
export function HierarchicalCollectionList({
  collections,
  selectedCollectionId,
  onReorder,
  entriesByCollection,
}: HierarchicalCollectionListProps) {
  // Get userPreferences from context
  const { userPreferences } = useApp();
  
  const { nodes, toggleExpand } = useCollectionHierarchy(collections, userPreferences);
  
  // Memoize sensor configuration to prevent recreation on every render
  const mouseSensor = useMemo(() => MouseSensor, []);
  const touchSensor = useMemo(() => TouchSensor, []);
  const keyboardSensor = useMemo(() => KeyboardSensor, []);
  
  // Setup drag-and-drop sensors
  const sensors = useSensors(
    useSensor(mouseSensor, {
      activationConstraint: {
        distance: DRAG_SENSOR_CONFIG.MOUSE_DRAG_DISTANCE,
      },
    }),
    useSensor(touchSensor, {
      activationConstraint: {
        delay: DRAG_SENSOR_CONFIG.TOUCH_DRAG_DELAY,
        tolerance: DRAG_SENSOR_CONFIG.TOUCH_DRAG_TOLERANCE,
      },
    }),
    useSensor(keyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end - calculate prev/next IDs for fractional indexing
  const handleDragEnd = (event: DragEndEvent, section: 'favorites' | 'other') => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorder) {
      return;
    }

    // Get the collections in this section
    const sectionCollections = nodes
      .filter(node => node.type === 'custom' && node.collection)
      .filter(node => 
        section === 'favorites' 
          ? isEffectivelyFavorited(node.collection!, userPreferences, now)
          : !isEffectivelyFavorited(node.collection!, userPreferences, now)
      );
    
    const activeId = String(active.id);
    const overId = String(over.id);

    const oldIndex = sectionCollections.findIndex(node => node.id === activeId);
    const newIndex = sectionCollections.findIndex(node => node.id === overId);

    // Determine previousCollectionId and nextCollectionId based on new position
    let previousCollectionId: string | null = null;
    let nextCollectionId: string | null = null;

    if (oldIndex < newIndex) {
      // Moving down: item will go AFTER the item we're hovering over
      previousCollectionId = sectionCollections[newIndex]?.id || null;
      nextCollectionId = sectionCollections[newIndex + 1]?.id || null;
    } else {
      // Moving up: item will go BEFORE the item we're hovering over
      previousCollectionId = sectionCollections[newIndex - 1]?.id || null;
      nextCollectionId = sectionCollections[newIndex]?.id || null;
    }

    onReorder(activeId, previousCollectionId, nextCollectionId);
  };
  
  // Collection count header
  const collectionText = collections.length === 1 ? 'collection' : 'collections';
  
  // Memoize reference date (MEDIUM PRIORITY - Casey's review #5)
  const now = useMemo(() => new Date(), []);
  
  // Separate nodes into sections for rendering with separators
  // Use isEffectivelyFavorited to include both manual and auto-favorited collections
  // For favorites, include both custom collections AND daily logs that are favorited
  const favoriteCustomNodes = nodes.filter(node => {
    // For custom collections, check if favorited
    if (node.type === 'custom' && node.collection) {
      return isEffectivelyFavorited(node.collection, userPreferences, now);
    }
    return false;
  });
  
  // Find favorited daily logs from the original collections array
  // This ensures they appear even when year/month are collapsed
  // Note: Only daily logs are currently auto-favorited (Today/Yesterday/Tomorrow)
  // Monthly/yearly auto-favorites are not yet implemented
  //
  
  const favoriteDayNodes = useMemo(() => {
    const favoritedDailies = collections
      .filter(collection => 
        collection.type === 'daily' &&
        isEffectivelyFavorited(collection, userPreferences, now)
      );
    
    // Use shared sorting utility (DRY - Casey's review #2)
    const sortedDailies = sortDailyLogsByDate(favoritedDailies, now);
    
    // Map to HierarchyNode format
    return sortedDailies.map(collection => ({
      type: 'day' as const,
      id: collection.id,
      label: getCollectionDisplayName(collection, now), // Use relative dates (Today, Yesterday, Tomorrow)
      date: collection.date,
      collection,
      children: [],
      isExpanded: false,
    } as HierarchyNode));
  }, [collections, userPreferences, now]);
  
  const allFavoriteNodes = useMemo(
    () => [...favoriteCustomNodes, ...favoriteDayNodes], 
    [favoriteCustomNodes, favoriteDayNodes]
  );
  
  const dateHierarchyNodes = nodes.filter(node => node.type === 'year');
  const otherCustomNodes = nodes.filter(node => 
    node.type === 'custom' && 
    node.collection &&
    !isEffectivelyFavorited(node.collection, userPreferences, now)
  );
  
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
  
  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center">
        <span>{collections.length} {collectionText}</span>
      </div>
      
      {/* ARIA live region for accessibility - announces divider state */}
      <div role="status" aria-live="polite" className="sr-only">
        Dividers shown between groups
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible md:ml-12">
        {/* Favorites Section - NO HEADER */}
        {allFavoriteNodes.length > 0 && (
          <>
            {onReorder ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, 'favorites')}
              >
                <SortableContext items={allFavoriteNodes.filter(n => n.type === 'custom').map(n => n.id)} strategy={verticalListSortingStrategy}>
                  {allFavoriteNodes.map(node => (
                    <CollectionTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      onToggleExpand={toggleExpand}
                      selectedCollectionId={selectedCollectionId}
                      isDraggable={node.type === 'custom'}
                      entriesByCollection={entriesByCollection}
                      userPreferences={userPreferences}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              allFavoriteNodes.map(node => (
                <CollectionTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  onToggleExpand={toggleExpand}
                  selectedCollectionId={selectedCollectionId}
                  isDraggable={false}
                  entriesByCollection={entriesByCollection}
                  userPreferences={userPreferences}
                />
              ))
            )}
          </>
        )}
        
        {/* Conditional Divider after Favorites */}
        {shouldShowDivider(allFavoriteNodes, otherCustomNodes) && <SectionDivider />}
        
        {/* Other Custom Collections Section - NO HEADER */}
        {otherCustomNodes.length > 0 && (
          <>
            {onReorder ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, 'other')}
              >
                <SortableContext items={otherCustomNodes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                  {otherCustomNodes.map(node => (
                    <CollectionTreeNode
                      key={node.id}
                      node={node}
                      depth={0}
                      onToggleExpand={toggleExpand}
                      selectedCollectionId={selectedCollectionId}
                      isDraggable={true}
                      entriesByCollection={entriesByCollection}
                      userPreferences={userPreferences}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              otherCustomNodes.map(node => (
                <CollectionTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  onToggleExpand={toggleExpand}
                  selectedCollectionId={selectedCollectionId}
                  isDraggable={false}
                  entriesByCollection={entriesByCollection}
                  userPreferences={userPreferences}
                />
              ))
            )}
          </>
        )}
        
        {/* Conditional Divider after Other Custom Collections */}
        {shouldShowDivider(otherCustomNodes, dateHierarchyNodes) && <SectionDivider />}
        
        {/* Conditional Divider between Favorites and Date Hierarchy (when no other customs) */}
        {shouldShowDivider(allFavoriteNodes, dateHierarchyNodes) && otherCustomNodes.length === 0 && <SectionDivider />}
        
        {/* Date Hierarchy Section - NO HEADER */}
        {dateHierarchyNodes.length > 0 && (
          <>
            {dateHierarchyNodes.map(node => (
              <CollectionTreeNode
                key={node.id}
                node={node}
                depth={0}
                onToggleExpand={toggleExpand}
                selectedCollectionId={selectedCollectionId}
                isDraggable={false}
                entriesByCollection={entriesByCollection}
                userPreferences={userPreferences}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
