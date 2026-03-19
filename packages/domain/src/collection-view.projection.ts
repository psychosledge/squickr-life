import type { Entry } from './task.types';
import type { EntryListProjection } from './entry.projections';

/**
 * CollectionViewProjection — collection-scoped query helpers extracted from EntryListProjection.
 *
 * This class is an internal implementation detail of EntryListProjection.
 * It is NOT intended to be used directly by callers; EntryListProjection
 * delegates to it via private facade fields and exposes the same public API.
 */
export class CollectionViewProjection {
  constructor(private readonly entryProjection: EntryListProjection) {}

  /**
   * Get the effective collection IDs for an entry (ADR-015 multi-collection pattern).
   *
   * Under ADR-015, `collections[]` is the authoritative source of truth.
   * The legacy `collectionId` field is only used as a fallback for entries that were
   * created before multi-collection support and have never been touched by the
   * Remove+Add move path (i.e., `collections` is still empty).
   *
   * @param entry - The entry to inspect
   * @returns Array of collection IDs (or `[null]` for uncategorized entries)
   */
  private static getEffectiveCollections(entry: Entry): (string | null)[] {
    return entry.collections.length > 0
      ? entry.collections
      : [entry.collectionId ?? null];
  }

  /**
   * Get entries filtered by collection
   *
   * @param collectionId - The collection ID to filter by (null = uncategorized)
   * @returns Array of entries in the specified collection, sorted by order
   */
  async getEntriesByCollection(collectionId: string | null): Promise<Entry[]> {
    const allEntries = await this.entryProjection.getEntries('all');

    // Filter entries by their current collections[] (ADR-015 multi-collection pattern).
    // We must NOT use the legacy collectionId field here — it is stale after a task is
    // moved via TaskRemovedFromCollection + TaskAddedToCollection (the Remove+Add path).
    return allEntries.filter(entry => {
      if (collectionId === null) {
        return entry.collections.length === 0;
      }
      return entry.collections.includes(collectionId);
    });
  }

  /**
   * Efficiently counts all entries and groups them by collection in a single query.
   * This avoids the N+1 query pattern when displaying collection badges.
   *
   * @returns Map of collection ID to entry count (null key = uncategorized entries)
   */
  async getEntryCountsByCollection(): Promise<Map<string | null, number>> {
    const allEntries = await this.entryProjection.getEntries('all');
    const counts = new Map<string | null, number>();

    // Count entries by collection ID in memory (fast!)
    // Sub-items (parentEntryId set) are excluded — they belong to their parent entry
    // and should not count as independent entries in collection stats.
    for (const entry of allEntries) {
      if (entry.parentEntryId) continue;
      for (const collectionId of CollectionViewProjection.getEffectiveCollections(entry)) {
        counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Get active task counts grouped by collection ID
   *
   * An "active task" is defined as:
   * - entry.type === 'task'
   * - entry.status === 'open'
   * - !entry.migratedTo (don't count migrated originals)
   *
   * Collection bucketing rules (Fix 2 — drop legacy collectionId fallback):
   * - Uses `entry.collections` directly (same as getEntriesByCollection).
   * - If `entry.collections.length > 0`: count toward each collection in that array.
   * - If `entry.collections.length === 0`: count toward `null` (uncategorized).
   * - `entry.collectionId` is NEVER used as a fallback — it is stale after a
   *   Remove+Add move and would cause phantom counts.
   *
   * Sub-task handling (Fix 3 — per-collection parent check):
   * - A sub-task (parentEntryId set) is skipped in a given collection ONLY when
   *   its parent is also present in that same collection.
   * - If the parent is absent (deleted/doesn't exist) OR lives in a different
   *   collection, the sub-task IS counted — it is an independent actionable item
   *   in that collection.
   *
   * @returns Map of collection ID to active task count (null key = uncategorized tasks)
   */
  async getActiveTaskCountsByCollection(): Promise<Map<string | null, number>> {
    const allEntries = await this.entryProjection.getEntries('all');
    const counts = new Map<string | null, number>();

    // Pre-pass: build a lookup of entryId → Set<collectionId | null> for all entries.
    // This lets us check, for any sub-task, which collections its parent occupies.
    const entryCollectionSets = new Map<string, Set<string | null>>();
    for (const entry of allEntries) {
      const colls: (string | null)[] =
        entry.collections.length > 0 ? [...entry.collections] : [null];
      entryCollectionSets.set(entry.id, new Set(colls));
    }

    // Counting pass
    for (const entry of allEntries) {
      // Only count active, non-migrated tasks
      if (entry.type !== 'task' || entry.status !== 'open' || entry.migratedTo) continue;

      // Fix 2: use collections[] directly; fall back to null (uncategorized), never collectionId
      const effectiveColls: (string | null)[] =
        entry.collections.length > 0 ? [...entry.collections] : [null];

      if (entry.parentEntryId) {
        // Fix 3: for sub-tasks, only skip counting in collections where the parent is also present
        const parentColls = entryCollectionSets.get(entry.parentEntryId); // undefined if parent gone

        for (const collId of effectiveColls) {
          // Skip only if the parent EXISTS AND is in the same collection
          if (parentColls !== undefined && parentColls.has(collId)) continue;
          counts.set(collId, (counts.get(collId) ?? 0) + 1);
        }
      } else {
        for (const collId of effectiveColls) {
          counts.set(collId, (counts.get(collId) ?? 0) + 1);
        }
      }
    }

    return counts;
  }

  /**
   * Get entry statistics (counts) grouped by collection ID
   *
   * Returns a map of collection ID to stats object containing:
   * - openTasks: count of open tasks (not migrated)
   * - completedTasks: count of completed tasks (not migrated)
   * - notes: count of notes (not migrated)
   * - events: count of events (not migrated)
   *
   * @returns Map of collection ID to stats (null key = uncategorized entries)
   */
  async getEntryStatsByCollection(): Promise<Map<string | null, {
    openTasks: number;
    completedTasks: number;
    notes: number;
    events: number;
  }>> {
    const allEntries = await this.entryProjection.getEntries('all');
    const statsMap = new Map<string | null, {
      openTasks: number;
      completedTasks: number;
      notes: number;
      events: number;
    }>();

    for (const entry of allEntries) {
      // Skip migrated entries (they shouldn't count in stats)
      if (entry.migratedTo) continue;

      // Skip sub-items (parentEntryId set) — they belong to their parent entry
      // and should not count as independent entries in collection stats.
      if (entry.parentEntryId) continue;

      for (const collectionId of CollectionViewProjection.getEffectiveCollections(entry)) {
        // Initialize stats for this collection if not exists
        if (!statsMap.has(collectionId)) {
          statsMap.set(collectionId, {
            openTasks: 0,
            completedTasks: 0,
            notes: 0,
            events: 0
          });
        }

        const stats = statsMap.get(collectionId)!;

        // Count by entry type
        switch (entry.type) {
          case 'task':
            if (entry.status === 'completed') {
              stats.completedTasks++;
            } else {
              stats.openTasks++;
            }
            break;
          case 'note':
            stats.notes++;
            break;
          case 'event':
            stats.events++;
            break;
        }
      }
    }

    return statsMap;
  }

  /**
   * Get entries for collection view (includes ghosts)
   *
   * Returns active entries + ghost entries for a specific collection.
   * - Active entries: Currently in this collection (renderAsGhost: false)
   * - Ghost entries: Removed from this collection (renderAsGhost: true, with ghostNewLocation)
   *
   * @param collectionId - The collection ID to view
   * @returns Array of entries with ghost rendering metadata
   */
  async getEntriesForCollectionView(
    collectionId: string
  ): Promise<(Entry & { renderAsGhost?: boolean; ghostNewLocation?: string })[]> {
    const allEntries = await this.entryProjection.getEntries();

    // Active entries: Currently in this collection (all types use collections[])
    // Note: getEntries() already excludes soft-deleted entries via its active-only filter,
    // so no additional deletedAt check is needed here.
    const activeEntries = allEntries
      .filter(entry => entry.collections.includes(collectionId))
      .map(entry => ({
        ...entry,
        renderAsGhost: false,
      }));

    // Ghost entries: Removed from this collection (all entry types with collectionHistory)
    const ghostEntries = allEntries
      .filter(entry => !entry.collections.includes(collectionId))
      .filter(entry => entry.collectionHistory?.some(h =>
        h.collectionId === collectionId && h.removedAt
      ))
      .map(entry => ({
        ...entry,
        renderAsGhost: true,
        ghostNewLocation: entry.collections[0],  // First current collection
      }));

    return [...activeEntries, ...ghostEntries];
  }

  /**
   * Get all soft-deleted entries for a specific collection
   *
   * Returns entries that have `deletedAt` set and belong to the given collection.
   * Useful for a "Trash" / "Recently Deleted" view.
   *
   * @param collectionId - The collection to query deleted entries for
   * @returns Array of soft-deleted entries in this collection
   */
  async getDeletedEntries(collectionId: string): Promise<Entry[]> {
    // Use getAllEntriesIncludingDeleted() to bypass the active-only filter
    const allEntries = await this.entryProjection.getAllEntriesIncludingDeleted();

    return allEntries.filter(entry =>
      entry.deletedAt !== undefined &&
      // COMPAT: fall back to legacy entry.collectionId for entries created before
      // multi-collection support (collections[] may still be empty for old entries)
      (entry.collections.includes(collectionId) || entry.collectionId === collectionId)
    );
  }
}
