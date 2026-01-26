import type { DailyLog } from '@squickr/shared';
import { DateHeader } from './DateHeader';
import { DayEntryList } from './DayEntryList';

interface DaySectionProps {
  dailyLog: DailyLog;
  isToday?: boolean;
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
 * DaySection Component
 * 
 * Groups a date header with its entries for a single day.
 * Provides an ID anchor for "Jump to Today" scrolling.
 */
export function DaySection({
  dailyLog,
  isToday = false,
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onReorder
}: DaySectionProps) {
  // Use special ID for today to enable "Jump to Today" functionality
  const sectionId = isToday ? 'daily-log-today' : `daily-log-${dailyLog.date}`;

  return (
    <section id={sectionId} className="mb-6">
      <DateHeader 
        date={dailyLog.date} 
        entryCount={dailyLog.entries.length} 
      />
      <DayEntryList
        dayEntries={dailyLog.entries}
        onCompleteTask={onCompleteTask}
        onReopenTask={onReopenTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onUpdateNoteContent={onUpdateNoteContent}
        onUpdateEventContent={onUpdateEventContent}
        onUpdateEventDate={onUpdateEventDate}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </section>
  );
}
