/**
 * buildEntriesByCollectionMap
 *
 * Builds a Map that groups entries by collection ID for use in collection stats
 * (e.g. the sidebar in CollectionIndexView).
 *
 * Bucketing rules:
 *  - All entry types (tasks, notes, events): use `entry.collections[]`.
 *    If `collections` is empty or absent, fall back to
 *    `[entry.collectionId ?? null]` for legacy entries.
 *
 * An entry that belongs to N collections will appear in N buckets, which is
 * intentional — each collection's stats should count it independently.
 */

import type { Entry } from '@squickr/domain';

export function buildEntriesByCollectionMap(
  entries: Entry[],
): Map<string | null, Entry[]> {
  const map = new Map<string | null, Entry[]>();

  for (const entry of entries) {
    // All entry types use the multi-collection pattern — collections[] is the source of truth.
    // Fall back to collectionId for legacy entries whose collections array is empty.
    const entryCollections =
      entry.collections && entry.collections.length > 0
        ? entry.collections
        : [entry.collectionId ?? null];

    for (const cid of entryCollections) {
      const key = cid ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
  }

  return map;
}
