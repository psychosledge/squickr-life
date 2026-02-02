/**
 * Collection Sorting Utilities
 * 
 * Provides consistent ordering logic for collections across the app.
 * This ensures navigation order matches the index page hierarchy.
 * 
 * Ordering Rules:
 * 1. Favorited customs (by order field, lexicographic)
 * 2. Daily logs (by date, descending - newest first)
 * 3. Other customs (by order field, lexicographic)
 */

import type { Collection } from '@squickr/shared';

/**
 * Sort collections according to the hierarchical display order.
 * 
 * This function ensures that navigation order matches the collection index:
 * - Favorited custom collections first (sorted by order)
 * - Daily logs second (sorted by date, newest first)
 * - Other custom collections last (sorted by order)
 * 
 * @param collections - Array of collections to sort
 * @returns Sorted array of collections (does not mutate input)
 */
export function sortCollectionsHierarchically(collections: Collection[]): Collection[] {
  // Separate daily logs from custom collections
  const dailyLogs = collections.filter(c => c.type === 'daily' && c.date);
  const customCollections = collections.filter(c => 
    !c.type || c.type === 'custom' || c.type === 'log' || c.type === 'tracker'
  );
  
  // Separate pinned from unpinned custom collections
  const pinnedCustoms = customCollections.filter(c => c.isFavorite);
  const unpinnedCustoms = customCollections.filter(c => !c.isFavorite);
  
  // Sort both by order field (fractional index string, lexicographic comparison)
  pinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  unpinnedCustoms.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
  
  // Sort daily logs by date (newest first = descending)
  dailyLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  // Return in hierarchical order: pinned customs, daily logs, unpinned customs
  return [...pinnedCustoms, ...dailyLogs, ...unpinnedCustoms];
}
