import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkMigrateEntriesHandler } from './bulk-migrate-entries.handler';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler } from './task.handlers';
import { CreateNoteHandler } from './note.handlers';
import { CreateEventHandler } from './event.handlers';
import { AddTaskToCollectionHandler } from './collection-management.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';
import type { BulkMigrateEntriesCommand } from './bulk-migrate-entries.handler';
import type { TaskAddedToCollection, TaskRemovedFromCollection, Entry } from './task.types';

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
        sourceCollectionId: 'col-a',
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act
      await handler.handle(command);

      // Assert: Single batch append
      expect(appendBatchSpy).toHaveBeenCalledTimes(1);
      
      // Assert: Migration events + collection management events
      // 2 tasks × 2 events (TaskRemovedFromCollection + TaskAddedToCollection) = 4
      // 2 notes × 2 events (NoteRemovedFromCollection + NoteAddedToCollection) = 4
      // 1 event × 2 events (EventRemovedFromCollection + EventAddedToCollection) = 2
      // Total: 4 + 4 + 2 = 10 events
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(10);

      // Verify each migration event type
      const taskMigratedEvents = batchedEvents.filter(e => e.type === 'TaskMigrated');
      const noteMigratedEvents = batchedEvents.filter(e => e.type === 'NoteMigrated');
      const eventMigratedEvents = batchedEvents.filter(e => e.type === 'EventMigrated');
      const noteAddedEvents = batchedEvents.filter(e => e.type === 'NoteAddedToCollection');
      const eventAddedEvents = batchedEvents.filter(e => e.type === 'EventAddedToCollection');
      const noteRemovedEvents = batchedEvents.filter(e => e.type === 'NoteRemovedFromCollection');
      const eventRemovedEvents = batchedEvents.filter(e => e.type === 'EventRemovedFromCollection');

      expect(taskMigratedEvents).toHaveLength(0); // No TaskMigrated for tasks
      expect(noteMigratedEvents).toHaveLength(0); // No NoteMigrated - use multi-collection pattern
      expect(eventMigratedEvents).toHaveLength(0); // No EventMigrated - use multi-collection pattern
      expect(noteAddedEvents).toHaveLength(2);    // Notes use NoteAddedToCollection now
      expect(noteRemovedEvents).toHaveLength(2);  // Notes also get NoteRemovedFromCollection in move mode
      expect(eventAddedEvents).toHaveLength(1);   // Events use EventAddedToCollection now
      expect(eventRemovedEvents).toHaveLength(1); // Events also get EventRemovedFromCollection in move mode

      // Verify all entries keep same IDs (multi-collection pattern, no new IDs)
      const task1 = await entryProjection.getTaskById(task1Id);
      const task2 = await entryProjection.getTaskById(task2Id);
      const note1 = await entryProjection.getNoteById(note1Id);
      const note2 = await entryProjection.getNoteById(note2Id);
      const event1 = await entryProjection.getEventById(event1Id);

      expect(task1?.migratedTo).toBeUndefined(); // Tasks keep same ID
      expect(task2?.migratedTo).toBeUndefined();
      expect(note1?.migratedTo).toBeUndefined(); // Notes also keep same ID now
      expect(note2?.migratedTo).toBeUndefined();
      expect(event1?.migratedTo).toBeUndefined(); // Events also keep same ID now
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: null, // Tasks are in uncategorized (null source)
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
        sourceCollectionId: 'col-a',
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

    it('should handle notes and events in add mode (multi-collection)', async () => {
      // Arrange: 1 note + 1 event
      const noteId = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-a' });
      const eventId = await createEventHandler.handle({ content: 'Event 1', eventDate: '2026-01-15', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [noteId, eventId],
        sourceCollectionId: 'col-a',
        targetCollectionId: 'col-b',
        mode: 'add', // Notes/Events now support multi-collection
      };

      // Act
      await handler.handle(command);

      // Assert: 1 × NoteAddedToCollection + 1 × EventAddedToCollection = 2 events
      // Notes and events now use multi-collection pattern (no NoteMigrated/EventMigrated)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(2);

      const noteMigratedEvents = batchedEvents.filter(e => e.type === 'NoteMigrated');
      const eventMigratedEvents = batchedEvents.filter(e => e.type === 'EventMigrated');
      const noteAddedEvents = batchedEvents.filter(e => e.type === 'NoteAddedToCollection');
      const eventAddedEvents = batchedEvents.filter(e => e.type === 'EventAddedToCollection');

      expect(noteMigratedEvents).toHaveLength(0); // No legacy NoteMigrated
      expect(eventMigratedEvents).toHaveLength(0); // No legacy EventMigrated
      expect(noteAddedEvents).toHaveLength(1);  // Multi-collection pattern
      expect(eventAddedEvents).toHaveLength(1); // Multi-collection pattern
    });
  });

  describe('Edge cases', () => {
    it('should throw error when mode=move but sourceCollectionId is missing', async () => {
      // Arrange: Create a task
      const taskId = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });

      const command: BulkMigrateEntriesCommand = {
        entryIds: [taskId],
        sourceCollectionId: undefined, // Missing sourceCollectionId
        targetCollectionId: 'col-b',
        mode: 'move',
      };

      // Act & Assert: Should throw validation error
      await expect(handler.handle(command)).rejects.toThrow(
        'sourceCollectionId is required when using mode="move". Pass the actual collection ID to remove tasks from.'
      );
    });

    it('should call appendBatch once (not N times)', async () => {
      // Arrange: 3 entries
      const task1Id = await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-a' });
      const task2Id = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-a' });
      const noteId = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-a' });

      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');

      const command: BulkMigrateEntriesCommand = {
        entryIds: [task1Id, task2Id],
        sourceCollectionId: 'col-a',
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
        entryIds: [], // FIX: Empty array, not undefined variables
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'col-a',
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
        sourceCollectionId: 'collection-a', // FIX: Use actual collection ID
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

  describe('Migrated sub-task bulk migration', () => {
    it('should remove migrated sub-task from actual collection, not parent collection', async () => {
      // Setup: Need AddTaskToCollectionHandler, TaskListProjection, and CreateSubTaskHandler
      const taskProjection = new TaskListProjection(eventStore);
      const addTaskHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
      const createSubTaskHandler = new CreateSubTaskHandler(eventStore, entryProjection);
      
      // Scenario: Parent in monthly log, sub-task migrated to 2/15, then bulk migrate to 2/16
      // 1. Create parent task in monthly log
      const parentId = await createTaskHandler.handle({
        title: 'Parent Task',
        collectionId: 'monthly-log',
      });
      
      // 2. Create sub-task under parent
      const subTaskId = await createSubTaskHandler.handle({
        parentEntryId: parentId,
        title: 'Sub-task',
      });
      
      // 3. Migrate sub-task to 2/15 (using AddTaskToCollection)
      await addTaskHandler.handle({
        taskId: subTaskId,
        collectionId: 'daily-log-2024-02-15',
      });
      
      // Verify sub-task is in 2/15 now
      let subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collections).toContain('daily-log-2024-02-15');
      expect(subTask?.collectionId).toBe('monthly-log'); // Display collection (parent's)
      
      // 4. Bulk migrate from 2/15 to 2/16
      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');
      await handler.handle({
        entryIds: [subTaskId],
        sourceCollectionId: 'daily-log-2024-02-15', // IMPORTANT: Remove from 2/15, not monthly-log
        targetCollectionId: 'daily-log-2024-02-16',
        mode: 'move',
      });
      
      // Assert: Should remove from 2/15 and add to 2/16
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(2);
      
      const removedEvent = batchedEvents.find(e => e.type === 'TaskRemovedFromCollection') as TaskRemovedFromCollection;
      const addedEvent = batchedEvents.find(e => e.type === 'TaskAddedToCollection') as TaskAddedToCollection;
      
      // CRITICAL: Should remove from 2/15 (source), NOT from monthly-log (parent's collection)
      expect(removedEvent.payload.collectionId).toBe('daily-log-2024-02-15');
      expect(removedEvent.payload.collectionId).not.toBe('monthly-log');
      expect(addedEvent.payload.collectionId).toBe('daily-log-2024-02-16');
      
      // Verify sub-task is now in 2/16, not 2/15
      subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collections).toContain('daily-log-2024-02-16');
      expect(subTask?.collections).not.toContain('daily-log-2024-02-15');
      expect(subTask?.collectionId).toBe('monthly-log'); // Display collection unchanged (still parent's)
    });

    it('INTEGRATION TEST: should handle exact user scenario - multi-step migration with bulk operation', async () => {
      // This test reproduces the EXACT user scenario:
      // 1. Parent task in monthly log
      // 2. Sub-task created (inherits monthly log as collectionId)
      // 3. Sub-task migrated to 2/14 daily log
      // 4. Sub-task moved from 2/14 to 2/15
      // 5. Additional tasks created in 2/15
      // 6. Bulk migrate ALL tasks from 2/15 to 2/16
      // Expected: Sub-task should be removed from 2/15, NOT from monthly-log

      // Setup handlers
      const taskProjection = new TaskListProjection(eventStore);
      const addTaskHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
      const removeTaskHandler = new (await import('./collection-management.handlers')).RemoveTaskFromCollectionHandler(eventStore, entryProjection);
      const createSubTaskHandler = new CreateSubTaskHandler(eventStore, entryProjection);
      
      // Setup: Need AddTaskToCollectionHandler, TaskListProjection, and CreateSubTaskHandler
      const taskProjection2 = new TaskListProjection(eventStore);
      void taskProjection2; // used below indirectly
      const parentId = await createTaskHandler.handle({
        title: 'Monthly Parent Task',
        collectionId: 'monthly-log',
      });
      
      // Step 2: Create sub-task under parent (inherits monthly-log as display collection)
      const subTaskId = await createSubTaskHandler.handle({
        parentEntryId: parentId,
        title: 'Migrated Sub-task',
      });
      
      // Verify initial state: sub-task has monthly-log as collectionId
      let subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collectionId).toBe('monthly-log');
      expect(subTask?.collections).toEqual(['monthly-log']);
      
      // Step 3: Single-migrate sub-task to 2/14 daily log (UI defaults to 'add' mode for sub-tasks)
      // This simulates user clicking "Migrate" on sub-task → defaults to "Also show in" (add mode)
      await addTaskHandler.handle({
        taskId: subTaskId,
        collectionId: 'daily-2024-02-14',
      });
      
      // Verify: sub-task is now in both monthly-log and 2/14
      subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collections).toEqual(expect.arrayContaining(['monthly-log', 'daily-2024-02-14']));
      expect(subTask?.collectionId).toBe('monthly-log'); // Display collection unchanged
      
      // Step 4: Single-migrate sub-task from 2/14 view to 2/15 (still using 'add' mode - UI default for sub-tasks)
      // User is in 2/14 daily log, migrates sub-task to 2/15 → UI defaults to "Also show in"
      await addTaskHandler.handle({
        taskId: subTaskId,
        collectionId: 'daily-2024-02-15',
      });
      
      // Verify: sub-task is now in monthly-log, 2/14, AND 2/15 (all 3 collections!)
      subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collections).toEqual(expect.arrayContaining(['monthly-log', 'daily-2024-02-14', 'daily-2024-02-15']));
      expect(subTask?.collectionId).toBe('monthly-log'); // Display collection STILL unchanged
      
      // Step 5: Create additional tasks directly in 2/15 daily log
      const normalTask1Id = await createTaskHandler.handle({
        title: 'Normal Task 1 in 2/15',
        collectionId: 'daily-2024-02-15',
      });
      const normalTask2Id = await createTaskHandler.handle({
        title: 'Normal Task 2 in 2/15',
        collectionId: 'daily-2024-02-15',
      });
      
      // Verify all 3 tasks are in 2/15 daily log
      const entriesIn215 = await entryProjection.getEntriesForCollectionView('daily-2024-02-15');
      expect(entriesIn215.map((e: Entry) => e.id)).toEqual(expect.arrayContaining([subTaskId, normalTask1Id, normalTask2Id]));
      
      // Step 6: Bulk migrate ALL tasks from 2/15 to 2/16
      const appendBatchSpy = vi.spyOn(eventStore, 'appendBatch');
      await handler.handle({
        entryIds: [subTaskId, normalTask1Id, normalTask2Id],
        sourceCollectionId: 'daily-2024-02-15', // CRITICAL: Remove from 2/15 (actual collection)
        targetCollectionId: 'daily-2024-02-16',
        mode: 'move',
      });
      
      // Assert: Should have 6 events total (3 remove + 3 add)
      const batchedEvents = appendBatchSpy.mock.calls[0][0];
      expect(batchedEvents).toHaveLength(6);
      
      const removedEvents = batchedEvents.filter(e => e.type === 'TaskRemovedFromCollection') as TaskRemovedFromCollection[];
      const addedEvents = batchedEvents.filter(e => e.type === 'TaskAddedToCollection') as TaskAddedToCollection[];
      
      expect(removedEvents).toHaveLength(3);
      expect(addedEvents).toHaveLength(3);
      
      // CRITICAL BUG CHECK: All removal events should reference 2/15, NOT monthly-log
      const subTaskRemovedEvent = removedEvents.find(e => e.payload.taskId === subTaskId);
      expect(subTaskRemovedEvent).toBeDefined();
      expect(subTaskRemovedEvent!.payload.collectionId).toBe('daily-2024-02-15'); // ✅ Should remove from 2/15
      expect(subTaskRemovedEvent!.payload.collectionId).not.toBe('monthly-log'); // ❌ BUG: Would incorrectly remove from monthly-log
      
      // Verify normal tasks also removed from 2/15
      removedEvents.forEach(event => {
        expect(event.payload.collectionId).toBe('daily-2024-02-15');
      });
      
      // Verify all tasks added to 2/16
      addedEvents.forEach(event => {
        expect(event.payload.collectionId).toBe('daily-2024-02-16');
      });
      
      // Final state verification: Sub-task should be in monthly-log, 2/14, AND 2/16 (removed from 2/15 only)
      // This is the KEY test: bulk migrate with mode='move' from 2/15 should ONLY remove from 2/15
      subTask = await entryProjection.getTaskById(subTaskId);
      expect(subTask?.collections).toEqual(expect.arrayContaining(['monthly-log', 'daily-2024-02-14', 'daily-2024-02-16']));
      expect(subTask?.collections).not.toContain('daily-2024-02-15'); // Removed from 2/15 only
      expect(subTask?.collectionId).toBe('monthly-log'); // Display collection STILL unchanged
      
      // Verify normal tasks are ONLY in 2/16 (not in monthly-log)
      const normalTask1 = await entryProjection.getTaskById(normalTask1Id);
      const normalTask2 = await entryProjection.getTaskById(normalTask2Id);
      expect(normalTask1?.collections).toEqual(['daily-2024-02-16']);
      expect(normalTask2?.collections).toEqual(['daily-2024-02-16']);
    });
  });
});

