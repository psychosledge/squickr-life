import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from './event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler, CompleteTaskHandler } from './task.handlers';
import { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler } from './note.handlers';
import { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler } from './event.handlers';
import type { CreateTaskCommand, CreateNoteCommand, CreateEventCommand } from './task.types';

describe('EntryListProjection', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let taskHandler: CreateTaskHandler;
  let noteHandler: CreateNoteHandler;
  let eventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    taskHandler = new CreateTaskHandler(eventStore, projection);
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
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      const entries = await projection.getEntries('open-tasks');
      
      expect(entries).toHaveLength(2); // Task 1 and Task 2 from beforeEach
      expect(entries.every(e => e.type === 'task' && e.status === 'open')).toBe(true);
    });

    it('should filter to show only completed tasks', async () => {
      const taskId = await taskHandler.handle({ title: 'Task to complete' });
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
});
