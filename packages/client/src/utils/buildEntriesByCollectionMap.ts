/**
 * buildEntriesByCollectionMap
 *
 * Builds a Map that groups entries by collection ID for use in collection stats
 * (e.g. the sidebar in CollectionIndexView).
 *
 * Bucketing rules:
 *  - All entry types (tasks, notes, events): use `entry.collections[]`.
 *  - If `collections` is empty or absent, behaviour depends on whether this is
 *    a "modern" or "legacy" entry:
 *
 *    • Modern entry (collectionHistory is defined): went through the multi-
 *      collection event system. Trust `collections[]` even when it is empty —
 *      an empty array means "belongs to no collection" and the entry should
 *      not be placed into any bucket (avoids ghost tasks in monthly log stats
 *      after TaskRemovedFromCollection empties the array).
 *
 *    • Legacy entry (collectionHistory is undefined): created before the
 *      multi-collection system. Fall back to `[collectionId ?? null]` to
 *      preserve existing behaviour for old data.
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
    // Determine whether this entry went through the modern multi-collection
    // event system. TaskCreated (and equivalents for notes/events) always
    // initialises collectionHistory: [] for new entries, so its presence —
    // even as an empty array — is a reliable marker of a modern entry.
    const isModernEntry = entry.collectionHistory !== undefined;

    // collections[] is the source of truth for modern entries.
    // For legacy entries (no collectionHistory), fall back to collectionId.
    const entryCollections =
      entry.collections && entry.collections.length > 0
        ? entry.collections
        : isModernEntry
          ? []                           // Modern entry with empty collections[] = belongs nowhere
          : [entry.collectionId ?? null]; // Legacy entry: fall back to collectionId

    for (const cid of entryCollections) {
      const key = cid ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
  }

  return map;
}
