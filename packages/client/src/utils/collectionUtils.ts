/**
 * Collection Utilities
 * 
 * Helper functions for working with collections, including auto-favorite logic.
 */

import type { Collection, UserPreferences } from '@squickr/shared';

/**
 * Checks if a daily collection is considered "recent" (Today, Yesterday, Tomorrow)
 * Uses local timezone for date calculations
 * 
 * @param collection - The collection to check
 * @returns true if the collection is a recent daily log (yesterday, today, or tomorrow)
 */
export function isRecentDailyLog(collection: Collection): boolean {
  if (collection.type !== 'daily') return false;
  if (!collection.date) return false;
  
  // Get today's date at midnight in local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Parse collection date (YYYY-MM-DD format) in local timezone
  // IMPORTANT: Appending 'T00:00:00' ensures local timezone interpretation
  // (without it, the date would be parsed as UTC midnight)
  const collectionDate = new Date(collection.date + 'T00:00:00');
  
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
 * @returns true if the collection should be displayed as favorited
 */
export function isEffectivelyFavorited(
  collection: Collection,
  userPreferences: UserPreferences
): boolean {
  // Manual favorite always takes precedence
  if (collection.isFavorite) return true;
  
  // Auto-favorite if enabled and is recent daily log
  if (userPreferences.autoFavoriteRecentDailyLogs && collection.type === 'daily') {
    return isRecentDailyLog(collection);
  }
  
  return false;
}

/**
 * Returns true if collection is auto-favorited (not manually favorited)
 * Used to show hollow star icon instead of filled star
 * 
 * @param collection - The collection to check
 * @param userPreferences - The user's preferences
 * @returns true if the collection is auto-favorited but not manually favorited
 */
export function isAutoFavorited(
  collection: Collection,
  userPreferences: UserPreferences
): boolean {
  // Manual favorite takes precedence
  if (collection.isFavorite) return false;
  
  // Check if it would be auto-favorited
  return (
    userPreferences.autoFavoriteRecentDailyLogs &&
    collection.type === 'daily' &&
    isRecentDailyLog(collection)
  );
}
