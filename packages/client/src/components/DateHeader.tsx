import { formatDateLabel } from '../utils/dateUtils';

interface DateHeaderProps {
  date: string; // YYYY-MM-DD
  entryCount: number;
  /** Override the reference date used for Today/Yesterday labels (defaults to now). */
  referenceDate?: Date;
}

/**
 * DateHeader Component
 * 
 * Displays a sticky date header for a daily log section.
 * Shows "Today", "Yesterday", or a formatted date depending on the date.
 */
export function DateHeader({ date, entryCount, referenceDate }: DateHeaderProps) {
  const entryText = entryCount === 1 ? 'entry' : 'entries';

  return (
    <div 
      className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 
                 px-4 py-2 mb-2 rounded-lg
                 border-b border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {formatDateLabel(date, referenceDate)}
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {entryCount} {entryText}
        </span>
      </div>
    </div>
  );
}
