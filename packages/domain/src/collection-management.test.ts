import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';
import {
  AddTaskToCollectionHandler,
  RemoveTaskFromCollectionHandler,
  MoveTaskToCollectionHandler,
} from './collection-management.handlers';

describe('Multi-Collection Management', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let addToCollectionHandler: AddTaskToCollectionHandler;
  let removeFromCollectionHandler: RemoveTaskFromCollectionHandler;
  let moveToCollectionHandler: MoveTaskToCollectionHandler;
  
  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, projection);
    addToCollectionHandler = new AddTaskToCollectionHandler(eventStore, projection);
    removeFromCollectionHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    moveToCollectionHandler = new MoveTaskToCollectionHandler(
      eventStore,
      addToCollectionHandler,
      projection
    );
  });
  
  describe('AddTaskToCollectionHandler', () => {
    it('should validate collectionId is not empty', async () => {
      // Arrange: Create a task
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Act & Assert: Reject empty collectionId
      await expect(
        addToCollectionHandler.handle({ 
          taskId, 
          collectionId: '' 
        })
      ).rejects.toThrow();
    });
    
    it('should add task to additional collection', async () => {
      // Create task in monthly-log
      const taskId = await createTaskHandler.handle({
        content: 'Write blog post',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Add to daily-log
      await addToCollectionHandler.handle({
        taskId,
        collectionId: 'daily-log',
      });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['monthly-log', 'daily-log']);
      expect(task?.collectionHistory).toHaveLength(2);
      expect(task?.collectionHistory?.[1]?.collectionId).toBe('daily-log');
      expect(task?.collectionHistory?.[1]?.removedAt).toBeUndefined();
    });
    
    it('should be idempotent (adding to same collection twice)', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['monthly-log', 'daily-log']);
      expect(task?.collectionHistory).toHaveLength(2);
    });
    
    it('should track collection history with timestamps', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collectionHistory?.[0]?.addedAt).toBeDefined();
      expect(task?.collectionHistory?.[1]?.addedAt).toBeDefined();
    });
  });
  
  describe('RemoveTaskFromCollectionHandler', () => {
    it('should validate collectionId is not empty', async () => {
      // Arrange: Create a task
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Act & Assert: Reject empty collectionId
      await expect(
        removeFromCollectionHandler.handle({ 
          taskId, 
          collectionId: '' 
        })
      ).rejects.toThrow();
    });
    
    it('should remove task from collection', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['daily-log']);
      expect(task?.collectionHistory?.[0]?.removedAt).toBeDefined();
    });
    
    it('should be idempotent (removing from same collection twice - both calls no-op if task not in collection)', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Add to a second collection so removal is allowed
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      // First removal succeeds
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      // Second removal is a no-op (task is no longer in monthly-log)
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['daily-log']);
    });
    
    it('should throw when removing task from its only collection (last-collection guard)', async () => {
      // Arrange: Create a task in a single collection
      const taskId = await createTaskHandler.handle({
        content: 'Orphan Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Act & Assert: Should throw instead of orphaning the task
      await expect(
        removeFromCollectionHandler.handle({ 
          taskId, 
          collectionId: 'monthly-log' 
        })
      ).rejects.toThrow('only collection');
      
      // Assert: Task still exists with its collection intact
      const task = await projection.getTaskById(taskId);
      expect(task).toBeDefined();
      expect(task?.collections).toEqual(['monthly-log']);
    });
    
    it('should allow re-adding task to collection it was previously removed from', async () => {
      // Arrange: Create task and add to a second collection so removal is allowed
      const taskId = await createTaskHandler.handle({
        content: 'Boomerang Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Add to a second collection first so we can remove from monthly-log
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      // Act: Remove from monthly-log (still has daily-log, so guard allows it)
      await removeFromCollectionHandler.handle({ 
        taskId, 
        collectionId: 'monthly-log' 
      });
      
      // Act: Re-add to same collection
      await addToCollectionHandler.handle({ 
        taskId, 
        collectionId: 'monthly-log' 
      });
      
      // Assert: Task is in both collections
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(expect.arrayContaining(['monthly-log', 'daily-log']));
      
      // Assert: Collection history has 3 entries (monthly-log added, daily-log added, monthly-log re-added)
      expect(task?.collectionHistory).toHaveLength(3);
      
      // Assert: First monthly-log entry has removedAt timestamp
      const firstMonthly = task?.collectionHistory?.find(h => h.collectionId === 'monthly-log' && h.removedAt);
      expect(firstMonthly?.removedAt).toBeDefined();
      
      // Assert: Second monthly-log entry is currently active (no removedAt)
      const activeMonthly = task?.collectionHistory?.filter(h => h.collectionId === 'monthly-log').pop();
      expect(activeMonthly?.removedAt).toBeUndefined();
    });

    it('should allow removing sub-task from one of multiple collections (Bug #7)', async () => {
      // Arrange: Create parent task in monthly-log
      const parentId = await createTaskHandler.handle({
        content: 'Parent Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });

      // Create sub-task (inherits monthly-log from parent)
      const subTaskId = await createSubTaskHandler.handle({
        content: 'Sub Task',
        parentEntryId: parentId,
        collectionId: 'monthly-log',
        userId: 'user-1',
      });

      // Add sub-task to daily-log (now it is in monthly-log AND daily-log)
      await addToCollectionHandler.handle({ taskId: subTaskId, collectionId: 'daily-log' });

      // Act: Remove sub-task from daily-log (it still has monthly-log, so guard allows it)
      await removeFromCollectionHandler.handle({
        taskId: subTaskId,
        collectionId: 'daily-log',
      });

      // Assert: Sub-task is now only in monthly-log
      const subTask = await projection.getTaskById(subTaskId);
      expect(subTask?.collections).toEqual(['monthly-log']);

      // Assert: A TaskRemovedFromCollection event was emitted
      const allEvents = await eventStore.getAll();
      const removedEvent = allEvents.find(
        e => e.type === 'TaskRemovedFromCollection' && (e as any).payload?.taskId === subTaskId
      );
      expect(removedEvent).toBeDefined();
      expect((removedEvent as any).payload.collectionId).toBe('daily-log');
    });

    it('should throw when removing sub-task from its only collection (last-collection guard)', async () => {
      // Arrange: Create parent task in monthly-log
      const parentId = await createTaskHandler.handle({
        content: 'Parent Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });

      // Create sub-task (inherits monthly-log — it is in exactly one collection)
      const subTaskId = await createSubTaskHandler.handle({
        content: 'Sub Task',
        parentEntryId: parentId,
        collectionId: 'monthly-log',
        userId: 'user-1',
      });

      // Act & Assert: Should throw instead of orphaning the sub-task
      await expect(
        removeFromCollectionHandler.handle({
          taskId: subTaskId,
          collectionId: 'monthly-log',
        })
      ).rejects.toThrow('only collection');

      // Assert: Sub-task still belongs to monthly-log
      const subTask = await projection.getTaskById(subTaskId);
      expect(subTask?.collections).toEqual(['monthly-log']);
    });
  });
  
  describe('MoveTaskToCollectionHandler', () => {
    it('should move task from one collection to another', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await moveToCollectionHandler.handle({
        taskId,
        currentCollectionId: 'monthly-log',
        targetCollectionId: 'daily-log',
      });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['daily-log']);
      expect(task?.collectionHistory?.[0]?.removedAt).toBeDefined();
      expect(task?.collectionHistory?.[1]?.collectionId).toBe('daily-log');
    });
    
    it('should remove from current collection only when moving (not all collections)', async () => {
      // Setup: Task in multiple collections
      const taskId = await createTaskHandler.handle({
        content: 'Multi-collection task',
        collectionId: 'collection-a',
        userId: 'user-1',
      });
      await addToCollectionHandler.handle({ taskId, collectionId: 'collection-b' });
      await addToCollectionHandler.handle({ taskId, collectionId: 'collection-c' });
      
      // Task should be in A, B, C
      let task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(expect.arrayContaining(['collection-a', 'collection-b', 'collection-c']));
      
      // Move from B to D (should remove from B only)
      await moveToCollectionHandler.handle({ 
        taskId, 
        currentCollectionId: 'collection-b',
        targetCollectionId: 'collection-d' 
      });
      
      // Task should now be in A, C, D (not B)
      task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(expect.arrayContaining(['collection-a', 'collection-c', 'collection-d']));
      expect(task?.collections).not.toContain('collection-b');
      expect(task?.collections).toHaveLength(3);
      
      // Verify collectionHistory
      expect(task?.collectionHistory).toHaveLength(4); // A, B (removed), C, D
      const historyB = task?.collectionHistory?.find(h => h.collectionId === 'collection-b' && h.removedAt);
      expect(historyB?.removedAt).toBeDefined(); // B should be marked as removed
    });
    
    it('should move task from multiple collections to one (legacy test - now deprecated)', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      await addToCollectionHandler.handle({ taskId, collectionId: 'work-projects' });
      
      // Move from monthly-log to archive (removes from monthly-log only)
      await moveToCollectionHandler.handle({
        taskId,
        currentCollectionId: 'monthly-log',
        targetCollectionId: 'archive',
      });
      
      const task = await projection.getTaskById(taskId);
      // Should be in daily-log, work-projects, and archive (not monthly-log)
      expect(task?.collections).toEqual(expect.arrayContaining(['daily-log', 'work-projects', 'archive']));
      expect(task?.collections).not.toContain('monthly-log');
    });
    
    // Edge case tests for validation
    it('should throw error if currentCollectionId is empty', async () => {
      await expect(
        moveToCollectionHandler.handle({
          taskId: 'any-id',
          currentCollectionId: '',
          targetCollectionId: 'collection-a',
        })
      ).rejects.toThrow('Current collection ID cannot be empty');
    });
    
    it('should throw error if targetCollectionId is empty', async () => {
      await expect(
        moveToCollectionHandler.handle({
          taskId: 'any-id',
          currentCollectionId: 'collection-a',
          targetCollectionId: '',
        })
      ).rejects.toThrow('Target collection ID cannot be empty');
    });
    
    it('should throw error if task not in current collection', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task in A',
        collectionId: 'collection-a',
        userId: 'user-1',
      });
      
      await expect(
        moveToCollectionHandler.handle({
          taskId,
          currentCollectionId: 'collection-b', // Task NOT in B
          targetCollectionId: 'collection-c',
        })
      ).rejects.toThrow('not in collection');
    });
    
    it('should be idempotent when moving to same collection', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'collection-a',
        userId: 'user-1',
      });
      
      // Move from A to A (no-op)
      await moveToCollectionHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-a',
      });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['collection-a']);
      expect(task?.collectionHistory).toHaveLength(1); // No duplicate history
    });
  });
  
  describe('getEntriesForCollectionView (Ghost Rendering)', () => {
    it('should return active entries in collection', async () => {
      const task1 = await createTaskHandler.handle({
        content: 'Task 1',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await createTaskHandler.handle({
        content: 'Task 2',
        collectionId: 'daily-log',
        userId: 'user-1',
      });
      
      const entries = await projection.getEntriesForCollectionView('monthly-log');
      
      expect(entries).toHaveLength(1);
      expect(entries[0]!.id).toBe(task1);
      expect((entries[0] as any).renderAsGhost).toBe(false);
    });
    
    it('should return ghost entries that were removed from collection', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Move to daily-log from monthly-log
      await moveToCollectionHandler.handle({
        taskId,
        currentCollectionId: 'monthly-log',
        targetCollectionId: 'daily-log',
      });
      
      // Monthly log should show ghost
      const monthlyEntries = await projection.getEntriesForCollectionView('monthly-log');
      expect(monthlyEntries).toHaveLength(1);
      expect((monthlyEntries[0] as any).renderAsGhost).toBe(true);
      expect((monthlyEntries[0] as any).ghostNewLocation).toBe('daily-log');
      
      // Daily log should show active
      const dailyEntries = await projection.getEntriesForCollectionView('daily-log');
      expect(dailyEntries).toHaveLength(1);
      expect((dailyEntries[0] as any).renderAsGhost).toBe(false);
    });
    
    it('should not show ghost if task was never in collection', async () => {
      await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Daily log should be empty (no ghost)
      const dailyEntries = await projection.getEntriesForCollectionView('daily-log');
      expect(dailyEntries).toHaveLength(0);
    });
    
    it('should show task in multiple collections (multi-collection presence)', async () => {
      const taskId = await createTaskHandler.handle({
        content: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      const monthlyEntries = await projection.getEntriesForCollectionView('monthly-log');
      const dailyEntries = await projection.getEntriesForCollectionView('daily-log');
      
      expect(monthlyEntries).toHaveLength(1);
      expect((monthlyEntries[0] as any).renderAsGhost).toBe(false);
      
      expect(dailyEntries).toHaveLength(1);
      expect((dailyEntries[0] as any).renderAsGhost).toBe(false);
      
      // Same task ID in both
      expect(monthlyEntries[0]!.id).toBe(dailyEntries[0]!.id);
    });
  });
});
