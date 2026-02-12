import { getLocalDateKey } from '@squickr/domain';

/**
 * Convert temporal keyword to date key matching collection.date format
 * Reuses same date logic as auto-favorites
 */
export function getDateKeyForTemporal(
  temporal: 'today' | 'yesterday' | 'tomorrow',
  now: Date = new Date()
): string {
  const date = new Date(now);
  
  if (temporal === 'yesterday') {
    date.setDate(date.getDate() - 1);
  } else if (temporal === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  }
  
  return getLocalDateKey(date); // "2026-02-11"
}

/**
 * Convert monthly temporal keyword to month key matching collection.date format
 * Returns YYYY-MM format for monthly collections
 */
export function getMonthKeyForTemporal(
  temporal: 'this-month' | 'last-month' | 'next-month',
  now: Date = new Date()
): string {
  const date = new Date(now);
  
  if (temporal === 'last-month') {
    date.setMonth(date.getMonth() - 1);
  } else if (temporal === 'next-month') {
    date.setMonth(date.getMonth() + 1);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; // "2026-02"
}

