import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler, CompleteTaskHandler, MigrateTaskHandler } from './task.handlers';
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
 * 
 * Tests Phase 2 migration/symlink queries:
 * - getParentTask(task)
 * - isSubTaskMigrated(task)
 */
describe('EntryListProjection - Sub-Task Queries', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let taskProjection: TaskListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let completeTaskHandler: CompleteTaskHandler;
  let migrateTaskHandler: MigrateTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    taskProjection = new TaskListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, projection);
    completeTaskHandler = new CompleteTaskHandler(eventStore, projection);
    migrateTaskHandler = new MigrateTaskHandler(eventStore, projection);
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
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Deploy to production',
        parentEntryId: parentId,
      });

      const subTask3Id = await createSubTaskHandler.handle({
        title: 'Send announcement',
        parentEntryId: parentId,
      });

      // Act
      const subTasks = await projection.getSubTasks(parentId);

      // Assert
      expect(subTasks).toHaveLength(3);
      expect(subTasks.map(t => t.id)).toEqual([subTask1Id, subTask2Id, subTask3Id]);
      expect(subTasks.every(t => t.parentEntryId === parentId)).toBe(true);
    });

    it('should only return direct children (not grandchildren)', async () => {
      // Arrange: Create hierarchy that should fail 2-level validation
      // But test that projection would work correctly if structure existed
      const parentId = await createTaskHandler.handle({
        title: 'Grandparent',
      });

      const childId = await createSubTaskHandler.handle({
        title: 'Parent',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub-task 2',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub-task 2',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
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
        parentEntryId: parentId,
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
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Deploy',
        parentEntryId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Announce',
        parentEntryId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Monitor',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentEntryId: parentId,
      });

      const subTask3Id = await createSubTaskHandler.handle({
        title: 'Sub 3',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentEntryId: parentId,
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
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub 2',
        parentEntryId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Sub 3',
        parentEntryId: parentId,
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

  // ============================================================================
  // Phase 2: Migration/Symlink Tests
  // ============================================================================

  describe('getParentTask', () => {
    it('should return undefined for top-level task', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({
        title: 'Top-level task',
      });

      const task = await projection.getTaskById(taskId);

      // Act
      const parent = await projection.getParentTask(task!);

      // Assert
      expect(parent).toBeUndefined();
    });

    it('should return parent task for sub-task', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent task',
      });

      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      const subTask = await projection.getTaskById(subTaskId);

      // Act
      const parent = await projection.getParentTask(subTask!);

      // Assert
      expect(parent).toBeDefined();
      expect(parent!.id).toBe(parentId);
      expect(parent!.title).toBe('Parent task');
    });

    it('should return undefined if parent is deleted', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
      });

      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      // Delete parent
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

      const subTask = await projection.getTaskById(subTaskId);

      // Act
      const parent = await projection.getParentTask(subTask!);

      // Assert
      expect(parent).toBeUndefined();
    });
  });

  describe('isSubTaskMigrated', () => {
    it('should return false for top-level task', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({
        title: 'Top-level task',
      });

      const task = await projection.getTaskById(taskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(task!);

      // Assert
      expect(isMigrated).toBe(false);
    });

    it('should return false for unmigrated sub-task (same collection as parent)', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        collectionId: 'work',
      });

      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      const subTask = await projection.getTaskById(subTaskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(subTask!);

      // Assert
      expect(isMigrated).toBe(false);
      // Verify both are in same collection
      const parent = await projection.getTaskById(parentId);
      expect(subTask!.collectionId).toBe(parent!.collectionId);
    });

    it('should return true for migrated sub-task (different collection than parent)', async () => {
      // Arrange: Create parent in "work" collection
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
        collectionId: 'work',
      });

      // Create sub-task (inherits "work" collection)
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Write blog post',
        parentEntryId: parentId,
      });

      // Migrate sub-task to "today" collection
      await migrateTaskHandler.handle({
        taskId: subTaskId,
        targetCollectionId: 'today',
      });

      // Get migrated version of sub-task (new ID)
      const allTasks = await projection.getTasks();
      const migratedSubTask = allTasks.find(t => t.migratedFrom === subTaskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(migratedSubTask!);

      // Assert
      expect(isMigrated).toBe(true);
      expect(migratedSubTask!.collectionId).toBe('today');
      expect(migratedSubTask!.parentEntryId).toBe(parentId);
      
      // Verify parent is still in "work"
      const parent = await projection.getTaskById(parentId);
      expect(parent!.collectionId).toBe('work');
    });

    it('should return true when parent is uncategorized and sub-task is in a collection', async () => {
      // Arrange: Create parent with no collection
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        // No collectionId - uncategorized
      });

      // Create sub-task (inherits undefined collection)
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      // Migrate sub-task to "today" collection
      await migrateTaskHandler.handle({
        taskId: subTaskId,
        targetCollectionId: 'today',
      });

      // Get migrated version
      const allTasks = await projection.getTasks();
      const migratedSubTask = allTasks.find(t => t.migratedFrom === subTaskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(migratedSubTask!);

      // Assert
      expect(isMigrated).toBe(true);
      expect(migratedSubTask!.collectionId).toBe('today');
      
      // Verify parent is uncategorized
      const parent = await projection.getTaskById(parentId);
      expect(parent!.collectionId).toBeUndefined();
    });

    it('should return true when parent is in collection and sub-task is uncategorized', async () => {
      // Arrange: Create parent in "work" collection
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        collectionId: 'work',
      });

      // Create sub-task (inherits "work")
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      // Migrate sub-task to uncategorized (null)
      await migrateTaskHandler.handle({
        taskId: subTaskId,
        targetCollectionId: null,
      });

      // Get migrated version
      const allTasks = await projection.getTasks();
      const migratedSubTask = allTasks.find(t => t.migratedFrom === subTaskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(migratedSubTask!);

      // Assert
      expect(isMigrated).toBe(true);
      expect(migratedSubTask!.collectionId).toBeUndefined();
      
      // Verify parent is in "work"
      const parent = await projection.getTaskById(parentId);
      expect(parent!.collectionId).toBe('work');
    });

    it('should return false if parent is deleted (orphaned sub-task)', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        collectionId: 'work',
      });

      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      // Migrate sub-task
      await migrateTaskHandler.handle({
        taskId: subTaskId,
        targetCollectionId: 'today',
      });

      // Delete parent
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

      // Get migrated version
      const allTasks = await projection.getTasks();
      const migratedSubTask = allTasks.find(t => t.migratedFrom === subTaskId);

      // Act
      const isMigrated = await projection.isSubTaskMigrated(migratedSubTask!);

      // Assert
      expect(isMigrated).toBe(false); // Parent doesn't exist, treat as not migrated
    });

    it('should preserve parentTaskId after migration (cross-collection query)', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'App launch',
        collectionId: 'work',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Write blog post',
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Deploy to production',
        parentEntryId: parentId,
      });

      // Migrate both sub-tasks to different collections
      await migrateTaskHandler.handle({
        taskId: subTask1Id,
        targetCollectionId: 'today',
      });

      await migrateTaskHandler.handle({
        taskId: subTask2Id,
        targetCollectionId: 'tomorrow',
      });

      // Act: getSubTasks should return ALL children across collections
      const children = await projection.getSubTasks(parentId);

      // Assert: Should find BOTH migrated sub-tasks (cross-collection query)
      expect(children).toHaveLength(2);
      
      const migratedChild1 = children.find(c => c.migratedFrom === subTask1Id);
      const migratedChild2 = children.find(c => c.migratedFrom === subTask2Id);
      
      expect(migratedChild1).toBeDefined();
      expect(migratedChild2).toBeDefined();
      
      expect(migratedChild1!.parentEntryId).toBe(parentId);
      expect(migratedChild2!.parentEntryId).toBe(parentId);
      
      expect(migratedChild1!.collectionId).toBe('today');
      expect(migratedChild2!.collectionId).toBe('tomorrow');
    });
  });

  describe('getSubTasksForMultipleParents (batch query optimization)', () => {
    it('should return empty map for parents with no sub-tasks', async () => {
      // Arrange
      const parent1Id = await createTaskHandler.handle({
        title: 'Parent 1',
      });

      const parent2Id = await createTaskHandler.handle({
        title: 'Parent 2',
      });

      // Act
      const result = await projection.getSubTasksForMultipleParents([parent1Id, parent2Id]);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should fetch sub-tasks for multiple parents in single query', async () => {
      // Arrange: Create 2 parents with sub-tasks
      const parent1Id = await createTaskHandler.handle({
        title: 'Parent 1',
      });

      const parent2Id = await createTaskHandler.handle({
        title: 'Parent 2',
      });

      const sub1_1Id = await createSubTaskHandler.handle({
        title: 'Sub 1-1',
        parentEntryId: parent1Id,
      });

      const sub1_2Id = await createSubTaskHandler.handle({
        title: 'Sub 1-2',
        parentEntryId: parent1Id,
      });

      const sub2_1Id = await createSubTaskHandler.handle({
        title: 'Sub 2-1',
        parentEntryId: parent2Id,
      });

      // Act
      const result = await projection.getSubTasksForMultipleParents([parent1Id, parent2Id]);

      // Assert
      expect(result.size).toBe(2);
      expect(result.get(parent1Id)?.length).toBe(2);
      expect(result.get(parent2Id)?.length).toBe(1);
      
      const parent1SubTasks = result.get(parent1Id)!;
      expect(parent1SubTasks.map(t => t.id)).toEqual([sub1_1Id, sub1_2Id]);
      
      const parent2SubTasks = result.get(parent2Id)!;
      expect(parent2SubTasks.map(t => t.id)).toEqual([sub2_1Id]);
    });

    it('should filter out migrated original sub-tasks (only return active versions)', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({
        title: 'Parent',
        collectionId: 'work',
      });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Sub-task 1',
        parentEntryId: parentId,
      });

      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub-task 2 (will be migrated)',
        parentEntryId: parentId,
      });

      // Migrate sub-task 2
      await migrateTaskHandler.handle({
        taskId: subTask2Id,
        targetCollectionId: 'today',
      });

      // Act
      const result = await projection.getSubTasksForMultipleParents([parentId]);

      // Assert
      expect(result.size).toBe(1);
      const subTasks = result.get(parentId)!;
      expect(subTasks.length).toBe(2); // Both: unmigrated original + migrated version
      
      // Should include unmigrated original
      expect(subTasks.some(t => t.id === subTask1Id)).toBe(true);
      
      // Should include migrated version (NOT the original)
      const migratedVersion = subTasks.find(t => t.migratedFrom === subTask2Id);
      expect(migratedVersion).toBeDefined();
      expect(migratedVersion!.collectionId).toBe('today');
      
      // Should NOT include original migrated task
      expect(subTasks.some(t => t.id === subTask2Id)).toBe(false);
    });

    it('should only return sub-tasks for requested parents', async () => {
      // Arrange: Create 3 parents
      const parent1Id = await createTaskHandler.handle({ title: 'Parent 1' });
      const parent2Id = await createTaskHandler.handle({ title: 'Parent 2' });
      const parent3Id = await createTaskHandler.handle({ title: 'Parent 3' });

      await createSubTaskHandler.handle({ title: 'Sub 1-1', parentEntryId: parent1Id });
      await createSubTaskHandler.handle({ title: 'Sub 2-1', parentEntryId: parent2Id });
      await createSubTaskHandler.handle({ title: 'Sub 3-1', parentEntryId: parent3Id });

      // Act: Only request parent1 and parent3
      const result = await projection.getSubTasksForMultipleParents([parent1Id, parent3Id]);

      // Assert: Should NOT include parent2's sub-tasks
      expect(result.size).toBe(2);
      expect(result.has(parent1Id)).toBe(true);
      expect(result.has(parent2Id)).toBe(false); // Not requested
      expect(result.has(parent3Id)).toBe(true);
    });

    it('should match behavior of individual getSubTasks() calls', async () => {
      // Arrange
      const parent1Id = await createTaskHandler.handle({ title: 'Parent 1' });
      const parent2Id = await createTaskHandler.handle({ title: 'Parent 2' });

      await createSubTaskHandler.handle({ title: 'Sub 1-1', parentEntryId: parent1Id });
      await createSubTaskHandler.handle({ title: 'Sub 1-2', parentEntryId: parent1Id });
      await createSubTaskHandler.handle({ title: 'Sub 2-1', parentEntryId: parent2Id });

      // Act: Compare batch query vs individual queries
      const batchResult = await projection.getSubTasksForMultipleParents([parent1Id, parent2Id]);
      const individual1 = await projection.getSubTasks(parent1Id);
      const individual2 = await projection.getSubTasks(parent2Id);

      // Assert: Results should be identical
      expect(batchResult.get(parent1Id)?.map(t => t.id)).toEqual(individual1.map(t => t.id));
      expect(batchResult.get(parent2Id)?.map(t => t.id)).toEqual(individual2.map(t => t.id));
    });
  });

  describe('getParentTitlesForSubTasks', () => {
    it('should return parent title for a sub-task with existing parent', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({ title: 'Put together Bed Frame' });
      const subTaskId = await createSubTaskHandler.handle({
        title: 'find hardware',
        parentEntryId: parentId,
      });

      // Act
      const result = await projection.getParentTitlesForSubTasks([subTaskId]);

      // Assert
      expect(result.size).toBe(1);
      expect(result.get(subTaskId)).toBe('Put together Bed Frame');
    });

    it('should return empty map for non-existent sub-task', async () => {
      // Arrange
      const nonExistentId = 'non-existent-task-id';

      // Act
      const result = await projection.getParentTitlesForSubTasks([nonExistentId]);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return empty result for task with non-existent parent', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({ title: 'Parent Task' });
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });

      // Delete the parent
      const deleteHandler = await import('./task.handlers').then(m => new m.DeleteTaskHandler(eventStore, projection));
      await deleteHandler.handle({ taskId: parentId });

      // Act
      const result = await projection.getParentTitlesForSubTasks([subTaskId]);

      // Assert
      expect(result.size).toBe(0); // No parent exists
    });

    it('should return empty result for non-sub-task (no parentTaskId)', async () => {
      // Arrange
      const taskId = await createTaskHandler.handle({ title: 'Regular task' });

      // Act
      const result = await projection.getParentTitlesForSubTasks([taskId]);

      // Assert
      expect(result.size).toBe(0); // Not a sub-task
    });

    it('should return parent titles for multiple sub-tasks in batch', async () => {
      // Arrange
      const parent1Id = await createTaskHandler.handle({ title: 'Project A' });
      const parent2Id = await createTaskHandler.handle({ title: 'Project B' });

      const subTask1Id = await createSubTaskHandler.handle({
        title: 'Sub-task 1',
        parentEntryId: parent1Id,
      });
      const subTask2Id = await createSubTaskHandler.handle({
        title: 'Sub-task 2',
        parentEntryId: parent2Id,
      });
      const subTask3Id = await createSubTaskHandler.handle({
        title: 'Sub-task 3',
        parentEntryId: parent1Id,
      });

      // Act
      const result = await projection.getParentTitlesForSubTasks([subTask1Id, subTask2Id, subTask3Id]);

      // Assert
      expect(result.size).toBe(3);
      expect(result.get(subTask1Id)).toBe('Project A');
      expect(result.get(subTask2Id)).toBe('Project B');
      expect(result.get(subTask3Id)).toBe('Project A');
    });

    it('should return parent title regardless of collection (does NOT filter by collection)', async () => {
      // Arrange: Parent in 'work' collection
      const parentId = await createTaskHandler.handle({ 
        title: 'Work Project',
        collectionId: 'work',
      });

      // Sub-task inherits parent's collection initially
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task in work',
        parentEntryId: parentId,
      });

      // Migrate sub-task to 'home' collection (different from parent)
      const migratedSubTaskId = await migrateTaskHandler.handle({
        taskId: subTaskId,
        targetCollectionId: 'home',
      });

      // Act: Query the migrated sub-task
      const result = await projection.getParentTitlesForSubTasks([migratedSubTaskId]);

      // Assert: Should STILL return parent title (filtering happens in UI)
      expect(result.size).toBe(1);
      expect(result.get(migratedSubTaskId)).toBe('Work Project');
    });

    it('should handle mixed bag of sub-tasks and non-sub-tasks', async () => {
      // Arrange
      const parentId = await createTaskHandler.handle({ title: 'Parent Task' });
      const subTaskId = await createSubTaskHandler.handle({
        title: 'Sub-task',
        parentEntryId: parentId,
      });
      const regularTaskId = await createTaskHandler.handle({ title: 'Regular Task' });

      // Act
      const result = await projection.getParentTitlesForSubTasks([subTaskId, regularTaskId]);

      // Assert
      expect(result.size).toBe(1); // Only sub-task has parent
      expect(result.get(subTaskId)).toBe('Parent Task');
      expect(result.has(regularTaskId)).toBe(false);
    });
  });
});
