import type { DailyLog } from '@squickr/domain';
import { DaySection } from './DaySection';
import { getLocalDateKey } from '../utils/dateUtils';

interface DailyLogsListProps {
  dailyLogs: DailyLog[];
  onLoadEarlier: () => void;
  hasMoreDays: boolean;
  // Task handlers
  onCompleteTask: (taskId: string) => void;
  onReopenTask: (taskId: string) => void;
  onUpdateTaskTitle: (taskId: string, newTitle: string) => void;
  // Note handlers
  onUpdateNoteContent: (noteId: string, newContent: string) => void;
  // Event handlers
  onUpdateEventContent: (eventId: string, newContent: string) => void;
  onUpdateEventDate: (eventId: string, newDate: string | null) => void;
  // Common handlers
  onDelete: (entryId: string) => void;
  onReorder: (entryId: string, previousEntryId: string | null, nextEntryId: string | null) => void;
}

/**
 * DailyLogsList Component
 * 
 * Renders all daily log sections with progressive loading.
 * Shows a "Load Earlier Days" button when more history is available.
 */
export function DailyLogsList({
  dailyLogs,
  onLoadEarlier,
  hasMoreDays,
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onReorder
}: DailyLogsListProps) {
  if (dailyLogs.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No entries yet. Add one above to get started!
        </p>
      </div>
    );
  }

  // Determine which day is "today" for special ID (timezone-safe)
  const today = getLocalDateKey();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {dailyLogs.map((dailyLog) => (
        <DaySection
          key={dailyLog.date}
          dailyLog={dailyLog}
          isToday={dailyLog.date === today}
          onCompleteTask={onCompleteTask}
          onReopenTask={onReopenTask}
          onUpdateTaskTitle={onUpdateTaskTitle}
          onUpdateNoteContent={onUpdateNoteContent}
          onUpdateEventContent={onUpdateEventContent}
          onUpdateEventDate={onUpdateEventDate}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      ))}

      {/* Progressive loading button */}
      {hasMoreDays && (
        <div className="mt-8 text-center">
          <button
            onClick={onLoadEarlier}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 
                     text-gray-700 dark:text-gray-300
                     rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600
                     transition-colors duration-200"
          >
            Load Earlier Days
          </button>
        </div>
      )}
    </div>
  );
}
