import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import {
  AddTaskToCollectionHandler,
  RemoveTaskFromCollectionHandler,
  MoveTaskToCollectionHandler,
} from './collection-management.handlers';

describe('Multi-Collection Management', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let addToCollectionHandler: AddTaskToCollectionHandler;
  let removeFromCollectionHandler: RemoveTaskFromCollectionHandler;
  let moveToCollectionHandler: MoveTaskToCollectionHandler;
  
  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, null as any, projection);
    addToCollectionHandler = new AddTaskToCollectionHandler(eventStore, projection);
    removeFromCollectionHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    moveToCollectionHandler = new MoveTaskToCollectionHandler(
      addToCollectionHandler,
      removeFromCollectionHandler,
      projection
    );
  });
  
  describe('AddTaskToCollectionHandler', () => {
    it('should validate collectionId is not empty', async () => {
      // Arrange: Create a task
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
        title: 'Write blog post',
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
      expect(task?.collectionHistory?.[1].collectionId).toBe('daily-log');
      expect(task?.collectionHistory?.[1].removedAt).toBeUndefined();
    });
    
    it('should be idempotent (adding to same collection twice)', async () => {
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
        title: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collectionHistory?.[0].addedAt).toBeDefined();
      expect(task?.collectionHistory?.[1].addedAt).toBeDefined();
    });
  });
  
  describe('RemoveTaskFromCollectionHandler', () => {
    it('should validate collectionId is not empty', async () => {
      // Arrange: Create a task
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
        title: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await addToCollectionHandler.handle({ taskId, collectionId: 'daily-log' });
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['daily-log']);
      expect(task?.collectionHistory?.[0].removedAt).toBeDefined();
    });
    
    it('should be idempotent (removing from same collection twice)', async () => {
      const taskId = await createTaskHandler.handle({
        title: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      await removeFromCollectionHandler.handle({ taskId, collectionId: 'monthly-log' });
      
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual([]);
    });
    
    it('should allow orphaning (removing from last collection)', async () => {
      // Arrange: Create a task in a single collection
      const taskId = await createTaskHandler.handle({
        title: 'Orphan Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Act: Remove from only collection
      await removeFromCollectionHandler.handle({ 
        taskId, 
        collectionId: 'monthly-log' 
      });
      
      // Assert: Task still exists with empty collections array
      const task = await projection.getTaskById(taskId);
      expect(task).toBeDefined();
      expect(task?.collections).toEqual([]);
      
      // Assert: Collection history tracked with removedAt
      expect(task?.collectionHistory).toHaveLength(1);
      expect(task?.collectionHistory?.[0].collectionId).toBe('monthly-log');
      expect(task?.collectionHistory?.[0].removedAt).toBeDefined();
    });
    
    it('should allow re-adding task to collection it was previously removed from', async () => {
      // Arrange: Create task and add to collection
      const taskId = await createTaskHandler.handle({
        title: 'Boomerang Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Act: Remove from collection
      await removeFromCollectionHandler.handle({ 
        taskId, 
        collectionId: 'monthly-log' 
      });
      
      // Act: Re-add to same collection
      await addToCollectionHandler.handle({ 
        taskId, 
        collectionId: 'monthly-log' 
      });
      
      // Assert: Task is back in collection
      const task = await projection.getTaskById(taskId);
      expect(task?.collections).toEqual(['monthly-log']);
      
      // Assert: Collection history has 2 entries
      expect(task?.collectionHistory).toHaveLength(2);
      
      // Assert: First entry has removedAt timestamp
      expect(task?.collectionHistory?.[0].collectionId).toBe('monthly-log');
      expect(task?.collectionHistory?.[0].removedAt).toBeDefined();
      
      // Assert: Second entry is currently active (no removedAt)
      expect(task?.collectionHistory?.[1].collectionId).toBe('monthly-log');
      expect(task?.collectionHistory?.[1].removedAt).toBeUndefined();
    });
  });
  
  describe('MoveTaskToCollectionHandler', () => {
    it('should move task from one collection to another', async () => {
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
      expect(task?.collectionHistory?.[0].removedAt).toBeDefined();
      expect(task?.collectionHistory?.[1].collectionId).toBe('daily-log');
    });
    
    it('should remove from current collection only when moving (not all collections)', async () => {
      // Setup: Task in multiple collections
      const taskId = await createTaskHandler.handle({
        title: 'Multi-collection task',
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
        title: 'Task',
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
        title: 'Task in A',
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
        title: 'Task',
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
        title: 'Task 1',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      const task2 = await createTaskHandler.handle({
        title: 'Task 2',
        collectionId: 'daily-log',
        userId: 'user-1',
      });
      
      const entries = await projection.getEntriesForCollectionView('monthly-log');
      
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(task1);
      expect((entries[0] as any).renderAsGhost).toBe(false);
    });
    
    it('should return ghost entries that were removed from collection', async () => {
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
      const taskId = await createTaskHandler.handle({
        title: 'Task',
        collectionId: 'monthly-log',
        userId: 'user-1',
      });
      
      // Daily log should be empty (no ghost)
      const dailyEntries = await projection.getEntriesForCollectionView('daily-log');
      expect(dailyEntries).toHaveLength(0);
    });
    
    it('should show task in multiple collections (multi-collection presence)', async () => {
      const taskId = await createTaskHandler.handle({
        title: 'Task',
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
      expect(monthlyEntries[0].id).toBe(dailyEntries[0].id);
    });
  });
});
