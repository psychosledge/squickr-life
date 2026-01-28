import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from './event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, CompleteTaskHandler, DeleteTaskHandler } from './task.handlers';
import { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler } from './note.handlers';
import { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler } from './event.handlers';
import type { CreateTaskCommand, CreateNoteCommand, CreateEventCommand } from './task.types';

describe('EntryListProjection', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let taskProjection: TaskListProjection;
  let taskHandler: CreateTaskHandler;
  let noteHandler: CreateNoteHandler;
  let eventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new EventStore();
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
      const taskId = await taskHandler.handle({ title: 'Test task' });

      const entries = await projection.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        type: 'task',
        id: taskId,
        title: 'Test task',
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
      const taskId = await taskHandler.handle({ title: 'Task 1' });
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
      const taskId1 = await taskHandler.handle({ title: 'Task 1' });
      const taskId2 = await taskHandler.handle({ title: 'Task 2' });
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
      const taskId = await taskHandler.handle({ title: 'Task to complete' });
      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection);
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
      await taskHandler.handle({ title: 'Task 1' });
      await taskHandler.handle({ title: 'Task 2' });
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
      const taskId = await taskHandler.handle({ title: 'Task 3' });
      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection);
      await completeHandler.handle({ taskId });

      const entries = await projection.getEntries('open-tasks');
      
      expect(entries).toHaveLength(2); // Task 1 and Task 2 from beforeEach
      expect(entries.every(e => e.type === 'task' && e.status === 'open')).toBe(true);
    });

    it('should filter to show only completed tasks', async () => {
      const taskId = await taskHandler.handle({ title: 'Task to complete' });
      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection);
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
      const taskId = await taskHandler.handle({ title: 'Find me' });

      const entry = await projection.getEntryById(taskId);
      
      expect(entry).toMatchObject({
        type: 'task',
        id: taskId,
        title: 'Find me',
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
        await taskHandler.handle({ title: 'Task 1' });
        await taskHandler.handle({ title: 'Task 2' });
        await noteHandler.handle({ content: 'Note 1' });

        const tasks = await projection.getTasks();
        
        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toMatchObject({
          title: 'Task 1',
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
        const taskId = await taskHandler.handle({ title: 'Task 1' });

        const task = await projection.getTaskById(taskId);
        
        expect(task).toMatchObject({
          id: taskId,
          title: 'Task 1',
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
        await taskHandler.handle({ title: 'Task 1' });

        const notes = await projection.getNotes();
        
        expect(notes).toHaveLength(2);
        expect(notes[0]).toMatchObject({
          content: 'Note 1',
        });
        expect(notes[0]).not.toHaveProperty('type');
      });

      it('should return empty array when no notes exist', async () => {
        await taskHandler.handle({ title: 'Task 1' });

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
        const taskId = await taskHandler.handle({ title: 'Task 1' });

        const note = await projection.getNoteById(taskId);
        
        expect(note).toBeUndefined();
      });
    });

    describe('getEvents', () => {
      it('should return only events without type discriminator', async () => {
        await eventHandler.handle({ content: 'Event 1' });
        await eventHandler.handle({ content: 'Event 2' });
        await taskHandler.handle({ title: 'Task 1' });

        const events = await projection.getEvents();
        
        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({
          content: 'Event 1',
        });
        expect(events[0]).not.toHaveProperty('type');
      });

      it('should return empty array when no events exist', async () => {
        await taskHandler.handle({ title: 'Task 1' });

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
        const taskId = await taskHandler.handle({ title: 'Task 1' });

        const event = await projection.getEventById(taskId);
        
        expect(event).toBeUndefined();
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed operations across all entry types', async () => {
      // Create entries
      const task1 = await taskHandler.handle({ title: 'Task 1' });
      const note1 = await noteHandler.handle({ content: 'Note 1' });
      const event1 = await eventHandler.handle({ content: 'Event 1' });
      const task2 = await taskHandler.handle({ title: 'Task 2' });

      // Modify entries
      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection);
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
      const id1 = await taskHandler.handle({ title: 'Task 1' });
      const id2 = await noteHandler.handle({ content: 'Note 1' });
      const id3 = await eventHandler.handle({ content: 'Event 1' });
      const id4 = await taskHandler.handle({ title: 'Task 2' });

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
      const task1 = await taskHandler.handle({ title: 'Task 1' });
      const task2 = await taskHandler.handle({ title: 'Task 2' });
      const task3 = await taskHandler.handle({ title: 'Task 3' });
      await noteHandler.handle({ content: 'Note 1' });

      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection);
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
      const taskId = await taskHandler.handle({ title: 'Task 1' });
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
      const taskId = await taskHandler.handle({ title: 'Task 1' });
      
      // Initial order: Note 1, Note 2, Task 1
      let entries = await projection.getEntries();
      expect(entries[0].id).toBe(note1Id);
      expect(entries[1].id).toBe(note2Id);
      expect(entries[2].id).toBe(taskId);
      
      // Reorder task to be between the two notes
      const { ReorderTaskHandler } = await import('./task.handlers');
      const { TaskListProjection } = await import('./task.projections');
      const taskProjection = new TaskListProjection(eventStore);
      const reorderHandler = new ReorderTaskHandler(eventStore, taskProjection, projection);
      
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
      const taskId = await taskHandler.handle({ title: 'Task 1' });
      
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
      const task1Id = await taskHandler.handle({ title: 'Task 1' });
      const note1Id = await noteHandler.handle({ content: 'Note 1' });
      const event1Id = await eventHandler.handle({ content: 'Event 1' });
      const task2Id = await taskHandler.handle({ title: 'Task 2' });
      
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
      const { TaskListProjection } = await import('./task.projections');
      const taskProjection = new TaskListProjection(eventStore);
      const taskReorderHandler = new ReorderTaskHandler(eventStore, taskProjection, projection);
      
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
      const task1Id = await taskHandler.handle({ title: 'Task 1' });
      const note2Id = await noteHandler.handle({ content: 'Note 2' });
      
      // Move task1 to the beginning
      const { ReorderTaskHandler } = await import('./task.handlers');
      const { TaskListProjection } = await import('./task.projections');
      const taskProjection = new TaskListProjection(eventStore);
      const taskReorderHandler = new ReorderTaskHandler(eventStore, taskProjection, projection);
      
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
      const taskId = await taskHandler.handle({ title: 'Task 1' });
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
      const taskId1 = await taskHandler.handle({ title: 'First task' });
      const noteId = await noteHandler.handle({ content: 'Middle note' });
      const taskId2 = await taskHandler.handle({ title: 'Last task' });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(3);
      
      // Should be ordered by fractional index (order field)
      const entryIds = logs[0].entries.map(e => e.id);
      expect(entryIds).toEqual([taskId1, noteId, taskId2]);
    });

    it('should respect limit parameter', async () => {
      // Create some entries
      await taskHandler.handle({ title: 'Task 1' });
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
      await taskHandler.handle({ title: 'Task 1' });
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
      const taskId = await taskHandler.handle({ title: 'To be deleted' });
      await noteHandler.handle({ content: 'Stays' });

      // Delete the task
      const deleteHandler = new DeleteTaskHandler(eventStore, taskProjection, projection);
      await deleteHandler.handle({ taskId });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].entries).toHaveLength(1); // Only note remains
      expect(logs[0].entries[0].type).toBe('note');
    });

    it('should handle completed tasks correctly', async () => {
      const taskId = await taskHandler.handle({ title: 'Task to complete' });

      // Complete the task
      const completeHandler = new CompleteTaskHandler(eventStore, taskProjection, projection);
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
      await taskHandler.handle({ title: 'Test task' });

      const logs = await projection.getDailyLogs();
      
      expect(logs).toHaveLength(1);
      // Date should be in YYYY-MM-DD format
      expect(logs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include all entry types in same daily log', async () => {
      await taskHandler.handle({ title: 'Task' });
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
      await taskHandler.handle({ title: 'Task in A', collectionId: 'collection-A' });
      await taskHandler.handle({ title: 'Task in B', collectionId: 'collection-B' });
      await noteHandler.handle({ content: 'Note in A', collectionId: 'collection-A' });

      const entriesInA = await projection.getEntriesByCollection('collection-A');
      
      expect(entriesInA).toHaveLength(2);
      expect(entriesInA[0].type).toBe('task');
      expect(entriesInA[1].type).toBe('note');
      
      if (entriesInA[0].type === 'task') {
        expect(entriesInA[0].title).toBe('Task in A');
      }
      if (entriesInA[1].type === 'note') {
        expect(entriesInA[1].content).toBe('Note in A');
      }
    });

    it('should return uncategorized entries when collectionId is null', async () => {
      // Create entries without collectionId
      await taskHandler.handle({ title: 'Uncategorized task' });
      await noteHandler.handle({ content: 'Uncategorized note' });
      
      // Create entry with collection
      await taskHandler.handle({ title: 'Task in collection', collectionId: 'collection-A' });

      const uncategorized = await projection.getEntriesByCollection(null);
      
      expect(uncategorized).toHaveLength(2);
      expect(uncategorized.every(e => !e.collectionId)).toBe(true);
    });

    it('should return empty array when no entries in collection', async () => {
      await taskHandler.handle({ title: 'Task in A', collectionId: 'collection-A' });

      const entriesInB = await projection.getEntriesByCollection('collection-B');
      
      expect(entriesInB).toHaveLength(0);
    });

    it('should handle mixed entry types in same collection', async () => {
      await taskHandler.handle({ title: 'Task', collectionId: 'collection-X' });
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
      const taskId = await taskHandler.handle({ title: 'Second', collectionId: 'col-1' });
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
      const taskId = await taskHandler.handle({ title: 'Task to move' });

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
      const taskId = await taskHandler.handle({ title: 'Task', collectionId: 'collection-A' });

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
      const taskId = await taskHandler.handle({ title: 'Task', collectionId: 'collection-A' });

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
      await taskHandler.handle({ title: 'Task in A', collectionId: 'collection-A' });
      await taskHandler.handle({ title: 'Task 2 in A', collectionId: 'collection-A' });
      await noteHandler.handle({ content: 'Note in A', collectionId: 'collection-A' });
      await taskHandler.handle({ title: 'Task in B', collectionId: 'collection-B' });
      await eventHandler.handle({ content: 'Event in C', collectionId: 'collection-C' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get('collection-A')).toBe(3);
      expect(counts.get('collection-B')).toBe(1);
      expect(counts.get('collection-C')).toBe(1);
    });

    it('should count uncategorized entries with null key', async () => {
      // Create uncategorized entries
      await taskHandler.handle({ title: 'Uncategorized task' });
      await noteHandler.handle({ content: 'Uncategorized note' });
      
      // Create categorized entry
      await taskHandler.handle({ title: 'Task in A', collectionId: 'collection-A' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get(null)).toBe(2);
      expect(counts.get('collection-A')).toBe(1);
    });

    it('should return empty map when no entries exist', async () => {
      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.size).toBe(0);
    });

    it('should handle mixed entry types in same collection', async () => {
      await taskHandler.handle({ title: 'Task', collectionId: 'mixed' });
      await noteHandler.handle({ content: 'Note', collectionId: 'mixed' });
      await eventHandler.handle({ content: 'Event', collectionId: 'mixed' });

      const counts = await projection.getEntryCountsByCollection();
      
      expect(counts.get('mixed')).toBe(3);
    });

    it('should update counts when entries are moved between collections', async () => {
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      
      // Create entries
      const taskId = await taskHandler.handle({ title: 'Task', collectionId: 'collection-A' });
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
      const taskId = await taskHandler.handle({ title: 'Task', collectionId: 'collection-A' });

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
      const taskId1 = await taskHandler.handle({ title: 'Task 1', collectionId: 'collection-A' });
      await taskHandler.handle({ title: 'Task 2', collectionId: 'collection-A' });

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
});
