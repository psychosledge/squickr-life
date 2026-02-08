import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkMigrateEntriesHandler } from './bulk-migrate-entries.handler';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from '@squickr/infrastructure';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import { CreateNoteHandler } from './note.handlers';
import { CreateEventHandler } from './event.handlers';
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
      // 2 tasks × 3 events (TaskMigrated + TaskRemovedFromCollection + TaskAddedToCollection)
      // 2 notes × 1 event (NoteMigrated)
      // 1 event × 1 event (EventMigrated)
      // Total: 6 + 2 + 1 = 9 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(9);

      // Verify each migration event type
      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const noteMigratedEvents = batchedEvents.filter(e => e.type === 'NoteMigrated');
      const eventMigratedEvents = batchedEvents.filter(e => e.type === 'EventMigrated');

      expect(taskMigratedEvents).toHaveLength(2);
      expect(noteMigratedEvents).toHaveLength(2);
      expect(eventMigratedEvents).toHaveLength(1);

      // Verify all entries have migratedTo pointers
      const task1 = await entryProjection.getTaskById(task1Id);
      const task2 = await entryProjection.getTaskById(task2Id);
      const note1 = await entryProjection.getNoteById(note1Id);
      const note2 = await entryProjection.getNoteById(note2Id);
      const event1 = await entryProjection.getEventById(event1Id);

      expect(task1?.migratedTo).toBeDefined();
      expect(task2?.migratedTo).toBeDefined();
      expect(note1?.migratedTo).toBeDefined();
      expect(note2?.migratedTo).toBeDefined();
      expect(event1?.migratedTo).toBeDefined();
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
      // 2 tasks × 3 events (TaskMigrated + TaskRemovedFromCollection + TaskAddedToCollection) = 6 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(6);

      const migratedTaskIds = batchedEvents
        .filter(e => e.type === 'TaskMigrated')
        .map((e: any) => e.payload.originalTaskId);

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

      // Assert: 3 × TaskMigrated + 3 × TaskRemovedFromCollection + 3 × TaskAddedToCollection = 9 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(9);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(3);
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

      // Assert: 2 × TaskMigrated + 0 × TaskRemovedFromCollection + 2 × TaskAddedToCollection = 4 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(4);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(2);
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

      // Assert: 3 × TaskMigrated + 0 × TaskRemovedFromCollection + 3 × TaskAddedToCollection = 6 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(6);

      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const taskRemovedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection');
      const taskAddedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection');

      expect(taskMigratedEvents).toHaveLength(3);
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

      // Assert: TaskMigrated event has targetCollectionId: null (not undefined)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskMigratedEvent = batchedEvents.find(e => e.type === 'TaskMigrated') as TaskMigrated;

      expect(taskMigratedEvent).toBeDefined();
      expect(taskMigratedEvent.payload.targetCollectionId).toBeNull();
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
      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      expect(taskMigratedEvents).toHaveLength(1);
    });
  });

  describe('Migration event structure', () => {
    it('should generate unique migratedToId for each entry', async () => {
      // Arrange: 2 tasks
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id],
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Each migration has unique migratedToId
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated') as TaskMigrated[];

      const migratedToIds = taskMigratedEvents.map(e => e.payload.migratedToId);
      const uniqueIds = new Set(migratedToIds);

      expect(uniqueIds.size).toBe(2); // All IDs are unique
    });

    it('should use new task ID for TaskAddedToCollection event', async () => {
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

      // Assert: TaskAddedToCollection uses migratedToId (new task ID), not original ID
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      const taskMigratedEvent = batchedEvents.find(e => e.type === 'TaskMigrated') as TaskMigrated;
      const taskAddedEvent = batchedEvents.find(e => e.type === 'TaskAddedToCollection') as TaskAddedToCollection;

      expect(taskAddedEvent.payload.taskId).toBe(taskMigratedEvent.payload.migratedToId);
      expect(taskAddedEvent.aggregateId).toBe(taskMigratedEvent.payload.migratedToId);
    });
  });
});
