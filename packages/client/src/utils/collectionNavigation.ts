import type { Entry, Collection } from '@squickr/domain';

export interface NavigationCollection {
  readonly collectionId: string | null;
  readonly isGhost: boolean;
}

/**
 * Get ALL collections where entry appears (active or ghost), excluding current.
 * 
 * Priority order:
 * 1. Modern pattern: entry.collections (active), entry.collectionHistory (ghosts)
 * 2. Legacy pattern: entry.migratedTo (active), entry.migratedFrom (ghost)
 * 3. Mixed: Both modern and legacy may coexist (handle both)
 * 
 * @param entry - The entry to gather navigation collections for
 * @param currentCollectionId - The collection currently being viewed (excluded from results)
 *                              undefined = global view (show all), null = uncategorized view
 * @returns Array of navigation collections with ghost status
 */
export function getNavigationCollections(
  entry: Entry,
  currentCollectionId: string | null | undefined
): NavigationCollection[] {
  const result = new Map<string | null, boolean>(); // Auto de-duplicates

  // 1. Add all ACTIVE collections (only for tasks with multi-collection support)
  if (entry.type === 'task') {
    const entryCollections = entry.collections || [];
    for (const collId of entryCollections) {
      if (collId !== currentCollectionId) {
        result.set(collId, false); // false = active, not ghost
      }
    }
  }

  // 2. Add all GHOST collections (removed from) from collectionHistory
  if ('collectionHistory' in entry && entry.collectionHistory) {
    for (const history of entry.collectionHistory) {
      if (history.removedAt && history.collectionId !== currentCollectionId) {
        // Only add as ghost if NOT already in active list
        // (Active takes priority over ghost)
        if (!result.has(history.collectionId)) {
          result.set(history.collectionId, true); // true = ghost
        }
      }
    }
  }

  // 3. LEGACY: Add migratedTo (old format)
  if ('migratedTo' in entry && entry.migratedTo && 'migratedToCollectionId' in entry) {
    const targetCollId = entry.migratedToCollectionId ?? null;
    // Only show if different from current collection
    if (targetCollId !== currentCollectionId) {
      if (!result.has(targetCollId)) {
        result.set(targetCollId, false); // Active
      }
    }
  }

  // 4. LEGACY: Add migratedFrom (old format)
  if ('migratedFrom' in entry && entry.migratedFrom && 'migratedFromCollectionId' in entry) {
    const sourceCollId = entry.migratedFromCollectionId ?? null;
    // Only show if different from current collection
    if (sourceCollId !== currentCollectionId) {
      if (!result.has(sourceCollId)) {
        result.set(sourceCollId, true); // Ghost
      }
    }
  }

  return Array.from(result.entries()).map(([collectionId, isGhost]) => ({
    collectionId,
    isGhost,
  }));
}

/**
 * Helper to get collection name, filtering out deleted collections
 */
export function getCollectionName(
  collectionId: string | null,
  collections: Collection[] | undefined
): string {
  if (!collectionId) return 'Uncategorized';
  const collection = collections?.find(c => c.id === collectionId && !c.deletedAt);
  return collection?.name || 'Unknown Collection';
}
