/**
 * Collection Sorting Utilities
 * 
 * Provides consistent ordering logic for collections across the app.
 * This ensures navigation order matches the index page hierarchy.
 * 
 * Ordering Rules:
 * 1. Favorited customs (by order field, lexicographic)
 * 2. Monthly logs (by date, descending - newest first)
 * 3. Daily logs (by date, descending - newest first)
 * 4. Other customs (by order field, lexicographic)
 */

import type { Collection, UserPreferences } from '@squickr/domain';
import { isEffectivelyFavorited } from './collectionUtils';

/**
 * Sort collections according to the hierarchical display order.
 * 
 * This function ensures that navigation order matches the collection index:
 * - Favorited custom collections first (sorted by order)
 * - Monthly logs second (sorted by date, newest first)
 * - Daily logs third (sorted by date, newest first)
 * - Other custom collections last (sorted by order)
 * 
 * @param collections - Array of collections to sort
 * @param userPreferences - User preferences (for auto-favorite logic)
 * @returns Sorted array of collections (does not mutate input)
 */
export function sortCollectionsHierarchically(
  collections: Collection[],
  userPreferences: UserPreferences
): Collection[] {
  // Separate monthly logs, daily logs, and custom collections
  const monthlyLogs = collections.filter(c => c.type === 'monthly');
  const dailyLogs = collections.filter(c => c.type === 'daily' && c.date);
  const customCollections = collections.filter(c => 
    !c.type || c.type === 'custom' || c.type === 'log' || c.type === 'tracker'
  );
  
  // Separate pinned from unpinned custom collections (using effective favorites)
  const pinnedCustoms = customCollections.filter(c => isEffectivelyFavorited(c, userPreferences));
  const unpinnedCustoms = customCollections.filter(c => !isEffectivelyFavorited(c, userPreferences));
  
  // Sort both by order field (fractional index string, lexicographic comparison)
  pinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  unpinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort monthly logs by date (newest first = descending)
  monthlyLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  // Sort daily logs by date (newest first = descending)
  dailyLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  // Return in hierarchical order: pinned customs, monthly logs, daily logs, unpinned customs
  return [...pinnedCustoms, ...monthlyLogs, ...dailyLogs, ...unpinnedCustoms];
}
