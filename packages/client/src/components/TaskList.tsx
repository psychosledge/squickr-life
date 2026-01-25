import type { Task } from '@squickr/shared';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskItem } from './SortableTaskItem';

interface TaskListProps {
  tasks: Task[];
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onReorder: (taskId: string, previousTaskId: string | null, nextTaskId: string | null) => void;
}

/**
 * TaskList Component
 * 
 * Displays a list of tasks from the projection with drag-and-drop reordering.
 * Shows empty state when no tasks exist.
 */
export function TaskList({ tasks, onComplete, onReopen, onDelete, onReorder }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = tasks.findIndex(task => task.id === active.id);
    const newIndex = tasks.findIndex(task => task.id === over.id);

    // Determine previousTaskId and nextTaskId based on new position
    // We need to think about the order AFTER the dragged item is removed
    let previousTaskId: string | null = null;
    let nextTaskId: string | null = null;

    if (oldIndex < newIndex) {
      // Moving down: item will go AFTER the item we're hovering over
      previousTaskId = tasks[newIndex]?.id || null;
      nextTaskId = tasks[newIndex + 1]?.id || null;
    } else {
      // Moving up: item will go BEFORE the item we're hovering over
      previousTaskId = tasks[newIndex - 1]?.id || null;
      nextTaskId = tasks[newIndex]?.id || null;
    }

    onReorder(active.id as string, previousTaskId, nextTaskId);
  };

  if (tasks.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No tasks yet. Add one above to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                onComplete={onComplete}
                onReopen={onReopen}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
