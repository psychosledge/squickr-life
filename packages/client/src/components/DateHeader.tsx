interface DateHeaderProps {
  date: string; // YYYY-MM-DD
  entryCount: number;
}

/**
 * DateHeader Component
 * 
 * Displays a sticky date header for a daily log section.
 * Shows "Today", "Yesterday", or a formatted date depending on the date.
 */
export function DateHeader({ date, entryCount }: DateHeaderProps) {
  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00'); // Avoid timezone issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);
    
    if (inputDate.getTime() === today.getTime()) return 'Today';
    if (inputDate.getTime() === yesterday.getTime()) return 'Yesterday';
    
    // Format as "Friday, Jan 24"
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const entryText = entryCount === 1 ? 'entry' : 'entries';

  return (
    <div 
      className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 
                 px-4 py-2 mb-2 rounded-lg
                 border-b border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {formatDateLabel(date)}
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {entryCount} {entryText}
        </span>
      </div>
    </div>
  );
}
