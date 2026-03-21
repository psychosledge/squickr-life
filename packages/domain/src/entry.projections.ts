import type { IEventStore } from './event-store';
import type {
  Entry,
  Task,
  Note,
  Event as EventEntry,
  EntryFilter,
  DailyLog,
} from './task.types';
import { EntryEventApplicator } from './entry.event-applicator';
import type { ISnapshotStore, ProjectionSnapshot } from './snapshot-store';
import { SNAPSHOT_SCHEMA_VERSION } from './snapshot-store';
import type { DomainEvent } from './domain-event';
import { logger } from './logger';
import { CollectionViewProjection } from './collection-view.projection';
import { SubTaskProjection } from './sub-task.projection';
import { DailyLogProjection } from './daily-log.projection';
import { ReviewProjection } from './review.projection';
import type { StalledTask } from './review.projection';
import type { Collection } from './collection.types';
import { HabitProjection } from './habit.projection';
import type { HabitReadModel } from './habit.types';

/**
 * EntryListProjection - Unified Read Model for Tasks, Notes, and Events
 * 
 * This projection creates a unified view of all entry types (tasks, notes, events)
 * by replaying events from the EventStore and building discriminated union types.
 * 
 * This demonstrates:
 * - Multiple aggregate types in one projection
 * - Discriminated unions for type safety
 * - Polymorphic handling in the UI layer
 * - Reactive updates via event store subscription
 */
export class EntryListProjection {
  private subscribers = new Set<() => void>();
  private readonly applicator = new EntryEventApplicator();
  private cachedEntries: Entry[] | null = null;
  private readonly snapshotStore?: ISnapshotStore;
  private absorbedEventIds: Set<string> | null = null;

  // ── Private facade objects (implementation details — never exported) ──────
  private readonly collectionView = new CollectionViewProjection(this);
  private readonly subTask = new SubTaskProjection(this);
  private readonly dailyLog = new DailyLogProjection(this);
  private readonly review: ReviewProjection;
  private readonly habit: HabitProjection;

  constructor(private readonly eventStore: IEventStore, snapshotStore?: ISnapshotStore) {
    this.snapshotStore = snapshotStore;
    this.review = new ReviewProjection(this, this.eventStore);
    this.habit = new HabitProjection(this.eventStore);
    // Subscribe to event store changes to enable reactive projections
    this.eventStore.subscribe((event: DomainEvent) => {
      // If this event was already baked into the hydrated snapshot, absorb silently.
      if (this.absorbedEventIds?.has(event.id)) {
        this.absorbedEventIds.delete(event.id); // drain to allow GC
        return;
      }
      // First genuinely new event clears absorption mode.
      this.absorbedEventIds = null;

      // Incremental update: apply the new event directly on top of the in-memory
      // cache instead of discarding it and forcing a full event-log replay.
      // If the cache is null (cold start, not yet populated), leave it null —
      // a full replay will happen lazily on the next getEntries() call.
      if (this.cachedEntries !== null) {
        this.cachedEntries = this.applicator.applyEventsOnto([...this.cachedEntries], [event]);
      }

      this.notifySubscribers();
    });
  }

  /**
   * Resolve the full (unfiltered, unsanitized) entry list from cache or rebuild.
   * All public methods that need the base entry list should go through here.
   */
  private async resolveCache(): Promise<Entry[]> {
    if (this.cachedEntries !== null) {
      return this.cachedEntries;
    }
    const events = await this.eventStore.getAll();
    this.cachedEntries = this.applicator.applyEvents(events);
    this.absorbedEventIds = null; // full replay — absorbed IDs no longer relevant
    return this.cachedEntries;
  }

  /**
   * Hydrate the projection cache from a previously saved snapshot.
   *
   * Phase 2 (ADR-016 / ADR-017): Uses `snapshot.state` as the seed and applies
   * only the delta events (those after `snapshot.lastEventId`) on top of it via
   * `applyEventsOnto()`.  This avoids a full event replay when the snapshot is
   * recent.
   *
   * If no snapshot store is configured, no snapshot exists, the schema version
   * is stale, or the snapshot's lastEventId is not found in the event log, this
   * method is a no-op — a full replay will happen lazily on the first
   * getEntries() call.
   */
  async hydrate(): Promise<void> {
    if (!this.snapshotStore) return;

    const snapshot = await this.snapshotStore.load('entry-list-projection');

    if (!snapshot || snapshot.version !== SNAPSHOT_SCHEMA_VERSION) {
      // No snapshot or stale schema — cache stays null, full replay on first getEntries()
      return;
    }

    // Load all events to determine the delta
    const allEvents = await this.eventStore.getAll();

    if (allEvents.length === 0) {
      // No events at all. One legitimate scenario: first cold-start on a new device where
      // the remote snapshot was restored (ADR-018) but SyncManager hasn't downloaded the
      // event log yet. The snapshot is ignored here; a full replay will happen lazily on
      // the next getEntries() call once events arrive.
      logger.warn(
        '[EntryListProjection.hydrate] Snapshot exists but local event log is empty.',
        'Possible causes: cold-start before event download completes, or IndexedDB was cleared.',
        'Falling back to full replay on next getEntries() call.',
      );
      return;
    }

    // Find the snapshot's cursor position in the event log
    const snapshotEventIndex = allEvents.findIndex(e => e.id === snapshot.lastEventId);

    if (snapshotEventIndex < 0) {
      // lastEventId not found in log — full replay fallback (cache stays null)
      return;
    }

    const deltaEvents = allEvents.slice(snapshotEventIndex + 1);

    if (deltaEvents.length === 0) {
      // Snapshot is fully up-to-date — seed the cache directly, zero replay cost
      this.cachedEntries = [...snapshot.state];
      // Use all event IDs (not just lastEventId) so that any call path — including
      // individual append() calls — is absorbed correctly. The set is drained lazily
      // as events arrive, so GC cost is identical to a single-ID set.
      this.absorbedEventIds = new Set(allEvents.map(e => e.id));
    } else {
      // Apply only the delta events on top of the snapshot state
      this.cachedEntries = this.applicator.applyEventsOnto([...snapshot.state], deltaEvents);
      // absorbedEventIds includes ALL events (snapshot + delta), not just snapshot events.
      // Rationale: SyncManager may re-deliver delta events on its next syncNow() pass if
      // the batch download window overlaps with what hydrate() already applied (e.g. a
      // retry or a remote fetch that starts from lastKnownEventId rather than current
      // localIds). Including delta IDs ensures those re-deliveries are silently absorbed
      // rather than causing a spurious cache invalidation and UI re-render.
      this.absorbedEventIds = new Set(allEvents.map(e => e.id));
    }
  }

  /**
   * Create a snapshot of the current projection state.
   *
   * The snapshot captures the result of getEntries('all') — all active
   * (non-deleted) entries — together with the ID of the last event that was
   * applied.  The SnapshotManager (Step 6) is responsible for persisting the
   * snapshot via snapshotStore.save().
   *
   * @returns A ProjectionSnapshot, or null if there are no events yet.
   */
  async createSnapshot(): Promise<ProjectionSnapshot | null> {
    const allEvents = await this.eventStore.getAll();
    if (allEvents.length === 0) return null;

    const lastEvent = allEvents[allEvents.length - 1]!;

    // Prime the cache with the events we already fetched so that the
    // getEntries('all') call below hits the cache instead of issuing a
    // second IndexedDB scan.
    if (this.cachedEntries === null) {
      this.cachedEntries = this.applicator.applyEvents(allEvents);
    }

    // getEntries('all') will hit the cache we just warmed
    const entries = await this.getEntries('all');

    return {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: lastEvent.id,
      state: entries,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Subscribe to projection changes
   * Callback is invoked whenever the projection data changes
   * Returns an unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers that the projection has changed
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  /**
   * Get all entries (tasks + notes + events) as a unified list
   * 
   * @param filter - Optional filter for entry types
   * @returns Array of entries sorted by order
   */
  async getEntries(filter: EntryFilter = 'all'): Promise<Entry[]> {
    const entries = await this.resolveCache();

    // Sanitize migration pointers (clear invalid pointers where target is deleted)
    const sanitizedEntries = entries.map(entry =>
      this.applicator.sanitizeMigrationPointers(entry, entries)
    );

    // Exclude soft-deleted entries from active views
    const activeEntries = sanitizedEntries.filter(entry => !entry.deletedAt);

    // Apply filter
    return this.applicator.filterEntries(activeEntries, filter);
  }

  /**
   * Get a specific entry by ID (works for tasks, notes, or events)
   * Returns ALL entries including soft-deleted ones (used by restore handlers).
   * 
   * @param entryId - The entry ID to find
   * @returns The entry (including soft-deleted), or undefined if not found
   */
  async getEntryById(entryId: string): Promise<Entry | undefined> {
    // IMPORTANT: We must get ALL events and apply them, not just events with this aggregateId
    // This is because migrated entries are created by TaskMigrated/NoteMigrated/EventMigrated events
    // which have the ORIGINAL task ID as aggregateId, not the new task ID
    const entries = await this.resolveCache();

    // Sanitize migration pointers before returning
    const sanitizedEntries = entries.map(entry =>
      this.applicator.sanitizeMigrationPointers(entry, entries)
    );

    return sanitizedEntries.find(entry => entry.id === entryId);
  }

  /**
   * Get all tasks (for backward compatibility with existing code)
   * Only returns ACTIVE (non-deleted) tasks.
   */
  async getTasks(): Promise<Task[]> {
    const entries = await this.getEntries('tasks');
    return entries.filter((e): e is Task & { type: 'task' } => e.type === 'task')
      .map(({ type, ...task }) => task);
  }

  /**
   * Get task by ID (for backward compatibility)
   * Returns the task including soft-deleted ones (so callers can check deletedAt).
   * Use getEntries() / getTasks() for active-only lists.
   */
  async getTaskById(taskId: string): Promise<Task | undefined> {
    const entry = await this.getEntryById(taskId);
    if (entry?.type === 'task') {
      const { type, ...task } = entry;
      return task;
    }
    return undefined;
  }

  /**
   * Get all notes
   */
  async getNotes(): Promise<Note[]> {
    const entries = await this.getEntries('notes');
    return entries.filter((e): e is Note & { type: 'note' } => e.type === 'note')
      .map(({ type, ...note }) => note);
  }

  /**
   * Get note by ID
   * Returns the note including soft-deleted ones (so callers can check deletedAt).
   * Use getEntries() / getNotes() for active-only lists.
   */
  async getNoteById(noteId: string): Promise<Note | undefined> {
    const entry = await this.getEntryById(noteId);
    if (entry?.type === 'note') {
      const { type, ...note } = entry;
      return note;
    }
    return undefined;
  }

  /**
   * Get all events
   */
  async getEvents(): Promise<EventEntry[]> {
    const entries = await this.getEntries('events');
    return entries.filter((e): e is EventEntry & { type: 'event' } => e.type === 'event')
      .map(({ type, ...event }) => event);
  }

  /**
   * Get event by ID
   * Returns the event including soft-deleted ones (so callers can check deletedAt).
   * Use getEntries() / getEvents() for active-only lists.
   */
  async getEventById(eventId: string): Promise<EventEntry | undefined> {
    const entry = await this.getEntryById(eventId);
    if (entry?.type === 'event') {
      const { type, ...event } = entry;
      return event;
    }
    return undefined;
  }

  /**
   * Get ALL entries including soft-deleted ones, without any active filter.
   * 
   * This is the escape hatch for handlers that need to see deleted entries
   * (e.g. RestoreTaskHandler cascade). Prefer getEntries() for normal read models.
   * 
   * @returns Array of all entries including soft-deleted
   */
  async getAllEntriesIncludingDeleted(): Promise<Entry[]> {
    return this.resolveCache();
  }

  // ── Delegating methods — forward to private facade instances ─────────────

  /** @see CollectionViewProjection.getEntriesByCollection */
  async getEntriesByCollection(collectionId: string | null): Promise<Entry[]> {
    return this.collectionView.getEntriesByCollection(collectionId);
  }

  /** @see CollectionViewProjection.getEntryCountsByCollection */
  async getEntryCountsByCollection(): Promise<Map<string | null, number>> {
    return this.collectionView.getEntryCountsByCollection();
  }

  /** @see CollectionViewProjection.getActiveTaskCountsByCollection */
  async getActiveTaskCountsByCollection(): Promise<Map<string | null, number>> {
    return this.collectionView.getActiveTaskCountsByCollection();
  }

  /** @see CollectionViewProjection.getEntryStatsByCollection */
  async getEntryStatsByCollection(): Promise<Map<string | null, {
    openTasks: number;
    completedTasks: number;
    notes: number;
    events: number;
  }>> {
    return this.collectionView.getEntryStatsByCollection();
  }

  /** @see CollectionViewProjection.getEntriesForCollectionView */
  async getEntriesForCollectionView(
    collectionId: string
  ): Promise<(Entry & { renderAsGhost?: boolean; ghostNewLocation?: string })[]> {
    return this.collectionView.getEntriesForCollectionView(collectionId);
  }

  /** @see CollectionViewProjection.getDeletedEntries */
  async getDeletedEntries(collectionId: string): Promise<Entry[]> {
    return this.collectionView.getDeletedEntries(collectionId);
  }

  /** @see SubTaskProjection.getSubTasks */
  async getSubTasks(parentEntryId: string): Promise<Task[]> {
    return this.subTask.getSubTasks(parentEntryId);
  }

  /** @see SubTaskProjection.getSubTasksForMultipleParents */
  async getSubTasksForMultipleParents(parentIds: string[]): Promise<Map<string, Task[]>> {
    return this.subTask.getSubTasksForMultipleParents(parentIds);
  }

  /** @see SubTaskProjection.isSubTask */
  isSubTask(task: Task): boolean {
    return this.subTask.isSubTask(task);
  }

  /** @see SubTaskProjection.isParentTask */
  async isParentTask(taskId: string): Promise<boolean> {
    return this.subTask.isParentTask(taskId);
  }

  /** @see SubTaskProjection.getParentCompletionStatus */
  async getParentCompletionStatus(parentEntryId: string): Promise<{
    total: number;
    completed: number;
    allComplete: boolean;
  }> {
    return this.subTask.getParentCompletionStatus(parentEntryId);
  }

  /** @see SubTaskProjection.getParentTask */
  async getParentTask(task: Task): Promise<Task | undefined> {
    return this.subTask.getParentTask(task);
  }

  /** @see SubTaskProjection.isSubTaskMigrated */
  async isSubTaskMigrated(task: Task): Promise<boolean> {
    return this.subTask.isSubTaskMigrated(task);
  }

  /** @see SubTaskProjection.getParentTitlesForSubTasks */
  async getParentTitlesForSubTasks(subTaskIds: string[]): Promise<Map<string, string>> {
    return this.subTask.getParentTitlesForSubTasks(subTaskIds);
  }

  /** @see SubTaskProjection.getSubEntries */
  async getSubEntries(parentEntryId: string): Promise<Entry[]> {
    return this.subTask.getSubEntries(parentEntryId);
  }

  /** @see DailyLogProjection.getDailyLogs */
  async getDailyLogs(
    limit: number = 7,
    beforeDate?: string,
    filter: EntryFilter = 'all'
  ): Promise<DailyLog[]> {
    return this.dailyLog.getDailyLogs(limit, beforeDate, filter);
  }

  // ── ReviewProjection delegates ─────────────────────────────────────────────

  /** @see ReviewProjection.getCompletedInRange */
  async getCompletedInRange(from: Date, to: Date): Promise<Entry[]> {
    return this.review.getCompletedInRange(from, to);
  }

  /** @see ReviewProjection.getStalledMonthlyTasks */
  async getStalledMonthlyTasks(
    olderThanDays: number,
    getCollection: (id: string) => Collection | undefined,
  ): Promise<StalledTask[]> {
    return this.review.getStalledMonthlyTasks(olderThanDays, getCollection);
  }

  // ── HabitProjection delegates ──────────────────────────────────────────────

  /** @see HabitProjection.getActiveHabits */
  async getActiveHabits(): Promise<HabitReadModel[]> {
    return this.habit.getActiveHabits();
  }

  /** @see HabitProjection.getAllHabits */
  async getAllHabits(): Promise<HabitReadModel[]> {
    return this.habit.getAllHabits();
  }

  /** @see HabitProjection.getHabitById */
  async getHabitById(habitId: string): Promise<HabitReadModel | undefined> {
    return this.habit.getHabitById(habitId);
  }

  /** @see HabitProjection.getHabitsForDate */
  async getHabitsForDate(date: string): Promise<HabitReadModel[]> {
    return this.habit.getHabitsForDate(date);
  }
}
