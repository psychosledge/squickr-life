import { describe, it, expect, beforeEach } from 'vitest';
import { MoveEntryToCollectionHandler } from './task.handlers';
import { CreateTaskHandler } from './task.handlers';
import { CreateNoteHandler } from './note.handlers';
import { CreateEventHandler } from './event.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from '@squickr/infrastructure';
import { TaskListProjection } from './task.projections';
import { EntryListProjection } from './entry.projections';
import type { MoveEntryToCollectionCommand, EntryMovedToCollection } from './task.types';

describe('MoveEntryToCollectionHandler', () => {
  let eventStore: IEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let handler: MoveEntryToCollectionHandler;
  let createTaskHandler: CreateTaskHandler;
  let createNoteHandler: CreateNoteHandler;
  let createEventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    handler = new MoveEntryToCollectionHandler(eventStore, entryProjection);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
    createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
    createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create EntryMovedToCollection event for valid task', async () => {
      // Create a task
      const taskId = await createTaskHandler.handle({ title: 'Test task' });

      // Move task to collection
      const command: MoveEntryToCollectionCommand = {
        entryId: taskId,
        collectionId: 'collection-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // TaskCreated + EntryMovedToCollection

      const moveEvent = events[1] as EntryMovedToCollection;
      expect(moveEvent.type).toBe('EntryMovedToCollection');
      expect(moveEvent.payload.entryId).toBe(taskId);
      expect(moveEvent.payload.collectionId).toBe('collection-123');
      expect(moveEvent.aggregateId).toBe(taskId);
    });

    it('should create EntryMovedToCollection event for valid note', async () => {
      // Create a note
      const noteId = await createNoteHandler.handle({ content: 'Test note' });

      // Move note to collection
      const command: MoveEntryToCollectionCommand = {
        entryId: noteId,
        collectionId: 'collection-456',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const moveEvent = events[1] as EntryMovedToCollection;
      expect(moveEvent.type).toBe('EntryMovedToCollection');
      expect(moveEvent.payload.entryId).toBe(noteId);
      expect(moveEvent.payload.collectionId).toBe('collection-456');
    });

    it('should create EntryMovedToCollection event for valid event', async () => {
      // Create an event
      const eventId = await createEventHandler.handle({ content: 'Test event' });

      // Move event to collection
      const command: MoveEntryToCollectionCommand = {
        entryId: eventId,
        collectionId: 'collection-789',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const moveEvent = events[1] as EntryMovedToCollection;
      expect(moveEvent.type).toBe('EntryMovedToCollection');
      expect(moveEvent.payload.entryId).toBe(eventId);
      expect(moveEvent.payload.collectionId).toBe('collection-789');
    });

    it('should allow moving entry to null (uncategorized)', async () => {
      // Create a task with collectionId
      const taskId = await createTaskHandler.handle({ 
        title: 'Task in collection',
        collectionId: 'collection-123',
      });

      // Move task to uncategorized (null)
      const command: MoveEntryToCollectionCommand = {
        entryId: taskId,
        collectionId: null,
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const moveEvent = events[1] as EntryMovedToCollection;
      expect(moveEvent.payload.collectionId).toBeNull();
    });

    it('should throw error if entry does not exist', async () => {
      const command: MoveEntryToCollectionCommand = {
        entryId: 'non-existent-entry',
        collectionId: 'collection-123',
      };

      await expect(handler.handle(command)).rejects.toThrow('Entry non-existent-entry not found');
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createTaskHandler.handle({ title: 'Test task' });

      await handler.handle({
        entryId: taskId,
        collectionId: 'collection-123',
      });

      const events = await eventStore.getAll();
      const moveEvent = events[1] as EntryMovedToCollection;

      expect(moveEvent.id).toBeDefined();
      expect(moveEvent.timestamp).toBeDefined();
      expect(moveEvent.version).toBe(1);
      expect(moveEvent.payload.movedAt).toBe(moveEvent.timestamp);
    });

    it('should be idempotent - no event if already in target collection', async () => {
      // Create task with collectionId
      const taskId = await createTaskHandler.handle({
        title: 'Task in collection',
        collectionId: 'collection-123',
      });

      // Try to move to same collection
      const command: MoveEntryToCollectionCommand = {
        entryId: taskId,
        collectionId: 'collection-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      // Should only have TaskCreated, no EntryMovedToCollection
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TaskCreated');
    });

    it('should be idempotent - no event if already uncategorized and moving to null', async () => {
      // Create task without collectionId
      const taskId = await createTaskHandler.handle({
        title: 'Uncategorized task',
      });

      // Try to move to uncategorized (null)
      const command: MoveEntryToCollectionCommand = {
        entryId: taskId,
        collectionId: null,
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      // Should only have TaskCreated, no EntryMovedToCollection
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('TaskCreated');
    });

    it('should allow moving entry between collections', async () => {
      // Create task in collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task',
        collectionId: 'collection-A',
      });

      // Move to collection B
      await handler.handle({
        entryId: taskId,
        collectionId: 'collection-B',
      });

      // Move to collection C
      await handler.handle({
        entryId: taskId,
        collectionId: 'collection-C',
      });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3); // Created + 2 moves
      expect((events[1] as EntryMovedToCollection).payload.collectionId).toBe('collection-B');
      expect((events[2] as EntryMovedToCollection).payload.collectionId).toBe('collection-C');
    });
  });
});
