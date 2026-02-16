import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler, MigrateTaskHandler } from './task.handlers';
import { MoveTaskToCollectionHandler, AddTaskToCollectionHandler, RemoveTaskFromCollectionHandler } from './collection-management.handlers';

/**
 * Test: Migration Pointer Preservation Bug Fix (Issue #2)
 * 
 * Root Cause: When TaskAddedToCollection fires after TaskMigrated,
 * the projection overwrites migratedTo/migratedToCollectionId pointers,
 * breaking "Go to {collection}" navigation links.
 * 
 * Solution: Preserve migration pointers in TaskAddedToCollection handler
 * by distinguishing between:
 * - Migration: Task migrated to new collection (preserve migratedTo/migratedToCollectionId)
 * - Movement: Task moved between collections (set movedFrom/movedFromCollectionId)
 */
describe('Migration Pointer Preservation (Issue #2)', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let migrateTaskHandler: MigrateTaskHandler;
  let moveHandler: MoveTaskToCollectionHandler;
  let addHandler: AddTaskToCollectionHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, null as any, projection);
    migrateTaskHandler = new MigrateTaskHandler(eventStore, projection);
    addHandler = new AddTaskToCollectionHandler(eventStore, projection);
    const removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    moveHandler = new MoveTaskToCollectionHandler(addHandler, removeHandler, projection);
  });

  describe('TaskMigrated preserves migration pointers', () => {
    it('should preserve migratedTo pointer when original task is migrated', async () => {
      // Arrange: Create task in Collection A
      await createTaskHandler.handle({
        title: 'Task in Collection A',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const originalTaskId = tasks[0]!.id;

      // Act: Migrate to Collection B
      const migratedTaskId = await migrateTaskHandler.handle({
        taskId: originalTaskId,
        targetCollectionId: 'collection-b',
      });

      // Assert: Original task should have migratedTo pointer
      const originalTask = await projection.getTaskById(originalTaskId);
      expect(originalTask).toBeDefined();
      expect(originalTask!.migratedTo).toBe(migratedTaskId);
      expect(originalTask!.migratedToCollectionId).toBe('collection-b');
    });

    it('should preserve migratedFrom pointer when migrated task is created', async () => {
      // Arrange: Create task in Collection A
      await createTaskHandler.handle({
        title: 'Task in Collection A',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const originalTaskId = tasks[0]!.id;

      // Act: Migrate to Collection B
      const migratedTaskId = await migrateTaskHandler.handle({
        taskId: originalTaskId,
        targetCollectionId: 'collection-b',
      });

      // Assert: Migrated task should have migratedFrom pointer
      const migratedTask = await projection.getTaskById(migratedTaskId);
      expect(migratedTask).toBeDefined();
      expect(migratedTask!.migratedFrom).toBe(originalTaskId);
      expect(migratedTask!.migratedFromCollectionId).toBe('collection-a');
    });
  });

  describe('TaskAddedToCollection after migration (BUG)', () => {
    it('should NOT overwrite migratedTo when TaskAddedToCollection fires after TaskMigrated', async () => {
      // This test reproduces the bug where migration pointers are lost
      
      // Arrange: Create task in Collection A
      await createTaskHandler.handle({
        title: 'Task in Collection A',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const originalTaskId = tasks[0]!.id;

      // Act 1: Migrate to Collection B (creates TaskMigrated event)
      const migratedTaskId = await migrateTaskHandler.handle({
        taskId: originalTaskId,
        targetCollectionId: 'collection-b',
      });

      // Verify migration pointers are set correctly
      let originalTask = await projection.getTaskById(originalTaskId);
      expect(originalTask!.migratedTo).toBe(migratedTaskId);
      expect(originalTask!.migratedToCollectionId).toBe('collection-b');

      // Act 2: Simulate TaskAddedToCollection event (this happens during cascade migration)
      // This should NOT clear the migratedTo pointer
      await addHandler.handle({
        taskId: migratedTaskId,
        collectionId: 'collection-c',
      });

      // Assert: Original task should STILL have migratedTo pointer
      // BUG: Currently this fails because TaskAddedToCollection overwrites it
      originalTask = await projection.getTaskById(originalTaskId);
      expect(originalTask!.migratedTo).toBe(migratedTaskId);
      expect(originalTask!.migratedToCollectionId).toBe('collection-b');

      // And migrated task should be in both collection-b and collection-c
      const migratedTask = await projection.getTaskById(migratedTaskId);
      expect(migratedTask!.collections).toContain('collection-b');
      expect(migratedTask!.collections).toContain('collection-c');
    });

    it('should preserve migratedFrom when TaskAddedToCollection fires on migrated task', async () => {
      // Arrange: Create and migrate task
      await createTaskHandler.handle({
        title: 'Task to migrate',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const originalTaskId = tasks[0]!.id;

      const migratedTaskId = await migrateTaskHandler.handle({
        taskId: originalTaskId,
        targetCollectionId: 'collection-b',
      });

      // Act: Add migrated task to another collection
      await addHandler.handle({
        taskId: migratedTaskId,
        collectionId: 'collection-c',
      });

      // Assert: Migrated task should STILL have migratedFrom pointer
      const migratedTask = await projection.getTaskById(migratedTaskId);
      expect(migratedTask!.migratedFrom).toBe(originalTaskId);
      expect(migratedTask!.migratedFromCollectionId).toBe('collection-a');
    });
  });

  describe('Movement vs Migration distinction', () => {
    it('should set movedFrom when task is moved (not migrated) between collections', async () => {
      // Arrange: Create task in Collection A
      await createTaskHandler.handle({
        title: 'Task to move',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const taskId = tasks[0]!.id;

      // Act: Move (not migrate) from Collection A to Collection B
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
      });

      // Assert: Task should have BOTH migratedFrom (for backward compat) AND movedFrom
      const task = await projection.getTaskById(taskId);
      expect(task).toBeDefined();
      
      // Legacy behavior: migratedFrom with self-reference indicates movement
      expect(task!.migratedFrom).toBe(taskId); // Self-reference indicates movement
      expect(task!.migratedFromCollectionId).toBe('collection-a');
      
      // New behavior: movedFrom is also set
      expect(task!.movedFrom).toBe(taskId); // Self-reference indicates movement
      expect(task!.movedFromCollectionId).toBe('collection-a');
      
      // Should NOT have migratedTo (that's for TaskMigrated only)
      expect(task!.migratedTo).toBeUndefined();
    });

    it('should distinguish between migration and movement', async () => {
      // Migration creates TWO tasks (original + new)
      // Movement keeps ONE task (same ID)
      
      // Test 1: Migration
      await createTaskHandler.handle({
        title: 'Task to migrate',
        collectionId: 'collection-a',
      });

      let tasks = await projection.getTasks();
      const task1Id = tasks[0]!.id;

      const migratedTaskId = await migrateTaskHandler.handle({
        taskId: task1Id,
        targetCollectionId: 'collection-b',
      });

      tasks = await projection.getTasks();
      expect(tasks).toHaveLength(2); // Original + migrated = 2 tasks
      expect(migratedTaskId).not.toBe(task1Id); // Different IDs

      // Test 2: Movement
      await createTaskHandler.handle({
        title: 'Task to move',
        collectionId: 'collection-c',
      });

      tasks = await projection.getTasks();
      const task2Id = tasks.find(t => t.title === 'Task to move')!.id;

      await moveHandler.handle({
        taskId: task2Id,
        currentCollectionId: 'collection-c',
        targetCollectionId: 'collection-d',
      });

      const movedTask = await projection.getTaskById(task2Id);
      expect(movedTask!.id).toBe(task2Id); // Same ID
      expect(movedTask!.collections).toEqual(['collection-d']);
    });
  });

  describe('Parent cascade migration with multi-collection', () => {
    it('should preserve migration pointers when parent and children are migrated', async () => {
      // This is the real-world scenario from Issue #2
      // When a parent is migrated, children follow via cascade
      // The cascade creates TaskMigrated events, which then trigger TaskAddedToCollection
      // The bug causes migration pointers to be lost
      
      // Arrange: Create parent with 2 children in Collection A
      await createTaskHandler.handle({
        title: 'Parent task',
        collectionId: 'collection-a',
      });

      const tasks = await projection.getTasks();
      const parentId = tasks[0]!.id;

      // Create sub-tasks (implementation detail: use CreateSubTaskCommand if available)
      // For now, we'll simulate by creating tasks with parentTaskId
      const { CreateSubTaskHandler } = await import('./sub-task.handlers');
      const createSubTaskHandler = new CreateSubTaskHandler(eventStore, null as any, projection);
      
      await createSubTaskHandler.handle({
        title: 'Child 1',
        parentTaskId: parentId,
      });

      await createSubTaskHandler.handle({
        title: 'Child 2',
        parentTaskId: parentId,
      });

      // Act: Migrate parent to Collection B (cascade should migrate children)
      const migratedParentId = await migrateTaskHandler.handle({
        taskId: parentId,
        targetCollectionId: 'collection-b',
      });

      // Assert: Original parent should have migratedTo pointer
      const originalParent = await projection.getTaskById(parentId);
      expect(originalParent!.migratedTo).toBe(migratedParentId);
      expect(originalParent!.migratedToCollectionId).toBe('collection-b');

      // Assert: Migrated parent should have migratedFrom pointer
      const migratedParent = await projection.getTaskById(migratedParentId);
      expect(migratedParent!.migratedFrom).toBe(parentId);
      expect(migratedParent!.migratedFromCollectionId).toBe('collection-a');

      // Assert: Children should also have migration pointers
      const allTasks = await projection.getTasks();
      const migratedChildren = allTasks.filter(t => 
        t.parentTaskId === migratedParentId && 
        t.collectionId === 'collection-b'
      );

      expect(migratedChildren).toHaveLength(2);
      
      for (const child of migratedChildren) {
        // Each migrated child should have migratedFrom pointing to original
        expect(child.migratedFrom).toBeDefined();
        expect(child.migratedFromCollectionId).toBe('collection-a');
        
        // Each migrated child should be in collection-b
        expect(child.collectionId).toBe('collection-b');
        expect(child.collections).toContain('collection-b');
      }
    });
  });
});
