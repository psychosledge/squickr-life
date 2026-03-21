/**
 * HabitHistoryGrid
 *
 * 30-day calendar grid showing habit completion history.
 * 7 columns (Mon-Sun), oldest day top-left.
 */

import type { HabitDayStatus } from '@squickr/domain';

interface HabitHistoryGridProps {
  history: HabitDayStatus[];
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day-of-week index: Monday=0, Sunday=6 */
function dayOfWeekMonFirst(dateStr: string): number {
  // Parse date string YYYY-MM-DD as local date to avoid UTC offset shifts
  const parts = dateStr.split('-');
  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);
  const d = new Date(year, month, day);
  // getDay(): Sun=0, Mon=1, ..., Sat=6 → we want Mon=0, Sun=6
  return (d.getDay() + 6) % 7;
}

function cellColorClass(status: HabitDayStatus['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500 dark:bg-green-600';
    case 'missed':
      return 'bg-red-400 dark:bg-red-500';
    case 'future':
      return 'bg-gray-100 dark:bg-gray-700 opacity-40';
    default: // not-scheduled
      return 'bg-gray-200 dark:bg-gray-700';
  }
}

export function HabitHistoryGrid({ history }: HabitHistoryGridProps) {
  if (history.length === 0) {
    // Render empty grid with headers only
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-xs text-center text-gray-400 dark:text-gray-500 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" />
      </div>
    );
  }

  // Find the Monday of the week containing the first day in history
  const firstDate = history[0]!.date;
  const firstDow = dayOfWeekMonFirst(firstDate); // 0=Mon, 6=Sun

  // Build cell array: prepend empty cells to align first day to its weekday column
  const emptyCells = Array.from({ length: firstDow }, (_, i) => ({
    key: `empty-${i}`,
    isEmpty: true as const,
  }));

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-xs text-center text-gray-400 dark:text-gray-500 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {emptyCells.map((cell) => (
          <div key={cell.key} className="w-full aspect-square" />
        ))}
        {history.map((day) => (
          <div
            key={day.date}
            data-date={day.date}
            data-status={day.status}
            title={day.date}
            aria-label={`${day.date}: ${day.status}`}
            className={`w-full aspect-square rounded-sm ${cellColorClass(day.status)}`}
          />
        ))}
      </div>
    </div>
  );
}
