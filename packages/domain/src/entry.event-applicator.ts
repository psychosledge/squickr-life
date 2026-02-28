/**
 * ⚠️ SNAPSHOT VERSIONING: If you change the shape of `Entry[]` returned by
 * `applyEvents()` (add, rename, or remove fields on any Entry variant),
 * increment `SNAPSHOT_SCHEMA_VERSION` in `packages/domain/src/snapshot-store.ts`
 * to invalidate stale snapshots stored in IndexedDB. Failure to do so will
 * cause hydrate() to seed the projection cache with structurally invalid data.
 */
import type { DomainEvent } from './domain-event';
import type {
  Entry,
  Task,
  Note,
  Event as EventEntry,
  TaskCreated,
  TaskCompleted,
  TaskReopened,
  TaskDeleted,
  TaskRestored,
  TaskReordered,
  TaskTitleChanged,
  TaskMigrated,
  TaskAddedToCollection,
  TaskRemovedFromCollection,
  NoteCreated,
  NoteContentChanged,
  NoteDeleted,
  NoteRestored,
  NoteReordered,
  NoteMigrated,
  NoteAddedToCollection,
  NoteRemovedFromCollection,
  EventCreated,
  EventContentChanged,
  EventDateChanged,
  EventDeleted,
  EventRestored,
  EventReordered,
  EventMigrated,
  EventAddedToCollection,
  EventRemovedFromCollection,
  EntryFilter,
  EntryMovedToCollection,
} from './task.types';

/**
 * EntryEventApplicator
 *
 * Single-Responsibility: applies a stream of domain events to build in-memory
 * entry state (Tasks, Notes, Events).  Extracted from EntryListProjection so
 * that the projection class only owns query / subscription concerns.
 *
 * Public surface intentionally matches what EntryListProjection previously did
 * internally; see entry.projections.ts for usage.
 */
export class EntryEventApplicator {
  /**
   * Replay all events and return the resulting entry list sorted by order.
   */
  applyEvents(events: readonly DomainEvent[]): Entry[] {
    const tasks: Map<string, Task> = new Map();
    const notes: Map<string, Note> = new Map();
    const eventEntries: Map<string, EventEntry> = new Map();

    this.applyEventsToMaps(tasks, notes, eventEntries, events);

    return this.mapsToSortedEntries(tasks, notes, eventEntries);
  }

  /**
   * Apply delta events on top of a seed entry list and return the resulting
   * entry list sorted by order.
   *
   * Used by `EntryListProjection.hydrate()` to apply only the events that
   * occurred after the snapshot was taken, avoiding a full replay.
   *
   * @param seed - The snapshot state (Entry[]) to start from
   * @param deltaEvents - Events to apply on top of the seed
   */
  applyEventsOnto(seed: Entry[], deltaEvents: readonly DomainEvent[]): Entry[] {
    const tasks: Map<string, Task> = new Map();
    const notes: Map<string, Note> = new Map();
    const eventEntries: Map<string, EventEntry> = new Map();

    // Populate maps from the seed (snapshot state)
    for (const entry of seed) {
      if (entry.type === 'task') {
        tasks.set(entry.id, entry as Task);
      } else if (entry.type === 'note') {
        notes.set(entry.id, entry as Note);
      } else if (entry.type === 'event') {
        eventEntries.set(entry.id, entry as EventEntry);
      }
    }

    this.applyEventsToMaps(tasks, notes, eventEntries, deltaEvents);

    return this.mapsToSortedEntries(tasks, notes, eventEntries);
  }

  /**
   * Apply events to the in-memory maps (tasks, notes, eventEntries).
   * Shared by applyEvents() and applyEventsOnto().
   */
  private applyEventsToMaps(
    tasks: Map<string, Task>,
    notes: Map<string, Note>,
    eventEntries: Map<string, EventEntry>,
    events: readonly DomainEvent[]
  ): void {
    for (const event of events) {
      // Handle polymorphic EntryMovedToCollection FIRST (cross-cutting concern)
      // This event can apply to any entry type, so we check all three maps
      if (this.isEntryMovedEvent(event)) {
        const entryId = event.payload.entryId;
        const newCollectionId = event.payload.collectionId ?? undefined;

        // Helper: update collectionId AND replace the entire collections[] array.
        // EntryMovedToCollection is a legacy "move to exactly one collection" event,
        // so the resulting collections[] should be exactly [newCollectionId] (or [])
        // when moving to uncategorized.
        const newCollections = newCollectionId ? [newCollectionId] : [];

        // Check which map contains this entry and update it
        if (tasks.has(entryId)) {
          const task = tasks.get(entryId)!;
          tasks.set(task.id, { ...task, collectionId: newCollectionId, collections: newCollections });
        } else if (notes.has(entryId)) {
          const note = notes.get(entryId)!;
          notes.set(note.id, { ...note, collectionId: newCollectionId, collections: newCollections });
        } else if (eventEntries.has(entryId)) {
          const evt = eventEntries.get(entryId)!;
          eventEntries.set(evt.id, { ...evt, collectionId: newCollectionId, collections: newCollections });
        }
      }
      // Handle type-specific events
      else if (this.isTaskEvent(event)) {
        this.applyTaskEvent(tasks, event);
      } else if (this.isNoteEvent(event)) {
        this.applyNoteEvent(notes, event);
      } else if (this.isEventEvent(event)) {
        this.applyEventEvent(eventEntries, event);
      }
    }
  }

  /**
   * Combine the three entry maps into a single sorted Entry[] array.
   */
  private mapsToSortedEntries(
    tasks: Map<string, Task>,
    notes: Map<string, Note>,
    eventEntries: Map<string, EventEntry>
  ): Entry[] {
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
   * Sanitize migration pointers for a single entry.
   * If entry has migratedTo but target doesn't exist or is deleted, clear migration pointers.
   */
  sanitizeMigrationPointers<T extends Entry>(entry: T, allEntries: Entry[]): T {
    // If entry has no migration pointer, return unchanged
    if (!entry.migratedTo) {
      return entry;
    }

    // Check if target entry exists in the event log at all (including soft-deleted).
    // A soft-deleted target can be restored, so we preserve the migratedTo pointer.
    // We only clear it if the target is completely absent from the event log.
    const targetExists = allEntries.some(e => e.id === entry.migratedTo);

    // If target exists (even if soft-deleted), return unchanged
    if (targetExists) {
      return entry;
    }

    // Target doesn't exist at all in the event log — clear migration pointers
    // Create new object without migratedTo and migratedToCollectionId properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { migratedTo, migratedToCollectionId, ...entryWithoutMigration } = entry as any;
    return entryWithoutMigration as T;
  }

  /**
   * Filter entries based on filter type.
   */
  filterEntries(entries: Entry[], filter: EntryFilter): Entry[] {
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

  // ============================================================================
  // Type Guards
  // ============================================================================

  isEntryMovedEvent(event: DomainEvent): event is EntryMovedToCollection {
    return event.type === 'EntryMovedToCollection';
  }

  isTaskEvent(
    event: DomainEvent
  ): event is
    | TaskCreated
    | TaskCompleted
    | TaskReopened
    | TaskDeleted
    | TaskRestored
    | TaskReordered
    | TaskTitleChanged
    | TaskMigrated
    | TaskAddedToCollection
    | TaskRemovedFromCollection {
    return (
      event.type === 'TaskCreated' ||
      event.type === 'TaskCompleted' ||
      event.type === 'TaskReopened' ||
      event.type === 'TaskDeleted' ||
      event.type === 'TaskRestored' ||
      event.type === 'TaskReordered' ||
      event.type === 'TaskTitleChanged' ||
      event.type === 'TaskMigrated' ||
      event.type === 'TaskAddedToCollection' ||
      event.type === 'TaskRemovedFromCollection'
    );
  }

  isNoteEvent(
    event: DomainEvent
  ): event is NoteCreated | NoteContentChanged | NoteDeleted | NoteRestored | NoteReordered | NoteMigrated | NoteAddedToCollection | NoteRemovedFromCollection {
    return (
      event.type === 'NoteCreated' ||
      event.type === 'NoteContentChanged' ||
      event.type === 'NoteDeleted' ||
      event.type === 'NoteRestored' ||
      event.type === 'NoteReordered' ||
      event.type === 'NoteMigrated' ||
      event.type === 'NoteAddedToCollection' ||
      event.type === 'NoteRemovedFromCollection'
    );
  }

  isEventEvent(
    event: DomainEvent
  ): event is
    | EventCreated
    | EventContentChanged
    | EventDateChanged
    | EventDeleted
    | EventRestored
    | EventReordered
    | EventMigrated
    | EventAddedToCollection
    | EventRemovedFromCollection {
    return (
      event.type === 'EventCreated' ||
      event.type === 'EventContentChanged' ||
      event.type === 'EventDateChanged' ||
      event.type === 'EventDeleted' ||
      event.type === 'EventRestored' ||
      event.type === 'EventReordered' ||
      event.type === 'EventMigrated' ||
      event.type === 'EventAddedToCollection' ||
      event.type === 'EventRemovedFromCollection'
    );
  }

  // ============================================================================
  // Per-aggregate event applicators
  // ============================================================================

  /**
   * Apply a single task event to the in-memory task map.
   * Covers all task event types including collection membership changes.
   */
  applyTaskEvent(
    tasks: Map<string, Task>,
    event:
      | TaskCreated
      | TaskCompleted
      | TaskReopened
      | TaskDeleted
      | TaskRestored
      | TaskReordered
      | TaskTitleChanged
      | TaskMigrated
      | TaskAddedToCollection
      | TaskRemovedFromCollection
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
          parentEntryId: event.payload.parentTaskId, // Use parentEntryId for polymorphism (event payload field name is immutable)
          // Initialize collections array from legacy collectionId
          collections: event.payload.collectionId ? [event.payload.collectionId] : [],
          collectionHistory: event.payload.collectionId
            ? [
                {
                  collectionId: event.payload.collectionId,
                  addedAt: event.timestamp,
                },
              ]
            : [],
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
        const task = tasks.get(event.payload.taskId);
        if (task) {
          tasks.set(task.id, {
            ...task,
            deletedAt: event.payload.deletedAt,
          });
        }
        break;
      }
      case 'TaskRestored': {
        const task = tasks.get(event.payload.id);
        if (task) {
          const { deletedAt, ...taskWithoutDeletedAt } = task as Task & { deletedAt?: string };
          tasks.set(task.id, taskWithoutDeletedAt as Task);
        }
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
        // IMPORTANT: Preserve parentEntryId for sub-tasks (Phase 2: Migration/Symlink)
        if (originalTask) {
          // Phase 3: Parent Cascade - If this is a sub-task and its parent has been migrated,
          // update parentEntryId to point to migrated parent (preserve hierarchy in new collection)
          let parentEntryId = originalTask.parentEntryId;

          if (parentEntryId) {
            // This is a sub-task - check if parent has been migrated
            const parentTask = tasks.get(parentEntryId);
            if (parentTask?.migratedTo) {
              // Parent has been migrated - check if in SAME target collection
              const parentMigrated = tasks.get(parentTask.migratedTo);
              if (
                parentMigrated &&
                (parentMigrated.collectionId ?? null) ===
                  (event.payload.targetCollectionId ?? null)
              ) {
                // Parent migrated to SAME collection → update child to point to migrated parent
                parentEntryId = parentTask.migratedTo;
              }
              // Else: Parent migrated to DIFFERENT collection → keep original parentEntryId
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
            parentEntryId, // Phase 3: Updated to point to migrated parent if cascade
            // Initialize collections array from target collection
            collections: event.payload.targetCollectionId ? [event.payload.targetCollectionId] : [],
            collectionHistory: event.payload.targetCollectionId
              ? [
                  {
                    collectionId: event.payload.targetCollectionId,
                    addedAt: event.payload.migratedAt,
                  },
                ]
              : [],
          };
          tasks.set(newTask.id, newTask);
        }
        break;
      }
      case 'TaskAddedToCollection': {
        const task = tasks.get(event.payload.taskId);
        if (!task) {
          break;
        }

        // Idempotency check
        if (task.collections.includes(event.payload.collectionId)) {
          break;
        }

        // Check if this is a MOVE (there's a recent removal in collectionHistory)
        // Find the most recent removal (entry with removedAt timestamp)
        // NOTE: When events happen in quick succession, timestamps might be identical.
        // In that case, use array order (last removed = most recent)
        const removals = task.collectionHistory
          ?.map((h, index) => ({ ...h, index })) // Track original index
          ?.filter(h => h.removedAt !== undefined) || [];

        const recentRemoval =
          removals.length > 0
            ? removals.reduce((latest, current) => {
                // Compare by timestamp first
                const latestTime = new Date(latest.removedAt!).getTime();
                const currentTime = new Date(current.removedAt!).getTime();

                if (currentTime > latestTime) return current;
                if (currentTime < latestTime) return latest;

                // Same timestamp - use array index (later index = more recent)
                return current.index > latest.index ? current : latest;
              })
            : undefined;

        // CRITICAL FIX (Issue #2): Preserve existing migratedTo pointer
        // If task has migratedTo/migratedToCollectionId (from TaskMigrated event),
        // we MUST preserve it. TaskAddedToCollection should NOT overwrite it.
        //
        // Note: We use migratedFrom (with self-reference) for movement tracking,
        // and preserve migratedTo for migration tracking.

        // Build the updated task - if this is a MOVE, set migratedFrom properties
        const updatedTask: Task = recentRemoval
          ? {
              ...task,
              collections: [...task.collections, event.payload.collectionId],
              collectionHistory: [
                ...(task.collectionHistory || []),
                {
                  collectionId: event.payload.collectionId,
                  addedAt: event.timestamp,
                },
              ],
              // PRESERVE existing migratedTo pointer (don't overwrite!)
              migratedTo: task.migratedTo,
              migratedToCollectionId: task.migratedToCollectionId,
              // SET migratedFrom for movement tracking (self-reference = moved, not migrated)
              migratedFrom: task.id, // Use task's own ID (indicates moved, not migrated)
              migratedFromCollectionId: recentRemoval.collectionId,
              // ALSO SET movedFrom for explicit movement tracking
              movedFrom: task.id,
              movedFromCollectionId: recentRemoval.collectionId,
            }
          : {
              ...task,
              collections: [...task.collections, event.payload.collectionId],
              collectionHistory: [
                ...(task.collectionHistory || []),
                {
                  collectionId: event.payload.collectionId,
                  addedAt: event.timestamp,
                },
              ],
              // PRESERVE existing migration pointers even when NOT a move
              migratedTo: task.migratedTo,
              migratedToCollectionId: task.migratedToCollectionId,
              migratedFrom: task.migratedFrom, // Preserve existing migratedFrom
            };

        tasks.set(task.id, updatedTask);
        break;
      }
      case 'TaskRemovedFromCollection': {
        const task = tasks.get(event.payload.taskId);
        if (!task) {
          break;
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
  applyNoteEvent(
    notes: Map<string, Note>,
    event: NoteCreated | NoteContentChanged | NoteDeleted | NoteRestored | NoteReordered | NoteMigrated | NoteAddedToCollection | NoteRemovedFromCollection
  ): void {
    switch (event.type) {
      case 'NoteCreated': {
        const note: Note = {
          id: event.payload.id,
          content: event.payload.content,
          createdAt: event.payload.createdAt,
          order: event.payload.order,
          collectionId: event.payload.collectionId,
          userId: event.payload.userId,
          // Initialize collections array from legacy collectionId
          collections: event.payload.collectionId ? [event.payload.collectionId] : [],
          collectionHistory: event.payload.collectionId
            ? [{ collectionId: event.payload.collectionId, addedAt: event.payload.createdAt }]
            : [],
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
        const note = notes.get(event.payload.noteId);
        if (note) {
          notes.set(note.id, {
            ...note,
            deletedAt: event.payload.deletedAt,
          });
        }
        break;
      }
      case 'NoteRestored': {
        const note = notes.get(event.payload.id);
        if (note) {
          const { deletedAt, ...noteWithoutDeletedAt } = note as Note & { deletedAt?: string };
          notes.set(note.id, noteWithoutDeletedAt as Note);
        }
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
            // Initialize collections for the new note
            collections: event.payload.targetCollectionId ? [event.payload.targetCollectionId] : [],
            collectionHistory: event.payload.targetCollectionId
              ? [{ collectionId: event.payload.targetCollectionId, addedAt: event.payload.migratedAt }]
              : [],
          };
          notes.set(newNote.id, newNote);
        }
        break;
      }
      case 'NoteAddedToCollection': {
        const note = notes.get(event.payload.noteId);
        if (!note) break;

        // Idempotency check
        if (note.collections.includes(event.payload.collectionId)) break;

        // Check if this is a MOVE (there's a recent removal in collectionHistory)
        const removals = note.collectionHistory
          ?.map((h, index) => ({ ...h, index }))
          ?.filter(h => h.removedAt !== undefined) || [];

        const recentRemoval =
          removals.length > 0
            ? removals.reduce((latest, current) => {
                const latestTime = new Date(latest.removedAt!).getTime();
                const currentTime = new Date(current.removedAt!).getTime();
                if (currentTime > latestTime) return current;
                if (currentTime < latestTime) return latest;
                return current.index > latest.index ? current : latest;
              })
            : undefined;

        const updatedNote: Note = recentRemoval
          ? {
              ...note,
              collections: [...note.collections, event.payload.collectionId],
              collectionHistory: [
                ...(note.collectionHistory || []),
                { collectionId: event.payload.collectionId, addedAt: event.timestamp },
              ],
              migratedFrom: note.id, // Self-reference = moved, not migrated
              migratedFromCollectionId: recentRemoval.collectionId,
            }
          : {
              ...note,
              collections: [...note.collections, event.payload.collectionId],
              collectionHistory: [
                ...(note.collectionHistory || []),
                { collectionId: event.payload.collectionId, addedAt: event.timestamp },
              ],
            };

        notes.set(note.id, updatedNote);
        break;
      }
      case 'NoteRemovedFromCollection': {
        const note = notes.get(event.payload.noteId);
        if (!note) break;

        const updatedNote: Note = {
          ...note,
          collections: note.collections.filter(c => c !== event.payload.collectionId),
          collectionHistory: note.collectionHistory?.map(h =>
            h.collectionId === event.payload.collectionId && !h.removedAt
              ? { ...h, removedAt: event.timestamp }
              : h
          ),
        };

        notes.set(note.id, updatedNote);
        break;
      }
    }
  }

  /**
   * Apply event events
   */
  applyEventEvent(
    eventEntries: Map<string, EventEntry>,
    event:
      | EventCreated
      | EventContentChanged
      | EventDateChanged
      | EventDeleted
      | EventRestored
      | EventReordered
      | EventMigrated
      | EventAddedToCollection
      | EventRemovedFromCollection
  ): void {
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
          // Initialize collections array from legacy collectionId
          collections: event.payload.collectionId ? [event.payload.collectionId] : [],
          collectionHistory: event.payload.collectionId
            ? [{ collectionId: event.payload.collectionId, addedAt: event.payload.createdAt }]
            : [],
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
        const evt = eventEntries.get(event.payload.eventId);
        if (evt) {
          eventEntries.set(evt.id, {
            ...evt,
            deletedAt: event.payload.deletedAt,
          });
        }
        break;
      }
      case 'EventRestored': {
        const evt = eventEntries.get(event.payload.id);
        if (evt) {
          const { deletedAt, ...evtWithoutDeletedAt } = evt as EventEntry & { deletedAt?: string };
          eventEntries.set(evt.id, evtWithoutDeletedAt as EventEntry);
        }
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
            // Initialize collections for the new event
            collections: event.payload.targetCollectionId ? [event.payload.targetCollectionId] : [],
            collectionHistory: event.payload.targetCollectionId
              ? [{ collectionId: event.payload.targetCollectionId, addedAt: event.payload.migratedAt }]
              : [],
          };
          eventEntries.set(newEvent.id, newEvent);
        }
        break;
      }
      case 'EventAddedToCollection': {
        const evt = eventEntries.get(event.payload.eventId);
        if (!evt) break;

        // Idempotency check
        if (evt.collections.includes(event.payload.collectionId)) break;

        // Check if this is a MOVE (there's a recent removal in collectionHistory)
        const removals = evt.collectionHistory
          ?.map((h, index) => ({ ...h, index }))
          ?.filter(h => h.removedAt !== undefined) || [];

        const recentRemoval =
          removals.length > 0
            ? removals.reduce((latest, current) => {
                const latestTime = new Date(latest.removedAt!).getTime();
                const currentTime = new Date(current.removedAt!).getTime();
                if (currentTime > latestTime) return current;
                if (currentTime < latestTime) return latest;
                return current.index > latest.index ? current : latest;
              })
            : undefined;

        const updatedEvt: EventEntry = recentRemoval
          ? {
              ...evt,
              collections: [...evt.collections, event.payload.collectionId],
              collectionHistory: [
                ...(evt.collectionHistory || []),
                { collectionId: event.payload.collectionId, addedAt: event.timestamp },
              ],
              migratedFrom: evt.id, // Self-reference = moved, not migrated
              migratedFromCollectionId: recentRemoval.collectionId,
            }
          : {
              ...evt,
              collections: [...evt.collections, event.payload.collectionId],
              collectionHistory: [
                ...(evt.collectionHistory || []),
                { collectionId: event.payload.collectionId, addedAt: event.timestamp },
              ],
            };

        eventEntries.set(evt.id, updatedEvt);
        break;
      }
      case 'EventRemovedFromCollection': {
        const evt = eventEntries.get(event.payload.eventId);
        if (!evt) break;

        const updatedEvt: EventEntry = {
          ...evt,
          collections: evt.collections.filter(c => c !== event.payload.collectionId),
          collectionHistory: evt.collectionHistory?.map(h =>
            h.collectionId === event.payload.collectionId && !h.removedAt
              ? { ...h, removedAt: event.timestamp }
              : h
          ),
        };

        eventEntries.set(evt.id, updatedEvt);
        break;
      }
    }
  }
}
