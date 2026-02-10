import { describe, it, expect, beforeEach } from 'vitest';
import { MoveEntryToCollectionHandler } from './task.handlers';
import { CreateTaskHandler } from './task.handlers';
import { CreateNoteHandler } from './note.handlers';
import { CreateEventHandler } from './event.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
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

  // Phase 3: Parent Migration Cascade Tests
  describe('Phase 3: Parent task migration with cascade', () => {
    it('should cascade migrate unmigrated children when parent moves', async () => {
      // Import CreateSubTaskHandler for creating children
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, entryProjection);

      // Create parent task in collection-A
      const parentId = await createTaskHandler.handle({
        title: 'Parent task',
        collectionId: 'collection-A',
      });

      // Create 2 sub-tasks (will inherit parent's collection)
      await createSubTaskHandler.handle({
        title: 'Child 1',
        parentTaskId: parentId,
      });
      await createSubTaskHandler.handle({
        title: 'Child 2',
        parentTaskId: parentId,
      });

      // Verify children are in same collection as parent
      const children = await entryProjection.getSubTasks(parentId);
      expect(children).toHaveLength(2);
      expect(children.every(c => c.collectionId === 'collection-A')).toBe(true);

      const eventCountBefore = (await eventStore.getAll()).length;

      // Move parent to collection-B
      await handler.handle({
        entryId: parentId,
        collectionId: 'collection-B',
      });

      // Assert: 3 EntryMovedToCollection events (parent + 2 children)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(3);
      expect(moveEvents.every(e => e.payload.collectionId === 'collection-B')).toBe(true);

      // Verify all tasks now in collection-B
      const updatedChildren = await entryProjection.getSubTasks(parentId);
      expect(updatedChildren).toHaveLength(2);
      expect(updatedChildren.every(c => c.collectionId === 'collection-B')).toBe(true);
    });

    it('should cascade ALL children when parent moves (including previously migrated)', async () => {
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, entryProjection);

      // Create parent in collection-A
      const parentId = await createTaskHandler.handle({
        title: 'Parent task',
        collectionId: 'collection-A',
      });

      // Create 2 children
      await createSubTaskHandler.handle({
        title: 'Child 1',
        parentTaskId: parentId,
      });
      await createSubTaskHandler.handle({
        title: 'Child 2',
        parentTaskId: parentId,
      });

      const children = await entryProjection.getSubTasks(parentId);

      // Manually move one child to different collection (Phase 2 individual migration)
      await handler.handle({
        entryId: children[0]!.id,
        collectionId: 'collection-B',
      });

      const eventCountBefore = (await eventStore.getAll()).length;

      // Move parent to collection-C
      await handler.handle({
        entryId: parentId,
        collectionId: 'collection-C',
      });

      // Assert: 3 EntryMovedToCollection events (parent + ALL children)
      // Children belong to parent, not collection - ALL children follow
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(3); // Parent + BOTH children

      // Verify: Parent in C, BOTH children now in C (all followed parent)
      const updatedChildren = await entryProjection.getSubTasks(parentId);
      expect(updatedChildren).toHaveLength(2);
      const updatedChild1 = updatedChildren.find(c => c.id === children[0]?.id);
      const updatedChild2 = updatedChildren.find(c => c.id === children[1]?.id);

      expect(updatedChild1).toBeDefined();
      expect(updatedChild2).toBeDefined();
      expect(updatedChild1!.collectionId).toBe('collection-C'); // Followed parent (was in B, now in C)
      expect(updatedChild2!.collectionId).toBe('collection-C'); // Followed parent
    });

    it('should handle parent with no children (standard migration)', async () => {
      // Create parent task with no children
      const parentId = await createTaskHandler.handle({
        title: 'Parent with no children',
        collectionId: 'collection-A',
      });

      const eventCountBefore = (await eventStore.getAll()).length;

      // Move parent to collection-B
      await handler.handle({
        entryId: parentId,
        collectionId: 'collection-B',
      });

      // Assert: Only 1 EntryMovedToCollection event (parent only)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(1);
      expect(moveEvents[0]!.aggregateId).toBe(parentId);
    });
  });
});
