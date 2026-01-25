import type { Task } from '@squickr/shared';

interface TaskItemProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onReopen: (taskId: string) => void;
}

/**
 * TaskItem Component
 * 
 * Displays a single task with its title, status, timestamp, and action buttons.
 */
export function TaskItem({ task, onComplete, onReopen }: TaskItemProps) {
  const isCompleted = task.status === 'completed';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className={`text-lg font-medium ${
            isCompleted 
              ? 'text-gray-500 dark:text-gray-400 line-through' 
              : 'text-gray-900 dark:text-white'
          }`}>
            {task.title}
          </h3>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatTimestamp(task.createdAt)}
            {isCompleted && task.completedAt && (
              <span className="ml-2">
                • Completed {formatTimestamp(task.completedAt)}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isCompleted
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {task.status}
          </span>
          
          {isCompleted ? (
            <button
              onClick={() => onReopen(task.id)}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 
                         bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                         rounded-md transition-colors"
              aria-label="Reopen task"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => onComplete(task.id)}
              className="px-3 py-1 text-sm font-medium text-white 
                         bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 
                         rounded-md transition-colors"
              aria-label="Complete task"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format timestamp as relative time
 * e.g., "just now", "2 minutes ago", "3 hours ago"
 */
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 10) {
    return 'just now';
  } else if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
}
