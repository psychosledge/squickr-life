/**
 * Date utilities for handling timezone-safe operations
 * Used across both client and shared packages
 */

/**
 * Get local date key in YYYY-MM-DD format from a Date object
 * Uses local timezone, not UTC, to avoid date boundary issues
 * 
 * @param date - Date to convert (defaults to now)
 * @returns Date string in YYYY-MM-DD format in local timezone
 * 
 * @example
 * // If it's 11 PM PST on Jan 25
 * getLocalDateKey() // "2026-01-25" (not "2026-01-26")
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert ISO timestamp string to local date key in YYYY-MM-DD format
 * Parses UTC timestamp and converts to local timezone before extracting date
 * 
 * @param isoTimestamp - ISO 8601 timestamp string (e.g., "2026-01-25T23:03:00.000Z")
 * @returns Date string in YYYY-MM-DD format in local timezone
 * 
 * @example
 * // If user is in EST (UTC-5) and it's 7:03 PM EST (00:03 UTC next day)
 * isoToLocalDateKey("2026-01-26T00:03:00.000Z") // "2026-01-25" (not "2026-01-26")
 */
export function isoToLocalDateKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return getLocalDateKey(date);
}
