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
  EntryFilter
} from './task.types';

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
 */
export class EntryListProjection {
  constructor(private readonly eventStore: IEventStore) {}

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
   * Apply events to build entry state
   * This handles Task, Note, and Event events polymorphically
   */
  private applyEvents(events: readonly import('./domain-event').DomainEvent[]): Entry[] {
    const tasks: Map<string, Task> = new Map();
    const notes: Map<string, Note> = new Map();
    const eventEntries: Map<string, EventEntry> = new Map();

    for (const event of events) {
      // Handle Task events
      if (this.isTaskEvent(event)) {
        this.applyTaskEvent(tasks, event);
      }
      // Handle Note events
      else if (this.isNoteEvent(event)) {
        this.applyNoteEvent(notes, event);
      }
      // Handle Event events
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
