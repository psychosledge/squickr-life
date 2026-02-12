/**
 * Collection Utilities
 * 
 * Helper functions for working with collections, including auto-favorite logic.
 */

import type { Collection, UserPreferences } from '@squickr/domain';

/**
 * Checks if a daily collection is considered "recent" (Today, Yesterday, Tomorrow)
 * Uses local timezone to match how daily logs are created (via getLocalDateKey)
 * 
 * @param collection - The collection to check
 * @param now - Current date/time (defaults to new Date() if not provided)
 * @returns true if the collection is a recent daily log (yesterday, today, or tomorrow)
 */
export function isRecentDailyLog(collection: Collection, now: Date = new Date()): boolean {
  if (collection.type !== 'daily') return false;
  if (!collection.date) return false;
  
  // Get today's date at midnight in local timezone (to match how daily logs are created)
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  // Parse in local timezone to match getLocalDateKey() behavior
  const collectionDate = new Date(collection.date + 'T00:00:00');
  
  // Calculate difference in days
  const diffInMs = collectionDate.getTime() - today.getTime();
  const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
  
  // Recent = yesterday (-1), today (0), tomorrow (+1)
  return diffInDays >= -1 && diffInDays <= 1;
}

/**
 * Checks if a monthly collection is considered "recent" (Last month, Current month, Next month)
 * Uses local timezone to match how monthly logs are created
 * 
 * @param collection - The collection to check
 * @param now - Current date/time (defaults to new Date() if not provided)
 * @returns true if the collection is a recent monthly log (last month, current month, or next month)
 */
export function isRecentMonthlyLog(collection: Collection, now: Date = new Date()): boolean {
  if (collection.type !== 'monthly') return false;
  if (!collection.date) return false;
  
  // Parse collection date (format: YYYY-MM)
  const parts = collection.date.split('-');
  if (parts.length !== 2) return false;
  
  const collectionYear = parseInt(parts[0]!, 10);
  const collectionMonth = parseInt(parts[1]!, 10);
  
  if (isNaN(collectionYear) || isNaN(collectionMonth)) return false;
  if (collectionMonth < 1 || collectionMonth > 12) return false;
  
  // Get current month and year in local timezone
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-based
  
  // Calculate difference in months
  const monthsDiff = (collectionYear - currentYear) * 12 + (collectionMonth - currentMonth);
  
  // Recent = last month (-1), current month (0), next month (+1)
  return monthsDiff >= -1 && monthsDiff <= 1;
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
  
  // Auto-favorite if enabled and is recent monthly log
  if (userPreferences.autoFavoriteRecentMonthlyLogs && collection.type === 'monthly') {
    return isRecentMonthlyLog(collection, now);
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
  
  // Check if it would be auto-favorited (daily logs)
  if (
    userPreferences.autoFavoriteRecentDailyLogs &&
    collection.type === 'daily' &&
    isRecentDailyLog(collection, now)
  ) {
    return true;
  }
  
  // Check if it would be auto-favorited (monthly logs)
  if (
    userPreferences.autoFavoriteRecentMonthlyLogs &&
    collection.type === 'monthly' &&
    isRecentMonthlyLog(collection, now)
  ) {
    return true;
  }
  
  return false;
}
