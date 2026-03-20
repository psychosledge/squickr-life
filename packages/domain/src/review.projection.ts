import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { Entry } from './task.types';
import type { Collection } from './collection.types';
import type { DomainEvent } from './domain-event';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StalledTask {
  readonly entry: Entry;
  readonly collectionId: string;
  readonly collectionName: string;
  readonly lastEventAt: string;
  readonly staleDays: number;
}

// ---------------------------------------------------------------------------
// Content event types (task state / content changes)
// Collection-management events are intentionally EXCLUDED from this set.
//
// Included  (content events):
//   TaskCreated, TaskCompleted, TaskReopened, TaskTitleChanged,
//   TaskDeleted, TaskRestored, TaskReordered
//
// Excluded (collection-management events):
//   TaskAddedToCollection, TaskRemovedFromCollection, TaskMigrated,
//   EntryMovedToCollection, NoteAddedToCollection, NoteRemovedFromCollection,
//   NoteMigrated, EventAddedToCollection, EventRemovedFromCollection,
//   EventMigrated
// ---------------------------------------------------------------------------

const CONTENT_EVENT_TYPES = new Set<string>([
  'TaskCreated',
  'TaskCompleted',
  'TaskReopened',
  'TaskTitleChanged',
  'TaskDeleted',
  'TaskRestored',
  'TaskReordered',
  // Note content events (for completeness, though only tasks are returned by getStalledMonthlyTasks)
  'NoteCreated',
  'NoteContentChanged',
  'NoteDeleted',
  'NoteRestored',
  'NoteReordered',
  // Calendar-event content events
  'EventCreated',
  'EventContentChanged',
  'EventDateChanged',
  'EventDeleted',
  'EventRestored',
  'EventReordered',
]);

function isContentEvent(event: DomainEvent): boolean {
  return CONTENT_EVENT_TYPES.has(event.type);
}

// ---------------------------------------------------------------------------
// ReviewProjection
// ---------------------------------------------------------------------------

/**
 * ReviewProjection — Read model for the "Review" screen (Proactive Squickr).
 *
 * Provides two query methods:
 *  - getCompletedInRange: tasks completed within a date window (for weekly/monthly review)
 *  - getStalledMonthlyTasks: open tasks on monthly collections whose last CONTENT event
 *    is older than a configurable threshold (staleness detection)
 *
 * Staleness rule: only CONTENT events are considered when determining "last activity".
 * Collection-management events (TaskAddedToCollection, TaskMigrated, etc.) are excluded
 * so that a task migrated every day for a month is still detected as stale.
 */
export class ReviewProjection {
  constructor(
    private readonly entryProjection: EntryListProjection,
    private readonly eventStore: IEventStore,
  ) {}

  // ── getCompletedInRange ────────────────────────────────────────────────────

  /**
   * Returns entries where type === 'task' AND completedAt is within [from, to].
   *
   * @param from - Start of range (inclusive)
   * @param to   - End of range (inclusive)
   */
  async getCompletedInRange(from: Date, to: Date): Promise<Entry[]> {
    const entries = await this.entryProjection.getEntries('completed-tasks');

    const fromMs = from.getTime();
    const toMs = to.getTime();

    return entries.filter(entry => {
      if (entry.type !== 'task') return false;
      if (!entry.completedAt) return false;

      const completedMs = new Date(entry.completedAt).getTime();
      return completedMs >= fromMs && completedMs <= toMs;
    });
  }

  // ── getStalledMonthlyTasks ─────────────────────────────────────────────────

  /**
   * Returns open tasks that:
   *  1. Belong to at least one collection of type === 'monthly'
   *  2. Have not had a CONTENT event in more than `olderThanDays` days
   *
   * Sorted most-stale-first (descending staleDays).
   *
   * @param olderThanDays  - Threshold (exclusive): tasks with lastEventAt older than
   *                         this many days are considered stalled
   * @param getCollection  - Callback to resolve a Collection by ID.  If the callback
   *                         returns undefined for all of a task's collections, the task
   *                         is excluded (we cannot confirm monthly membership).
   */
  async getStalledMonthlyTasks(
    olderThanDays: number,
    getCollection: (id: string) => Collection | undefined,
  ): Promise<StalledTask[]> {
    // 1. Gather all open tasks
    const openEntries = await this.entryProjection.getEntries('open-tasks');
    const openTasks = openEntries.filter(e => e.type === 'task');

    if (openTasks.length === 0) return [];

    // 2. Build a per-aggregate index of last content event timestamp
    //    We scan the full event log once rather than once per task.
    const allEvents = await this.eventStore.getAll();
    const lastContentEventAt = this.buildLastContentEventIndex(allEvents);

    // 3. Evaluate each open task
    const now = Date.now();
    const thresholdMs = olderThanDays * 24 * 60 * 60 * 1000;

    const results: StalledTask[] = [];

    for (const entry of openTasks) {
      // Determine which monthly collection(s) this task belongs to
      const monthlyCollectionId = this.resolveMonthlyCollectionId(entry, getCollection);
      if (monthlyCollectionId === null) continue;

      // Find last content event timestamp
      const lastEventAt = lastContentEventAt.get(entry.id);
      if (!lastEventAt) continue; // no events (shouldn't happen for active entries)

      // Check staleness
      const lastEventMs = new Date(lastEventAt).getTime();
      const ageMs = now - lastEventMs;
      if (ageMs <= thresholdMs) continue; // not stale yet

      const staleDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

      const collection = getCollection(monthlyCollectionId);
      const collectionName = collection?.name ?? 'Monthly Log';

      results.push({
        entry,
        collectionId: monthlyCollectionId,
        collectionName,
        lastEventAt,
        staleDays,
      });
    }

    // Sort most-stale-first (descending staleDays)
    results.sort((a, b) => b.staleDays - a.staleDays);

    return results;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Scan all events and return a map of aggregateId → ISO timestamp of the most
   * recent CONTENT event for that aggregate.
   */
  private buildLastContentEventIndex(events: DomainEvent[]): Map<string, string> {
    const index = new Map<string, string>();

    for (const event of events) {
      if (!isContentEvent(event)) continue;

      const existing = index.get(event.aggregateId);
      if (!existing || event.timestamp > existing) {
        index.set(event.aggregateId, event.timestamp);
      }
    }

    return index;
  }

  /**
   * Return the first monthly collection ID that this entry belongs to, or null
   * if the entry is not in any monthly collection that can be resolved.
   *
   * Collection membership is determined by:
   *  1. `entry.collections[]` (ADR-015 multi-collection) — preferred
   *  2. `entry.collectionId` (legacy single-collection field) — fallback
   */
  private resolveMonthlyCollectionId(
    entry: Entry,
    getCollection: (id: string) => Collection | undefined,
  ): string | null {
    // Gather all collection IDs this entry is a member of
    const collectionIds: string[] = [];

    // Prefer multi-collection array
    if (entry.collections && entry.collections.length > 0) {
      collectionIds.push(...entry.collections);
    } else if (entry.collectionId) {
      // Legacy single-collection field
      collectionIds.push(entry.collectionId);
    }

    if (collectionIds.length === 0) return null;

    // Return the first collection ID that resolves to a monthly collection
    for (const id of collectionIds) {
      const col = getCollection(id);
      if (col?.type === 'monthly') {
        return id;
      }
    }

    return null;
  }
}
