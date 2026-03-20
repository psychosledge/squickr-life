export type ReviewPeriod = 'weekly' | 'monthly';

/**
 * Returns an inclusive local-time date range for the given review period.
 *
 * @param period - 'weekly' | 'monthly'
 * @param now    - Reference date (defaults to new Date()). Injectable for testing.
 * @returns { from: Date, to: Date } — both in local time
 */
export function getDateRange(
  period: ReviewPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  if (period === 'weekly') {
    return getWeekRange(now);
  }
  return getMonthRange(now);
}

function getWeekRange(now: Date): { from: Date; to: Date } {
  // ISO week: Monday = 1 … Sunday = 7
  // getDay() returns 0 (Sun) … 6 (Sat)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysToMonday = (dayOfWeek + 6) % 7; // 0 when Mon, 6 when Sun

  const from = new Date(now);
  from.setDate(now.getDate() - daysToMonday);
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(from.getDate() + 6); // Monday + 6 = Sunday
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function getMonthRange(now: Date): { from: Date; to: Date } {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const from = new Date(year, month, 1, 0, 0, 0, 0);

  // Day 0 of next month = last day of current month
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return { from, to };
}
