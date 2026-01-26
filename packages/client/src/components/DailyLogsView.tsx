import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyLog, EntryListProjection } from '@squickr/shared';
import { DailyLogsList } from './DailyLogsList';

interface DailyLogsViewProps {
  projection: EntryListProjection;
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
 * DailyLogsView Component
 * 
 * Top-level container for the daily logs feature.
 * Manages progressive loading state and "Jump to Today" functionality.
 * Replaces the previous EntryList view with an authentic bullet journal paradigm.
 */
export function DailyLogsView({
  projection,
  onCompleteTask,
  onReopenTask,
  onUpdateTaskTitle,
  onUpdateNoteContent,
  onUpdateEventContent,
  onUpdateEventDate,
  onDelete,
  onReorder
}: DailyLogsViewProps) {
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [daysToLoad] = useState(7);
  const earliestDateRef = useRef<string | undefined>();
  const [hasMoreDays, setHasMoreDays] = useState(true);
  const [showJumpToToday, setShowJumpToToday] = useState(false);

  // Memoize loadDailyLogs to prevent recreating on every render
  const loadDailyLogs = useCallback(async (append: boolean) => {
    const logs = await projection.getDailyLogs(daysToLoad, append ? earliestDateRef.current : undefined);
    
    if (append) {
      setDailyLogs(prev => [...prev, ...logs]);
    } else {
      setDailyLogs(logs);
    }
    
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      if (lastLog) {
        earliestDateRef.current = lastLog.date;
      }
      setHasMoreDays(logs.length === daysToLoad);
    } else {
      setHasMoreDays(false);
    }
  }, [projection, daysToLoad]);

  // Handle scroll to show/hide "Jump to Today" button
  const handleScroll = useCallback(() => {
    setShowJumpToToday(window.scrollY > 200);
  }, []);

  // Load initial daily logs on mount
  useEffect(() => {
    loadDailyLogs(false);
  }, [loadDailyLogs]);

  // Subscribe to projection changes for reactive updates
  useEffect(() => {
    const unsubscribe = projection.subscribe(() => {
      // Reload data when projection changes (event store appended)
      loadDailyLogs(false);
    });
    return unsubscribe;
  }, [projection, loadDailyLogs]);

  // Show "Jump to Today" button when scrolled away from top
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleLoadEarlier = useCallback(() => {
    loadDailyLogs(true);
  }, [loadDailyLogs]);

  const handleJumpToToday = useCallback(() => {
    // Reset to default 7 days and scroll to today
    // This prevents keeping large amounts of data in memory
    earliestDateRef.current = undefined;
    setHasMoreDays(true);
    loadDailyLogs(false);
    
    // Scroll to today after state updates
    setTimeout(() => {
      const todayElement = document.getElementById('daily-log-today');
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth' });
      } else {
        // If no entries today, just scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }, [loadDailyLogs]);

  return (
    <>
      <DailyLogsList
        dailyLogs={dailyLogs}
        onLoadEarlier={handleLoadEarlier}
        hasMoreDays={hasMoreDays}
        onCompleteTask={onCompleteTask}
        onReopenTask={onReopenTask}
        onUpdateTaskTitle={onUpdateTaskTitle}
        onUpdateNoteContent={onUpdateNoteContent}
        onUpdateEventContent={onUpdateEventContent}
        onUpdateEventDate={onUpdateEventDate}
        onDelete={onDelete}
        onReorder={onReorder}
      />

      {/* Jump to Today floating button */}
      {showJumpToToday && (
        <button
          onClick={handleJumpToToday}
          className="fixed bottom-8 right-8 
                   px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg
                   hover:bg-blue-700 transition-all duration-200
                   flex items-center gap-2"
          aria-label="Jump to Today"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={2} 
            stroke="currentColor" 
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          Today
        </button>
      )}
    </>
  );
}
