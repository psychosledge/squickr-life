import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import type { CreateSubTaskCommand, TaskCreated, TaskDeleted, TaskAddedToCollection, TaskRemovedFromCollection } from './task.types';

/**
 * Sub-Task Handlers Test Suite
 * 
 * Tests Phase 1 functionality:
 * - Creating sub-tasks under parent tasks
 * - Validation (parent exists, parent is not sub-task, title not empty)
 * - Sub-task uses collectionId from command (not stale parent.collectionId)
 * - 2-level hierarchy enforcement
 */
describe('CreateSubTaskHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let handler: CreateSubTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new CreateSubTaskHandler(eventStore, entryProjection);
  });

  describe('successful sub-task creation', () => {
    it('should create sub-task under top-level task', async () => {
      // Arrange: Create parent task first
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'App launch',
        collectionId: 'work-projects',
      });

      const command: CreateSubTaskCommand = {
        content: 'Write blog post',
        parentEntryId: parentId,
        collectionId: 'work-projects',
      };

      // Act: Create sub-task
      const subTaskId = await handler.handle(command);

      // Assert: Event was created with correct structure
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // Parent + sub-task

      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.type).toBe('TaskCreated');
      expect(subTaskEvent.payload.content).toBe('Write blog post');
      expect(subTaskEvent.payload.parentTaskId).toBe(parentId); // Event payload field - immutable
      expect(subTaskEvent.payload.collectionId).toBe('work-projects'); // Uses command's collectionId
      expect(subTaskEvent.payload.status).toBe('open');
      expect(subTaskId).toBe(subTaskEvent.payload.id);
    });

    it('should create sub-task with trimmed title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent task',
      });

      const command: CreateSubTaskCommand = {
        content: '  Sub-task with spaces  ',
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.content).toBe('Sub-task with spaces');
    });

    it('should use command collectionId when parent is in collection', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
        collectionId: 'monthly-2026-02',
      });

      const command: CreateSubTaskCommand = {
        content: 'Sub-task',
        parentEntryId: parentId,
        collectionId: 'monthly-2026-02',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.collectionId).toBe('monthly-2026-02');
    });

    it('should use command collectionId even when parent is in a different collection', async () => {
      // Arrange: Parent in collection-A
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
        collectionId: 'collection-A',
      });

      // Command specifies collection-B (the currently viewed collection)
      const command: CreateSubTaskCommand = {
        content: 'Sub-task',
        parentEntryId: parentId,
        collectionId: 'collection-B',
      };

      // Act
      await handler.handle(command);

      // Assert: uses command.collectionId, NOT parent's collectionId
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.collectionId).toBe('collection-B');
    });

    it('should create multiple sub-tasks under same parent', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'App launch',
        collectionId: 'work',
      });

      // Act: Create 3 sub-tasks
      const subTask1Id = await handler.handle({
        content: 'Write blog post',
        parentEntryId: parentId,
        collectionId: 'work',
      });

      const subTask2Id = await handler.handle({
        content: 'Deploy to production',
        parentEntryId: parentId,
        collectionId: 'work',
      });

      const subTask3Id = await handler.handle({
        content: 'Send announcement',
        parentEntryId: parentId,
        collectionId: 'work',
      });

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(4); // 1 parent + 3 sub-tasks

      const subTaskEvents = events.slice(1) as TaskCreated[];
      expect(subTaskEvents.every(e => e.payload.parentTaskId === parentId)).toBe(true); // Event payload - immutable
      expect(subTaskEvents.every(e => e.payload.collectionId === 'work')).toBe(true);
      
      expect([subTask1Id, subTask2Id, subTask3Id]).toHaveLength(3);
      expect(new Set([subTask1Id, subTask2Id, subTask3Id]).size).toBe(3); // All unique
    });

    it('assigns the collectionId from the command, not parentTask.collectionId (regression: stale collectionId bug)', async () => {
      // Arrange: create parent in 'collection-A', then move it to 'collection-B'
      // so parentTask.collectionId (legacy field) is still 'collection-A',
      // but the parent's collections[] = ['collection-B'] after the move.
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent task',
        collectionId: 'collection-A',
      });

      // Simulate move: append TaskAddedToCollection + TaskRemovedFromCollection events
      // so parent's collections[] changes to ['collection-B']
      // (The stale parentTask.collectionId scalar field remains 'collection-A')
      const addEvent: TaskAddedToCollection = {
        id: crypto.randomUUID(),
        type: 'TaskAddedToCollection',
        aggregateId: parentId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId: parentId, collectionId: 'collection-B', addedAt: new Date().toISOString() },
      };
      await eventStore.append(addEvent);

      const removeEvent: TaskRemovedFromCollection = {
        id: crypto.randomUUID(),
        type: 'TaskRemovedFromCollection',
        aggregateId: parentId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: { taskId: parentId, collectionId: 'collection-A', removedAt: new Date().toISOString() },
      };
      await eventStore.append(removeEvent);

      // Act: Create sub-task while viewing 'collection-B' (command.collectionId = 'collection-B')
      const subTaskId = await handler.handle({
        content: 'Sub-task created in collection-B',
        parentEntryId: parentId,
        collectionId: 'collection-B', // Currently viewed collection
      });

      // Assert: SubTaskCreated event has collectionId = 'collection-B', NOT 'collection-A'
      const events = await eventStore.getAll();
      const subTaskEvent = events.find(e => e.aggregateId === subTaskId) as TaskCreated;
      expect(subTaskEvent).toBeDefined();
      expect(subTaskEvent.type).toBe('TaskCreated');
      expect(subTaskEvent.payload.collectionId).toBe('collection-B'); // From command, NOT stale 'collection-A'
      expect(subTaskEvent.payload.collectionId).not.toBe('collection-A'); // NOT the stale legacy field
    });
  });

  describe('validation errors', () => {
    it('should reject empty title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        content: '',
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should reject whitespace-only title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        content: '   ',
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should reject title longer than 500 characters', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        content: 'a'.repeat(501),
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title must be between 1 and 500 characters');
    });

    it('should reject when parent task does not exist', async () => {
      // Arrange
      const command: CreateSubTaskCommand = {
        content: 'Sub-task',
        parentEntryId: 'non-existent-parent',
        collectionId: 'some-collection',
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Parent task non-existent-parent not found');
    });

    it('should reject creating sub-task under another sub-task (enforce 2-level limit)', async () => {
      // Arrange: Create parent and sub-task
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Grandparent',
      });

      const childId = await handler.handle({
        content: 'Parent (sub-task)',
        parentEntryId: parentId,
        collectionId: 'some-collection',
      });

      // Act & Assert: Try to create sub-task of sub-task
      const command: CreateSubTaskCommand = {
        content: 'Grandchild',
        parentEntryId: childId,
        collectionId: 'some-collection',
      };

      await expect(handler.handle(command)).rejects.toThrow(
        `Cannot create sub-task under ${childId}: parent is already a sub-task (2-level limit)`
      );
    });

    it('should reject when parent task was deleted', async () => {
      // Arrange: Create and delete parent task
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      // Delete parent task manually by appending TaskDeleted event
      const deleteEvent: TaskDeleted = {
        id: crypto.randomUUID(),
        type: 'TaskDeleted',
        aggregateId: parentId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          taskId: parentId,
          deletedAt: new Date().toISOString(),
        },
      };
      await eventStore.append(deleteEvent);

      // Act & Assert
      const command: CreateSubTaskCommand = {
        content: 'Sub-task',
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      await expect(handler.handle(command)).rejects.toThrow(`Parent task ${parentId} not found`);
    });
  });

  describe('edge cases', () => {
    it('should handle userId propagation', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
        userId: 'user-123',
      });

      const command: CreateSubTaskCommand = {
        content: 'Sub-task',
        parentEntryId: parentId,
        collectionId: 'some-collection',
        userId: 'user-456', // Different user creating sub-task
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.userId).toBe('user-456');
    });

    it('should generate unique IDs for multiple sub-tasks', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      // Act: Create 10 sub-tasks rapidly
      const subTaskIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await handler.handle({
          content: `Sub-task ${i}`,
          parentEntryId: parentId,
          collectionId: 'some-collection',
        });
        subTaskIds.push(id);
      }

      // Assert: All IDs are unique
      const uniqueIds = new Set(subTaskIds);
      expect(uniqueIds.size).toBe(10);
      expect(subTaskIds.every(id => id.length > 0)).toBe(true);
    });

    it('should handle maximum title length (500 characters)', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, entryProjection);
      const parentId = await createTaskHandler.handle({
        content: 'Parent',
      });

      const maxTitle = 'a'.repeat(500);
      const command: CreateSubTaskCommand = {
        content: maxTitle,
        parentEntryId: parentId,
        collectionId: 'some-collection',
      };

      // Act
      const subTaskId = await handler.handle(command);

      // Assert
      expect(subTaskId).toBeTruthy();
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.content).toBe(maxTitle);
    });
  });
});
