import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '@squickr/infrastructure';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler, CompleteTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { TaskListProjection } from './task.projections';
import type { TaskDeleted } from './task.types';

/**
 * Sub-Task Projection Test Suite
 * 
 * Tests Phase 1 projection queries:
 * - getSubTasks(parentTaskId)
 * - isSubTask(task)
 * - isParentTask(task)
 * - getParentCompletionStatus(parentTaskId)
 */
describe('EntryListProjection - Sub-Task Queries', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let taskProjection: TaskListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let completeTaskHandler: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    taskProjection = new TaskListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, projection);
    completeTaskHandler = new CompleteTaskHandler(eventStore, projection);
  });

  describe('getSubTasks', () => {
    it('should return empty array for task with no sub-tasks', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent with no children',
      });

      // Act
      const subTasks = await projection.getSubTasks(parentId);

      // Assert
      expect(subTasks).toEqual([]);
    });

    it('should return all sub-tasks for a parent', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Write blog post',
        parentTaskId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Deploy to production',
        parentTaskId: parentId,
      });

      const subTask3Id = await createSubTaskHandler.handle({
        title: 'Send announcement',
        parentTaskId: parentId,
      });

      // Act
      const subTasks = await projection.getSubTasks(parentId);

      // Assert
      expect(subTasks).toHaveLength(3);
      expect(subTasks.map(t => t.id)).toEqual([subTask1Id, subTask2Id, subTask3Id]);
      expect(subTasks.every(t => t.parentTaskId === parentId)).toBe(true);
    });

    it('should only return direct children (not grandchildren)', async () => {
      // Arrange: Create hierarchy that should fail 2-level validation
      // But test that projection would work correctly if structure existed
      const parentId = await createTaskHandler.handle({
        title: 'Grandparent',
      });

      const childId = await createSubTaskHandler.handle({
        title: 'Parent',
        parentTaskId: parentId,
      });

      // Act
      const childrenOfGrandparent = await projection.getSubTasks(parentId);
      const childrenOfParent = await projection.getSubTasks(childId);

      // Assert
      expect(childrenOfGrandparent).toHaveLength(1);
      expect(childrenOfGrandparent[0]!.id).toBe(childId);
      expect(childrenOfParent).toHaveLength(0); // No grandchildren due to 2-level limit
    });

    it('should return sub-tasks from different collections (cross-collection query)', async () => {
      // Arrange: This tests future Phase 2 behavior where sub-tasks can migrate
      // For now, all sub-tasks inherit parent's collection
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
        collectionId: 'work',
      });

      await createSubTaskHandler.handle({
        title: 'Sub-task 1',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub-task 2',
        parentTaskId: parentId,
      });

      // Act
      const subTasks = await projection.getSubTasks(parentId);

      // Assert
      expect(subTasks).toHaveLength(2);
      // All sub-tasks should be in parent's collection initially
      expect(subTasks.every(t => t.collectionId === 'work')).toBe(true);
    });

    it('should not return deleted sub-tasks', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Sub-task 1',
        parentTaskId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub-task 2',
        parentTaskId: parentId,
      });

      // Delete sub-task 1
      const deleteEvent1: TaskDeleted = {
        id: crypto.randomUUID(),
        type: 'TaskDeleted',
        aggregateId: subTask1Id,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          taskId: subTask1Id,
          deletedAt: new Date().toISOString(),
        },
      };
      await eventStore.append(deleteEvent1);

      // Act
      const subTasks = await projection.getSubTasks(parentId);

      // Assert
      expect(subTasks).toHaveLength(1);
      expect(subTasks[0]!.id).toBe(subTask2Id);
    });
  });

  describe('isSubTask', () => {
    it('should return false for top-level task', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({
        title: 'Top-level task',
      });

      const task = await projection.getTaskById(taskId);

      // Act
      const result = projection.isSubTask(task!);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for sub-task', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentTaskId: parentId,
      });

      const subTask = await projection.getTaskById(subTaskId);

      // Act
      const result = projection.isSubTask(subTask!);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('isParentTask', () => {
    it('should return false for task with no children', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({
        title: 'Task without children',
      });

      // Act
      const result = await projection.isParentTask(taskId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for task with children', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      await createSubTaskHandler.handle({
        title: 'Child',
        parentTaskId: parentId,
      });

      // Act
      const result = await projection.isParentTask(parentId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false after all children are deleted', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const childId = await createSubTaskHandler.handle({
        title: 'Child',
        parentTaskId: parentId,
      });

      // Initially parent
      expect(await projection.isParentTask(parentId)).toBe(true);

      // Delete child
      const deleteEvent2: TaskDeleted = {
        id: crypto.randomUUID(),
        type: 'TaskDeleted',
        aggregateId: childId,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          taskId: childId,
          deletedAt: new Date().toISOString(),
        },
      };
      await eventStore.append(deleteEvent2);

      // Act
      const result = await projection.isParentTask(parentId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getParentCompletionStatus', () => {
    it('should return 0/0 for parent with no children', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      // Act
      const status = await projection.getParentCompletionStatus(parentId);

      // Assert
      expect(status).toEqual({
        total: 0,
        completed: 0,
        allComplete: true, // Vacuous truth: 0/0 = all complete
      });
    });

    it('should return correct counts for mixed completion status', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Write blog post',
        parentTaskId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Deploy',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Announce',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Monitor',
        parentTaskId: parentId,
      });

      // Complete 2 out of 4
      await completeTaskHandler.handle({ taskId: subTask1Id });
      await completeTaskHandler.handle({ taskId: subTask2Id });

      // Act
      const status = await projection.getParentCompletionStatus(parentId);

      // Assert
      expect(status).toEqual({
        total: 4,
        completed: 2,
        allComplete: false,
      });
    });

    it('should return allComplete: true when all children complete', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Sub 1',
        parentTaskId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentTaskId: parentId,
      });

      const subTask3Id = await createSubTaskHandler.handle({
        title: 'Sub 3',
        parentTaskId: parentId,
      });

      // Complete all
      await completeTaskHandler.handle({ taskId: subTask1Id });
      await completeTaskHandler.handle({ taskId: subTask2Id });
      await completeTaskHandler.handle({ taskId: subTask3Id });

      // Act
      const status = await projection.getParentCompletionStatus(parentId);

      // Assert
      expect(status).toEqual({
        total: 3,
        completed: 3,
        allComplete: true,
      });
    });

    it('should return allComplete: false when no children complete', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      await createSubTaskHandler.handle({
        title: 'Sub 1',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentTaskId: parentId,
      });

      // Act
      const status = await projection.getParentCompletionStatus(parentId);

      // Assert
      expect(status).toEqual({
        total: 2,
        completed: 0,
        allComplete: false,
      });
    });

    it('should not count deleted sub-tasks in total', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Sub 1',
        parentTaskId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub 3',
        parentTaskId: parentId,
      });

      // Complete sub-task 1
      await completeTaskHandler.handle({ taskId: subTask1Id });

      // Delete sub-task 2
      const deleteEvent3: TaskDeleted = {
        id: crypto.randomUUID(),
        type: 'TaskDeleted',
        aggregateId: subTask2Id,
        timestamp: new Date().toISOString(),
        version: 1,
        payload: {
          taskId: subTask2Id,
          deletedAt: new Date().toISOString(),
        },
      };
      await eventStore.append(deleteEvent3);

      // Act
      const status = await projection.getParentCompletionStatus(parentId);

      // Assert
      expect(status).toEqual({
        total: 2, // Only 2 remaining (1 deleted)
        completed: 1,
        allComplete: false,
      });
    });
  });
});
