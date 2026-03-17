import type { DailyLog, EntryFilter } from './task.types';
import type { Entry } from './task.types';
import { isoToLocalDateKey } from './date-utils';
import type { EntryListProjection } from './entry.projections';

/**
 * DailyLogProjection — daily-log grouping logic extracted from EntryListProjection.
 *
 * This class is an internal implementation detail of EntryListProjection.
 * It is NOT intended to be used directly by callers; EntryListProjection
 * delegates to it via private facade fields and exposes the same public API.
 */
export class DailyLogProjection {
  constructor(private readonly entryProjection: EntryListProjection) {}

  /**
   * Get entries grouped by creation date (Daily Logs view)
   *
   * This implements the bullet journal "daily log" paradigm where entries
   * are organized by the day they were created, not by type or other criteria.
   *
   * @param limit - Number of days to load (default: 7)
   * @param beforeDate - Load days before this ISO date string (for progressive loading)
   * @param filter - Optional filter for entry types (default: 'all')
   * @returns Array of daily logs, sorted newest first
   *
   * @example
   * // Load last 7 days
   * const logs = await projection.getDailyLogs();
   *
   * // Load 7 more days before a specific date
   * const olderLogs = await projection.getDailyLogs(7, '2026-01-15');
   */
  async getDailyLogs(
    limit: number = 7,
    beforeDate?: string,
    filter: EntryFilter = 'all'
  ): Promise<DailyLog[]> {
    // Get all entries (already sorted by order field)
    const allEntries = await this.entryProjection.getEntries(filter);

    // Group entries by creation date (YYYY-MM-DD)
    const groupedByDate = new Map<string, Entry[]>();

    for (const entry of allEntries) {
      // Convert UTC timestamp to local date (timezone-safe)
      // e.g., "2026-01-26T00:03:00.000Z" -> "2026-01-25" if user is in EST
      const dateKey = isoToLocalDateKey(entry.createdAt);

      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, []);
      }
      groupedByDate.get(dateKey)!.push(entry);
    }

    // Convert to DailyLog array
    const allDailyLogs: DailyLog[] = Array.from(groupedByDate.entries())
      .map(([date, entries]) => ({
        date,
        entries, // Already sorted by order field from getEntries()
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates newest first

    // Apply progressive loading filters
    if (beforeDate) {
      const beforeDateKey = beforeDate.substring(0, 10);
      const filteredLogs = allDailyLogs.filter(log => log.date < beforeDateKey);
      return filteredLogs.slice(0, limit);
    }

    // Return most recent N days
    return allDailyLogs.slice(0, limit);
  }
}
