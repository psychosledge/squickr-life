import { describe, it, expect, beforeEach } from 'vitest';
import { CompleteParentTaskHandler } from './complete-parent-task.handler';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { CreateTaskHandler, CompleteTaskHandler } from './task.handlers';
import { TaskListProjection } from './task.projections';
import type { CompleteParentTaskCommand, TaskCompleted } from './task.types';

/**
 * Phase 4: Completion Cascade Tests
 * 
 * Test scenarios:
 * - Complete parent with all children complete → success (no cascade needed)
 * - Complete parent with incomplete children + confirmed=false → throws error
 * - Complete parent with incomplete children + confirmed=true → cascades completion
 * - Complete parent without children → success (standard behavior)
 * - Complete parent with mixed completion states → only completes incomplete children
 * - Complete parent that doesn't exist → throws error
 * - Complete non-existent parent → throws error
 */
describe('CompleteParentTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: EntryListProjection;
  let handler: CompleteParentTaskHandler;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let completeTaskHandler: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    const taskProjection = new TaskListProjection(eventStore);
    projection = new EntryListProjection(eventStore);
    handler = new CompleteParentTaskHandler(eventStore, projection);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, projection);
    completeTaskHandler = new CompleteTaskHandler(eventStore, projection);
  });

  describe('handle - parent with all children complete', () => {
    it('should complete parent when all children are already complete', async () => {
      // Arrange: Create parent with 3 sub-tasks, all completed
      const parentId = await createTaskHandler.handle({ title: 'Plan vacation' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book flights' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book hotel' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Research activities' });

      // Complete all children
      await completeTaskHandler.handle({ taskId: child1Id });
      await completeTaskHandler.handle({ taskId: child2Id });
      await completeTaskHandler.handle({ taskId: child3Id });

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false, // No confirmation needed
      };

      // Act
      await handler.handle(command);

      // Assert: Only parent completion event (children already complete)
      const allEvents = await eventStore.getAll();
      const completionEvents = allEvents.filter(e => e.type === 'TaskCompleted') as TaskCompleted[];
      
      // 3 child completions + 1 parent completion = 4 total
      expect(completionEvents).toHaveLength(4);
      
      // Last event should be parent completion
      const lastCompletionEvent = completionEvents[completionEvents.length - 1];
      expect(lastCompletionEvent).toBeDefined();
      expect(lastCompletionEvent!.payload.taskId).toBe(parentId);

      // Verify parent is now complete
      const parent = await projection.getTaskById(parentId);
      expect(parent?.status).toBe('completed');
    });

    it('should complete parent without confirmation when all children complete', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({ title: 'Launch app' });
      const childId = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Deploy' });

      // Complete child
      await completeTaskHandler.handle({ taskId: childId });

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert: Should not throw
      await expect(handler.handle(command)).resolves.toBeUndefined();
    });
  });

  describe('handle - parent with incomplete children (no confirmation)', () => {
    it('should throw error when trying to complete parent with incomplete children and not confirmed', async () => {
      // Arrange: Create parent with 3 sub-tasks, only 1 complete
      const parentId = await createTaskHandler.handle({ title: 'Plan vacation' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book flights' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book hotel' }); // incomplete
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Research activities' }); // incomplete

      // Complete only first child
      await completeTaskHandler.handle({ taskId: child1Id });

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert: Should throw with clear message
      await expect(handler.handle(command)).rejects.toThrow(
        /This will complete the parent task AND all 2 sub-task\(s\)\. Are you sure\?/
      );
    });

    it('should throw error with correct count when no children are complete', async () => {
      // Arrange: All children incomplete
      const parentId = await createTaskHandler.handle({ title: 'Big project' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 3' });
      await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 4' });

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: false,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow(
        /This will complete the parent task AND all 4 sub-task\(s\)\./
      );
    });
  });

  describe('handle - parent with incomplete children (confirmed)', () => {
    it('should cascade complete parent and all incomplete children when confirmed', async () => {
      // Arrange: Create parent with 3 sub-tasks, only 1 complete
      const parentId = await createTaskHandler.handle({ title: 'Plan vacation' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book flights' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Book hotel' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Research activities' });

      // Complete only first child
      await completeTaskHandler.handle({ taskId: child1Id });

      const eventCountBefore = (await eventStore.getAll()).length;

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true, // User confirmed cascade
      };

      // Act
      await handler.handle(command);

      // Assert: Should generate 3 completion events (2 incomplete children + 1 parent)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const completionEvents = newEvents.filter(e => e.type === 'TaskCompleted') as TaskCompleted[];

      expect(completionEvents).toHaveLength(3); // child2, child3, parent

      // Verify children completed
      const completedTaskIds = completionEvents.map(e => e.payload.taskId);
      expect(completedTaskIds).toContain(child2Id);
      expect(completedTaskIds).toContain(child3Id);
      expect(completedTaskIds).toContain(parentId);

      // Parent should be last
      const lastEvent = completionEvents[completionEvents.length - 1];
      expect(lastEvent).toBeDefined();
      expect(lastEvent!.payload.taskId).toBe(parentId);

      // Verify all tasks are now complete
      const parent = await projection.getTaskById(parentId);
      const child2 = await projection.getTaskById(child2Id);
      const child3 = await projection.getTaskById(child3Id);

      expect(parent?.status).toBe('completed');
      expect(child2?.status).toBe('completed');
      expect(child3?.status).toBe('completed');
    });

    it('should not re-complete already completed children', async () => {
      // Arrange: All children already complete
      const parentId = await createTaskHandler.handle({ title: 'Project' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });

      // Complete both children
      await completeTaskHandler.handle({ taskId: child1Id });
      await completeTaskHandler.handle({ taskId: child2Id });

      const eventCountBefore = (await eventStore.getAll()).length;

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: Only parent completion event (children already complete)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const completionEvents = newEvents.filter(e => e.type === 'TaskCompleted') as TaskCompleted[];

      expect(completionEvents).toHaveLength(1); // Only parent
      expect(completionEvents[0]!.payload.taskId).toBe(parentId);
    });

    it('should handle mixed completion states correctly', async () => {
      // Arrange: 5 children, 2 complete, 3 incomplete
      const parentId = await createTaskHandler.handle({ title: 'Big project' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });
      const child3Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 3' });
      const child4Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 4' });
      const child5Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 5' });

      // Complete child1 and child3
      await completeTaskHandler.handle({ taskId: child1Id });
      await completeTaskHandler.handle({ taskId: child3Id });

      const eventCountBefore = (await eventStore.getAll()).length;

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: 4 completion events (child2, child4, child5, parent)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const completionEvents = newEvents.filter(e => e.type === 'TaskCompleted') as TaskCompleted[];

      expect(completionEvents).toHaveLength(4);

      const completedTaskIds = completionEvents.map(e => e.payload.taskId);
      expect(completedTaskIds).toContain(child2Id);
      expect(completedTaskIds).toContain(child4Id);
      expect(completedTaskIds).toContain(child5Id);
      expect(completedTaskIds).toContain(parentId);

      // Should NOT re-complete already complete children
      expect(completedTaskIds.filter(id => id === child1Id)).toHaveLength(0);
      expect(completedTaskIds.filter(id => id === child3Id)).toHaveLength(0);
    });
  });

  describe('handle - parent without children', () => {
    it('should complete parent task normally when it has no children', async () => {
      // Arrange: Task with no children
      const taskId = await createTaskHandler.handle({ title: 'Simple task' });

      const command: CompleteParentTaskCommand = {
        taskId,
        confirmed: false,
      };

      // Act
      await handler.handle(command);

      // Assert: Only 1 completion event (the task itself)
      const allEvents = await eventStore.getAll();
      const completionEvents = allEvents.filter(e => e.type === 'TaskCompleted') as TaskCompleted[];

      expect(completionEvents).toHaveLength(1);
      expect(completionEvents[0]!.payload.taskId).toBe(taskId);

      const task = await projection.getTaskById(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should work with confirmed=true even when no children exist', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({ title: 'Another task' });

      const command: CompleteParentTaskCommand = {
        taskId,
        confirmed: true, // Doesn't matter, no children anyway
      };

      // Act & Assert
      await expect(handler.handle(command)).resolves.toBeUndefined();
    });
  });

  describe('handle - error cases', () => {
    it('should throw error when task does not exist', async () => {
      const command: CompleteParentTaskCommand = {
        taskId: 'nonexistent-task-id',
        confirmed: false,
      };

      await expect(handler.handle(command)).rejects.toThrow(
        /Task nonexistent-task-id not found/
      );
    });

    it('should throw error when task is already completed', async () => {
      // Arrange: Create and complete a task
      const taskId = await createTaskHandler.handle({ title: 'Task' });
      
      await completeTaskHandler.handle({ taskId });

      const command: CompleteParentTaskCommand = {
        taskId,
        confirmed: false,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow(
        /Task .* is not open \(status: completed\)/
      );
    });
  });

  describe('handle - cross-collection sub-tasks', () => {
    it('should complete sub-tasks even if they are in different collections (symlink behavior)', async () => {
      // Arrange: Parent in one collection, sub-tasks migrated to different collections
      const parentId = await createTaskHandler.handle({ title: 'Project', collectionId: 'work-projects' });
      const child1Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 1' });
      const child2Id = await createSubTaskHandler.handle({ parentEntryId: parentId, title: 'Task 2' });

      // Move child2 to different collection (simulates migration)
      // Use the MoveEntryToCollectionHandler
      const { MoveEntryToCollectionHandler } = await import('./task.handlers');
      const moveHandler = new MoveEntryToCollectionHandler(eventStore, projection);
      await moveHandler.handle({
        entryId: child2Id,
        collectionId: 'daily-2026-02-07',
      });

      const command: CompleteParentTaskCommand = {
        taskId: parentId,
        confirmed: true,
      };

      // Act
      await handler.handle(command);

      // Assert: Both children completed regardless of collection
      const child1 = await projection.getTaskById(child1Id);
      const child2 = await projection.getTaskById(child2Id);

      expect(child1?.status).toBe('completed');
      expect(child2?.status).toBe('completed');

      // Verify child2 is still in different collection (didn't move)
      expect(child2?.collectionId).toBe('daily-2026-02-07');
    });
  });
});
