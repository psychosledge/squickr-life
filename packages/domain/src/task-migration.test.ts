import { describe, it, expect, beforeEach } from 'vitest';
import { MigrateTaskHandler } from './task.handlers';
import { CreateTaskHandler } from './task.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { TaskListProjection } from './task.projections';
import { EntryListProjection } from './entry.projections';
import type { MigrateTaskCommand, TaskMigrated } from './task.types';

describe('MigrateTaskHandler', () => {
  let eventStore: IEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let handler: MigrateTaskHandler;
  let createTaskHandler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    handler = new MigrateTaskHandler(eventStore, entryProjection);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
  });

  describe('handle', () => {
    it('should create TaskMigrated event for valid task', async () => {
      // Create a task
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      // Migrate task to collection B
      const command: MigrateTaskCommand = {
        taskId,
        targetCollectionId: 'collection-B',
      };

      const newTaskId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // TaskCreated + TaskMigrated

      const migrateEvent = events[1] as TaskMigrated;
      expect(migrateEvent.type).toBe('TaskMigrated');
      expect(migrateEvent.payload.originalTaskId).toBe(taskId);
      expect(migrateEvent.payload.targetCollectionId).toBe('collection-B');
      expect(migrateEvent.payload.migratedToId).toBe(newTaskId);
      expect(migrateEvent.aggregateId).toBe(taskId);
    });

    it('should create new task in target collection with same title and status', async () => {
      // Create a completed task
      const taskId = await createTaskHandler.handle({ 
        title: 'Original task',
        collectionId: 'collection-A',
      });

      // Migrate to collection B
      const newTaskId = await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      // Verify new task has same properties
      const newTask = await entryProjection.getTaskById(newTaskId);
      const originalTask = await entryProjection.getTaskById(taskId);

      expect(newTask).toBeDefined();
      expect(newTask!.title).toBe(originalTask!.title);
      expect(newTask!.status).toBe(originalTask!.status);
      expect(newTask!.collectionId).toBe('collection-B');
      expect(newTask!.migratedFrom).toBe(taskId);
      expect(newTask!.id).not.toBe(taskId); // Different ID
    });

    it('should mark original task with migratedTo pointer', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      const newTaskId = await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      const originalTask = await entryProjection.getTaskById(taskId);
      expect(originalTask!.migratedTo).toBe(newTaskId);
    });

    it('should update original task collectionId to point to target collection', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      // Original task should still exist in its original collection
      // but have migratedToCollectionId set for "Go to" navigation
      const originalTask = await entryProjection.getTaskById(taskId);
      expect(originalTask).toBeDefined();
      expect(originalTask!.collectionId).toBe('collection-A'); // Stays in original collection
      expect(originalTask!.migratedToCollectionId).toBe('collection-B'); // Points to target
    });

    it('should throw error if task does not exist', async () => {
      const command: MigrateTaskCommand = {
        taskId: 'non-existent-task',
        targetCollectionId: 'collection-B',
      };

      await expect(handler.handle(command)).rejects.toThrow('Entry non-existent-task not found');
    });

    it('should throw error if task is already migrated', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      // Migrate once
      await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again
      await expect(handler.handle({
        taskId,
        targetCollectionId: 'collection-C',
      })).rejects.toThrow('Task has already been migrated');
    });

    it('should be idempotent - return existing migration if same target collection', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      // Migrate once
      const newTaskId1 = await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again to same collection
      const newTaskId2 = await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      expect(newTaskId1).toBe(newTaskId2);
      
      // Should only have 2 events (TaskCreated + TaskMigrated), not 3
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      const events = await eventStore.getAll();
      const migrateEvent = events[1] as TaskMigrated;

      expect(migrateEvent.id).toBeDefined();
      expect(migrateEvent.timestamp).toBeDefined();
      expect(migrateEvent.version).toBe(1);
      expect(migrateEvent.payload.migratedAt).toBe(migrateEvent.timestamp);
    });

    it('should allow migrating from uncategorized (null collection)', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Uncategorized task',
        // No collectionId
      });

      const newTaskId = await handler.handle({
        taskId,
        targetCollectionId: 'collection-B',
      });

      const newTask = await entryProjection.getTaskById(newTaskId);
      expect(newTask!.collectionId).toBe('collection-B');
      expect(newTask!.migratedFrom).toBe(taskId);
    });

    it('should allow migrating to uncategorized (null collection)', async () => {
      const taskId = await createTaskHandler.handle({ 
        title: 'Test task',
        collectionId: 'collection-A',
      });

      const newTaskId = await handler.handle({
        taskId,
        targetCollectionId: null,
      });

      const newTask = await entryProjection.getTaskById(newTaskId);
      expect(newTask!.collectionId).toBeUndefined();
      expect(newTask!.migratedFrom).toBe(taskId);
    });
  });
});
