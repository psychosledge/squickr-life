import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteParentTaskHandler } from './delete-parent-task.handler';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { CreateTaskHandler } from './task.handlers';
import { TaskListProjection } from './task.projections';
import type { DeleteParentTaskCommand, TaskDeleted } from './task.types';

/**
 * Phase 5: Deletion Cascade Tests - FINAL PHASE!
 * 
 * Test scenarios:
 * - Delete parent without children → success (standard delete)
 * - Delete parent with children + confirmed=false → throws error
 * - Delete parent with children + confirmed=true → cascades deletion
 * - Delete parent that doesn't exist → throws error
 * - Delete parent with children across collections → all children deleted (symlink behavior)
 * - Verify children deleted before parent (event order)
 */
describe('DeleteParentTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: EntryListProjection;
  let handler: DeleteParentTaskHandler;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    const taskProjection = new TaskListProjection(eventStore);
    projection = new EntryListProjection(eventStore);
    handler = new DeleteParentTaskHandler(eventStore, projection);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, projection);
  });

  describe('handle - parent without children', () => {
    it('should delete parent task normally when it has no children', async () => {
      // Arrange: Task with no children
      const taskId = await createTaskHandler.handle({ title: 'Simple task' });

      const command: DeleteParentTaskCommand = {
        taskId,
        confirmed: false,
      };

      // Act
      await handler.handle(command);

      // Assert: Only 1 deletion event (the task itself)
      const allEvents = await eventStore.getAll();
      const deletionEvents = allEvents.filter(e => e.type === 'TaskDeleted') as TaskDeleted[];

      expect(deletionEvents).toHaveLength(1);
      expect(deletionEvents[0]!.payload.taskId).toBe(taskId);

      // Verify task is deleted (no longer exists)
      const task = await projection.getTaskById(taskId);
      expect(task).toBeUndefined();
    });

    it('should work with confirmed=true even when no children exist', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({ title: 'Another task' });

      const command: DeleteParentTaskCommand = {
        taskId,
        confirmed: true, // Doesn't matter, no children anyway
      };

      // Act & Assert
      await expect(handler.handle(command)).resolves.toBeUndefined();
    });
  });

  describe('handle - parent with children (no confirmation)', () => {
    it('should throw error when trying to delete parent with children and not confirmed', async () => {
      // Arrange: Create parent with 3 sub-tasks
      const parentId = await createTaskHandler.handle({ title: 'Plan vacation' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book flights' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book hotel' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Research activities' });

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert: Should throw with clear message
      await expect(handler.handle(command)).rejects.toThrow(
        /This will delete the parent task AND all 3 sub-task\(s\)\. Are you sure\?/
      );
    });

    it('should throw error with correct count for different number of children', async () => {
      // Arrange: 5 children
      const parentId = await createTaskHandler.handle({ title: 'Big project' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 3' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 4' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 5' });

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow(
        /This will delete the parent task AND all 5 sub-task\(s\)\./
      );
    });

    it('should throw error even if all children are completed', async () => {
      // Arrange: Parent with children (doesn't matter if complete or not - delete always requires confirmation)
      const parentId = await createTaskHandler.handle({ title: 'Completed project' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });

      // Complete children (deletion still requires confirmation)
      const { CompleteTaskHandler } = await import('./task.handlers');
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: child1Id });
      await completeHandler.handle({ taskId: child2Id });

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert: Should still throw (deletion doesn't filter by status)
      await expect(handler.handle(command)).rejects.toThrow(
        /This will delete the parent task AND all 2 sub-task\(s\)\./
      );
    });
  });

  describe('handle - parent with children (confirmed)', () => {
    it('should cascade delete parent and all children when confirmed', async () => {
      // Arrange: Create parent with 3 sub-tasks
      const parentId = await createTaskHandler.handle({ title: 'Plan vacation' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book flights' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book hotel' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Research activities' });

      const eventCountBefore = (await eventStore.getAll()).length;

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true, // User confirmed cascade
      };

      // Act
      await handler.handle(command);

      // Assert: Should generate 4 deletion events (3 children + 1 parent)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const deletionEvents = newEvents.filter(e => e.type === 'TaskDeleted') as TaskDeleted[];

      expect(deletionEvents).toHaveLength(4); // child1, child2, child3, parent

      // Verify all deleted
      const deletedTaskIds = deletionEvents.map(e => e.payload.taskId);
      expect(deletedTaskIds).toContain(child1Id);
      expect(deletedTaskIds).toContain(child2Id);
      expect(deletedTaskIds).toContain(child3Id);
      expect(deletedTaskIds).toContain(parentId);

      // Parent should be last
      const lastEvent = deletionEvents[deletionEvents.length - 1];
      expect(lastEvent).toBeDefined();
      expect(lastEvent!.payload.taskId).toBe(parentId);

      // Verify all tasks are now deleted (no longer exist)
      const parent = await projection.getTaskById(parentId);
      const child1 = await projection.getTaskById(child1Id);
      const child2 = await projection.getTaskById(child2Id);
      const child3 = await projection.getTaskById(child3Id);

      expect(parent).toBeUndefined();
      expect(child1).toBeUndefined();
      expect(child2).toBeUndefined();
      expect(child3).toBeUndefined();
    });

    it('should delete all children regardless of completion status', async () => {
      // Arrange: Mix of completed and incomplete children
      const parentId = await createTaskHandler.handle({ title: 'Project' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 3' });

      // Complete child1 and child3
      const { CompleteTaskHandler } = await import('./task.handlers');
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId: child1Id });
      await completeHandler.handle({ taskId: child3Id });

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: All 3 children + parent deleted (4 events)
      const allEvents = await eventStore.getAll();
      const deletionEvents = allEvents.filter(e => e.type === 'TaskDeleted') as TaskDeleted[];

      expect(deletionEvents).toHaveLength(4);

      // Verify all deleted
      const parent = await projection.getTaskById(parentId);
      const child1 = await projection.getTaskById(child1Id);
      const child2 = await projection.getTaskById(child2Id);
      const child3 = await projection.getTaskById(child3Id);

      expect(parent).toBeUndefined();
      expect(child1).toBeUndefined();
      expect(child2).toBeUndefined();
      expect(child3).toBeUndefined();
    });

    it('should delete children before parent (event order)', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({ title: 'Project' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });

      const eventCountBefore = (await eventStore.getAll()).length;

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: Verify event order - children first, parent last
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const deletionEvents = newEvents.filter(e => e.type === 'TaskDeleted') as TaskDeleted[];

      expect(deletionEvents).toHaveLength(3);

      // First two events should be children (in any order)
      const firstTwoIds = deletionEvents.slice(0, 2).map(e => e.payload.taskId);
      expect(firstTwoIds).toContain(child1Id);
      expect(firstTwoIds).toContain(child2Id);

      // Last event should be parent
      const lastEvent = deletionEvents[2];
      expect(lastEvent!.payload.taskId).toBe(parentId);
    });
  });

  describe('handle - error cases', () => {
    it('should throw error when task does not exist', async () => {
      const command: DeleteParentTaskCommand = {
        taskId: 'nonexistent-task-id',
        confirmed: false,
      };

      await expect(handler.handle(command)).rejects.toThrow(
        /Task nonexistent-task-id not found/
      );
    });

    it('should throw error when trying to delete non-existent task even with confirmed=true', async () => {
      const command: DeleteParentTaskCommand = {
        taskId: 'nonexistent-task-id',
        confirmed: true,
      };

      await expect(handler.handle(command)).rejects.toThrow(
        /Task nonexistent-task-id not found/
      );
    });
  });

  describe('handle - cross-collection sub-tasks', () => {
    it('should delete sub-tasks even if they are in different collections (symlink behavior)', async () => {
      // Arrange: Parent in one collection, sub-tasks migrated to different collections
      const parentId = await createTaskHandler.handle({ title: 'Project', collectionId: 'work-projects' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 3' });

      // Move child2 and child3 to different collections (simulates migration)
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      await moveHandler.handle({
        entryId: child2Id,
        collectionId: 'daily-2026-02-07',
      });
      await moveHandler.handle({
        entryId: child3Id,
        collectionId: 'daily-2026-02-08',
      });

      const command: DeleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: All children deleted regardless of collection
      const child1 = await projection.getTaskById(child1Id);
      const child2 = await projection.getTaskById(child2Id);
      const child3 = await projection.getTaskById(child3Id);
      const parent = await projection.getTaskById(parentId);

      expect(child1).toBeUndefined();
      expect(child2).toBeUndefined();
      expect(child3).toBeUndefined();
      expect(parent).toBeUndefined();
    });
  });
});
