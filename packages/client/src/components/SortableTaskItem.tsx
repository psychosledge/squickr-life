import type { Task } from '@squickr/domain';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from './TaskItem';

interface SortableTaskItemProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdateTitle?: (taskId: string, newTitle: string) => void;
}

/**
 * SortableTaskItem Component
 * 
 * Wrapper around TaskItem that adds drag-and-drop functionality.
 * Provides a drag handle and visual feedback during dragging.
 */
export function SortableTaskItem({ task, onComplete, onReopen, onDelete, onUpdateTitle }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag Handle - visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 
                   w-6 h-8 flex items-center justify-center
                   text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                   cursor-grab active:cursor-grabbing
                   opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M7 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM14 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM7 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM14 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM7 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM14 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" />
        </svg>
      </div>

      {/* The actual task item */}
      <TaskItem
        task={task}
        onComplete={onComplete}
        onReopen={onReopen}
        onDelete={onDelete}
        onUpdateTitle={onUpdateTitle}
      />
    </div>
  );
}
