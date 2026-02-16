import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkMigrateEntriesHandler } from './bulk-migrate-entries.handler';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import { CreateNoteHandler } from './note.handlers';
import { CreateEventHandler } from './event.handlers';
import { AddTaskToCollectionHandler } from './collection-management.handlers';
import type { BulkMigrateEntriesCommand } from './bulk-migrate-entries.handler';
import type { TaskMigrated, NoteMigrated, EventMigrated, TaskAddedToCollection, TaskRemovedFromCollection } from './task.types';

describe('BulkMigrateEntriesHandler', () => {
  let eventStore: IEventStore;
  let entryProjection: EntryListProjection;
  let handler: BulkMigrateEntriesHandler;
  let createTaskHandler: CreateTaskHandler;
  let createNoteHandler: CreateNoteHandler;
  let createEventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new BulkMigrateEntriesHandler(eventStore, entryProjection);
    createTaskHandler = new CreateTaskHandler(eventStore, undefined as any, entryProjection);
    createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
    createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  });

  describe('Mixed entry type migration', () => {
    it('should migrate mixed entry types (tasks, notes, events) in single batch', async () => {
      // Arrange: Create 2 tasks, 2 notes, 1 event
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });
      const note1Id = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-a' });
      const note2Id = await createNoteHandler.handle({ content: 'Note 2', collectionId: 'col-a' });
      const event1Id = await createEventHandler.handle({ content: 'Event 1', eventDate: '2026-01-15', collectionId: 'col-a' });

      // Spy on appendBatch to verify single batch call
      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id, note1Id, note2Id, event1Id],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Single batch append
      expect(appendBatchSpy).toHaveBeenCalledTimes(1);
      
      // Assert: Migration events + collection management events
      // 2 tasks × 2 events (TaskRemovedFromCollection + TaskAddedToCollection) - NO TaskMigrated
      // 2 notes × 1 event (NoteMigrated)
      // 1 event × 1 event (EventMigrated)
      // Total: 4 + 2 + 1 = 7 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(7);

      // Verify each migration event type
      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const noteMigratedEvents = batchedEvents.filter(e => e.type === 'NoteMigrated');
      const eventMigratedEvents = batchedEvents.filter(e => e.type === 'EventMigrated');

      expect(taskMigratedEvents).toHaveLength(0); // No TaskMigrated for tasks anymore
      expect(noteMigratedEvents).toHaveLength(2);
      expect(eventMigratedEvents).toHaveLength(1);

      // Verify tasks NO LONGER have migratedTo pointers (they keep same ID)
      const task1 = await entryProjection.getTaskById(task1Id);
      const task2 = await entryProjection.getTaskById(task2Id);
      const note1 = await entryProjection.getNoteById(note1Id);
      const note2 = await entryProjection.getNoteById(note2Id);
      const event1 = await entryProjection.getEventById(event1Id);

      expect(task1?.migratedTo).toBeUndefined(); // Tasks keep same ID
      expect(task2?.migratedTo).toBeUndefined();
      expect(note1?.migratedTo).toBeDefined(); // Notes still use old pattern
      expect(note2?.migratedTo).toBeDefined();
      expect(event1?.migratedTo).toBeDefined(); // Events still use old pattern
    });
  });

  describe('Ghost entry handling', () => {
    it('should skip ghost entries (already migrated)', async () => {
      // Arrange: Create 2 active tasks + 1 ghost task (already migrated)
      const activeTask1Id = await createTaskHandler.handle({ title: 'Active Task 1', collectionId: 'col-a' });
      const activeTask2Id = await createTaskHandler.handle({ title: 'Active Task 2', collectionId: 'col-a' });
      const ghostTaskId = await createTaskHandler.handle({ title: 'Ghost Task', collectionId: 'col-a' });

      // Manually append TaskMigrated event to make ghostTask a ghost
      const ghostMigratedToId = crypto.randomUUID();
      await eventStore.append({
        id: crypto.randomUUID(),
        type: 'TaskMigrated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: ghostTaskId,
        payload: {
          originalTaskId: ghostTaskId,
          targetCollectionId: 'col-c',
          migratedToId: ghostMigratedToId,
          migratedAt: new Date().toISOString(),
        },
      } as TaskMigrated);

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [activeTask1Id, activeTask2Id, ghostTaskId],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Ghost skipped, only 2 active tasks migrated
      // 2 tasks × 2 events (TaskRemovedFromCollection + TaskAddedToCollection) = 4 events (NO TaskMigrated)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(4);

      const migratedTaskIds = batchedEvents
        .filter(e => e.type === 'TaskAddedToCollection')
        .map((e: any) => e.payload.taskId);

      expect(migratedTaskIds).toContain(activeTask1Id);
      expect(migratedTaskIds).toContain(activeTask2Id);
      expect(migratedTaskIds).not.toContain(ghostTaskId); // Ghost not migrated again
    });
  });

  describe('Move mode behavior', () => {
    it('should use move mode - remove from old collection (tasks only)', async () => {
      // Arrange: 3 tasks in collection A
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });
      const task3Id = await createTaskHandler.handle({ title: 'Task 3', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id, task3Id],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: 3 × TaskRemovedFromCollection + 3 × TaskAddedToCollection = 6 events (NO TaskMigrated)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(6);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(0); // No TaskMigrated anymore
      expect(taskRemovedEvents).toHaveLength(3);
      expect(taskAddedEvents).toHaveLength(3);

      // Verify removal events target col-a (old collection)
      taskRemovedEvents.forEach((event: any) => {
        expect(event.payload.collectionId).toBe('col-a');
      });

      // Verify addition events target col-b (new collection)
      taskAddedEvents.forEach((event: any) => {
        expect(event.payload.collectionId).toBe('col-b');
      });
    });

    it('should not emit removal events for tasks without collectionId', async () => {
      // Arrange: 2 tasks in uncategorized (no collectionId)
      const task1Id = await createTaskHandler.handle({ title: 'Task 1' }); // No collectionId
      const task2Id = await createTaskHandler.handle({ title: 'Task 2' }); // No collectionId

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: 0 × TaskRemovedFromCollection + 2 × TaskAddedToCollection = 2 events (NO TaskMigrated)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(2);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(0); // No TaskMigrated anymore
      expect(taskRemovedEvents).toHaveLength(0); // No removal for uncategorized
      expect(taskAddedEvents).toHaveLength(2);
    });
  });

  describe('Add mode behavior', () => {
    it('should use add mode - preserve in old collection (tasks only)', async () => {
      // Arrange: 3 tasks in collection A
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });
      const task3Id = await createTaskHandler.handle({ title: 'Task 3', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id, task3Id],
        targetCollectionId: 'col-b',
        mode: 'add',
      };

      // Act
      await handler.handle(command);

      // Assert: 0 × TaskRemovedFromCollection + 3 × TaskAddedToCollection = 3 events (NO TaskMigrated)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(3);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(0); // No TaskMigrated anymore
      expect(taskRemovedEvents).toHaveLength(0); // Not removed in 'add' mode!
      expect(taskAddedEvents).toHaveLength(3);
    });

    it('should handle notes and events in add mode (no multi-collection yet)', async () => {
      // Arrange: 1 note + 1 event
      const noteId = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-a' });
      const eventId = await createEventHandler.handle({ content: 'Event 1', eventDate: '2026-01-15', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [noteId, eventId],
        targetCollectionId: 'col-b',
        mode: 'add', // Mode doesn't affect notes/events (they don't support multi-collection)
      };

      // Act
      await handler.handle(command);

      // Assert: 1 × NoteMigrated + 1 × EventMigrated = 2 events
      // Notes and events don't have multi-collection, so no add/remove events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(2);

      const noteMigratedEvents = batchedEvents.filter(e => e.type === 'NoteMigrated');
      const eventMigratedEvents = batchedEvents.filter(e => e.type === 'EventMigrated');

      expect(noteMigratedEvents).toHaveLength(1);
      expect(eventMigratedEvents).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should call appendBatch once (not N times)', async () => {
      // Arrange: 3 entries
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });
      const noteId = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id, noteId],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Only ONE batch call
      expect(appendBatchSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle empty selection (no-op)', async () => {
      // Arrange: Empty selection
      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: No events, no crash
      expect(appendBatchSpy).not.toHaveBeenCalled();
    });

    it('should handle null targetCollectionId (move to uncategorized)', async () => {
      // Arrange: 1 task in collection A
      const taskId = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [taskId],
        targetCollectionId: null,
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Only TaskRemovedFromCollection (no TaskAddedToCollection when target is null)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskRemovedEvent = batchedEvents.find(e => e.type === 'TaskRemovedFromCollection') as TaskRemovedFromCollection;
      const taskAddedEvent = batchedEvents.find(e => e.type === 'TaskAddedToCollection');

      expect(taskRemovedEvent).toBeDefined();
      expect(taskRemovedEvent.payload.collectionId).toBe('col-a');
      expect(taskAddedEvent).toBeUndefined(); // No add event for null target
    });

    it('should skip non-existent entries', async () => {
      // Arrange: 1 valid task + 1 non-existent ID
      const taskId = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const fakeId = 'non-existent-id';

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [taskId, fakeId],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Only 1 task migrated (fake ID skipped)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');
      expect(taskAddedEvents).toHaveLength(1);
    });
  });

  describe('Migration event structure', () => {
    it('should preserve task IDs (no new IDs created for tasks)', async () => {
      // Arrange: 2 tasks
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Tasks keep their original IDs (no migration to new IDs)
      const task1 = await entryProjection.getTaskById(task1Id);
      const task2 = await entryProjection.getTaskById(task2Id);
      
      expect(task1?.id).toBe(task1Id);
      expect(task2?.id).toBe(task2Id);
      expect(task1?.migratedTo).toBeUndefined();
      expect(task2?.migratedTo).toBeUndefined();
    });

    it('should use original task ID for TaskAddedToCollection event', async () => {
      // Arrange: 1 task
      const taskId = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [taskId],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: TaskAddedToCollection uses original taskId (not a new ID)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskAddedEvent = batchedEvents.find(e => e.type === 'TaskAddedToCollection') as TaskAddedToCollection;

      expect(taskAddedEvent.payload.taskId).toBe(taskId); // Original ID
      expect(taskAddedEvent.aggregateId).toBe(taskId); // Original ID
    });
  });

  describe('Collection history preservation', () => {
    it('should preserve collection history when migrating (not create new task)', async () => {
      // Setup: Need AddTaskToCollectionHandler
      const addTaskHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
      
      // Create task in collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to migrate',
        collectionId: 'collection-a',
        userId: 'user-1',
      });
      
      // Add to collection B (multi-collection)
      await addTaskHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });
      
      // Task should be in A and B
      let task = await entryProjection.getTaskById(taskId);
      expect(task?.collections).toEqual(expect.arrayContaining(['collection-a', 'collection-b']));
      expect(task?.collectionHistory).toHaveLength(2);
      
      // Migrate from A to C (using bulk handler with mode='move')
      await handler.handle({
        entryIds: [taskId],
        targetCollectionId: 'collection-c',
        mode: 'move',
      });
      
      // Task should STILL have same ID (not a new ID)
      task = await entryProjection.getTaskById(taskId);
      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId); // ✅ Same ID preserved
      
      // Task should be in B and C (removed from A because mode='move')
      expect(task?.collections).toEqual(expect.arrayContaining(['collection-b', 'collection-c']));
      expect(task?.collections).not.toContain('collection-a');
      
      // Collection history should show ALL 3 collections
      expect(task?.collectionHistory).toHaveLength(3);
      expect(task?.collectionHistory).toContainEqual(
        expect.objectContaining({ collectionId: 'collection-a', removedAt: expect.any(String) })
      );
      expect(task?.collectionHistory).toContainEqual(
        expect.objectContaining({ collectionId: 'collection-b', addedAt: expect.any(String) })
      );
      expect(task?.collectionHistory).toContainEqual(
        expect.objectContaining({ collectionId: 'collection-c', addedAt: expect.any(String) })
      );
    });
  });
});
