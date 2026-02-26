import type { IEventStore } from './event-store';
import type {
  Entry,
  Task,
  Note,
  Event as EventEntry,
  EntryFilter,
  DailyLog,
} from './task.types';
import { isoToLocalDateKey } from './date-utils';
import { EntryEventApplicator } from './entry.event-applicator';

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

  constructor(private readonly eventStore: IEventStore) {
    // Subscribe to event store changes to enable reactive projections
    this.eventStore.subscribe(() => {
      this.notifySubscribers();
    });
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
    const events = await this.eventStore.getAll();
    const entries = this.applicator.applyEvents(events);

    // Sanitize migration pointers (clear invalid pointers where target is deleted)
    const sanitizedEntries = entries.map(entry =>
      this.applicator.sanitizeMigrationPointers(entry, entries)
    );

    // Apply filter
    return this.applicator.filterEntries(sanitizedEntries, filter);
  }

  /**
   * Get a specific entry by ID (works for tasks, notes, or events)
   * 
   * @param entryId - The entry ID to find
   * @returns The entry, or undefined if not found
   */
  async getEntryById(entryId: string): Promise<Entry | undefined> {
    // IMPORTANT: We must get ALL events and apply them, not just events with this aggregateId
    // This is because migrated entries are created by TaskMigrated/NoteMigrated/EventMigrated events
    // which have the ORIGINAL task ID as aggregateId, not the new task ID
    const events = await this.eventStore.getAll();
    const entries = this.applicator.applyEvents(events);

    // Sanitize migration pointers before returning
    const sanitizedEntries = entries.map(entry =>
      this.applicator.sanitizeMigrationPointers(entry, entries)
    );

    return sanitizedEntries.find(entry => entry.id === entryId);
  }

  /**
   * Get all tasks (for backward compatibility with existing code)
   */
  async getTasks(): Promise<Task[]> {
    const entries = await this.getEntries('tasks');
    return entries.filter((e): e is Task & { type: 'task' } => e.type === 'task')
      .map(({ type, ...task }) => task);
  }

  /**
   * Get task by ID (for backward compatibility)
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
   * Get entries grouped by creation date (Daily Logs view)
   * 
   * This implements the bullet journal "daily log" paradigm where entries
   * are organized by the day they were created, not by type or other criteria.
   * 
   * @param limit - Number of days to load (default: 7)
   * @param beforeDate - Load days before this ISO date string (for progressive loading)
   * @param filter - Optional filter for entry types (default: 'all')
   * @returns Array of daily logs, sorted newest first
   * 
   * @example
   * // Load last 7 days
   * const logs = await projection.getDailyLogs();
   * 
   * // Load 7 more days before a specific date
   * const olderLogs = await projection.getDailyLogs(7, '2026-01-15');
   */
  async getDailyLogs(
    limit: number = 7,
    beforeDate?: string,
    filter: EntryFilter = 'all'
  ): Promise<DailyLog[]> {
    // Get all entries (already sorted by order field)
    const allEntries = await this.getEntries(filter);
    
    // Group entries by creation date (YYYY-MM-DD)
    const groupedByDate = new Map<string, Entry[]>();
    
    for (const entry of allEntries) {
      // Convert UTC timestamp to local date (timezone-safe)
      // e.g., "2026-01-26T00:03:00.000Z" -> "2026-01-25" if user is in EST
      const dateKey = isoToLocalDateKey(entry.createdAt);
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, []);
      }
      groupedByDate.get(dateKey)!.push(entry);
    }
    
    // Convert to DailyLog array
    const allDailyLogs: DailyLog[] = Array.from(groupedByDate.entries())
      .map(([date, entries]) => ({
        date,
        entries, // Already sorted by order field from getEntries()
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort dates newest first
    
    // Apply progressive loading filters
    if (beforeDate) {
      const beforeDateKey = beforeDate.substring(0, 10);
      const filteredLogs = allDailyLogs.filter(log => log.date < beforeDateKey);
      return filteredLogs.slice(0, limit);
    }
    
    // Return most recent N days
    return allDailyLogs.slice(0, limit);
  }

  /**
   * Get entries filtered by collection
   * 
   * @param collectionId - The collection ID to filter by (null = uncategorized)
   * @returns Array of entries in the specified collection, sorted by order
   */
  async getEntriesByCollection(collectionId: string | null): Promise<Entry[]> {
    const allEntries = await this.getEntries('all');
    
    // Filter entries by collectionId
    // Note: both undefined and null are treated as "uncategorized"
    return allEntries.filter(entry => {
      const entryCollectionId = entry.collectionId ?? null;
      return entryCollectionId === collectionId;
    });
  }

  /**
   * Get entry counts grouped by collection ID
   * Efficiently counts all entries and groups them by collection in a single query.
   * This avoids the N+1 query pattern when displaying collection badges.
   * 
   * @returns Map of collection ID to entry count (null key = uncategorized entries)
   */
  async getEntryCountsByCollection(): Promise<Map<string | null, number>> {
    const allEntries = await this.getEntries('all');
    const counts = new Map<string | null, number>();
    
    // Count entries by collection ID in memory (fast!)
    for (const entry of allEntries) {
      const collectionId = entry.collectionId ?? null;
      counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
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
   * This provides a more meaningful metric for collection badges than
   * total entry counts, as it shows actionable work remaining.
   * 
   * @returns Map of collection ID to active task count (null key = uncategorized tasks)
   */
  async getActiveTaskCountsByCollection(): Promise<Map<string | null, number>> {
    const allEntries = await this.getEntries('all');
    const counts = new Map<string | null, number>();
    
    for (const entry of allEntries) {
      // Only count active tasks:
      // - Must be a task
      // - Must have 'open' status
      // - Must not be migrated (no migratedTo pointer)
      if (entry.type === 'task' && entry.status === 'open' && !entry.migratedTo) {
        const collectionId = entry.collectionId ?? null;
        counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
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
    const allEntries = await this.getEntries('all');
    const statsMap = new Map<string | null, {
      openTasks: number;
      completedTasks: number;
      notes: number;
      events: number;
    }>();
    
    for (const entry of allEntries) {
      // Skip migrated entries (they shouldn't count in stats)
      if (entry.migratedTo) continue;
      
      const collectionId = entry.collectionId ?? null;
      
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
    
    return statsMap;
  }

  // ============================================================================
  // Sub-Task Queries (Phase 1: Sub-Tasks)
  // ============================================================================

  /**
   * Get all sub-tasks of a parent task
   * Returns tasks that have parentEntryId === parentEntryId
   * NOTE: This is a cross-collection query - returns sub-tasks from ALL collections
   * 
   * Symlink behavior (Phase 2):
   * - Excludes original versions of migrated tasks (tasks with migratedTo pointer)
   * - Includes migrated versions (tasks with migratedFrom pointer)
   * - Result: Sub-task appears only once in the list (the active version)
   * 
   * @param parentEntryId - The parent entry ID
   * @returns Array of sub-tasks (tasks with this parentEntryId), sorted by order
   */
  async getSubTasks(parentEntryId: string): Promise<Task[]> {
    const allTasks = await this.getTasks();
    return allTasks.filter(task => 
      task.parentEntryId === parentEntryId && !task.migratedTo
    );
  }

  /**
   * Batch query for sub-tasks of multiple parents (Phase 2 optimization)
   * Reduces N queries to 1 query by fetching all tasks once
   * 
   * Performance: O(n) instead of O(n²) for large task lists
   * - Single call to getTasks() instead of N calls
   * - Single iteration over all tasks to group by parent
   * 
   * @param parentIds - Array of parent task IDs
   * @returns Map of parent ID to sub-tasks array
   */
  async getSubTasksForMultipleParents(parentIds: string[]): Promise<Map<string, Task[]>> {
    const allTasks = await this.getTasks();
    const resultMap = new Map<string, Task[]>();
    
    // Group tasks by parentEntryId in a single pass
    for (const task of allTasks) {
      // Skip if not a sub-task, or if migrated (original version)
      if (!task.parentEntryId || task.migratedTo) {
        continue;
      }
      
      // Only include if this is one of the requested parents
      if (parentIds.includes(task.parentEntryId)) {
        if (!resultMap.has(task.parentEntryId)) {
          resultMap.set(task.parentEntryId, []);
        }
        resultMap.get(task.parentEntryId)!.push(task);
      }
    }
    
    return resultMap;
  }

  /**
   * Check if a task is a sub-task
   * A task is a sub-task if it has a parentEntryId set
   * 
   * @param task - The task to check
   * @returns true if task is a sub-task, false otherwise
   */
  isSubTask(task: Task): boolean {
    return task.parentEntryId !== undefined;
  }

  /**
   * Check if a task is a parent task (has children)
   * A task is a parent if at least one other task has parentEntryId === this task's ID
   * 
   * @param taskId - The task ID to check
   * @returns true if task has children, false otherwise
   */
  async isParentTask(taskId: string): Promise<boolean> {
    const children = await this.getSubTasks(taskId);
    return children.length > 0;
  }

  /**
   * Get completion status for a parent task's children
   * 
   * Returns:
   * - total: Total number of sub-tasks
   * - completed: Number of completed sub-tasks
   * - allComplete: true if all sub-tasks are complete (or no sub-tasks exist)
   * 
   * @param parentEntryId - The parent entry ID
   * @returns Completion status object
   */
  async getParentCompletionStatus(parentEntryId: string): Promise<{
    total: number;
    completed: number;
    allComplete: boolean;
  }> {
    const children = await this.getSubTasks(parentEntryId);
    const completed = children.filter(child => child.status === 'completed').length;
    
    return {
      total: children.length,
      completed,
      allComplete: children.length === 0 || completed === children.length, // Vacuous truth: 0/0 = all complete
    };
  }

  /**
   * Get parent task for a sub-task (Phase 2: Migration/Symlink)
   * 
   * Returns the parent task if the given task is a sub-task.
   * Returns undefined if:
   * - Task is not a sub-task (no parentEntryId)
   * - Parent task doesn't exist (deleted)
   * 
   * @param task - The task to get parent for
   * @returns Parent task or undefined
   */
  async getParentTask(task: Task): Promise<Task | undefined> {
    if (!task.parentEntryId) {
      return undefined;
    }
    return this.getTaskById(task.parentEntryId);
  }

  /**
   * Check if a sub-task has been migrated to a different collection (Phase 2: Migration/Symlink)
   * 
   * A sub-task is considered "migrated" when:
   * - It has a parentEntryId (is a sub-task), AND
   * - Its collectionId differs from its parent's collectionId
   * 
   * Returns false if:
   * - Task is not a sub-task (no parentEntryId)
   * - Task is in the same collection as parent (unmigrated sub-task)
   * - Parent task doesn't exist (edge case - orphaned sub-task)
   * 
   * This determines whether to show the 🔗 icon and migration indicators.
   * 
   * @param task - The task to check
   * @returns true if sub-task is migrated to different collection, false otherwise
   */
  async isSubTaskMigrated(task: Task): Promise<boolean> {
    // Not a sub-task - cannot be migrated
    if (!task.parentEntryId) {
      return false;
    }

    // Get parent task
    const parent = await this.getParentTask(task);
    
    // Parent doesn't exist (deleted or never existed) - treat as not migrated
    if (!parent) {
      return false;
    }

    // Compare collection IDs (normalize undefined to null for comparison)
    const taskCollectionId = task.collectionId ?? null;
    const parentCollectionId = parent.collectionId ?? null;

    // Migrated if collection IDs differ
    return taskCollectionId !== parentCollectionId;
  }

  /**
   * Get parent task titles for a list of sub-task IDs (Phase 2: Batch Query for Parent Titles)
   * 
   * This is a performance optimization for displaying parent context in entry lists.
   * Returns a Map<subTaskId, parentTitle> only for entries where:
   * - Entry is a task
    * - Entry has a parentEntryId

   * - Parent task exists and is a task
   * 
   * This does NOT filter by collection - filtering happens in the UI layer.
   * UI decides whether to show parent title based on whether sub-task is migrated.
   * 
   * @param subTaskIds - Array of task IDs to check for parent titles
   * @returns Map of sub-task ID to parent title (only includes entries with valid parents)
   */
  async getParentTitlesForSubTasks(subTaskIds: string[]): Promise<Map<string, string>> {
    const parentTitles = new Map<string, string>();
    
    // Get all events and build entries map (reuse projection logic)
    const events = await this.eventStore.getAll();
    const entries = this.applicator.applyEvents(events);
    
    // Build a lookup map for fast access
    const entriesMap = new Map<string, Entry>();
    for (const entry of entries) {
      entriesMap.set(entry.id, entry);
    }
    
    // For each sub-task ID, find parent and extract title
    for (const subTaskId of subTaskIds) {
      const subTask = entriesMap.get(subTaskId);
      
      // Skip if entry doesn't exist or is not a task
      if (!subTask || subTask.type !== 'task') continue;
      
      // Skip if task has no parent
      if (!subTask.parentEntryId) continue;
      
      // Find parent task
      const parent = entriesMap.get(subTask.parentEntryId);
      
      // Skip if parent doesn't exist or is not a task
      if (!parent || parent.type !== 'task') continue;
      
      // Add parent title to map
      parentTitles.set(subTaskId, parent.title);
    }
    
    return parentTitles;
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
    const allEntries = await this.getEntries();
    
    // Active entries: Currently in this collection (all types use collections[])
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

}
