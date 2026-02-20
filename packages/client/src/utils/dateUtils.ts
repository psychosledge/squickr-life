/**
 * Date utilities for Daily Logs feature
 * Re-exports from @squickr/domain for convenience
 */

export { getLocalDateKey, isoToLocalDateKey } from '@squickr/domain';

/**
 * Format a YYYY-MM-DD date string as a human-readable label.
 *
 * Appends 'T00:00:00' before parsing to prevent the browser from interpreting
 * the bare date as midnight UTC, which would shift the displayed date by one
 * day for users in timezones west of UTC.
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @param referenceDate - Optional reference date for today/yesterday comparisons
 *   (defaults to `new Date()`). Accepting an explicit value makes the function
 *   pure and therefore testable without mocking system time.
 * @returns "Today", "Yesterday", "Tomorrow", or a locale-formatted string like "Friday, Jan 24"
 */
export function formatDateLabel(dateStr: string, referenceDate: Date = new Date()): string {
  const parsed = new Date(dateStr + 'T00:00:00'); // Avoid UTC-midnight timezone shift

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const inputDate = new Date(parsed);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate.getTime() === today.getTime()) return 'Today';
  if (inputDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (inputDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

  // Format as "Friday, Jan 24"
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
