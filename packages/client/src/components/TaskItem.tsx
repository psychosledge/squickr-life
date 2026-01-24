import type { Task } from '@squickr/shared';

interface TaskItemProps {
  task: Task;
}

/**
 * TaskItem Component
 * 
 * Displays a single task with its title, status, and timestamp.
 */
export function TaskItem({ task }: TaskItemProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {task.title}
          </h3>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatTimestamp(task.createdAt)}
          </div>
        </div>
        
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                         bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {task.status}
          </span>
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
