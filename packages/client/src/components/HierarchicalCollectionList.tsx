import type { Collection } from '@squickr/shared';
import { useMemo } from 'react';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCollectionHierarchy } from '../hooks/useCollectionHierarchy';
import { CollectionTreeNode } from './CollectionTreeNode';

interface HierarchicalCollectionListProps {
  collections: Collection[];
  selectedCollectionId?: string;
  onNavigate?: (collectionId: string) => void;
  onReorder?: (collectionId: string, previousCollectionId: string | null, nextCollectionId: string | null) => void;
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
  onNavigate,
  onReorder,
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
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(touchSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay for touch devices
        tolerance: 5, // Allow 5px of movement during delay
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
          ? node.collection!.isFavorite 
          : !node.collection!.isFavorite
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
  
  // Separate nodes into sections for rendering with separators
  const favoriteNodes = nodes.filter(node => node.type === 'custom' && node.collection?.isFavorite);
  const dateHierarchyNodes = nodes.filter(node => node.type === 'year');
  const otherCustomNodes = nodes.filter(node => node.type === 'custom' && !node.collection?.isFavorite);
  
  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {collections.length} {collectionText}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible md:ml-12">
        {/* Favorites Section */}
        {favoriteNodes.length > 0 && onReorder && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, 'favorites')}
          >
            <SortableContext items={favoriteNodes.map(n => n.id)} strategy={verticalListSortingStrategy}>
              {favoriteNodes.map(node => (
                <CollectionTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  onToggleExpand={toggleExpand}
                  onNavigate={onNavigate}
                  selectedCollectionId={selectedCollectionId}
                  isDraggable={true}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        
        {/* Non-draggable favorites (when onReorder not provided) */}
        {favoriteNodes.length > 0 && !onReorder && favoriteNodes.map(node => (
          <CollectionTreeNode
            key={node.id}
            node={node}
            depth={0}
            onToggleExpand={toggleExpand}
            onNavigate={onNavigate}
            selectedCollectionId={selectedCollectionId}
            isDraggable={false}
          />
        ))}
        
        {/* Separator between Favorites and Date Hierarchy */}
        {favoriteNodes.length > 0 && dateHierarchyNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Date Hierarchy Section (not draggable) */}
        {dateHierarchyNodes.map(node => (
          <CollectionTreeNode
            key={node.id}
            node={node}
            depth={0}
            onToggleExpand={toggleExpand}
            onNavigate={onNavigate}
            selectedCollectionId={selectedCollectionId}
            isDraggable={false}
          />
        ))}
        
        {/* Separator between Date Hierarchy and Other Customs */}
        {dateHierarchyNodes.length > 0 && otherCustomNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Separator between Favorites and Other Customs (when no date hierarchy) */}
        {favoriteNodes.length > 0 && dateHierarchyNodes.length === 0 && otherCustomNodes.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700" />
        )}
        
        {/* Other Custom Collections Section */}
        {otherCustomNodes.length > 0 && onReorder && (
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
                  onNavigate={onNavigate}
                  selectedCollectionId={selectedCollectionId}
                  isDraggable={true}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        
        {/* Non-draggable other customs (when onReorder not provided) */}
        {otherCustomNodes.length > 0 && !onReorder && otherCustomNodes.map(node => (
          <CollectionTreeNode
            key={node.id}
            node={node}
            depth={0}
            onToggleExpand={toggleExpand}
            onNavigate={onNavigate}
            selectedCollectionId={selectedCollectionId}
            isDraggable={false}
          />
        ))}
      </div>
    </div>
  );
}
