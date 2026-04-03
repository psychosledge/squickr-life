import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, CompleteTaskHandler, DeleteTaskHandler, MigrateTaskHandler, MoveEntryToCollectionHandler } from './task.handlers';
import { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler } from './note.handlers';
import { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler } from './event.handlers';
import { AddTaskToCollectionHandler, RemoveTaskFromCollectionHandler } from './collection-management.handlers';
import type { CreateTaskCommand, CreateNoteCommand, CreateEventCommand } from './task.types';
import type { ISnapshotStore, ProjectionSnapshot } from './snapshot-store';
import { SNAPSHOT_SCHEMA_VERSION } from './snapshot-store';
import type { Collection } from './collection.types';
import type { SerializableHabitState } from './habit.types';
import type { UserPreferences } from './user-preferences.types';
import { DEFAULT_USER_PREFERENCES } from './user-preferences.types';

// ---------------------------------------------------------------------------
// Minimal in-memory snapshot store for use in tests.
// We cannot import from @squickr/infrastructure (that package depends on
// @squickr/domain — importing in the other direction would create a cycle).
// ---------------------------------------------------------------------------
class InMemorySnapshotStore implements ISnapshotStore {
  private readonly store = new Map<string, ProjectionSnapshot>();

  async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
    this.store.set(key, snapshot);
  }

  async load(key: string): Promise<ProjectionSnapshot | null> {
    return this.store.get(key) ?? null;
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ---------------------------------------------------------------------------
// ADR-026: Helper to enrich a snapshot with the required v5 fields.
// Snapshots produced by EntryListProjection.createSnapshot() do not include
// `habits` or `userPreferences` — those are injected by SnapshotManager.
// Tests that exercise the hydrate() success path must augment their snapshots
// so the field-presence guard in hydrate() does not discard them.
// ---------------------------------------------------------------------------
function enrichSnapshot(snapshot: ProjectionSnapshot): ProjectionSnapshot {
  return {
    ...snapshot,
    habits: (snapshot as unknown as Record<string, unknown>)['habits'] ?? [],
    userPreferences: (snapshot as unknown as Record<string, unknown>)['userPreferences'] ?? {
      defaultCompletedTaskBehavior: 'keep-in-place',
      autoFavoriteRecentDailyLogs: false,
      autoFavoriteRecentMonthlyLogs: false,
      autoFavoriteCalendarWithActiveTasks: false,
    },
  } as unknown as ProjectionSnapshot;
}

describe('EntryListProjection', () => {
  let eventStore: IEventStore;
  let projection: EntryListProjection;
  let taskProjection: TaskListProjection;
  let taskHandler: CreateTaskHandler;
  let noteHandler: CreateNoteHandler;
  let eventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    taskProjection = new TaskListProjection(eventStore);
    taskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    noteHandler = new CreateNoteHandler(eventStore, projection);
    eventHandler = new CreateEventHandler(eventStore, projection);
  });

  describe('getEntries', () => {
    it('should return empty array when no events exist', async () => {
      const entries = await projection.getEntries();
      expect(entries).toEqual([]);
    });

    it('should return task entry when TaskCreated event exists', async () => {
      const taskId = await taskHandler.handle({ content: 'Test task' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'task',
        id: taskId,
        content: 'Test task',
        status: 'open',
      });
    });

    it('should return note entry when NoteCreated event exists', async () => {
      const noteId = await noteHandler.handle({ content: 'Test note' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'note',
        id: noteId,
        content: 'Test note',
      });
    });

    it('should return event entry when EventCreated event exists', async () => {
      const eventId = await eventHandler.handle({ content: 'Test event' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'event',
        id: eventId,
        content: 'Test event',
      });
    });

    it('should return all three entry types in a unified list', async () => {
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      const noteId = await noteHandler.handle({ content: 'Note 1' });
      const eventId = await eventHandler.handle({ content: 'Event 1' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(3);
      
      const taskEntry = entries.find(e => e.id === taskId);
      const noteEntry = entries.find(e => e.id === noteId);
      const eventEntry = entries.find(e => e.id === eventId);

      expect(taskEntry?.type).toBe('task');
      expect(noteEntry?.type).toBe('note');
      expect(eventEntry?.type).toBe('event');
    });

    it('should sort entries by fractional index order', async () => {
      // Create multiple of same type to verify ordering within type
      const taskId1 = await taskHandler.handle({ content: 'Task 1' });
      const taskId2 = await taskHandler.handle({ content: 'Task 2' });
      const noteId1 = await noteHandler.handle({ content: 'Note 1' });
      const noteId2 = await noteHandler.handle({ content: 'Note 2' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(4);
      
      // Find positions
      const task1Pos = entries.findIndex(e => e.id === taskId1);
      const task2Pos = entries.findIndex(e => e.id === taskId2);
      const note1Pos = entries.findIndex(e => e.id === noteId1);
      const note2Pos = entries.findIndex(e => e.id === noteId2);
      
      // Tasks should be ordered relative to each other
      expect(task1Pos).toBeLessThan(task2Pos);
      // Notes should be ordered relative to each other
      expect(note1Pos).toBeLessThan(note2Pos);
    });

    it('should handle completed task status', async () => {
      const taskId = await taskHandler.handle({ content: 'Task to complete' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'task',
        status: 'completed',
      });
    });

    it('should handle note content changes', async () => {
      const noteId = await noteHandler.handle({ content: 'Original content' });
      const updateHandler = new UpdateNoteContentHandler(eventStore, projection);
      await updateHandler.handle({ noteId, content: 'Updated content' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'note',
        content: 'Updated content',
      });
    });

    it('should handle event date changes', async () => {
      const eventId = await eventHandler.handle({ content: 'Event content' });
      const updateDateHandler = new UpdateEventDateHandler(eventStore, projection);
      const newDate = '2026-03-20T14:00:00.000Z';
      await updateDateHandler.handle({ eventId, eventDate: newDate });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'event',
        eventDate: newDate,
      });
    });

    it('should remove deleted notes from entries list', async () => {
      const noteId = await noteHandler.handle({ content: 'Note to delete' });
      const deleteHandler = new DeleteNoteHandler(eventStore, projection);
      
      let entries = await projection.getEntries();
      expect(entries).toHaveLength(1);

      await deleteHandler.handle({ noteId });
      
      entries = await projection.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('should remove deleted events from entries list', async () => {
      const eventId = await eventHandler.handle({ content: 'Event to delete' });
      const deleteHandler = new DeleteEventHandler(eventStore, projection);
      
      let entries = await projection.getEntries();
      expect(entries).toHaveLength(1);

      await deleteHandler.handle({ eventId });
      
      entries = await projection.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      // Create a mix of entries
      await taskHandler.handle({ content: 'Task 1' });
      await taskHandler.handle({ content: 'Task 2' });
      await noteHandler.handle({ content: 'Note 1' });
      await eventHandler.handle({ content: 'Event 1' });
    });

    it('should filter to show only tasks', async () => {
      const entries = await projection.getEntries('tasks');
      
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.type === 'task')).toBe(true);
    });

    it('should filter to show only notes', async () => {
      const entries = await projection.getEntries('notes');
      
      expect(entries).toHaveLength(1);
      expect(entries.every(e => e.type === 'note')).toBe(true);
    });

    it('should filter to show only events', async () => {
      const entries = await projection.getEntries('events');
      
      expect(entries).toHaveLength(1);
      expect(entries.every(e => e.type === 'event')).toBe(true);
    });

    it('should filter to show only open tasks', async () => {
      const taskId = await taskHandler.handle({ content: 'Task 3' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      const entries = await projection.getEntries('open-tasks');
      
      expect(entries).toHaveLength(2); // Task 1 and Task 2 from beforeEach
      expect(entries.every(e => e.type === 'task' && e.status === 'open')).toBe(true);
    });

    it('should filter to show only completed tasks', async () => {
      const taskId = await taskHandler.handle({ content: 'Task to complete' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      const entries = await projection.getEntries('completed-tasks');
      
      expect(entries).toHaveLength(1);
      expect(entries.every(e => e.type === 'task' && e.status === 'completed')).toBe(true);
    });

    it('should return all entries when filter is "all"', async () => {
      const entries = await projection.getEntries('all');
      
      expect(entries).toHaveLength(4); // 2 tasks + 1 note + 1 event
    });
  });

  describe('getEntryById', () => {
    it('should return task entry by ID', async () => {
      const taskId = await taskHandler.handle({ content: 'Find me' });

      const entry = await projection.getEntryById(taskId);
      
      expect(entry).toMatchObject({
        type: 'task',
        id: taskId,
        content: 'Find me',
      });
    });

    it('should return note entry by ID', async () => {
      const noteId = await noteHandler.handle({ content: 'Find me' });

      const entry = await projection.getEntryById(noteId);
      
      expect(entry).toMatchObject({
        type: 'note',
        id: noteId,
        content: 'Find me',
      });
    });

    it('should return event entry by ID', async () => {
      const eventId = await eventHandler.handle({ content: 'Find me' });

      const entry = await projection.getEntryById(eventId);
      
      expect(entry).toMatchObject({
        type: 'event',
        id: eventId,
        content: 'Find me',
      });
    });

    it('should return undefined for non-existent entry', async () => {
      const entry = await projection.getEntryById('non-existent-id');
      
      expect(entry).toBeUndefined();
    });
  });

  describe('backward compatibility methods', () => {
    describe('getTasks', () => {
      it('should return only tasks without type discriminator', async () => {
        await taskHandler.handle({ content: 'Task 1' });
        await taskHandler.handle({ content: 'Task 2' });
        await noteHandler.handle({ content: 'Note 1' });

        const tasks = await projection.getTasks();
        
        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toMatchObject({
          content: 'Task 1',
          status: 'open',
        });
        expect(tasks[0]).not.toHaveProperty('type');
      });

      it('should return empty array when no tasks exist', async () => {
        await noteHandler.handle({ content: 'Note 1' });

        const tasks = await projection.getTasks();
        
        expect(tasks).toEqual([]);
      });
    });

    describe('getTaskById', () => {
      it('should return task by ID without type discriminator', async () => {
        const taskId = await taskHandler.handle({ content: 'Task 1' });

        const task = await projection.getTaskById(taskId);
        
        expect(task).toMatchObject({
          id: taskId,
          content: 'Task 1',
        });
        expect(task).not.toHaveProperty('type');
      });

      it('should return undefined for note ID', async () => {
        const noteId = await noteHandler.handle({ content: 'Note 1' });

        const task = await projection.getTaskById(noteId);
        
        expect(task).toBeUndefined();
      });

      it('should return undefined for non-existent ID', async () => {
        const task = await projection.getTaskById('non-existent-id');
        
        expect(task).toBeUndefined();
      });
    });

    describe('getNotes', () => {
      it('should return only notes without type discriminator', async () => {
        await noteHandler.handle({ content: 'Note 1' });
        await noteHandler.handle({ content: 'Note 2' });
        await taskHandler.handle({ content: 'Task 1' });

        const notes = await projection.getNotes();
        
        expect(notes).toHaveLength(2);
        expect(notes[0]).toMatchObject({
          content: 'Note 1',
        });
        expect(notes[0]).not.toHaveProperty('type');
      });

      it('should return empty array when no notes exist', async () => {
        await taskHandler.handle({ content: 'Task 1' });

        const notes = await projection.getNotes();
        
        expect(notes).toEqual([]);
      });
    });

    describe('getNoteById', () => {
      it('should return note by ID without type discriminator', async () => {
        const noteId = await noteHandler.handle({ content: 'Note 1' });

        const note = await projection.getNoteById(noteId);
        
        expect(note).toMatchObject({
          id: noteId,
          content: 'Note 1',
        });
        expect(note).not.toHaveProperty('type');
      });

      it('should return undefined for task ID', async () => {
        const taskId = await taskHandler.handle({ content: 'Task 1' });

        const note = await projection.getNoteById(taskId);
        
        expect(note).toBeUndefined();
      });
    });

    describe('getEvents', () => {
      it('should return only events without type discriminator', async () => {
        await eventHandler.handle({ content: 'Event 1' });
        await eventHandler.handle({ content: 'Event 2' });
        await taskHandler.handle({ content: 'Task 1' });

        const events = await projection.getEvents();
        
        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({
          content: 'Event 1',
        });
        expect(events[0]).not.toHaveProperty('type');
      });

      it('should return empty array when no events exist', async () => {
        await taskHandler.handle({ content: 'Task 1' });

        const events = await projection.getEvents();
        
        expect(events).toEqual([]);
      });
    });

    describe('getEventById', () => {
      it('should return event by ID without type discriminator', async () => {
        const eventId = await eventHandler.handle({ content: 'Event 1' });

        const event = await projection.getEventById(eventId);
        
        expect(event).toMatchObject({
          id: eventId,
          content: 'Event 1',
        });
        expect(event).not.toHaveProperty('type');
      });

      it('should return undefined for task ID', async () => {
        const taskId = await taskHandler.handle({ content: 'Task 1' });

        const event = await projection.getEventById(taskId);
        
        expect(event).toBeUndefined();
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed operations across all entry types', async () => {
      // Create entries
      const task1 = await taskHandler.handle({ content: 'Task 1' });
      const note1 = await noteHandler.handle({ content: 'Note 1' });
      const event1 = await eventHandler.handle({ content: 'Event 1' });
      const task2 = await taskHandler.handle({ content: 'Task 2' });

      // Modify entries
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: task1 });

      const updateNoteHandler = new UpdateNoteContentHandler(eventStore, projection);
      await updateNoteHandler.handle({ noteId: note1, content: 'Updated note' });

      const updateEventHandler = new UpdateEventContentHandler(eventStore, projection);
      await updateEventHandler.handle({ eventId: event1, content: 'Updated event' });

      // Verify final state
      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(4);
      
      const taskEntry = entries.find(e => e.id === task1);
      expect(taskEntry).toMatchObject({
        type: 'task',
        status: 'completed',
      });

      const noteEntry = entries.find(e => e.id === note1);
      expect(noteEntry).toMatchObject({
        type: 'note',
        content: 'Updated note',
      });

      const eventEntry = entries.find(e => e.id === event1);
      expect(eventEntry).toMatchObject({
        type: 'event',
        content: 'Updated event',
      });
    });

    it('should maintain correct order after deletions', async () => {
      const id1 = await taskHandler.handle({ content: 'Task 1' });
      const id2 = await noteHandler.handle({ content: 'Note 1' });
      const id3 = await eventHandler.handle({ content: 'Event 1' });
      const id4 = await taskHandler.handle({ content: 'Task 2' });

      // Delete the middle note
      const deleteNoteHandler = new DeleteNoteHandler(eventStore, projection);
      await deleteNoteHandler.handle({ noteId: id2 });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBe(id1);
      expect(entries[1].id).toBe(id3);
      expect(entries[2].id).toBe(id4);
    });

    it('should correctly filter after multiple updates', async () => {
      const task1 = await taskHandler.handle({ content: 'Task 1' });
      const task2 = await taskHandler.handle({ content: 'Task 2' });
      const task3 = await taskHandler.handle({ content: 'Task 3' });
      await noteHandler.handle({ content: 'Note 1' });

      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: task1 });
      await completeHandler.handle({ taskId: task2 });

      const openTasks = await projection.getEntries('open-tasks');
      const completedTasks = await projection.getEntries('completed-tasks');
      
      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].id).toBe(task3);
      
      expect(completedTasks).toHaveLength(2);
      expect(completedTasks.map(t => t.id)).toContain(task1);
      expect(completedTasks.map(t => t.id)).toContain(task2);
    });
  });

  describe('cross-type reordering', () => {
    it('should allow a note to be reordered before a task', async () => {
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      const noteId = await noteHandler.handle({ content: 'Note 1' });
      
      // Initial order should be: Task 1, Note 1
      let entries = await projection.getEntries();
      expect(entries[0].id).toBe(taskId);
      expect(entries[1].id).toBe(noteId);
      
      // Reorder note to be before task (previousEntryId = null, nextEntryId = taskId)
      const { ReorderNoteHandler } = await import('./note.handlers');
      const { TaskListProjection } = await import('./task.projections');
      const taskProjection = new TaskListProjection(eventStore);
      const reorderHandler = new ReorderNoteHandler(eventStore, projection, projection);
      
      await reorderHandler.handle({
        noteId,
        previousNoteId: null,
        nextNoteId: taskId,
      });
      
      // New order should be: Note 1, Task 1
      entries = await projection.getEntries();
      expect(entries[0].id).toBe(noteId);
      expect(entries[0].type).toBe('note');
      expect(entries[1].id).toBe(taskId);
      expect(entries[1].type).toBe('task');
    });

    it('should allow a task to be reordered between two notes', async () => {
      const note1Id = await noteHandler.handle({ content: 'Note 1' });
      const note2Id = await noteHandler.handle({ content: 'Note 2' });
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      
      // Initial order: Note 1, Note 2, Task 1
      let entries = await projection.getEntries();
      expect(entries[0].id).toBe(note1Id);
      expect(entries[1].id).toBe(note2Id);
      expect(entries[2].id).toBe(taskId);
      
      // Reorder task to be between the two notes
      const { ReorderTaskHandler } = await import('./task.handlers');
      const { TaskListProjection } = await import('./task.projections');
      const taskProjection = new TaskListProjection(eventStore);
      const reorderHandler = new ReorderTaskHandler(eventStore, projection);
      
      await reorderHandler.handle({
        taskId,
        previousTaskId: note1Id,
        nextTaskId: note2Id,
      });
      
      // New order should be: Note 1, Task 1, Note 2
      entries = await projection.getEntries();
      expect(entries[0].id).toBe(note1Id);
      expect(entries[0].type).toBe('note');
      expect(entries[1].id).toBe(taskId);
      expect(entries[1].type).toBe('task');
      expect(entries[2].id).toBe(note2Id);
      expect(entries[2].type).toBe('note');
    });

    it('should allow an event to be reordered after a task', async () => {
      const eventId = await eventHandler.handle({ content: 'Event 1' });
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      
      // Initial order: Event 1, Task 1
      let entries = await projection.getEntries();
      expect(entries[0].id).toBe(eventId);
      expect(entries[1].id).toBe(taskId);
      
      // Reorder event to be after task
      const { ReorderEventHandler } = await import('./event.handlers');
      const reorderHandler = new ReorderEventHandler(eventStore, projection, projection);
      
      await reorderHandler.handle({
        eventId,
        previousEventId: taskId,
        nextEventId: null,
      });
      
      // New order should be: Task 1, Event 1
      entries = await projection.getEntries();
      expect(entries[0].id).toBe(taskId);
      expect(entries[0].type).toBe('task');
      expect(entries[1].id).toBe(eventId);
      expect(entries[1].type).toBe('event');
    });

    it('should maintain mixed type order with multiple reorderings', async () => {
      const task1Id = await taskHandler.handle({ content: 'Task 1' });
      const note1Id = await noteHandler.handle({ content: 'Note 1' });
      const event1Id = await eventHandler.handle({ content: 'Event 1' });
      const task2Id = await taskHandler.handle({ content: 'Task 2' });
      
      // Initial order: Task 1, Note 1, Event 1, Task 2
      let entries = await projection.getEntries();
      expect(entries.map(e => e.id)).toEqual([task1Id, note1Id, event1Id, task2Id]);
      
      // Move Event 1 to the beginning
      const { ReorderEventHandler } = await import('./event.handlers');
      const eventReorderHandler = new ReorderEventHandler(eventStore, projection, projection);
      
      await eventReorderHandler.handle({
        eventId: event1Id,
        previousEventId: null,
        nextEventId: task1Id,
      });
      
      // Order should now be: Event 1, Task 1, Note 1, Task 2
      entries = await projection.getEntries();
      expect(entries.map(e => e.id)).toEqual([event1Id, task1Id, note1Id, task2Id]);
      
      // Move Task 2 between Event 1 and Task 1
      const { ReorderTaskHandler } = await import('./task.handlers');
      const taskReorderHandler = new ReorderTaskHandler(eventStore, projection);
      
      await taskReorderHandler.handle({
        taskId: task2Id,
        previousTaskId: event1Id,
        nextTaskId: task1Id,
      });
      
      // Final order should be: Event 1, Task 2, Task 1, Note 1
      entries = await projection.getEntries();
      expect(entries.map(e => e.id)).toEqual([event1Id, task2Id, task1Id, note1Id]);
      expect(entries.map(e => e.type)).toEqual(['event', 'task', 'task', 'note']);
    });

    it('should preserve cross-type order when filtering', async () => {
      const note1Id = await noteHandler.handle({ content: 'Note 1' });
      const task1Id = await taskHandler.handle({ content: 'Task 1' });
      const note2Id = await noteHandler.handle({ content: 'Note 2' });
      
      // Move task1 to the beginning
      const { ReorderTaskHandler } = await import('./task.handlers');
      const taskReorderHandler = new ReorderTaskHandler(eventStore, projection);
      
      await taskReorderHandler.handle({
        taskId: task1Id,
        previousTaskId: null,
        nextTaskId: note1Id,
      });
      
      // All entries should be: Task 1, Note 1, Note 2
      const allEntries = await projection.getEntries('all');
      expect(allEntries.map(e => e.id)).toEqual([task1Id, note1Id, note2Id]);
      
      // Filtering to only notes should maintain their relative order
      const notes = await projection.getEntries('notes');
      expect(notes.map(e => e.id)).toEqual([note1Id, note2Id]);
      
      // Filtering to only tasks should return just the task
      const tasks = await projection.getEntries('tasks');
      expect(tasks.map(e => e.id)).toEqual([task1Id]);
    });
  });

  describe('getDailyLogs', () => {
    it('should return empty array when no entries exist', async () => {
      const logs = await projection.getDailyLogs();
      expect(logs).toEqual([]);
    });

    it('should group entries created at the same time on the same day', async () => {
      // Create multiple entries (they'll all have same creation time in tests)
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      const noteId = await noteHandler.handle({ content: 'Note 1' });
      const eventId = await eventHandler.handle({ content: 'Event 1' });

      const logs = await projection.getDailyLogs(30);
      
      // All entries created at same time should be in same day log
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(3);
      
      const entryIds = logs[0].entries.map(e => e.id);
      expect(entryIds).toEqual([taskId, noteId, eventId]);
    });

    it('should maintain entry order within each day', async () => {
      // Create multiple entries 
      const taskId1 = await taskHandler.handle({ content: 'First task' });
      const noteId = await noteHandler.handle({ content: 'Middle note' });
      const taskId2 = await taskHandler.handle({ content: 'Last task' });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(3);
      
      // Should be ordered by fractional index (order field)
      const entryIds = logs[0].entries.map(e => e.id);
      expect(entryIds).toEqual([taskId1, noteId, taskId2]);
    });

    it('should respect limit parameter', async () => {
      // Create some entries
      await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });

      // Request with limit
      const logs = await projection.getDailyLogs(1);
      
      // Should return at most 1 day
      expect(logs.length).toBeLessThanOrEqual(1);
    });

    it('should handle events with eventDate field', async () => {
      // Create event with eventDate
      const eventId = await eventHandler.handle({ content: 'Future event' });
      
      // Update the event to have a future date
      const updateHandler = new UpdateEventDateHandler(eventStore, projection);
      await updateHandler.handle({
        eventId,
        eventDate: '2026-07-15', // Future date
      });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(1);
      expect(logs[0].entries[0].type).toBe('event');
      
      // Event should appear on creation day but retain future eventDate
      if (logs[0].entries[0].type === 'event') {
        expect(logs[0].entries[0].eventDate).toBe('2026-07-15');
      }
    });

    it('should respect filter parameter', async () => {
      await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });
      await eventHandler.handle({ content: 'Event 1' });

      // Filter to only tasks
      const taskLogs = await projection.getDailyLogs(7, undefined, 'tasks');
      
      expect(taskLogs).toHaveLength(1);
      expect(taskLogs[0].entries).toHaveLength(1);
      expect(taskLogs[0].entries[0].type).toBe('task');
      
      // Filter to only notes
      const noteLogs = await projection.getDailyLogs(7, undefined, 'notes');
      
      expect(noteLogs).toHaveLength(1);
      expect(noteLogs[0].entries).toHaveLength(1);
      expect(noteLogs[0].entries[0].type).toBe('note');
    });

    it('should handle deleted entries correctly', async () => {
      const taskId = await taskHandler.handle({ content: 'To be deleted' });
      await noteHandler.handle({ content: 'Stays' });

      // Delete the task
      const deleteHandler = new DeleteTaskHandler(eventStore, projection);
      await deleteHandler.handle({ taskId });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(1); // Only note remains
      expect(logs[0].entries[0].type).toBe('note');
    });

    it('should handle completed tasks correctly', async () => {
      const taskId = await taskHandler.handle({ content: 'Task to complete' });

      // Complete the task
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(1);
      expect(logs[0].entries[0].type).toBe('task');
      
      if (logs[0].entries[0].type === 'task') {
        expect(logs[0].entries[0].status).toBe('completed');
        expect(logs[0].entries[0].completedAt).toBeDefined();
      }
    });

    it('should return daily logs with valid date format (YYYY-MM-DD)', async () => {
      await taskHandler.handle({ content: 'Test task' });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      // Date should be in YYYY-MM-DD format
      expect(logs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include all entry types in same daily log', async () => {
      await taskHandler.handle({ content: 'Task' });
      await noteHandler.handle({ content: 'Note' });
      await eventHandler.handle({ content: 'Event' });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(3);
      
      const types = logs[0].entries.map(e => e.type);
      expect(types).toContain('task');
      expect(types).toContain('note');
      expect(types).toContain('event');
    });
  });

  describe('getEntriesByCollection', () => {
    it('should return entries in specified collection', async () => {
      // Create entries in different collections
      await taskHandler.handle({ content: 'Task in A', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task in B', collectionId: 'collection-B' });
      await noteHandler.handle({ content: 'Note in A', collectionId: 'collection-A' });

      const entriesInA = await projection.getEntriesByCollection('collection-A');
      
      expect(entriesInA).toHaveLength(2);
      expect(entriesInA[0].type).toBe('task');
      expect(entriesInA[1].type).toBe('note');
      
      if (entriesInA[0].type === 'task') {
        expect(entriesInA[0].content).toBe('Task in A');
      }
      if (entriesInA[1].type === 'note') {
        expect(entriesInA[1].content).toBe('Note in A');
      }
    });

    it('should return uncategorized entries when collectionId is null', async () => {
      // Create entries without collectionId
      await taskHandler.handle({ content: 'Uncategorized task' });
      await noteHandler.handle({ content: 'Uncategorized note' });
      
      // Create entry with collection
      await taskHandler.handle({ content: 'Task in collection', collectionId: 'collection-A' });

      const uncategorized = await projection.getEntriesByCollection(null);
      
      expect(uncategorized).toHaveLength(2);
      expect(uncategorized.every(e => !e.collectionId)).toBe(true);
    });

    it('should return empty array when no entries in collection', async () => {
      await taskHandler.handle({ content: 'Task in A', collectionId: 'collection-A' });

      const entriesInB = await projection.getEntriesByCollection('collection-B');
      
      expect(entriesInB).toHaveLength(0);
    });

    it('should handle mixed entry types in same collection', async () => {
      await taskHandler.handle({ content: 'Task', collectionId: 'collection-X' });
      await noteHandler.handle({ content: 'Note', collectionId: 'collection-X' });
      await eventHandler.handle({ content: 'Event', collectionId: 'collection-X' });

      const entries = await projection.getEntriesByCollection('collection-X');
      
      expect(entries).toHaveLength(3);
      
      const types = entries.map(e => e.type);
      expect(types).toContain('task');
      expect(types).toContain('note');
      expect(types).toContain('event');
    });

    it('should return entries sorted by order field', async () => {
      // Create entries in reverse order but same collection
      const noteId = await noteHandler.handle({ content: 'First', collectionId: 'col-1' });
      const taskId = await taskHandler.handle({ content: 'Second', collectionId: 'col-1' });
      const eventId = await eventHandler.handle({ content: 'Third', collectionId: 'col-1' });

      const entries = await projection.getEntriesByCollection('col-1');
      
      expect(entries).toHaveLength(3);
      // Should be in creation order (order field determines sorting)
      expect(entries[0].id).toBe(noteId);
      expect(entries[1].id).toBe(taskId);
      expect(entries[2].id).toBe(eventId);
    });

    it('should update when entry is moved to collection', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create task without collection
      const taskId = await taskHandler.handle({ content: 'Task to move' });

      // Initially in uncategorized
      let uncategorized = await projection.getEntriesByCollection(null);
      expect(uncategorized).toHaveLength(1);

      // Move to collection-A
      await moveHandler.handle({ entryId: taskId, collectionId: 'collection-A' });

      // Now should be in collection-A
      const inCollectionA = await projection.getEntriesByCollection('collection-A');
      expect(inCollectionA).toHaveLength(1);
      expect(inCollectionA[0].id).toBe(taskId);

      // And no longer in uncategorized
      uncategorized = await projection.getEntriesByCollection(null);
      expect(uncategorized).toHaveLength(0);
    });

    it('should handle entry moved from one collection to another', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create task in collection-A
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });

      // Move to collection-B
      await moveHandler.handle({ entryId: taskId, collectionId: 'collection-B' });

      // Should be in B, not A
      const inA = await projection.getEntriesByCollection('collection-A');
      const inB = await projection.getEntriesByCollection('collection-B');
      
      expect(inA).toHaveLength(0);
      expect(inB).toHaveLength(1);
      expect(inB[0].id).toBe(taskId);
    });

    it('should handle entry moved to uncategorized (null)', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create task in collection-A
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });

      // Move to uncategorized
      await moveHandler.handle({ entryId: taskId, collectionId: null });

      // Should be in uncategorized
      const uncategorized = await projection.getEntriesByCollection(null);
      const inA = await projection.getEntriesByCollection('collection-A');
      
      expect(uncategorized).toHaveLength(1);
      expect(uncategorized[0].id).toBe(taskId);
      expect(inA).toHaveLength(0);
    });

    // Regression tests for type guard bug (Casey's review)
    it('should update note collectionId when moved via EntryMovedToCollection event', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create note in collection-A
      const noteId = await noteHandler.handle({ content: 'Note in A', collectionId: 'collection-A' });
      
      // Verify initial state
      let note = await projection.getNoteById(noteId);
      expect(note?.collectionId).toBe('collection-A');
      
      // Move to collection-B
      await moveHandler.handle({ entryId: noteId, collectionId: 'collection-B' });
      
      // Verify updated state - collectionId should change
      note = await projection.getNoteById(noteId);
      expect(note?.collectionId).toBe('collection-B');
      
      // Verify filtering works
      const inA = await projection.getEntriesByCollection('collection-A');
      const inB = await projection.getEntriesByCollection('collection-B');
      expect(inA.some(e => e.id === noteId)).toBe(false);
      expect(inB.some(e => e.id === noteId)).toBe(true);
    });

    it('should update event collectionId when moved via EntryMovedToCollection event', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create event in collection-X
      const eventId = await eventHandler.handle({ content: 'Event in X', collectionId: 'collection-X' });
      
      // Verify initial state
      let evt = await projection.getEventById(eventId);
      expect(evt?.collectionId).toBe('collection-X');
      
      // Move to collection-Y
      await moveHandler.handle({ entryId: eventId, collectionId: 'collection-Y' });
      
      // Verify updated state - collectionId should change
      evt = await projection.getEventById(eventId);
      expect(evt?.collectionId).toBe('collection-Y');
      
      // Verify filtering works
      const inX = await projection.getEntriesByCollection('collection-X');
      const inY = await projection.getEntriesByCollection('collection-Y');
      expect(inX.some(e => e.id === eventId)).toBe(false);
      expect(inY.some(e => e.id === eventId)).toBe(true);
    });
  });

  describe('getEntryCountsByCollection', () => {
    it('should return counts for all collections in a single query', async () => {
      // Create entries in different collections
      await taskHandler.handle({ content: 'Task in A', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task 2 in A', collectionId: 'collection-A' });
      await noteHandler.handle({ content: 'Note in A', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task in B', collectionId: 'collection-B' });
      await eventHandler.handle({ content: 'Event in C', collectionId: 'collection-C' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get('collection-A')).toBe(3);
      expect(counts.get('collection-B')).toBe(1);
      expect(counts.get('collection-C')).toBe(1);
    });

    it('should count uncategorized entries with null key', async () => {
      // Create uncategorized entries
      await taskHandler.handle({ content: 'Uncategorized task' });
      await noteHandler.handle({ content: 'Uncategorized note' });
      
      // Create categorized entry
      await taskHandler.handle({ content: 'Task in A', collectionId: 'collection-A' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get(null)).toBe(2);
      expect(counts.get('collection-A')).toBe(1);
    });

    it('should return empty map when no entries exist', async () => {
      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.size).toBe(0);
    });

    it('should handle mixed entry types in same collection', async () => {
      await taskHandler.handle({ content: 'Task', collectionId: 'mixed' });
      await noteHandler.handle({ content: 'Note', collectionId: 'mixed' });
      await eventHandler.handle({ content: 'Event', collectionId: 'mixed' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get('mixed')).toBe(3);
    });

    it('should update counts when entries are moved between collections', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create entries
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });
      await noteHandler.handle({ content: 'Note', collectionId: 'collection-A' });

      // Initial counts
      let counts = await projection.getEntryCountsByCollection();
      expect(counts.get('collection-A')).toBe(2);
      expect(counts.get('collection-B')).toBeUndefined();

      // Move task to collection-B
      await moveHandler.handle({ entryId: taskId, collectionId: 'collection-B' });

      // Updated counts
      counts = await projection.getEntryCountsByCollection();
      expect(counts.get('collection-A')).toBe(1);
      expect(counts.get('collection-B')).toBe(1);
    });

    it('should update counts when entry is moved to uncategorized', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create task in collection
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });

      // Move to uncategorized
      await moveHandler.handle({ entryId: taskId, collectionId: null });

      const counts = await projection.getEntryCountsByCollection();
      expect(counts.get('collection-A')).toBeUndefined();
      expect(counts.get(null)).toBe(1);
    });

    it('should handle deleted entries correctly', async () => {
      const { DeleteTaskHandler } = await import('./task.handlers');
      const deleteHandler = new DeleteTaskHandler(eventStore, projection);
      
      // Create tasks
      const taskId1 = await taskHandler.handle({ content: 'Task 1', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task 2', collectionId: 'collection-A' });

      // Initial count
      let counts = await projection.getEntryCountsByCollection();
      expect(counts.get('collection-A')).toBe(2);

      // Delete one task
      await deleteHandler.handle({ taskId: taskId1 });

      // Updated count
      counts = await projection.getEntryCountsByCollection();
      expect(counts.get('collection-A')).toBe(1);
    });
  });

  describe('getActiveTaskCountsByCollection', () => {
    it('should return empty map when no tasks exist', async () => {
      const counts = await projection.getActiveTaskCountsByCollection();
      
      expect(counts.size).toBe(0);
    });

    it('should count only open tasks, not completed tasks', async () => {
      // Create open task
      const openTaskId = await taskHandler.handle({ content: 'Open task', collectionId: 'collection-A' });
      
      // Create and complete another task
      const completedTaskId = await taskHandler.handle({ content: 'Completed task', collectionId: 'collection-A' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: completedTaskId });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      // Should only count the open task
      expect(counts.get('collection-A')).toBe(1);
    });

    it('should count only tasks, not notes or events', async () => {
      // Create mixed entry types in same collection
      await taskHandler.handle({ content: 'Task 1', collectionId: 'collection-B' });
      await taskHandler.handle({ content: 'Task 2', collectionId: 'collection-B' });
      await noteHandler.handle({ content: 'Note 1', collectionId: 'collection-B' });
      await eventHandler.handle({ content: 'Event 1', collectionId: 'collection-B' });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      // Should only count the 2 tasks
      expect(counts.get('collection-B')).toBe(2);
    });

    it('should group active tasks by collection ID', async () => {
      // Create tasks in different collections
      await taskHandler.handle({ content: 'Task A1', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task A2', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task A3', collectionId: 'collection-A' });
      await taskHandler.handle({ content: 'Task B1', collectionId: 'collection-B' });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      expect(counts.get('collection-A')).toBe(3);
      expect(counts.get('collection-B')).toBe(1);
    });

    it('should not count migrated tasks (tasks with migratedTo set)', async () => {
      const { MigrateTaskHandler } = await import('./task.handlers');
      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      
      // Create task in collection-A
      const originalTaskId = await taskHandler.handle({ content: 'Task to migrate', collectionId: 'collection-A' });
      
      // Create another task in collection-A that won't be migrated
      await taskHandler.handle({ content: 'Task to stay', collectionId: 'collection-A' });
      
      // Migrate first task to collection-B
      await migrateHandler.handle({ 
        taskId: originalTaskId, 
        targetCollectionId: 'collection-B' 
      });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      // collection-A should only have 1 task (the non-migrated one)
      expect(counts.get('collection-A')).toBe(1);
      // collection-B should have 1 task (the migrated copy)
      expect(counts.get('collection-B')).toBe(1);
    });

    it('should count uncategorized tasks with null key', async () => {
      // Create uncategorized tasks
      await taskHandler.handle({ content: 'Uncategorized task 1' });
      await taskHandler.handle({ content: 'Uncategorized task 2' });
      
      // Create task in a collection
      await taskHandler.handle({ content: 'Task in collection', collectionId: 'collection-A' });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      expect(counts.get(null)).toBe(2);
      expect(counts.get('collection-A')).toBe(1);
    });

    it('should not include collections with zero active tasks', async () => {
      // Create completed task in collection-A
      const taskId = await taskHandler.handle({ content: 'Task to complete', collectionId: 'collection-A' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });
      
      // Create note in collection-A (not a task)
      await noteHandler.handle({ content: 'Note', collectionId: 'collection-A' });

      const counts = await projection.getActiveTaskCountsByCollection();
      
      // collection-A should not be in the map since it has no active tasks
      expect(counts.has('collection-A')).toBe(false);
    });

    it('should update counts when task is completed', async () => {
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-X' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);

      // Before completion
      let counts = await projection.getActiveTaskCountsByCollection();
      expect(counts.get('collection-X')).toBe(1);

      // After completion
      await completeHandler.handle({ taskId });
      counts = await projection.getActiveTaskCountsByCollection();
      
      // Should no longer be counted
      expect(counts.has('collection-X')).toBe(false);
    });

    it('should update counts when task is reopened', async () => {
      const { ReopenTaskHandler } = await import('./task.handlers');
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      const reopenHandler = new ReopenTaskHandler(eventStore, projection);
      
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-Y' });
      
      // Complete the task
      await completeHandler.handle({ taskId });
      
      let counts = await projection.getActiveTaskCountsByCollection();
      expect(counts.has('collection-Y')).toBe(false);
      
      // Reopen the task
      await reopenHandler.handle({ taskId });
      
      counts = await projection.getActiveTaskCountsByCollection();
      expect(counts.get('collection-Y')).toBe(1);
    });

    it('should update counts when task is deleted', async () => {
      const { DeleteTaskHandler } = await import('./task.handlers');
      const deleteHandler = new DeleteTaskHandler(eventStore, projection);
      
      const taskId = await taskHandler.handle({ content: 'Task to delete', collectionId: 'collection-Z' });
      
      // Before deletion
      let counts = await projection.getActiveTaskCountsByCollection();
      expect(counts.get('collection-Z')).toBe(1);
      
      // After deletion
      await deleteHandler.handle({ taskId });
      counts = await projection.getActiveTaskCountsByCollection();
      
      expect(counts.has('collection-Z')).toBe(false);
    });

    // ── Fix 2: drop legacy collectionId fallback ───────────────────────────

    it('Fix 2 — after a task is moved (A→B via Remove+Add), getActiveTaskCountsByCollection uses collections[] not stale collectionId', async () => {
      // After a Remove+Add move, the entry's collectionId is stale (still 'collection-A')
      // but collections[] is ['collection-B'].
      // Fix 2 ensures we read collections[] and never fall back to collectionId.
      const { AddTaskToCollectionHandler } = await import('./collection-management.handlers');
      const { RemoveTaskFromCollectionHandler } = await import('./collection-management.handlers');
      const addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      const removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);

      // Create task originally in collection-A (collectionId = 'collection-A', collections = ['collection-A'])
      const taskId = await taskHandler.handle({ content: 'Task to move', collectionId: 'collection-A' });

      // Move: Add to B first, then remove A — collectionId stays as 'collection-A' (stale) but collections[] = ['collection-B']
      await addHandler.handle({ taskId, collectionId: 'collection-B' });
      await removeHandler.handle({ taskId, collectionId: 'collection-A' });

      const counts = await projection.getActiveTaskCountsByCollection();

      // Should count in collection-B (per collections[]), NOT in collection-A (stale collectionId)
      expect(counts.get('collection-A')).toBeUndefined();
      expect(counts.get('collection-B')).toBe(1);
    });

    // ── Fix 3: sub-tasks in different collections should count ─────────────

    it('Fix 3 — sub-task in same collection as parent is NOT counted', async () => {
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const subTaskHandler = new CreateSubTaskHandler(eventStore, projection);

      // Create parent task in collection-A
      const parentId = await taskHandler.handle({ content: 'Parent task', collectionId: 'collection-A' });
      // Create sub-task (inherits collection-A from parent)
      await subTaskHandler.handle({ content: 'Sub-task', parentEntryId: parentId });

      const counts = await projection.getActiveTaskCountsByCollection();

      // Only the parent should be counted in collection-A; sub-task shares the same
      // collection and should be suppressed.
      expect(counts.get('collection-A')).toBe(1);
    });

    it('Fix 3 — sub-task in a different collection from its parent IS counted in that collection', async () => {
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const { AddTaskToCollectionHandler } = await import('./collection-management.handlers');
      const subTaskHandler = new CreateSubTaskHandler(eventStore, projection);
      const addHandler = new AddTaskToCollectionHandler(eventStore, projection);

      // Create parent task in collection-A
      const parentId = await taskHandler.handle({ content: 'Parent task', collectionId: 'collection-A' });
      // Create sub-task (starts in collection-A by inheritance)
      const subTaskId = await subTaskHandler.handle({ content: 'Sub-task', parentEntryId: parentId });
      // Move sub-task to collection-B only (add B, remove A)
      await addHandler.handle({ taskId: subTaskId, collectionId: 'collection-B' });
      const { RemoveTaskFromCollectionHandler } = await import('./collection-management.handlers');
      const removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
      await removeHandler.handle({ taskId: subTaskId, collectionId: 'collection-A' });

      const counts = await projection.getActiveTaskCountsByCollection();

      // Parent counted in collection-A; sub-task is in collection-B only → should be counted there
      expect(counts.get('collection-A')).toBe(1);  // parent only
      expect(counts.get('collection-B')).toBe(1);  // sub-task (different collection from parent)
    });

    it('Fix 3b — sub-task whose parent was migrated away from that collection IS counted (ghost parent should not suppress count)', async () => {
      // Scenario:
      //   1. Create parent + child in collection-A; cascade-migrate both to collection-B
      //      → parent-new & child-new are in B; child-new.parentEntryId = parent-new
      //   2. Inject a raw TaskMigrated event that marks ONLY parent-new as a ghost
      //      (i.e. parent-new migrates to collection-C without cascading child-new).
      //      This is the minimal state that triggers the bug:
      //        - parent-new has migratedTo set (ghost in B)
      //        - child-new is still active in B with parentEntryId → parent-new
      //   Without Fix 3b the pre-pass includes parent-new in entryCollectionSets with
      //   collections: ['collection-B'], so parentColls.has('B') → true → child-new is
      //   incorrectly suppressed → count for B = 0.
      //   With Fix 3b the ghost parent-new is skipped in the pre-pass →
      //   entryCollectionSets.get(parent-new-id) = undefined → child-new IS counted → count for B = 1.
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const subTaskHandler = new CreateSubTaskHandler(eventStore, projection);

      // Step 1 — create parent + child in collection-A, then migrate both to collection-B
      const parentId = await taskHandler.handle({ content: 'Parent task', collectionId: 'collection-A' });
      await subTaskHandler.handle({ content: 'Sub-task', parentEntryId: parentId });

      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      const parentNewId = await migrateHandler.handle({ taskId: parentId, targetCollectionId: 'collection-B' });

      // Sanity: after first migration, only the parent is counted in B (child suppressed — correct Fix 3 behaviour)
      let counts = await projection.getActiveTaskCountsByCollection();
      expect(counts.get('collection-B')).toBe(1);

      // Step 2 — inject a raw TaskMigrated event that makes parent-new a ghost WITHOUT cascading child-new.
      // This produces the exact state the bug was triggered by:
      //   parent-new: migratedTo set (ghost in B)
      //   child-new:  active in B, parentEntryId → parent-new (the ghost)
      const parentNewNewId = crypto.randomUUID();
      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskMigrated',
        aggregateId: parentNewId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          originalTaskId: parentNewId,
          targetCollectionId: 'collection-C',
          migratedToId: parentNewNewId,
          migratedAt: new Date().toISOString(),
        },
      } as any);

      counts = await projection.getActiveTaskCountsByCollection();
      // child-new is the only active task in B; its parent (parent-new) is now a ghost.
      // Fix 3b: ghost parent is excluded from pre-pass → child-new is counted.
      expect(counts.get('collection-B')).toBe(1);
      // The freshly-created parent-new-new is in C and must also be counted.
      expect(counts.get('collection-C')).toBe(1);
      // A only has ghosts → no count.
      expect(counts.get('collection-A')).toBeUndefined();
    });

    it('Fix 3c — sub-task added to a second collection (while parent stays in original) IS counted in that second collection', async () => {
      // Scenario exactly matching the UAT bug report:
      //   1. Parent task exists in collection-A
      //   2. Sub-task is created under parent (inherits collection-A)
      //   3. Sub-task is ADDED to collection-B (multi-collection, NOT moved — still in A too)
      //   4. collection-B should show count = 1 for the sub-task
      //      because the parent is NOT in collection-B, so the sub-task is an
      //      independent actionable item there.
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const { AddTaskToCollectionHandler } = await import('./collection-management.handlers');
      const subTaskHandler = new CreateSubTaskHandler(eventStore, projection);
      const addHandler = new AddTaskToCollectionHandler(eventStore, projection);

      // Create parent + sub-task in collection-A
      const parentId = await taskHandler.handle({ content: 'Hang guitars in office', collectionId: 'collection-A' });
      await subTaskHandler.handle({ content: 'Find the mounts', parentEntryId: parentId });

      // Retrieve the sub-task id
      const allEntries = await projection.getEntries('all');
      const subTask = allEntries.find(e => e.type === 'task' && (e as any).parentEntryId === parentId);
      expect(subTask).toBeDefined();
      const subTaskId = subTask!.id;

      // Add sub-task to collection-B (does NOT remove it from collection-A)
      // Sub-task is now in collections: ['collection-A', 'collection-B']
      // Parent remains in collections: ['collection-A']
      await addHandler.handle({ taskId: subTaskId, collectionId: 'collection-B' });

      const counts = await projection.getActiveTaskCountsByCollection();

      // collection-A: parent counted (1); sub-task suppressed because parent is also in A
      expect(counts.get('collection-A')).toBe(1);
      // collection-B: sub-task counted (1); parent is NOT in B so suppression must NOT fire
      expect(counts.get('collection-B')).toBe(1);
    });

    it('Fix 3 — sub-task whose parent does not exist is counted', async () => {
      // Simulate an orphaned sub-task (parent was deleted or never synced).
      // The sub-task has a parentTaskId that references a non-existent entry.
      // It should be counted as an independent actionable item.
      const { InMemoryEventStore } = await import('./__tests__/in-memory-event-store');
      const orphanEventStore = new InMemoryEventStore();
      const orphanProjection = new EntryListProjection(orphanEventStore);

      // Inject a raw TaskCreated event for a sub-task.
      // The applicator builds collections[] from collectionId, so set collectionId = 'collection-A'.
      await orphanEventStore.append({
        type: 'TaskCreated',
        payload: {
          id: 'orphan-sub-task',
          content: 'Orphan sub-task',
          status: 'open',
          collectionId: 'collection-A',
          order: 0,
          parentTaskId: 'non-existent-parent',  // parent does not exist in the event store
          createdAt: new Date().toISOString(),
        },
      });

      const counts = await orphanProjection.getActiveTaskCountsByCollection();

      // Sub-task's parent is gone — it must still be counted as an independent actionable item
      expect(counts.get('collection-A')).toBe(1);
    });
  });

  describe('getEntryStatsByCollection', () => {
    it('should return empty map when no entries exist', async () => {
      const stats = await projection.getEntryStatsByCollection();
      
      expect(stats.size).toBe(0);
    });

    it('should count all entry types separately', async () => {
      // Create mixed entry types
      await taskHandler.handle({ content: 'Open task', collectionId: 'collection-A' });
      const completedTaskId = await taskHandler.handle({ content: 'Completed task', collectionId: 'collection-A' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: completedTaskId });
      await noteHandler.handle({ content: 'Note 1', collectionId: 'collection-A' });
      await eventHandler.handle({ content: 'Event 1', collectionId: 'collection-A' });

      const stats = await projection.getEntryStatsByCollection();
      
      const collectionAStats = stats.get('collection-A')!;
      expect(collectionAStats.openTasks).toBe(1);
      expect(collectionAStats.completedTasks).toBe(1);
      expect(collectionAStats.notes).toBe(1);
      expect(collectionAStats.events).toBe(1);
    });

    it('should group stats by collection ID', async () => {
      // Create entries in different collections
      await taskHandler.handle({ content: 'Task A', collectionId: 'collection-A' });
      await noteHandler.handle({ content: 'Note A', collectionId: 'collection-A' });
      
      await taskHandler.handle({ content: 'Task B', collectionId: 'collection-B' });
      await eventHandler.handle({ content: 'Event B', collectionId: 'collection-B' });

      const stats = await projection.getEntryStatsByCollection();
      
      expect(stats.get('collection-A')!.openTasks).toBe(1);
      expect(stats.get('collection-A')!.notes).toBe(1);
      expect(stats.get('collection-A')!.completedTasks).toBe(0);
      expect(stats.get('collection-A')!.events).toBe(0);
      
      expect(stats.get('collection-B')!.openTasks).toBe(1);
      expect(stats.get('collection-B')!.events).toBe(1);
      expect(stats.get('collection-B')!.completedTasks).toBe(0);
      expect(stats.get('collection-B')!.notes).toBe(0);
    });

    it('should handle uncategorized entries with null key', async () => {
      await taskHandler.handle({ content: 'Uncategorized task' }); // No collectionId
      await noteHandler.handle({ content: 'Uncategorized note' });

      const stats = await projection.getEntryStatsByCollection();
      
      const uncategorizedStats = stats.get(null)!;
      expect(uncategorizedStats.openTasks).toBe(1);
      expect(uncategorizedStats.notes).toBe(1);
    });

    it('should exclude migrated entries from stats', async () => {
      // Create task
      const taskId = await taskHandler.handle({ content: 'Task to migrate', collectionId: 'collection-A' });
      
      // Migrate it
      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      await migrateHandler.handle({ taskId, targetCollectionId: 'collection-B' });

      const stats = await projection.getEntryStatsByCollection();
      
      // Original collection should not count the migrated task
      expect(stats.get('collection-A')).toBeUndefined();
      
      // Target collection should count the new task
      expect(stats.get('collection-B')!.openTasks).toBe(1);
    });

    it('should update stats when entries are modified', async () => {
      const taskId = await taskHandler.handle({ content: 'Task 1', collectionId: 'collection-A' });
      
      let stats = await projection.getEntryStatsByCollection();
      expect(stats.get('collection-A')!.openTasks).toBe(1);
      expect(stats.get('collection-A')!.completedTasks).toBe(0);
      
      // Complete the task
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });
      
      stats = await projection.getEntryStatsByCollection();
      expect(stats.get('collection-A')!.openTasks).toBe(0);
      expect(stats.get('collection-A')!.completedTasks).toBe(1);
    });
  });

  describe('migration pointer sanitization', () => {
    it('should preserve valid migration pointers when target exists', async () => {
      // Create task in collection-A
      const taskId = await taskHandler.handle({ content: 'Original task', collectionId: 'collection-A' });
      
      // Migrate task to collection-B
      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      const newTaskId = await migrateHandler.handle({ taskId, targetCollectionId: 'collection-B' });
      
      // Original task should still have migratedTo pointer
      const originalTask = await projection.getTaskById(taskId);
      expect(originalTask).toBeDefined();
      expect(originalTask!.migratedTo).toBe(newTaskId);
      expect(originalTask!.migratedToCollectionId).toBe('collection-B');
      
      // New task should exist
      const newTask = await projection.getTaskById(newTaskId);
      expect(newTask).toBeDefined();
      expect(newTask!.migratedFrom).toBe(taskId);
    });

    it('should PRESERVE migration pointer when migrated target is soft-deleted (can be restored)', async () => {
      // Create task in collection-A
      const taskId = await taskHandler.handle({ content: 'Original task', collectionId: 'collection-A' });
      
      // Migrate task to collection-B
      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      const newTaskId = await migrateHandler.handle({ taskId, targetCollectionId: 'collection-B' });
      
      // Soft-delete the migrated target (it still exists in the event log with deletedAt set)
      const deleteHandler = new DeleteTaskHandler(eventStore, projection);
      await deleteHandler.handle({ taskId: newTaskId });
      
      // Original task should KEEP its migration pointer — the target is soft-deleted, not gone.
      // Preserving the pointer prevents the source from appearing as a phantom "1 task" in sidebar stats.
      const originalTask = await projection.getTaskById(taskId);
      expect(originalTask).toBeDefined();
      expect(originalTask!.migratedTo).toBe(newTaskId);
      expect(originalTask!.migratedToCollectionId).toBe('collection-B');
    });

    it('should PRESERVE migration pointer for notes when migrated target is soft-deleted', async () => {
      // Create note in collection-A
      const noteId = await noteHandler.handle({ content: 'Original note', collectionId: 'collection-A' });
      
      // Migrate note to collection-B
      const { MigrateNoteHandler } = await import('./note.handlers');
      const migrateHandler = new MigrateNoteHandler(eventStore, projection);
      const newNoteId = await migrateHandler.handle({ noteId, targetCollectionId: 'collection-B' });
      
      // Soft-delete the migrated target
      const deleteHandler = new DeleteNoteHandler(eventStore, projection);
      await deleteHandler.handle({ noteId: newNoteId });
      
      // Original note should KEEP its migration pointer
      const originalNote = await projection.getNoteById(noteId);
      expect(originalNote).toBeDefined();
      expect(originalNote!.migratedTo).toBe(newNoteId);
      expect(originalNote!.migratedToCollectionId).toBe('collection-B');
    });

    it('should PRESERVE migration pointer for events when migrated target is soft-deleted', async () => {
      // Create event in collection-A
      const eventId = await eventHandler.handle({ content: 'Original event', collectionId: 'collection-A' });
      
      // Migrate event to collection-B
      const { MigrateEventHandler } = await import('./event.handlers');
      const migrateHandler = new MigrateEventHandler(eventStore, projection);
      const newEventId = await migrateHandler.handle({ eventId, targetCollectionId: 'collection-B' });
      
      // Soft-delete the migrated target
      const deleteHandler = new DeleteEventHandler(eventStore, projection);
      await deleteHandler.handle({ eventId: newEventId });
      
      // Original event should KEEP its migration pointer
      const originalEvent = await projection.getEventById(eventId);
      expect(originalEvent).toBeDefined();
      expect(originalEvent!.migratedTo).toBe(newEventId);
      expect(originalEvent!.migratedToCollectionId).toBe('collection-B');
    });

    it('should preserve migration pointers in getEntriesByCollection when target is soft-deleted', async () => {
      // Create and migrate a task
      const taskId = await taskHandler.handle({ content: 'Task to migrate', collectionId: 'collection-A' });
      const migrateHandler = new MigrateTaskHandler(eventStore, projection);
      const newTaskId = await migrateHandler.handle({ taskId, targetCollectionId: 'collection-B' });
      
      // Soft-delete migrated target — source pointer is preserved
      const deleteHandler = new DeleteTaskHandler(eventStore, projection);
      await deleteHandler.handle({ taskId: newTaskId });
      
      // Get entries by collection — original task is still in collection-A (it's the source/ghost)
      const entriesInA = await projection.getEntriesByCollection('collection-A');
      expect(entriesInA).toHaveLength(1);
      
      const originalTask = entriesInA[0];
      expect(originalTask.type).toBe('task');
      if (originalTask.type === 'task') {
        // migratedTo is PRESERVED since the target still exists (soft-deleted, restorable)
        expect(originalTask.migratedTo).toBe(newTaskId);
      }
    });

    it('should preserve migration pointers for all entry types when targets are soft-deleted', async () => {
      // Test that we check all three maps (tasks, notes, events) when validating pointers
      // Create task, note, and event
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });
      const noteId = await noteHandler.handle({ content: 'Note', collectionId: 'collection-A' });
      const eventId = await eventHandler.handle({ content: 'Event', collectionId: 'collection-A' });
      
      // Migrate all three
      const migrateTaskHandler = new MigrateTaskHandler(eventStore, projection);
      const newTaskId = await migrateTaskHandler.handle({ taskId, targetCollectionId: 'collection-B' });
      
      const { MigrateNoteHandler } = await import('./note.handlers');
      const migrateNoteHandler = new MigrateNoteHandler(eventStore, projection);
      const newNoteId = await migrateNoteHandler.handle({ noteId, targetCollectionId: 'collection-B' });
      
      const { MigrateEventHandler } = await import('./event.handlers');
      const migrateEventHandler = new MigrateEventHandler(eventStore, projection);
      const newEventId = await migrateEventHandler.handle({ eventId, targetCollectionId: 'collection-B' });
      
      // Soft-delete all migrated targets
      const deleteTaskHandler = new DeleteTaskHandler(eventStore, projection);
      await deleteTaskHandler.handle({ taskId: newTaskId });
      
      const deleteNoteHandler = new DeleteNoteHandler(eventStore, projection);
      await deleteNoteHandler.handle({ noteId: newNoteId });
      
      const deleteEventHandler = new DeleteEventHandler(eventStore, projection);
      await deleteEventHandler.handle({ eventId: newEventId });
      
      // All originals should PRESERVE their migration pointers (targets are soft-deleted, not gone)
      const entries = await projection.getEntriesByCollection('collection-A');
      expect(entries).toHaveLength(3);
      
      entries.forEach(entry => {
        expect(entry.migratedTo).toBeDefined(); // pointer preserved
      });
    });
  });

  // ============================================================================
  // Bug Fix: Collection stats should use collections[] not legacy collectionId
  // ADR-015: Under the multi-collection pattern, only collections[] is kept current.
  // collectionId is legacy and is NOT updated when a task is moved.
  // ============================================================================
  describe('collection stats bucketing — uses collections[] not legacy collectionId', () => {
    let addHandler: AddTaskToCollectionHandler;
    let removeHandler: RemoveTaskFromCollectionHandler;

    beforeEach(() => {
      addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    });

    // ── getActiveTaskCountsByCollection ────────────────────────────────────────

    describe('getActiveTaskCountsByCollection — moved task', () => {
      it('should count 0 for collection A and 1 for collection B after task is moved A → B', async () => {
        // Arrange: create task in collection A
        const taskId = await taskHandler.handle({ content: 'Task to move', collectionId: 'collection-A' });

        // Act: move task from A to B via multi-collection pattern (Add first, then Remove)
        await addHandler.handle({ taskId, collectionId: 'collection-B' });
        await removeHandler.handle({ taskId, collectionId: 'collection-A' });

        // Assert: counts reflect current collections[], not stale collectionId
        const counts = await projection.getActiveTaskCountsByCollection();
        expect(counts.get('collection-A')).toBeUndefined(); // A has no active tasks
        expect(counts.get('collection-B')).toBe(1);         // B has the moved task
      });

      it('should not double-count a task that was moved from A to B', async () => {
        // Arrange
        const taskId = await taskHandler.handle({ content: 'Moved task', collectionId: 'collection-A' });

        // Act: Add to B first, then remove from A (required order: must have ≥2 collections at removal time)
        await addHandler.handle({ taskId, collectionId: 'collection-B' });
        await removeHandler.handle({ taskId, collectionId: 'collection-A' });

        // Assert: total across all collections is exactly 1
        const counts = await projection.getActiveTaskCountsByCollection();
        let total = 0;
        for (const count of counts.values()) total += count;
        expect(total).toBe(1);
      });
    });

    describe('getActiveTaskCountsByCollection — multi-collection task', () => {
      it('should count task in BOTH collections when it belongs to A and B simultaneously', async () => {
        // Arrange: create task in A, then add to B (multi-collection — still in A too)
        const taskId = await taskHandler.handle({ content: 'Multi-collection task', collectionId: 'collection-A' });
        await addHandler.handle({ taskId, collectionId: 'collection-B' });

        // Assert: task counted in both A and B
        const counts = await projection.getActiveTaskCountsByCollection();
        expect(counts.get('collection-A')).toBe(1);
        expect(counts.get('collection-B')).toBe(1);
      });
    });

    // ── getEntryCountsByCollection ─────────────────────────────────────────────

    describe('getEntryCountsByCollection — moved task', () => {
      it('should count 0 for A and 1 for B after task is moved A → B', async () => {
        // Arrange
        const taskId = await taskHandler.handle({ content: 'Task to move', collectionId: 'collection-A' });

        // Act: move (Add to B first, then remove from A so guard is satisfied)
        await addHandler.handle({ taskId, collectionId: 'collection-B' });
        await removeHandler.handle({ taskId, collectionId: 'collection-A' });

        // Assert
        const counts = await projection.getEntryCountsByCollection();
        expect(counts.get('collection-A')).toBeUndefined();
        expect(counts.get('collection-B')).toBe(1);
      });

      it('should count task in both A and B when it belongs to both simultaneously', async () => {
        // Arrange: task in A, also added to B
        const taskId = await taskHandler.handle({ content: 'Multi task', collectionId: 'collection-A' });
        await addHandler.handle({ taskId, collectionId: 'collection-B' });

        // Assert: counted in both
        const counts = await projection.getEntryCountsByCollection();
        expect(counts.get('collection-A')).toBe(1);
        expect(counts.get('collection-B')).toBe(1);
      });
    });

    // ── getEntryStatsByCollection ──────────────────────────────────────────────

    describe('getEntryStatsByCollection — moved task', () => {
      it('should show 0 open tasks for A and 1 open task for B after task is moved A → B', async () => {
        // Arrange
        const taskId = await taskHandler.handle({ content: 'Task to move', collectionId: 'collection-A' });

        // Act: move (Add to B first, then remove from A so guard is satisfied)
        await addHandler.handle({ taskId, collectionId: 'collection-B' });
        await removeHandler.handle({ taskId, collectionId: 'collection-A' });

        // Assert
        const stats = await projection.getEntryStatsByCollection();
        expect(stats.get('collection-A')).toBeUndefined();     // A has no entries
        expect(stats.get('collection-B')!.openTasks).toBe(1); // B has the moved task
      });

      it('should show open task counted in both A and B when task belongs to both', async () => {
        // Arrange: task in A, also added to B (still in A)
        const taskId = await taskHandler.handle({ content: 'Multi task', collectionId: 'collection-A' });
        await addHandler.handle({ taskId, collectionId: 'collection-B' });

        // Assert: openTasks counted in both collections
        const stats = await projection.getEntryStatsByCollection();
        expect(stats.get('collection-A')!.openTasks).toBe(1);
        expect(stats.get('collection-B')!.openTasks).toBe(1);
      });

      it('should handle completed task moved A → B: completedTasks in B, not A', async () => {
        // Arrange: create + complete task in A, then move to B
        const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });
        const completeHandler = new CompleteTaskHandler(eventStore, projection);
        await completeHandler.handle({ taskId });

        // Act: move to B (Add first, then remove from A so guard is satisfied)
        await addHandler.handle({ taskId, collectionId: 'collection-B' });
        await removeHandler.handle({ taskId, collectionId: 'collection-A' });

        // Assert
        const stats = await projection.getEntryStatsByCollection();
        expect(stats.get('collection-A')).toBeUndefined();
        expect(stats.get('collection-B')!.completedTasks).toBe(1);
        expect(stats.get('collection-B')!.openTasks).toBe(0);
      });
    });
  });

  // ============================================================================
  // Bug Fix: getEffectiveCollections must use collectionHistory guard for modern entries
  //
  // When a modern entry (collectionHistory !== undefined) has collections[] emptied via
  // TaskRemovedFromCollection, getEffectiveCollections must NOT fall back to collectionId.
  // Only legacy entries (no collectionHistory) should fall back.
  //
  // Without the fix, a modern entry removed from its only collection gets re-counted
  // in the original collection via the stale collectionId fallback.
  // ============================================================================
  describe('getEffectiveCollections — modern entries with empty collections[] must not fall back to collectionId', () => {
    it('getEntryCountsByCollection: modern entry removed from its only collection should NOT appear in any collection stats', async () => {
      // Arrange: create a modern task in collection-A (creates collectionHistory)
      const taskId = await taskHandler.handle({ content: 'Task to remove', collectionId: 'collection-A' });

      // Add to B so the handler guard allows removal from A (need 2+ collections to remove one)
      const addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      await addHandler.handle({ taskId, collectionId: 'collection-B' });

      // Bypass the handler guard: inject TaskRemovedFromCollection for B directly
      // (simulates the case where collections[] is fully emptied for a modern entry)
      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskRemovedFromCollection',
        aggregateId: taskId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId, collectionId: 'collection-B', removedAt: new Date().toISOString() },
      } as import('./task.types').TaskRemovedFromCollection);

      // Also remove from A via the handler (guard now allows it since task is still in A per handler state)
      // Actually we need to directly inject the removal from A too, bypassing the guard
      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskRemovedFromCollection',
        aggregateId: taskId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId, collectionId: 'collection-A', removedAt: new Date().toISOString() },
      } as import('./task.types').TaskRemovedFromCollection);

      // Act: get counts — the entry now has collections: [] and collectionHistory defined
      const counts = await projection.getEntryCountsByCollection();

      // Assert: modern entry with empty collections[] should appear in NO collection (not fall back to collectionId)
      expect(counts.get('collection-A')).toBeUndefined();
      expect(counts.get('collection-B')).toBeUndefined();
    });

    it('getEntryStatsByCollection: modern entry removed from its only collection should NOT appear in any stats', async () => {
      // Arrange: create a modern task in collection-A
      const taskId = await taskHandler.handle({ content: 'Removed task', collectionId: 'collection-A' });

      // Add to B so we can remove from both
      const addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      await addHandler.handle({ taskId, collectionId: 'collection-B' });

      // Bypass the guard and inject removal events directly for both collections
      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskRemovedFromCollection',
        aggregateId: taskId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId, collectionId: 'collection-B', removedAt: new Date().toISOString() },
      } as import('./task.types').TaskRemovedFromCollection);

      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskRemovedFromCollection',
        aggregateId: taskId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId, collectionId: 'collection-A', removedAt: new Date().toISOString() },
      } as import('./task.types').TaskRemovedFromCollection);

      // Act
      const stats = await projection.getEntryStatsByCollection();

      // Assert: modern entry with empty collections[] should not count in any collection
      expect(stats.get('collection-A')).toBeUndefined();
      expect(stats.get('collection-B')).toBeUndefined();
    });
  });

  // ============================================================================
  // Bug Fix B2: getEntriesByCollection should use collections[] not legacy collectionId
  // After a task is moved A → B via Remove+Add (ADR-015 path), collectionId stays 'A'
  // but collections[] correctly reflects ['B']. The query must use collections[].
  // ============================================================================
  describe('B2 — getEntriesByCollection uses collections[] not legacy collectionId', () => {
    let addHandler: AddTaskToCollectionHandler;
    let removeHandler: RemoveTaskFromCollectionHandler;

    beforeEach(() => {
      addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    });

    it('should return task in B (not A) after moved A → B via Remove+Add', async () => {
      // Arrange: create task in collection A
      const taskId = await taskHandler.handle({ content: 'Task to move', collectionId: 'collection-A' });

      // Act: move via ADR-015 path — Add to B first, then remove from A (guard requires ≥2 collections at removal)
      await addHandler.handle({ taskId, collectionId: 'collection-B' });
      await removeHandler.handle({ taskId, collectionId: 'collection-A' });

      // Assert: task appears in B but NOT in A
      const inA = await projection.getEntriesByCollection('collection-A');
      const inB = await projection.getEntriesByCollection('collection-B');

      expect(inA.some(e => e.id === taskId)).toBe(false); // not in A any more
      expect(inB.some(e => e.id === taskId)).toBe(true);  // now in B
    });

    it('should return 0 entries in A and 1 entry in B after move', async () => {
      // Arrange
      const taskId = await taskHandler.handle({ content: 'Solo task', collectionId: 'collection-A' });

      // Act: Add to B first, then remove from A (guard requires ≥2 collections at removal)
      await addHandler.handle({ taskId, collectionId: 'collection-B' });
      await removeHandler.handle({ taskId, collectionId: 'collection-A' });

      // Assert exact counts
      const inA = await projection.getEntriesByCollection('collection-A');
      const inB = await projection.getEntriesByCollection('collection-B');

      expect(inA).toHaveLength(0);
      expect(inB).toHaveLength(1);
      expect(inB[0].id).toBe(taskId);
    });

    it('should throw when attempting to remove a task from its only collection (use delete instead)', async () => {
      // Arrange: create task in collection A (only collection)
      const taskId = await taskHandler.handle({ content: 'Task to unassign', collectionId: 'collection-A' });

      // Act + Assert: removing from the only collection is forbidden — use delete instead
      await expect(removeHandler.handle({ taskId, collectionId: 'collection-A' }))
        .rejects.toThrow(`Cannot remove task ${taskId} from its only collection. Delete the task instead.`);

      // Task still in A (guard prevented the removal)
      const inA = await projection.getEntriesByCollection('collection-A');
      expect(inA.some(e => e.id === taskId)).toBe(true);
    });
  });

  // ============================================================================
  // Bug Fix B1: MoveEntryToCollectionHandler idempotency uses collections[] not legacy collectionId
  // After a task is moved A → B via Remove+Add (ADR-015), collectionId stays stale as 'A'.
  // Calling MoveEntryToCollectionHandler({ collectionId: 'B' }) must recognise the task is
  // already in B and NOT append a new event.
  // ============================================================================
  describe('B1 — MoveEntryToCollectionHandler idempotency uses collections[] not legacy collectionId', () => {
    let addHandler: AddTaskToCollectionHandler;
    let removeHandler: RemoveTaskFromCollectionHandler;

    beforeEach(() => {
      addHandler = new AddTaskToCollectionHandler(eventStore, projection);
      removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    });

    it('should be a no-op when calling Move to B after task already moved A → B via Remove+Add', async () => {
      // Arrange: create task in A, then move to B via ADR-015 Add+Remove (guard-safe order)
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });
      await addHandler.handle({ taskId, collectionId: 'collection-B' });
      await removeHandler.handle({ taskId, collectionId: 'collection-A' });

      // Capture event count after the move
      const eventsBefore = await eventStore.getAll();
      const countBefore = eventsBefore.length;

      // Act: call MoveEntryToCollectionHandler targeting B (where task already lives)
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      await moveHandler.handle({ entryId: taskId, collectionId: 'collection-B' });

      // Assert: no new event was appended (idempotent)
      const eventsAfter = await eventStore.getAll();
      expect(eventsAfter.length).toBe(countBefore);
    });

    it('should still move task from B to C (not treat as no-op) when collections differs from target', async () => {
      // Arrange: create task in A, move to B via Add+Remove (guard-safe order)
      const taskId = await taskHandler.handle({ content: 'Task', collectionId: 'collection-A' });
      await addHandler.handle({ taskId, collectionId: 'collection-B' });
      await removeHandler.handle({ taskId, collectionId: 'collection-A' });

      // Capture event count
      const countBefore = (await eventStore.getAll()).length;

      // Act: call MoveEntryToCollectionHandler to move to C (different from B)
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      await moveHandler.handle({ entryId: taskId, collectionId: 'collection-C' });

      // Assert: a new event WAS appended (real move, not no-op)
      const countAfter = (await eventStore.getAll()).length;
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it('should be a no-op when task has no collections and we move to uncategorized (null)', async () => {
      // Arrange: create task with no collection (collections = [], collectionId = undefined)
      const taskId = await taskHandler.handle({ content: 'Uncategorized task' });

      const countBefore = (await eventStore.getAll()).length;

      // Act: move to null (uncategorized) — task is already uncategorized
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      await moveHandler.handle({ entryId: taskId, collectionId: null });

      // Assert: no new event appended
      const countAfter = (await eventStore.getAll()).length;
      expect(countAfter).toBe(countBefore);
    });
  });

  // ============================================================================
  // Step 4: In-memory read cache
  // ============================================================================
  describe('in-memory cache', () => {
    it('should call eventStore.getAll() only once total across multiple reads (cache hits after first warm-up)', async () => {
      // Arrange: spy set before anything so we count the warm-up call inside the handler
      const spy = vi.spyOn(eventStore, 'getAll');
      await taskHandler.handle({ content: 'Task 1' }); // warms cache internally

      // Act: additional reads should all hit the in-memory cache
      await projection.getEntries();
      await projection.getEntries();

      // Assert: exactly 1 getAll() — the initial warm-up inside the handler
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should NOT call eventStore.getAll() again after an append (incremental update)', async () => {
      // Phase 6: new events are applied incrementally — no full replay needed.
      // Arrange: spy set before anything so we count every getAll() from scratch
      const spy = vi.spyOn(eventStore, 'getAll');
      await taskHandler.handle({ content: 'Task 1' }); // warms cache (1 getAll inside handler)

      // Act: append a second event — incremental update should NOT trigger another getAll()
      await taskHandler.handle({ content: 'Task 2' }); // incremental path: no extra getAll()

      // Both reads should hit the already-updated in-memory cache
      const entries = await projection.getEntries();
      expect(spy).toHaveBeenCalledTimes(1); // only the warm-up call, never again

      // Both tasks should be visible thanks to the incremental update
      expect(entries.some(e => e.content === 'Task 1')).toBe(true);
      expect(entries.some(e => e.content === 'Task 2')).toBe(true);
    });

    it('should still fire subscriber callbacks when an event is appended', async () => {
      // Arrange
      const callbackSpy = vi.fn();
      projection.subscribe(callbackSpy);

      // Act
      await taskHandler.handle({ content: 'Task 1' });

      // Assert: reactive behaviour is unchanged
      expect(callbackSpy).toHaveBeenCalledTimes(1);
    });

    it('should call eventStore.getAll() only once for multiple reads between appends', async () => {
      // Arrange: spy before handle so we count the warm-up call
      const spy = vi.spyOn(eventStore, 'getAll');
      await taskHandler.handle({ content: 'Task 1' }); // 1 getAll inside handler

      // Act: three more reads with no appends in between — all cache hits
      await projection.getEntries();
      await projection.getEntries();
      await projection.getEntries();

      // Assert: still only the single warm-up call
      expect(spy).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });
  });

  // ============================================================================
  // Step 5: hydrate() — populate cache from a persisted snapshot
  // ============================================================================
  describe('hydrate()', () => {
    it('resolves without error when no snapshot store is configured', async () => {
      // Arrange: projection without a snapshot store
      const plainProjection = new EntryListProjection(eventStore);
      await taskHandler.handle({ content: 'Task 1' });

      // Act & Assert: hydrate should be a no-op and not throw
      await expect(plainProjection.hydrate()).resolves.toBeUndefined();

      // getEntries() still works via full replay
      const entries = await plainProjection.getEntries();
      expect(entries).toHaveLength(1);
    });

    it('does a full replay on first getEntries() when no snapshot has been saved', async () => {
      // Arrange: projection with snapshot store but no saved snapshot
      const snapshotStore = new InMemorySnapshotStore();
      const proj = new EntryListProjection(eventStore, snapshotStore);
      await taskHandler.handle({ content: 'Task 1' });

      const spy = vi.spyOn(eventStore, 'getAll');

      // Act: hydrate is a no-op (no snapshot), first getEntries triggers a replay
      await proj.hydrate();
      // hydrate finds no snapshot → no getAll call yet from hydrate
      const callsAfterHydrate = spy.mock.calls.length;

      await proj.getEntries();
      // Full replay happens on first getEntries()
      expect(spy.mock.calls.length).toBeGreaterThan(callsAfterHydrate);

      vi.restoreAllMocks();
    });

    it('populates cache from snapshot so subsequent getEntries() skips getAll()', async () => {
      // Arrange: seed an event and build a snapshot
      await taskHandler.handle({ content: 'Hydrated Task' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);

      // Warm the seed projection's cache and create a snapshot
      const snapshot = await seedProjection.createSnapshot();
      expect(snapshot).not.toBeNull();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Create a fresh projection (cold cache) with the same snapshot store
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);

      // Hydrate populates the cache from the snapshot
      await freshProjection.hydrate();

      // Spy AFTER hydrate — the cache is now warm
      const spy = vi.spyOn(eventStore, 'getAll');

      // getEntries() should be a cache hit: no additional getAll() call
      await freshProjection.getEntries();
      expect(spy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('ignores snapshot with stale schema version and falls back to full replay', async () => {
      // Arrange: save a snapshot with the wrong version
      await taskHandler.handle({ content: 'Task' });

      const snapshotStore = new InMemorySnapshotStore();
      const staleSnapshot: ProjectionSnapshot = {
        version: SNAPSHOT_SCHEMA_VERSION + 999, // wrong version
        lastEventId: 'evt-stale',
        state: [],
        savedAt: new Date().toISOString(),
      };
      await snapshotStore.save('entry-list-projection', staleSnapshot);

      const proj = new EntryListProjection(eventStore, snapshotStore);

      // Spy before hydrate() to verify call counts
      const spy = vi.spyOn(eventStore, 'getAll');

      // ADR-024: hydrate() always calls getAll() to record the localStoreWasEmptyAtHydration
      // flag, even on the stale-version early-return path. The snapshot state is not applied
      // (cache stays null) but the emptiness flag is captured for the cold-start sequencer.
      await proj.hydrate();
      expect(spy).toHaveBeenCalledTimes(1); // called once for the emptiness flag

      await proj.getEntries(); // triggers full replay — calls getAll() again
      expect(spy).toHaveBeenCalledTimes(2); // full replay happened

      vi.restoreAllMocks();
    });

    it('seeds from snapshot + replays local events when lastEventId is not in the log (delta-only store)', async () => {
      // Arrange: snapshot references an event ID not in the local log (delta-only device).
      // hydrate() should use snapshot state as base and replay all local events on top.
      await taskHandler.handle({ content: 'Task' });

      const snapshotStore = new InMemorySnapshotStore();
      // ADR-026: orphaned snapshot still needs habits/userPreferences to pass
      // the field-presence guard; we want to test the lastEventId fallback path.
      const orphanedSnapshot = enrichSnapshot({
        version: SNAPSHOT_SCHEMA_VERSION,
        lastEventId: 'does-not-exist-in-log',
        state: [],
        savedAt: new Date().toISOString(),
      });
      await snapshotStore.save('entry-list-projection', orphanedSnapshot);

      const proj = new EntryListProjection(eventStore, snapshotStore);
      await proj.hydrate(); // seeds from snapshot state + replays all local events

      // Cache is populated by hydrate() — getEntries() should NOT call getAll() again
      const spy = vi.spyOn(eventStore, 'getAll');
      await proj.getEntries();

      expect(spy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('correctness check: hydrated projection returns same entries as a fresh full replay', async () => {
      // Arrange: create a variety of entries
      await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });
      await eventHandler.handle({ content: 'Event 1' });
      const completedTaskId = await taskHandler.handle({ content: 'Task to complete' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: completedTaskId });

      // Build and persist snapshot using a seed projection
      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Hydrated projection
      const hydratedProjection = new EntryListProjection(eventStore, snapshotStore);
      await hydratedProjection.hydrate();
      const hydratedEntries = await hydratedProjection.getEntries('all');

      // Fresh full-replay projection (no snapshot store)
      const freshProjection = new EntryListProjection(eventStore);
      const freshEntries = await freshProjection.getEntries('all');

      // Both should return identical results
      expect(hydratedEntries).toEqual(freshEntries);
    });

    // ---- Phase 2 (ADR-016 / ADR-017): delta application on top of snapshot state ----

    it('Phase 2: fully-current snapshot seeds cache directly (no applyEventsOnto call)', async () => {
      // Arrange: create tasks and build a snapshot that is fully up-to-date
      await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated with the up-to-date snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      // After hydrate, getEntries() must hit the cache (no further getAll() calls)
      const spy = vi.spyOn(eventStore, 'getAll');
      const entries = await freshProjection.getEntries('all');
      expect(spy).not.toHaveBeenCalled();

      // And the result equals the snapshot state (restored directly, not replayed)
      expect(entries).toEqual(snapshot!.state);

      vi.restoreAllMocks();
    });

    it('Phase 2: applies delta events onto snapshot state when new events exist after snapshot', async () => {
      // Arrange: create an initial entry and build a snapshot
      const taskId = await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Add a delta event AFTER the snapshot was taken
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      // Fresh projection hydrated with snapshot + delta
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      // getEntries() must hit the cache (no further getAll() calls after hydrate)
      const spy = vi.spyOn(eventStore, 'getAll');
      const hydratedEntries = await freshProjection.getEntries('all');
      expect(spy).not.toHaveBeenCalled();

      // The hydrated result must equal a full replay
      const fullReplayProjection = new EntryListProjection(eventStore);
      const fullReplayEntries = await fullReplayProjection.getEntries('all');
      expect(hydratedEntries).toEqual(fullReplayEntries);

      // Specifically: the task must now be 'completed'
      const task = hydratedEntries.find(e => e.id === taskId);
      expect(task).toBeDefined();
      expect((task as { status: string }).status).toBe('completed');

      vi.restoreAllMocks();
    });

    it('Phase 2: delta adds new entries on top of snapshot state', async () => {
      // Arrange: one task in the snapshot
      await taskHandler.handle({ content: 'Existing Task' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Delta: add a new note after the snapshot
      await noteHandler.handle({ content: 'New Note After Snapshot' });

      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      const spy = vi.spyOn(eventStore, 'getAll');
      const entries = await freshProjection.getEntries('all');
      expect(spy).not.toHaveBeenCalled();

      // Should see both the original task and the new note
      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.type === 'task')).toBe(true);
      expect(entries.some(e => e.type === 'note')).toBe(true);

      vi.restoreAllMocks();
    });

    it('notifies subscribers when cache is seeded from a fully-current snapshot (ADR-024 Fix 1)', async () => {
      // Arrange: create a task and build a fully-current snapshot
      await taskHandler.handle({ content: 'Task 1' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection — subscribe BEFORE hydrate to observe the notification
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      // Act
      await freshProjection.hydrate();

      // Assert: subscriber was called because cachedEntries was populated
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers when cache is seeded from snapshot + delta events (ADR-024 Fix 1)', async () => {
      // Arrange: create a task and build a snapshot
      const taskId = await taskHandler.handle({ content: 'Task 1' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Add a delta event after the snapshot
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      // Fresh projection — subscribe BEFORE hydrate
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      // Act
      await freshProjection.hydrate();

      // Assert: subscriber was called because cachedEntries was populated with delta applied
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT notify subscribers when hydrate() takes an early-return path (no cache set)', async () => {
      // Arrange: no snapshot → early-return path, cache stays null
      const snapshotStore = new InMemorySnapshotStore();
      const proj = new EntryListProjection(eventStore, snapshotStore);
      const subscriberSpy = vi.fn();
      proj.subscribe(subscriberSpy);

      // Act
      await proj.hydrate(); // no snapshot saved → early return

      // Assert: subscriber was NOT called (cache was never set)
      expect(subscriberSpy).not.toHaveBeenCalled();
    });

    // ---- ADR-024 Fix 2: seed cache from snapshot when event store is empty ----

    it('hydrate() with snapshot and empty event store seeds cache from snapshot state', async () => {
      // Arrange: build a snapshot using a projection with events,
      // then present it to a fresh projection with an EMPTY event store.
      const seedEventStore = new InMemoryEventStore();
      const seedProjection = new EntryListProjection(seedEventStore);
      const seedTaskProjection = new TaskListProjection(seedEventStore);
      const seedHandler = new CreateTaskHandler(seedEventStore, seedTaskProjection, seedProjection);
      await seedHandler.handle({ content: 'Snapshot Task' });
      const snapshot = await seedProjection.createSnapshot();
      expect(snapshot).not.toBeNull();

      // The real projection has an EMPTY event store but the snapshot in store
      const snapshotStore = new InMemorySnapshotStore();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh event store with zero events (cold-start scenario)
      const emptyEventStore = new InMemoryEventStore();
      const freshProjection = new EntryListProjection(emptyEventStore, snapshotStore);

      // Act
      await freshProjection.hydrate();

      // Assert: cache is populated even though the event store is empty
      expect(freshProjection.isCachePopulated()).toBe(true);

      const entries = await freshProjection.getEntries('all');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ content: 'Snapshot Task' });
    });

    it('ADR-025: new event on snapshot-seeded projection is applied incrementally, preserving seeded entries', async () => {
      // Arrange: build a snapshot with one task from a populated event store.
      const seedEventStore = new InMemoryEventStore();
      const seedProjection = new EntryListProjection(seedEventStore);
      const seedTaskProjection = new TaskListProjection(seedEventStore);
      const seedHandler = new CreateTaskHandler(seedEventStore, seedTaskProjection, seedProjection);
      await seedHandler.handle({ content: 'Snapshot Task' });
      const snapshot = await seedProjection.createSnapshot();

      const snapshotStore = new InMemorySnapshotStore();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh device: local event store is empty, seeded from remote snapshot.
      const emptyEventStore = new InMemoryEventStore();
      const freshProjection = new EntryListProjection(emptyEventStore, snapshotStore);
      await freshProjection.hydrate();
      expect(freshProjection.isCachePopulated()).toBe(true);

      // Act: user adds a new task — 1 event written to local IndexedDB.
      // With delta-only sync (ADR-025) this is the ONLY event in the local store;
      // the pre-snapshot history is NOT present locally.
      const newTaskEvent = {
        id: 'new-task-event-id',
        type: 'TaskCreated',
        aggregateId: 'new-task',
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          taskId: 'new-task',
          content: 'New Task Added On New Device',
          status: 'open',
          order: 'z',
          collectionId: null,
          createdAt: new Date().toISOString(),
        },
      };
      await emptyEventStore.append(newTaskEvent as Parameters<typeof emptyEventStore.append>[0]);

      // Assert: cache remains populated (not invalidated).
      // The incremental update path must have run, not the cache-clear path.
      expect(freshProjection.isCachePopulated()).toBe(true);

      // getEntries() must return BOTH the snapshot task AND the new task.
      // If it only returns the new task, the projection rebuilt from getAll()
      // which only has 1 event — the pre-snapshot entries are lost (the bug).
      const entries = await freshProjection.getEntries('all');
      expect(entries).toHaveLength(2);
      expect(entries.map(e => (e as { content?: string }).content)).toContain('Snapshot Task');
      expect(entries.map(e => (e as { content?: string }).content)).toContain('New Task Added On New Device');
    });

  }); // end hydrate()

  // ============================================================================
  // Step 5: createSnapshot() — capture current projection state
  // ============================================================================
  describe('createSnapshot()', () => {
    it('returns null when there are no events', async () => {
      // eventStore is empty (freshly created in beforeEach)
      const snap = await projection.createSnapshot();
      expect(snap).toBeNull();
    });

    it('returns a snapshot with lastEventId equal to the last appended event', async () => {
      // Arrange: append a couple of events
      await taskHandler.handle({ content: 'Task 1' });
      await taskHandler.handle({ content: 'Task 2' });

      // Get the last event's id directly from the store (handler returns aggregateId, not event id)
      const allEvents = await eventStore.getAll();
      const lastEventId = allEvents[allEvents.length - 1]!.id;

      // Act
      const snap = await projection.createSnapshot();

      // Assert: lastEventId matches the event id of the last appended event
      expect(snap).not.toBeNull();
      expect(snap!.lastEventId).toBe(lastEventId);
    });

    it('snapshot version equals SNAPSHOT_SCHEMA_VERSION', async () => {
      await taskHandler.handle({ content: 'Task' });

      const snap = await projection.createSnapshot();

      expect(snap!.version).toBe(SNAPSHOT_SCHEMA_VERSION);
    });

    it('snapshot state matches the result of getEntries("all")', async () => {
      // Arrange: mix of entry types
      await taskHandler.handle({ content: 'Task 1' });
      await noteHandler.handle({ content: 'Note 1' });
      await eventHandler.handle({ content: 'Event 1' });

      // Act
      const snap = await projection.createSnapshot();
      const liveEntries = await projection.getEntries('all');

      // Assert
      expect(snap!.state).toEqual(liveEntries);
    });

    it('savedAt is a valid ISO 8601 date string', async () => {
      await taskHandler.handle({ content: 'Task' });

      const snap = await projection.createSnapshot();

      expect(snap).not.toBeNull();
      const parsed = new Date(snap!.savedAt);
      expect(parsed.getTime()).not.toBeNaN();
      // ISO 8601 strings parsed by new Date() have valid getTime()
      expect(snap!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ============================================================================
  // ADR-018: Snapshot-Aware Background Sync Absorption
  // ============================================================================
  describe('snapshot-aware event absorption (ADR-018)', () => {
    it('after hydrate(), appending a pre-snapshot event does NOT call the subscribe callback', async () => {
      // Arrange: populate events and build snapshot
      await taskHandler.handle({ content: 'Task 1' });
      const allEvents = await eventStore.getAll();

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated from snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      // Act: "re-append" an event that was already in the snapshot (simulates SyncManager download)
      await eventStore.append(allEvents[0]!);

      // Assert: subscriber was NOT called (event was silently absorbed)
      expect(subscriberSpy).not.toHaveBeenCalled();
    });

    it('after hydrate(), appending a genuinely new event DOES call the subscribe callback', async () => {
      // Arrange: populate events and build snapshot
      await taskHandler.handle({ content: 'Task 1' });

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated from snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      // Act: append a brand-new event NOT in the snapshot
      const newEvent = {
        id: 'genuinely-new-event-id',
        type: 'task-created',
        aggregateId: 'brand-new-task',
        timestamp: new Date().toISOString(),
        version: 1,
      };
      await eventStore.append(newEvent);

      // Assert: subscriber WAS called exactly once
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });

    it('after hydrate(), appending a pre-snapshot event leaves cachedEntries valid (no getAll())', async () => {
      // Arrange: populate events and build snapshot
      await taskHandler.handle({ content: 'Task 1' });
      const allEvents = await eventStore.getAll();

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated from snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      // Prime the cache via getEntries()
      await freshProjection.getEntries('all');

      // Spy AFTER the initial cache prime
      const getAllSpy = vi.spyOn(eventStore, 'getAll');

      // Act: "re-append" a pre-snapshot event
      await eventStore.append(allEvents[0]!);

      // Now call getEntries() — it must be served from cache (no getAll() call)
      await freshProjection.getEntries('all');

      expect(getAllSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('appendBatch with all pre-snapshot events does NOT call subscriber and leaves cache valid', async () => {
      // Arrange: populate events and build snapshot
      await taskHandler.handle({ content: 'Task A' });
      await taskHandler.handle({ content: 'Task B' });
      const allEvents = await eventStore.getAll();

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated from snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      // Prime the cache
      await freshProjection.getEntries('all');

      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      const getAllSpy = vi.spyOn(eventStore, 'getAll');

      // Act: appendBatch with events already in the snapshot (SyncManager re-delivers all downloaded events)
      // appendBatch notifies subscriber once with the last event — which is pre-snapshot → absorbed silently
      await eventStore.appendBatch(allEvents);

      // Assert: subscriber was NOT called and cache was NOT invalidated
      expect(subscriberSpy).not.toHaveBeenCalled();

      await freshProjection.getEntries('all');
      expect(getAllSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('appendBatch with mixed pre-snapshot and new events calls subscriber exactly once for the new event', async () => {
      // Arrange: populate events and build snapshot
      await taskHandler.handle({ content: 'Task A' });
      const allEvents = await eventStore.getAll();

      const snapshotStore = new InMemorySnapshotStore();
      const seedProjection = new EntryListProjection(eventStore, snapshotStore);
      const snapshot = await seedProjection.createSnapshot();
      await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

      // Fresh projection hydrated from snapshot
      const freshProjection = new EntryListProjection(eventStore, snapshotStore);
      await freshProjection.hydrate();

      const subscriberSpy = vi.fn();
      freshProjection.subscribe(subscriberSpy);

      // Act: appendBatch where the last event is genuinely new
      // appendBatch calls notifySubscribers(events[last]) — the new event is not in absorbedEventIds
      const newEvent = {
        id: 'brand-new-event-id',
        type: 'task-created',
        aggregateId: 'brand-new-task',
        timestamp: new Date().toISOString(),
        version: 1,
      };
      await eventStore.appendBatch([...allEvents, newEvent]);

      // Assert: subscriber was called exactly once (for the new event, not 945 times)
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });

    it('before hydrate(), appending an event does NOT notify subscribers when cache is null (cold-start fix)', async () => {
      // Arrange: projection with NO hydration — cachedEntries is null
      const snapshotStore = new InMemorySnapshotStore();
      const bareProjection = new EntryListProjection(eventStore, snapshotStore);

      const subscriberSpy = vi.fn();
      bareProjection.subscribe(subscriberSpy);

      // Act: append an event before hydrate() is ever called (simulates cold-start
      // batch download of 1537 events where no cache has been primed yet)
      const event = {
        id: 'pre-hydrate-event-id',
        type: 'task-created',
        aggregateId: 'task-pre-hydrate',
        timestamp: new Date().toISOString(),
        version: 1,
      };
      await eventStore.append(event);

      // Assert: subscriber was NOT called — cache is null so incremental update is
      // impossible. The next getEntries() call will lazy-replay all events and
      // prime the cache. Notifying here would trigger 1537 redundant UI redraws
      // on cold-start sync.
      expect(subscriberSpy).not.toHaveBeenCalled();
    });

    it('after cache is populated (via getEntries), appending an event DOES notify subscribers', async () => {
      // Arrange: projection with NO hydration, but cache primed by calling getEntries()
      const snapshotStore = new InMemorySnapshotStore();
      const bareProjection = new EntryListProjection(eventStore, snapshotStore);

      // Prime the cache so cachedEntries !== null
      await bareProjection.getEntries('all');

      const subscriberSpy = vi.fn();
      bareProjection.subscribe(subscriberSpy);

      // Act: append a new event — cache is populated, so incremental update should run
      const event = {
        id: 'post-cache-event-id',
        type: 'task-created',
        aggregateId: 'task-post-cache',
        timestamp: new Date().toISOString(),
        version: 1,
      };
      await eventStore.append(event);

      // Assert: subscriber WAS called — the cache was updated incrementally
      expect(subscriberSpy).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// EntryListProjection — review delegation
// ---------------------------------------------------------------------------

describe('EntryListProjection — review delegation', () => {
  let eventStore: IEventStore;
  let projection: EntryListProjection;
  let taskProjection: TaskListProjection;
  let createTask: CreateTaskHandler;
  let completeTask: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    taskProjection = new TaskListProjection(eventStore);
    createTask = new CreateTaskHandler(eventStore, taskProjection, projection);
    completeTask = new CompleteTaskHandler(eventStore, projection);
  });

  it('getCompletedInRange delegates to ReviewProjection correctly', async () => {
    // Arrange: create and complete a task
    const taskId = await createTask.handle({ content: 'Completed task' });
    await completeTask.handle({ taskId });

    const from = new Date(Date.now() - 60_000); // 1 minute ago
    const to = new Date(Date.now() + 60_000);   // 1 minute from now

    // Act
    const results = await projection.getCompletedInRange(from, to);

    // Assert: the completed task appears in the range
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'task', id: taskId });
  });

  it('getStalledMonthlyTasks delegates to ReviewProjection correctly', async () => {
    // Arrange: a monthly collection
    const collectionId = 'monthly-col-1';
    const monthlyCollection: Collection = {
      id: collectionId,
      name: 'March 2026',
      type: 'monthly',
      order: 'a0',
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Insert a raw TaskCreated event dated 40 days ago so that the task is stale
    const taskId = crypto.randomUUID();
    const oldTimestamp = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await eventStore.append({
      id: crypto.randomUUID(),
      type: 'TaskCreated',
      aggregateId: taskId,
      timestamp: oldTimestamp,
      version: 1,
      payload: {
        id: taskId,
        content: 'Stale monthly task',
        createdAt: oldTimestamp,
        status: 'open',
        collectionId,
      },
    });

    const getCollection = (id: string): Collection | undefined =>
      id === collectionId ? monthlyCollection : undefined;

    // Act
    const stalled = await projection.getStalledMonthlyTasks(30, getCollection);

    // Assert: the stale task is detected via the façade
    expect(stalled.length).toBeGreaterThanOrEqual(1);
    expect(stalled[0]).toMatchObject({
      collectionId,
      collectionName: 'March 2026',
    });
    expect(stalled[0]!.staleDays).toBeGreaterThanOrEqual(30);
  });
});

// ============================================================================
// HabitProjection integration via EntryListProjection facade
// ============================================================================

describe('EntryListProjection — HabitProjection facade', () => {
  let eventStore: IEventStore;
  let projection: EntryListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
  });

  async function appendHabitCreated(habitId: string, title = 'Morning run'): Promise<void> {
    await eventStore.append({
      id: crypto.randomUUID(),
      type: 'HabitCreated',
      aggregateId: habitId,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: {
        habitId,
        title,
        frequency: { type: 'daily' },
        order: 'a0',
        createdAt: new Date().toISOString(),
      },
    });
  }

  it('getActiveHabits() returns empty when no habits', async () => {
    const habits = await projection.getActiveHabits();
    expect(habits).toEqual([]);
  });

  it('getActiveHabits() returns a created habit', async () => {
    const habitId = crypto.randomUUID();
    await appendHabitCreated(habitId);
    const habits = await projection.getActiveHabits();
    expect(habits).toHaveLength(1);
    expect(habits[0]!.id).toBe(habitId);
  });

  it('getAllHabits() includes archived habits', async () => {
    const habitId = crypto.randomUUID();
    await appendHabitCreated(habitId);
    await eventStore.append({
      id: crypto.randomUUID(),
      type: 'HabitArchived',
      aggregateId: habitId,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { habitId, archivedAt: new Date().toISOString() },
    });
    const active = await projection.getActiveHabits();
    expect(active).toHaveLength(0);
    const all = await projection.getAllHabits();
    expect(all).toHaveLength(1);
  });

  it('getHabitById() returns the correct habit', async () => {
    const habitId = crypto.randomUUID();
    await appendHabitCreated(habitId, 'Read 10 pages');
    const habit = await projection.getHabitById(habitId);
    expect(habit).toBeDefined();
    expect(habit!.title).toBe('Read 10 pages');
  });

  it('getHabitById() returns undefined for unknown id', async () => {
    const habit = await projection.getHabitById('no-such-id');
    expect(habit).toBeUndefined();
  });

  it('getHabitsForDate() returns daily habits scheduled for any date', async () => {
    const habitId = crypto.randomUUID();
    await appendHabitCreated(habitId);
    const today = new Date().toISOString().slice(0, 10);
    const habits = await projection.getHabitsForDate(today);
    expect(habits).toHaveLength(1);
  });
});

// ─── ADR-024: wasLocalStoreEmptyAtHydration() ─────────────────────────────────

describe('EntryListProjection.wasLocalStoreEmptyAtHydration()', () => {
  let eventStore: IEventStore;
  let snapshotStore: InMemorySnapshotStore;

  // Re-declare InMemorySnapshotStore locally so it's in scope for these tests.
  class InMemorySnapshotStore implements ISnapshotStore {
    private readonly store = new Map<string, ProjectionSnapshot>();
    async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
      this.store.set(key, snapshot);
    }
    async load(key: string): Promise<ProjectionSnapshot | null> {
      return this.store.get(key) ?? null;
    }
    async clear(key: string): Promise<void> {
      this.store.delete(key);
    }
  }

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    snapshotStore = new InMemorySnapshotStore();
  });

  it('returns true when local event store was empty at hydration time', async () => {
    // Arrange: no events in store
    const projection = new EntryListProjection(eventStore, snapshotStore);

    // Act
    await projection.hydrate();

    // Assert: empty store → true
    expect(projection.wasLocalStoreEmptyAtHydration()).toBe(true);
  });

  it('returns false when local event store had events at hydration time', async () => {
    // Arrange: at least one event exists before hydration
    await eventStore.append({
      id: 'evt-1',
      type: 'TaskCreated',
      aggregateId: 'task-1',
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { taskId: 'task-1', content: 'Test task', status: 'open', order: 'a0' },
    });
    const projection = new EntryListProjection(eventStore, snapshotStore);

    // Act
    await projection.hydrate();

    // Assert: non-empty store → false
    expect(projection.wasLocalStoreEmptyAtHydration()).toBe(false);
  });

  it('returns false after re-hydration when events are present on second call', async () => {
    // Arrange: first hydration on an empty store
    const projection = new EntryListProjection(eventStore, snapshotStore);
    await projection.hydrate();
    expect(projection.wasLocalStoreEmptyAtHydration()).toBe(true); // baseline

    // Simulate cold-start path: seed an event, then hydrate again
    await eventStore.append({
      id: 'evt-remote-1',
      type: 'TaskCreated',
      aggregateId: 'task-1',
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { taskId: 'task-1', content: 'Remote task', status: 'open', order: 'a0' },
    });
    await projection.hydrate();

    // Assert: second hydration sees events → returns false
    expect(projection.wasLocalStoreEmptyAtHydration()).toBe(false);
  });

  it('returns false (default) before hydrate() has been called', () => {
    // Arrange: projection constructed but hydrate() not yet called
    const projection = new EntryListProjection(eventStore, snapshotStore);

    // Assert: safe default is false (treats as non-empty, won't skip needed remote fetch)
    // Note: ADR-024 documents that calling this before hydrate() is a misuse;
    // the safe default here avoids false-positive "new device" detection.
    expect(projection.wasLocalStoreEmptyAtHydration()).toBe(false);
  });
});

// ============================================================================
// ADR-025: getLastSnapshotCursor() — delta-sync cursor
// ============================================================================
describe('EntryListProjection.getLastSnapshotCursor()', () => {
  let eventStore: IEventStore;
  let snapshotStore: InMemorySnapshotStore;
  let taskProjection: TaskListProjection;
  let taskHandler: CreateTaskHandler;
  let projection: EntryListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    snapshotStore = new InMemorySnapshotStore();
    projection = new EntryListProjection(eventStore, snapshotStore);
    taskProjection = new TaskListProjection(eventStore);
    taskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
  });

  it('returns null before hydrate() is called', () => {
    expect(projection.getLastSnapshotCursor()).toBeNull();
  });

  it('returns null after hydrate() when no snapshot exists', async () => {
    await taskHandler.handle({ content: 'Task 1' });

    await projection.hydrate();

    expect(projection.getLastSnapshotCursor()).toBeNull();
  });

  it('returns the lastEventId from the snapshot after hydrate() with a valid snapshot', async () => {
    await taskHandler.handle({ content: 'Task 1' });

    // Build and save a snapshot (enriched with ADR-026 required fields)
    const seedProjection = new EntryListProjection(eventStore, snapshotStore);
    const snapshot = await seedProjection.createSnapshot();
    expect(snapshot).not.toBeNull();
    await snapshotStore.save('entry-list-projection', enrichSnapshot(snapshot!));

    // Fresh projection — hydrate reads the snapshot
    const freshProjection = new EntryListProjection(eventStore, snapshotStore);
    await freshProjection.hydrate();

    expect(freshProjection.getLastSnapshotCursor()).toBe(snapshot!.lastEventId);
  });

  it('returns the updated lastEventId after createSnapshot() is called', async () => {
    await taskHandler.handle({ content: 'Task 1' });
    await taskHandler.handle({ content: 'Task 2' });

    const snapshot = await projection.createSnapshot();
    expect(snapshot).not.toBeNull();

    expect(projection.getLastSnapshotCursor()).toBe(snapshot!.lastEventId);
  });
});

// ============================================================================
// ADR-026: hydrate() field-presence guard and HabitProjection hydration
// ============================================================================

describe('EntryListProjection — ADR-026 snapshot field-presence guard', () => {
  let eventStore: IEventStore;
  let snapshotStore: InMemorySnapshotStore;

  function makeV5Snapshot(overrides: Partial<ProjectionSnapshot> = {}): ProjectionSnapshot {
    return {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-v5',
      state: [],
      savedAt: new Date().toISOString(),
      habits: [],
      userPreferences: DEFAULT_USER_PREFERENCES,
      ...overrides,
    } as unknown as ProjectionSnapshot;
  }

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    snapshotStore = new InMemorySnapshotStore();
  });

  it('discards a v5 snapshot that is missing the habits field', async () => {
    // Arrange — save a "v5" snapshot without habits
    const incompleteSnapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-missing-habits',
      state: [],
      savedAt: new Date().toISOString(),
      // habits field deliberately absent
      userPreferences: DEFAULT_USER_PREFERENCES,
    } as unknown as ProjectionSnapshot;

    await snapshotStore.save('entry-list-projection', incompleteSnapshot);

    // Also put an event in the store so the snapshot appears "stale-but-present"
    const proj = new EntryListProjection(eventStore, snapshotStore);

    // Act
    await proj.hydrate();

    // Assert — cache should NOT have been populated (snapshot was discarded)
    expect(proj.isCachePopulated()).toBe(false);
  });

  it('discards a v5 snapshot that is missing the userPreferences field', async () => {
    // Arrange
    const incompleteSnapshot: ProjectionSnapshot = {
      version: SNAPSHOT_SCHEMA_VERSION,
      lastEventId: 'evt-missing-prefs',
      state: [],
      savedAt: new Date().toISOString(),
      habits: [],
      // userPreferences field deliberately absent
    } as unknown as ProjectionSnapshot;

    await snapshotStore.save('entry-list-projection', incompleteSnapshot);

    const proj = new EntryListProjection(eventStore, snapshotStore);

    // Act
    await proj.hydrate();

    // Assert
    expect(proj.isCachePopulated()).toBe(false);
  });

  it('accepts a complete v5 snapshot and calls habitProjection.hydrateFromSnapshot()', async () => {
    // Arrange — save a valid v5 snapshot
    const habitState: SerializableHabitState = {
      id: 'habit-snap-1',
      title: 'Snapshot habit',
      frequency: { type: 'daily' },
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 'a0',
      completions: {},
      reverted: [],
    };
    const validSnapshot = makeV5Snapshot({ habits: [habitState] });
    await snapshotStore.save('entry-list-projection', validSnapshot);

    // Add an event that matches the snapshot's lastEventId
    await eventStore.append({
      id: 'evt-v5',
      type: 'SomeEvent',
      aggregateId: 'agg',
      timestamp: new Date().toISOString(),
      version: 1,
      payload: {},
    });

    const proj = new EntryListProjection(eventStore, snapshotStore);

    // Act
    await proj.hydrate();

    // Assert — after hydration the habitProjection should have been seeded
    // Query via the public delegate to verify the habit is accessible
    const habits = await proj.getActiveHabits({ asOf: '2026-01-01' });
    // The habit was seeded from the snapshot even though no HabitCreated event exists
    expect(habits.find(h => h.id === 'habit-snap-1')).toBeDefined();
  });
});

