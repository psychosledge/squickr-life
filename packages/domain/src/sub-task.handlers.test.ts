import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import { TaskListProjection } from './task.projections';
import type { CreateSubTaskCommand, TaskCreated, TaskDeleted } from './task.types';

/**
 * Sub-Task Handlers Test Suite
 * 
 * Tests Phase 1 functionality:
 * - Creating sub-tasks under parent tasks
 * - Validation (parent exists, parent is not sub-task, title not empty)
 * - Sub-task inherits parent's collectionId
 * - 2-level hierarchy enforcement
 */
describe('CreateSubTaskHandler', () => {
  let eventStore: InMemoryEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let handler: CreateSubTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    handler = new CreateSubTaskHandler(eventStore, taskProjection, entryProjection);
  });

  describe('successful sub-task creation', () => {
    it('should create sub-task under top-level task', async () => {
      // Arrange: Create parent task first
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
        collectionId: 'work-projects',
      });

      const command: CreateSubTaskCommand = {
        title: 'Write blog post',
        parentEntryId: parentId,
      };

      // Act: Create sub-task
      const subTaskId = await handler.handle(command);

      // Assert: Event was created with correct structure
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // Parent + sub-task

      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.type).toBe('TaskCreated');
      expect(subTaskEvent.payload.title).toBe('Write blog post');
      expect(subTaskEvent.payload.parentTaskId).toBe(parentId); // Event payload field - immutable
      expect(subTaskEvent.payload.collectionId).toBe('work-projects'); // Inherits parent's collection
      expect(subTaskEvent.payload.status).toBe('open');
      expect(subTaskId).toBe(subTaskEvent.payload.id);
    });

    it('should create sub-task with trimmed title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent task',
      });

      const command: CreateSubTaskCommand = {
        title: '  Sub-task with spaces  ',
        parentEntryId: parentId,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.title).toBe('Sub-task with spaces');
    });

    it('should inherit parent collectionId when parent is in collection', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        collectionId: 'monthly-2026-02',
      });

      const command: CreateSubTaskCommand = {
        title: 'Sub-task',
        parentEntryId: parentId,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.collectionId).toBe('monthly-2026-02');
    });

    it('should inherit undefined collectionId when parent has no collection', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        // No collectionId
      });

      const command: CreateSubTaskCommand = {
        title: 'Sub-task',
        parentEntryId: parentId,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.collectionId).toBeUndefined();
    });

    it('should create multiple sub-tasks under same parent', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
        collectionId: 'work',
      });

      // Act: Create 3 sub-tasks
      const subTask1Id = await handler.handle({
        title: 'Write blog post',
        parentEntryId: parentId,
      });

      const subTask2Id = await handler.handle({
        title: 'Deploy to production',
        parentEntryId: parentId,
      });

      const subTask3Id = await handler.handle({
        title: 'Send announcement',
        parentEntryId: parentId,
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
  });

  describe('validation errors', () => {
    it('should reject empty title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        title: '',
        parentEntryId: parentId,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should reject whitespace-only title', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        title: '   ',
        parentEntryId: parentId,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should reject title longer than 500 characters', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const command: CreateSubTaskCommand = {
        title: 'a'.repeat(501),
        parentEntryId: parentId,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Title must be between 1 and 500 characters');
    });

    it('should reject when parent task does not exist', async () => {
      // Arrange
      const command: CreateSubTaskCommand = {
        title: 'Sub-task',
        parentEntryId: 'non-existent-parent',
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow('Parent task non-existent-parent not found');
    });

    it('should reject creating sub-task under another sub-task (enforce 2-level limit)', async () => {
      // Arrange: Create parent and sub-task
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Grandparent',
      });

      const childId = await handler.handle({
        title: 'Parent (sub-task)',
        parentEntryId: parentId,
      });

      // Act & Assert: Try to create sub-task of sub-task
      const command: CreateSubTaskCommand = {
        title: 'Grandchild',
        parentEntryId: childId,
      };

      await expect(handler.handle(command)).rejects.toThrow(
        `Cannot create sub-task under ${childId}: parent is already a sub-task (2-level limit)`
      );
    });

    it('should reject when parent task was deleted', async () => {
      // Arrange: Create and delete parent task
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
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
        title: 'Sub-task',
        parentEntryId: parentId,
      };

      await expect(handler.handle(command)).rejects.toThrow(`Parent task ${parentId} not found`);
    });
  });

  describe('edge cases', () => {
    it('should handle userId propagation', async () => {
      // Arrange
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        userId: 'user-123',
      });

      const command: CreateSubTaskCommand = {
        title: 'Sub-task',
        parentEntryId: parentId,
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
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      // Act: Create 10 sub-tasks rapidly
      const subTaskIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = await handler.handle({
          title: `Sub-task ${i}`,
          parentEntryId: parentId,
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
      const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const maxTitle = 'a'.repeat(500);
      const command: CreateSubTaskCommand = {
        title: maxTitle,
        parentEntryId: parentId,
      };

      // Act
      const subTaskId = await handler.handle(command);

      // Assert
      expect(subTaskId).toBeTruthy();
      const events = await eventStore.getAll();
      const subTaskEvent = events[1] as TaskCreated;
      expect(subTaskEvent.payload.title).toBe(maxTitle);
    });
  });
});
