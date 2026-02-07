import type { Collection, Entry, UserPreferences } from '@squickr/domain';
import { useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionHierarchy, type HierarchyNode } from '../hooks/useCollectionHierarchy';
import { CollectionTreeNode } from './CollectionTreeNode';
import { DRAG_SENSOR_CONFIG } from '../utils/constants';
import { isEffectivelyFavorited } from '../utils/collectionUtils';

interface HierarchicalCollectionListProps {
  collections: Collection[];
  selectedCollectionId?: string;
  onReorder?: (collectionId: string, previousCollectionId: string | null, nextCollectionId: string | null) => void;
  entriesByCollection?: Map<string | null, Entry[]>;
  userPreferences: UserPreferences;
}

/**
 * HierarchicalCollectionList Component
 * 
 * Displays collections in a hierarchical tree structure with virtual year/month nodes.
 * 
 * Features:
 * - Groups daily logs by year and month
 * - Drag-and-drop reordering for custom collections
 * - Visual separators between sections (Favorites / Date Hierarchy / Other Customs)
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
  userPreferences,
}: HierarchicalCollectionListProps) {
  const { nodes, toggleExpand } = useCollectionHierarchy(collections);
  
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
          ? isEffectivelyFavorited(node.collection!, userPreferences)
          : !isEffectivelyFavorited(node.collection!, userPreferences)
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
  
  // Separate nodes into sections for rendering with separators
  // Use isEffectivelyFavorited to include both manual and auto-favorited collections
  // For favorites, include both custom collections AND daily logs that are favorited
  const favoriteCustomNodes = nodes.filter(node => {
    // For custom collections, check if favorited
    if (node.type === 'custom' && node.collection) {
      return isEffectivelyFavorited(node.collection, userPreferences);
    }
    return false;
  });
  
  // Find favorited daily/monthly logs from the original collections array
  // This ensures they appear even when year/month are collapsed
  const favoriteDayNodes = useMemo(() => {
    return collections
      .filter(collection => 
        (collection.type === 'daily' || collection.type === 'monthly') &&
        isEffectivelyFavorited(collection, userPreferences)
      )
      .map(collection => ({
        type: (collection.type === 'monthly' ? 'monthly' : 'day') as 'day' | 'monthly',
        id: collection.id,
        label: collection.name,
        date: collection.date,
        collection,
        children: [],
        isExpanded: false,
      } as HierarchyNode));
  }, [collections, userPreferences]);
  
  const allFavoriteNodes = useMemo(
    () => [...favoriteCustomNodes, ...favoriteDayNodes], 
    [favoriteCustomNodes, favoriteDayNodes]
  );
  
  const dateHierarchyNodes = nodes.filter(node => node.type === 'year');
  const otherCustomNodes = nodes.filter(node => 
    node.type === 'custom' && 
    node.collection &&
    !isEffectivelyFavorited(node.collection, userPreferences)
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
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {collections.length} {collectionText}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible md:ml-12">
        {/* Favorites Section */}
        {allFavoriteNodes.length > 0 && (
          <>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Favorites
            </div>
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
        
        {/* Separator between Favorites and Date Hierarchy */}
        {allFavoriteNodes.length > 0 && dateHierarchyNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Date Hierarchy Section (not draggable) */}
        {dateHierarchyNodes.length > 0 && (
          <>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Daily Logs
            </div>
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
        
        {/* Separator between Date Hierarchy and Other Customs */}
        {dateHierarchyNodes.length > 0 && otherCustomNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Separator between Favorites and Other Customs (when no date hierarchy) */}
        {allFavoriteNodes.length > 0 && dateHierarchyNodes.length === 0 && otherCustomNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Other Custom Collections Section */}
        {otherCustomNodes.length > 0 && (
          <>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Collections
            </div>
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
      </div>
    </div>
  );
}
