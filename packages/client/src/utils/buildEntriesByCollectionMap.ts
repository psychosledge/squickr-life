/**
 * buildEntriesByCollectionMap
 *
 * Builds a Map that groups entries by collection ID for use in collection stats
 * (e.g. the sidebar in CollectionIndexView).
 *
 * Bucketing rules:
 *  - Tasks  : use `entry.collections[]` (multi-collection pattern).
 *             If `collections` is empty or absent, fall back to
 *             `[entry.collectionId ?? null]` for legacy tasks.
 *  - Notes / events : use `entry.collectionId ?? null` (legacy pattern).
 *
 * A task that belongs to N collections will appear in N buckets, which is
 * intentional — each collection's stats should count it independently.
 */

import type { Entry } from '@squickr/domain';

export function buildEntriesByCollectionMap(
  entries: Entry[],
): Map<string | null, Entry[]> {
  const map = new Map<string | null, Entry[]>();

  for (const entry of entries) {
    if (entry.type === 'task') {
      // Tasks use the multi-collection pattern — collections[] is the source of truth.
      // Fall back to collectionId for legacy tasks whose collections array is empty.
      const taskCollections =
        entry.collections && entry.collections.length > 0
          ? entry.collections
          : [entry.collectionId ?? null];

      for (const cid of taskCollections) {
        const key = cid ?? null;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(entry);
      }
    } else {
      // Notes and events still use the legacy single-collection pattern.
      const key = entry.collectionId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
  }

  return map;
}
