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
  NoteCreated,
  NoteContentChanged,
  NoteDeleted,
  NoteReordered,
  EventCreated,
  EventContentChanged,
  EventDateChanged,
  EventDeleted,
  EventReordered,
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
    
    // Apply filter
    return this.filterEntries(entries, filter);
  }

  /**
   * Get a specific entry by ID (works for tasks, notes, or events)
   * 
   * @param entryId - The entry ID to find
   * @returns The entry, or undefined if not found
   */
  async getEntryById(entryId: string): Promise<Entry | undefined> {
    const events = await this.eventStore.getById(entryId);
    const entries = this.applyEvents(events);
    return entries[0];
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
  private applyTaskEvent(tasks: Map<string, Task>, event: TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged): void {
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
    }
  }

  /**
   * Apply note events
   */
  private applyNoteEvent(notes: Map<string, Note>, event: NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered): void {
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
    }
  }

  /**
   * Apply event events
   */
  private applyEventEvent(eventEntries: Map<string, EventEntry>, event: EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered): void {
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

  private isTaskEvent(event: import('./domain-event').DomainEvent): event is TaskCreated | TaskCompleted | TaskReopened | TaskDeleted | TaskReordered | TaskTitleChanged {
    return event.type === 'TaskCreated' || event.type === 'TaskCompleted' || event.type === 'TaskReopened' || event.type === 'TaskDeleted' || event.type === 'TaskReordered' || event.type === 'TaskTitleChanged';
  }

  private isNoteEvent(event: import('./domain-event').DomainEvent): event is NoteCreated | NoteContentChanged | NoteDeleted | NoteReordered {
    return event.type === 'NoteCreated' || event.type === 'NoteContentChanged' || event.type === 'NoteDeleted' || event.type === 'NoteReordered';
  }

  private isEventEvent(event: import('./domain-event').DomainEvent): event is EventCreated | EventContentChanged | EventDateChanged | EventDeleted | EventReordered {
    return event.type === 'EventCreated' || event.type === 'EventContentChanged' || event.type === 'EventDateChanged' || event.type === 'EventDeleted' || event.type === 'EventReordered';
  }
}
