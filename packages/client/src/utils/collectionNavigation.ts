import type { Entry, Collection } from '@squickr/domain';

export interface NavigationCollection {
  readonly collectionId: string | null;
  readonly isGhost: boolean;
}

/**
 * Get ALL collections where entry appears (active or ghost), excluding current.
 * 
 * Priority order:
 * 1. Modern pattern: entry.collections (active), entry.collectionHistory (last-hop ghost)
 * 2. Legacy pattern: entry.migratedTo (active), entry.migratedFrom (ghost)
 * 3. Mixed: Both modern and legacy may coexist (handle both)
 * 
 * Ghost link algorithm (last-hop only):
 *   - Find when the entry arrived at currentCollection (addedAt from history, or entry.createdAt)
 *   - Among all history entries removed *before* that arrival time (excluding currentCollection),
 *     take the single most-recent removal — that is the "last hop" predecessor.
 *   - Only that one predecessor is shown as a ghost link (not all predecessors).
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

  // 1. Add all ACTIVE collections (for all entry types with multi-collection support)
  const entryCollections = entry.collections || [];
  for (const collId of entryCollections) {
    if (collId !== currentCollectionId) {
      result.set(collId, false); // false = active, not ghost
    }
  }

  // 2. Add the LAST-HOP ghost collection from collectionHistory
  //    (only the single most-recent predecessor, not all removed collections)
  if ('collectionHistory' in entry && entry.collectionHistory && entry.collectionHistory.length > 0) {
    const history = entry.collectionHistory;

    // Find when the entry arrived at currentCollection.
    // Note: We search for any history entry for this collection, not just active ones,
    // because when viewing a past (ghost) collection it will have a removedAt.
    // If there are multiple entries for the same collection (re-added), use the most recent addedAt.
    const currentHistoryEntries = history.filter(
      h => h.collectionId === currentCollectionId
    );
    const currentHistoryEntry = currentHistoryEntries.length > 0
      ? currentHistoryEntries.reduce((latest, h) =>
          h.addedAt > latest.addedAt ? h : latest
        )
      : undefined;
    const arrivedAtCurrentAt: string = currentHistoryEntry?.addedAt ?? entry.createdAt;

    // All removed-from collections whose removal happened at or before arrival time,
    // excluding the current collection itself
    const candidates = history.filter(
      h =>
        h.removedAt !== undefined &&
        h.collectionId !== currentCollectionId &&
        h.removedAt <= arrivedAtCurrentAt
    );

    // The most recent removal is the "last hop" predecessor
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        // removedAt is always defined here (filtered above), sort descending
        const bR = b.removedAt as string;
        const aR = a.removedAt as string;
        return bR > aR ? 1 : bR < aR ? -1 : 0;
      });
      const lastHop = candidates[0] as (typeof candidates)[0];

      // Only add as ghost if NOT already in active list (active takes priority)
      if (lastHop !== undefined && !result.has(lastHop.collectionId)) {
        result.set(lastHop.collectionId, true); // true = ghost
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
