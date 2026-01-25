import type { Task } from '@squickr/shared';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
}

/**
 * TaskList Component
 * 
 * Displays a list of tasks from the projection.
 * Shows empty state when no tasks exist.
 */
export function TaskList({ tasks, onComplete, onReopen }: TaskListProps) {
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
      
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskItem 
            key={task.id} 
            task={task} 
            onComplete={onComplete}
            onReopen={onReopen}
          />
        ))}
      </div>
    </div>
  );
}
