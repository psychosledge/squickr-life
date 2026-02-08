import type { IEventStore } from './event-store';
import type { 
  Entry, 
  Task,
  Note,
  Event as EventEntry,
  TaskCreated, 
  TaskCompleted, 
  TaskReopened, 
  TaskDeleted, 
  TaskReordered, 
  TaskTitleChanged,
  TaskMigrated,
  NoteCreated,
  NoteContentChanged,
  NoteDeleted,
  NoteReordered,
  NoteMigrated,
  EventCreated,
  EventContentChanged,
  EventDateChanged,
  EventDeleted,
  EventReordered,
  EventMigrated,
  EntryFilter,
  DailyLog
} from './task.types';
import { isoToLocalDateKey } from './date-utils';

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
    const entries = this.applyEvents(events);
    
    // Sanitize migration pointers (clear invalid pointers where target is deleted)
    const sanitizedEntries = entries.map(entry => this.sanitizeMigrationPointers(entry, entries));
    
    // Apply filter
    return this.filterEntries(sanitizedEntries, filter);
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
    const entries = this.applyEvents(events);
    
    // Sanitize migration pointers before returning
    const sanitizedEntries = entries.map(entry => this.sanitizeMigrationPointers(entry, entries));
    
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
   * Returns tasks that have parentTaskId === parentTaskId
   * NOTE: This is a cross-collection query - returns sub-tasks from ALL collections
   * 
   * Symlink behavior (Phase 2):
   * - Excludes original versions of migrated tasks (tasks with migratedTo pointer)
   * - Includes migrated versions (tasks with migratedFrom pointer)
   * - Result: Sub-task appears only once in the list (the active version)
   * 
   * @param parentTaskId - The parent task ID
   * @returns Array of sub-tasks (tasks with this parentTaskId), sorted by order
   */
  async getSubTasks(parentTaskId: string): Promise<Task[]> {
    const allTasks = await this.getTasks();
    return allTasks.filter(task => 
      task.parentTaskId === parentTaskId && !task.migratedTo
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
    
    // Group tasks by parentTaskId in a single pass
    for (const task of allTasks) {
      // Skip if not a sub-task, or if migrated (original version)
      if (!task.parentTaskId || task.migratedTo) {
        continue;
      }
      
      // Only include if this is one of the requested parents
      if (parentIds.includes(task.parentTaskId)) {
        if (!resultMap.has(task.parentTaskId)) {
          resultMap.set(task.parentTaskId, []);
        }
        resultMap.get(task.parentTaskId)!.push(task);
      }
    }
    
    return resultMap;
  }

  /**
   * Check if a task is a sub-task
   * A task is a sub-task if it has a parentTaskId set
   * 
   * @param task - The task to check
   * @returns true if task is a sub-task, false otherwise
   */
  isSubTask(task: Task): boolean {
    return task.parentTaskId !== undefined;
  }

  /**
   * Check if a task is a parent task (has children)
   * A task is a parent if at least one other task has parentTaskId === this task's ID
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
   * @param parentTaskId - The parent task ID
   * @returns Completion status object
   */
  async getParentCompletionStatus(parentTaskId: string): Promise<{
    total: number;
    completed: number;
    allComplete: boolean;
  }> {
    const children = await this.getSubTasks(parentTaskId);
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
   * - Task is not a sub-task (no parentTaskId)
   * - Parent task doesn't exist (deleted)
   * 
   * @param task - The task to get parent for
   * @returns Parent task or undefined
   */
  async getParentTask(task: Task): Promise<Task | undefined> {
    if (!task.parentTaskId) {
      return undefined;
    }
    return this.getTaskById(task.parentTaskId);
  }

  /**
   * Check if a sub-task has been migrated to a different collection (Phase 2: Migration/Symlink)
   * 
   * A sub-task is considered "migrated" when:
   * - It has a parentTaskId (is a sub-task), AND
   * - Its collectionId differs from its parent's collectionId
   * 
   * Returns false if:
   * - Task is not a sub-task (no parentTaskId)
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
    if (!task.parentTaskId) {
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
    
    // Active entries: Currently in this collection
    const activeEntries = allEntries
      .filter(entry => {
        if (entry.type === 'task') {
          return entry.collections.includes(collectionId);
        }
        // For notes/events, use legacy collectionId (no multi-collection yet)
        return entry.collectionId === collectionId;
      })
      .map(entry => ({
        ...entry,
        renderAsGhost: false,
      }));
    
    // Ghost entries: Removed from this collection (tasks only for now)
    const ghostEntries = allEntries
      .filter(entry => entry.type === 'task')
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
   * Sanitize migration pointers for a single entry
   * If entry has migratedTo but target doesn't exist or is deleted, clear migration pointers
   * 
   * @param entry - The entry to sanitize
   * @param allEntries - All entries (to check if migration target exists)
   * @returns Entry with migration pointers cleared if target is invalid
   */
  private sanitizeMigrationPointers<T extends Entry>(entry: T, allEntries: Entry[]): T {
    // If entry has no migration pointer, return unchanged
    if (!entry.migratedTo) {
      return entry;
    }

    // Check if target entry exists in any of the three types
    const targetExists = allEntries.some(e => e.id === entry.migratedTo);

    // If target exists (not deleted), return unchanged
    if (targetExists) {
      return entry;
    }

    // Target is deleted or doesn't exist, clear migration pointers
    // Create new object without migratedTo and migratedToCollectionId properties
    const { migratedTo, migratedToCollectionId, ...entryWithoutMigration } = entry as any;
    return entryWithoutMigration as T;
  }

  /**
   * Apply events to build entry state
   * This handles Task, Note, and Event events polymorphically
   */
  private applyEvents(events: readonly import('./domain-event').DomainEvent[]): Entry[] {
    const tasks: Map<string, Task> = new Map();
    const notes: Map<string, Note> = new Map();
    const eventEntries: Map<string, EventEntry> = new Map();

    for (const event of events) {
      // Handle polymorphic EntryMovedToCollection FIRST (cross-cutting concern)
      // This event can apply to any entry type, so we check all three maps
      if (this.isEntryMovedEvent(event)) {
        const entryId = event.payload.entryId;
        const collectionId = event.payload.collectionId ?? undefined;
        
        // Check which map contains this entry and update it
        if (tasks.has(entryId)) {
          const task = tasks.get(entryId)!;
          tasks.set(task.id, { ...task, collectionId });
        } else if (notes.has(entryId)) {
          const note = notes.get(entryId)!;
          notes.set(note.id, { ...note, collectionId });
        } else if (eventEntries.has(entryId)) {
          const evt = eventEntries.get(entryId)!;
          eventEntries.set(evt.id, { ...evt, collectionId });
        }
      }
      // Handle type-specific events
      else if (this.isTaskEvent(event)) {
        this.applyTaskEvent(tasks, event);
      }
      else if (this.isNoteEvent(event)) {
        this.applyNoteEvent(notes, event);
      }
      else if (this.isEventEvent(event)) {
        this.applyEventEvent(eventEntries, event);
      }
    }

    // Combine all entries with type discriminators
    // NOTE: Order matters! We combine all types together, then sort by order field
    const allEntries: Entry[] = [
      ...Array.from(tasks.values()).map(task => ({ ...task, type: 'task' as const })),
      ...Array.from(notes.values()).map(note => ({ ...note, type: 'note' as const })),
      ...Array.from(eventEntries.values()).map(evt => ({ ...evt, type: 'event' as const })),
    ];

    // CRITICAL: Sort ONLY by order field (lexicographic comparison for fractional indexing)
    // DO NOT sort by type - this allows mixed types to be interleaved based on user's drag-drop order
    return allEntries.sort((a, b) => {
      if (a.order && b.order) {
        return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
      }
      if (a.order && !b.order) return -1;
      if (!a.order && b.order) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  /**
   * Apply task events (reuse logic from TaskListProjection)
   */
  private applyTaskEvent(
    tasks: Map<string, Task>, 
    event: TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged | TaskMigrated | import('./task.types').TaskAddedToCollection | import('./task.types').TaskRemovedFromCollection
  ): void {
    switch (event.type) {
      case 'TaskCreated': {
        const task: Task = {
          id: event.payload.id,
          title: event.payload.title,
          createdAt: event.payload.createdAt,
          status: event.payload.status,
          order: event.payload.order,
          collectionId: event.payload.collectionId,
          userId: event.payload.userId,
          parentTaskId: event.payload.parentTaskId, // Phase 1: Sub-Tasks
          parentEntryId: event.payload.parentTaskId, // Use parentEntryId for polymorphism
          // Initialize collections array from legacy collectionId
          collections: event.payload.collectionId ? [event.payload.collectionId] : [],
          collectionHistory: event.payload.collectionId ? [
            {
              collectionId: event.payload.collectionId,
              addedAt: event.timestamp,
            }
          ] : [],
        };
        tasks.set(task.id, task);
        break;
      }
      case 'TaskCompleted': {
        const task = tasks.get(event.payload.taskId);
        if (task) {
          tasks.set(task.id, {
            ...task,
            status: 'completed',
            completedAt: event.payload.completedAt,
          });
        }
        break;
      }
      case 'TaskReopened': {
        const task = tasks.get(event.payload.taskId);
        if (task) {
          tasks.set(task.id, {
            ...task,
            status: 'open',
            completedAt: undefined,
          });
        }
        break;
      }
      case 'TaskDeleted': {
        tasks.delete(event.payload.taskId);
        break;
      }
      case 'TaskReordered': {
        const task = tasks.get(event.payload.taskId);
        if (task) {
          tasks.set(task.id, {
            ...task,
            order: event.payload.order,
          });
        }
        break;
      }
      case 'TaskTitleChanged': {
        const task = tasks.get(event.payload.taskId);
        if (task) {
          tasks.set(task.id, {
            ...task,
            title: event.payload.newTitle,
          });
        }
        break;
      }
      case 'TaskMigrated': {
        // Mark original task with migratedTo pointer and store target collection
        // for "Go to" navigation. Original task stays in its original collection.
        const originalTask = tasks.get(event.payload.originalTaskId);
        if (originalTask) {
          tasks.set(originalTask.id, {
            ...originalTask,
            migratedTo: event.payload.migratedToId,
            migratedToCollectionId: event.payload.targetCollectionId ?? undefined,
          });
        }

        // Create new task in target collection with migratedFrom pointer
        // New task inherits all properties from original except collectionId and migration pointers
        // IMPORTANT: Preserve parentTaskId for sub-tasks (Phase 2: Migration/Symlink)
        if (originalTask) {
          // Phase 3: Parent Cascade - If this is a sub-task and its parent has been migrated,
          // update parentTaskId to point to migrated parent (preserve hierarchy in new collection)
          let parentTaskId = originalTask.parentTaskId;
          
          if (parentTaskId) {
            // This is a sub-task - check if parent has been migrated
            const parentTask = tasks.get(parentTaskId);
            if (parentTask?.migratedTo) {
              // Parent has been migrated - check if in SAME target collection
              const parentMigrated = tasks.get(parentTask.migratedTo);
              if (parentMigrated && 
                  (parentMigrated.collectionId ?? null) === (event.payload.targetCollectionId ?? null)) {
                // Parent migrated to SAME collection → update child to point to migrated parent
                parentTaskId = parentTask.migratedTo;
              }
              // Else: Parent migrated to DIFFERENT collection → keep original parentTaskId
            }
          }

          const newTask: Task = {
            id: event.payload.migratedToId,
            title: originalTask.title,
            createdAt: event.payload.migratedAt, // New creation time
            status: originalTask.status, // Preserve status
            completedAt: originalTask.completedAt, // Preserve completion if completed
            order: originalTask.order, // Same order as original (will need reordering in UI)
            collectionId: event.payload.targetCollectionId ?? undefined,
            userId: originalTask.userId,
            migratedFrom: event.payload.originalTaskId,
            migratedFromCollectionId: originalTask.collectionId, // Store source collection for "Go back"
            parentTaskId, // Phase 3: Updated to point to migrated parent if cascade
            parentEntryId: parentTaskId, // Use parentEntryId for polymorphism
            // Initialize collections array from target collection
            collections: event.payload.targetCollectionId ? [event.payload.targetCollectionId] : [],
            collectionHistory: event.payload.targetCollectionId ? [
              {
                collectionId: event.payload.targetCollectionId,
                addedAt: event.payload.migratedAt,
              }
            ] : [],
          };
          tasks.set(newTask.id, newTask);
        }
        break;
      }
      case 'TaskAddedToCollection': {
        const task = tasks.get(event.payload.taskId);
        if (!task) {
          return;
        }
        
        // Idempotency check
        if (task.collections.includes(event.payload.collectionId)) {
          return;
        }
        
        const updatedTask: Task = {
          ...task,
          collections: [...task.collections, event.payload.collectionId],
          collectionHistory: [
            ...(task.collectionHistory || []),
            {
              collectionId: event.payload.collectionId,
              addedAt: event.timestamp,
            }
          ],
        };
        
        tasks.set(task.id, updatedTask);
        break;
      }
      case 'TaskRemovedFromCollection': {
        const task = tasks.get(event.payload.taskId);
        if (!task) {
          return;
        }
        
        const updatedTask: Task = {
          ...task,
          collections: task.collections.filter(c => c !== event.payload.collectionId),
          collectionHistory: task.collectionHistory?.map(h => 
            h.collectionId === event.payload.collectionId && !h.removedAt
              ? { ...h, removedAt: event.timestamp }
              : h
          ),
        };
        
        tasks.set(task.id, updatedTask);
        break;
      }
    }
  }

  /**
   * Apply note events
   */
  private applyNoteEvent(notes: Map<string, Note>, event: NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered | NoteMigrated): void {
    switch (event.type) {
      case 'NoteCreated': {
        const note: Note = {
          id: event.payload.id,
          content: event.payload.content,
          createdAt: event.payload.createdAt,
          order: event.payload.order,
          collectionId: event.payload.collectionId,
          userId: event.payload.userId,
        };
        notes.set(note.id, note);
        break;
      }
      case 'NoteContentChanged': {
        const note = notes.get(event.payload.noteId);
        if (note) {
          notes.set(note.id, {
            ...note,
            content: event.payload.newContent,
          });
        }
        break;
      }
      case 'NoteDeleted': {
        notes.delete(event.payload.noteId);
        break;
      }
      case 'NoteReordered': {
        const note = notes.get(event.payload.noteId);
        if (note) {
          notes.set(note.id, {
            ...note,
            order: event.payload.order,
          });
        }
        break;
      }
      case 'NoteMigrated': {
        // Mark original note with migratedTo pointer and store target collection
        // for "Go to" navigation. Original note stays in its original collection.
        const originalNote = notes.get(event.payload.originalNoteId);
        if (originalNote) {
          notes.set(originalNote.id, {
            ...originalNote,
            migratedTo: event.payload.migratedToId,
            migratedToCollectionId: event.payload.targetCollectionId ?? undefined,
          });
        }

        // Create new note in target collection with migratedFrom pointer
        if (originalNote) {
          const newNote: Note = {
            id: event.payload.migratedToId,
            content: originalNote.content,
            createdAt: event.payload.migratedAt, // New creation time
            order: originalNote.order, // Same order as original
            collectionId: event.payload.targetCollectionId ?? undefined,
            userId: originalNote.userId,
            migratedFrom: event.payload.originalNoteId,
            migratedFromCollectionId: originalNote.collectionId, // Store source collection for "Go back"
          };
          notes.set(newNote.id, newNote);
        }
        break;
      }
    }
  }

  /**
   * Apply event events
   */
  private applyEventEvent(eventEntries: Map<string, EventEntry>, event: EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered | EventMigrated): void {
    switch (event.type) {
      case 'EventCreated': {
        const evt: EventEntry = {
          id: event.payload.id,
          content: event.payload.content,
          createdAt: event.payload.createdAt,
          eventDate: event.payload.eventDate,
          order: event.payload.order,
          collectionId: event.payload.collectionId,
          userId: event.payload.userId,
        };
        eventEntries.set(evt.id, evt);
        break;
      }
      case 'EventContentChanged': {
        const evt = eventEntries.get(event.payload.eventId);
        if (evt) {
          eventEntries.set(evt.id, {
            ...evt,
            content: event.payload.newContent,
          });
        }
        break;
      }
      case 'EventDateChanged': {
        const evt = eventEntries.get(event.payload.eventId);
        if (evt) {
          eventEntries.set(evt.id, {
            ...evt,
            eventDate: event.payload.newEventDate ?? undefined,
          });
        }
        break;
      }
      case 'EventDeleted': {
        eventEntries.delete(event.payload.eventId);
        break;
      }
      case 'EventReordered': {
        const evt = eventEntries.get(event.payload.eventId);
        if (evt) {
          eventEntries.set(evt.id, {
            ...evt,
            order: event.payload.order,
          });
        }
        break;
      }
      case 'EventMigrated': {
        // Mark original event with migratedTo pointer and store target collection
        // for "Go to" navigation. Original event stays in its original collection.
        const originalEvent = eventEntries.get(event.payload.originalEventId);
        if (originalEvent) {
          eventEntries.set(originalEvent.id, {
            ...originalEvent,
            migratedTo: event.payload.migratedToId,
            migratedToCollectionId: event.payload.targetCollectionId ?? undefined,
          });
        }

        // Create new event in target collection with migratedFrom pointer
        if (originalEvent) {
          const newEvent: EventEntry = {
            id: event.payload.migratedToId,
            content: originalEvent.content,
            createdAt: event.payload.migratedAt, // New creation time
            eventDate: originalEvent.eventDate, // Preserve event date
            order: originalEvent.order, // Same order as original
            collectionId: event.payload.targetCollectionId ?? undefined,
            userId: originalEvent.userId,
            migratedFrom: event.payload.originalEventId,
            migratedFromCollectionId: originalEvent.collectionId, // Store source collection for "Go back"
          };
          eventEntries.set(newEvent.id, newEvent);
        }
        break;
      }
    }
  }

  /**
   * Filter entries based on filter type
   */
  private filterEntries(entries: Entry[], filter: EntryFilter): Entry[] {
    switch (filter) {
      case 'all':
        return entries;
      case 'tasks':
        return entries.filter(e => e.type === 'task');
      case 'notes':
        return entries.filter(e => e.type === 'note');
      case 'events':
        return entries.filter(e => e.type === 'event');
      case 'open-tasks':
        return entries.filter(e => e.type === 'task' && e.status === 'open');
      case 'completed-tasks':
        return entries.filter(e => e.type === 'task' && e.status === 'completed');
      default:
        return entries;
    }
  }

  /**
   * Type guards
   */
  private isEntryMovedEvent(event: import('./domain-event').DomainEvent): event is import('./task.types').EntryMovedToCollection {
    return event.type === 'EntryMovedToCollection';
  }

  private isTaskEvent(event: import('./domain-event').DomainEvent): event is TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged | TaskMigrated | import('./task.types').TaskAddedToCollection | import('./task.types').TaskRemovedFromCollection {
    return event.type === 'TaskCreated' || event.type === 'TaskCompleted' || event.type === 'TaskReopened' || event.type === 'TaskDeleted' || event.type === 'TaskReordered' || event.type === 'TaskTitleChanged' || event.type === 'TaskMigrated' || event.type === 'TaskAddedToCollection' || event.type === 'TaskRemovedFromCollection';
  }

  private isNoteEvent(event: import('./domain-event').DomainEvent): event is NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered | NoteMigrated {
    return event.type === 'NoteCreated' || event.type === 'NoteContentChanged' || event.type === 'NoteDeleted' || event.type === 'NoteReordered' || event.type === 'NoteMigrated';
  }

  private isEventEvent(event: import('./domain-event').DomainEvent): event is EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered | EventMigrated {
    return event.type === 'EventCreated' || event.type === 'EventContentChanged' || event.type === 'EventDateChanged' || event.type === 'EventDeleted' || event.type === 'EventReordered' || event.type === 'EventMigrated';
  }
}
