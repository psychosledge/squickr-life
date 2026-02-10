/**
 * Collection Utilities
 * 
 * Helper functions for working with collections, including auto-favorite logic.
 */

import type { Collection, UserPreferences } from '@squickr/domain';

/**
 * Checks if a daily collection is considered "recent" (Today, Yesterday, Tomorrow)
 * Uses UTC timezone to match date string format
 * 
 * @param collection - The collection to check
 * @param now - Current date/time (defaults to new Date() if not provided)
 * @returns true if the collection is a recent daily log (yesterday, today, or tomorrow)
 */
export function isRecentDailyLog(collection: Collection, now: Date = new Date()): boolean {
  if (collection.type !== 'daily') return false;
  if (!collection.date) return false;
  
  // Get today's date at midnight in UTC timezone (to match how date strings are created)
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  
  // Parse in UTC to match the timezone of `now`
  const collectionDate = new Date(collection.date + 'T00:00:00Z');
  
  // Calculate difference in days
  const diffInMs = collectionDate.getTime() - today.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
  
  // Recent = yesterday (-1), today (0), tomorrow (+1)
  return diffInDays >= -1 && diffInDays <= 1;
}

/**
 * Determines if a collection should be shown as favorited
 * Combines manual favorites with auto-favorite logic
 * 
 * @param collection - The collection to check
 * @param userPreferences - The user's preferences
 * @param now - Current date/time (defaults to new Date() if not provided)
 * @returns true if the collection should be displayed as favorited
 */
export function isEffectivelyFavorited(
  collection: Collection,
  userPreferences: UserPreferences,
  now: Date = new Date()
): boolean {
  // Manual favorite always takes precedence
  if (collection.isFavorite) return true;
  
  // Auto-favorite if enabled and is recent daily log
  if (userPreferences.autoFavoriteRecentDailyLogs && collection.type === 'daily') {
    return isRecentDailyLog(collection, now);
  }
  
  return false;
}

/**
 * Returns true if collection is auto-favorited (not manually favorited)
 * Used to show hollow star icon instead of filled star
 * 
 * @param collection - The collection to check
 * @param userPreferences - The user's preferences
 * @param now - Current date/time (defaults to new Date() if not provided)
 * @returns true if the collection is auto-favorited but not manually favorited
 */
export function isAutoFavorited(
  collection: Collection,
  userPreferences: UserPreferences,
  now: Date = new Date()
): boolean {
  // Manual favorite takes precedence
  if (collection.isFavorite) return false;
  
  // Check if it would be auto-favorited
  return (
    userPreferences.autoFavoriteRecentDailyLogs &&
    collection.type === 'daily' &&
    isRecentDailyLog(collection, now)
  );
}
