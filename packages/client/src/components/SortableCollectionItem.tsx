import type { Collection } from '@squickr/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CollectionListItem } from './CollectionListItem';

interface SortableCollectionItemProps {
  collection: Collection;
  activeTaskCount: number;
}

/**
 * SortableCollectionItem Component
 * 
 * Wrapper around CollectionListItem that adds drag-and-drop functionality.
 * Provides a drag handle and visual feedback during dragging.
 */
export function SortableCollectionItem({ 
  collection, 
  activeTaskCount 
}: SortableCollectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group pr-14 md:pr-0 md:pl-0">
      {/* Drag Handle - visible on hover and focus */}
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

      {/* The actual collection item */}
      <CollectionListItem
        collection={collection}
        activeTaskCount={activeTaskCount}
      />
    </div>
  );
}
