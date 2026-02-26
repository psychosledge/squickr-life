/**
 * Tests for MoveParentTaskHandler (Phase 3: Parent Migration Cascade)
 * 
 * Test Strategy (TDD RED phase):
 * - Write tests that will fail initially
 * - Then implement handler to make them pass (GREEN phase)
 * - Then refactor (REFACTOR phase)
 * 
 * Test scenarios:
 * - Parent migrates → no children (standard migration)
 * - Parent migrates → all children unmigrated (all follow)
 * - Parent migrates → all children migrated (none follow)  
 * - Parent migrates → mixed (some follow, some stay)
 * - Edge cases: task not found, idempotency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MoveEntryToCollectionHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';
import type { MoveEntryToCollectionCommand, EntryMovedToCollection } from './task.types';

// Import the handler we're testing (will be implemented in GREEN phase)
import { MoveParentTaskHandler } from './move-parent-task.handler';

describe('MoveParentTaskHandler (Phase 3: Parent Migration Cascade)', () => {
  let eventStore: InMemoryEventStore;
  let taskProjection: TaskListProjection;
  let projection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let moveParentTaskHandler: MoveParentTaskHandler;
  let moveEntryHandler: MoveEntryToCollectionHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    projection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, projection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, projection);
    moveParentTaskHandler = new MoveParentTaskHandler(eventStore, projection);
    moveEntryHandler = new MoveEntryToCollectionHandler(eventStore, projection);
  });

  describe('Parent with no children', () => {
    it('should migrate parent task as standard migration (no cascade)', async () => {
      // Arrange: Create parent task in collection-1
      await createTaskHandler.handle({ 
        title: 'Parent task',
        collectionId: 'collection-1'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Migrate parent to collection-2
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: 'collection-2'
      });

      // Assert: Only 1 new EntryMovedToCollection event (for parent)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(1);
      expect(moveEvents[0]!.aggregateId).toBe(parent.id);
      expect(moveEvents[0]!.payload.collectionId).toBe('collection-2');

      // Verify projection state
      const updatedTasks = await projection.getTasks();
      const updatedParent = updatedTasks.find(t => t.id === parent.id)!;
      expect(updatedParent.collectionId).toBe('collection-2');
    });
  });

  describe('Parent with all children unmigrated (same collection)', () => {
    it('should cascade migrate all children when parent migrates', async () => {
      // Arrange: Create parent + 3 children in 'work-projects'
      await createTaskHandler.handle({ 
        title: 'App launch',
        collectionId: 'work-projects'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      await createSubTaskHandler.handle({ 
        title: 'Set up analytics',
        parentEntryId: parent.id
      });
      await createSubTaskHandler.handle({ 
        title: 'Deploy to production',
        parentEntryId: parent.id
      });
      await createSubTaskHandler.handle({ 
        title: 'Update documentation',
        parentEntryId: parent.id
      });

      // Verify all in same collection
      const allTasks = await projection.getTasks();
      const children = allTasks.filter(t => t.parentEntryId === parent.id);
      expect(children).toHaveLength(3);
      expect(children.every(c => c.collectionId === 'work-projects')).toBe(true);

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Migrate parent to 'monthly-2026-02'
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: 'monthly-2026-02'
      });

      // Assert: 4 EntryMovedToCollection events (parent + 3 children)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(4);
      
      // Parent moved
      const parentMoveEvent = moveEvents.find(e => e.aggregateId === parent.id);
      expect(parentMoveEvent).toBeDefined();
      expect(parentMoveEvent!.payload.collectionId).toBe('monthly-2026-02');
      
      // All 3 children moved
      const childMoveEvents = moveEvents.filter(e => e.aggregateId !== parent.id);
      expect(childMoveEvents).toHaveLength(3);
      childMoveEvents.forEach(event => {
        expect(event.payload.collectionId).toBe('monthly-2026-02');
      });

      // Verify projection state - all tasks now in 'monthly-2026-02'
      const updatedTasks = await projection.getTasks();
      const updatedParent = updatedTasks.find(t => t.id === parent.id)!;
      const updatedChildren = updatedTasks.filter(t => t.parentEntryId === parent.id);
      
      expect(updatedParent.collectionId).toBe('monthly-2026-02');
      expect(updatedChildren).toHaveLength(3);
      expect(updatedChildren.every(c => c.collectionId === 'monthly-2026-02')).toBe(true);
    });
  });

  describe('Parent with all children migrated (different collections)', () => {
    it('should cascade ALL children when parent migrates (including previously migrated)', async () => {
      // Arrange: Create parent in 'collection-1'
      await createTaskHandler.handle({ 
        title: 'Parent task',
        collectionId: 'collection-1'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      // Create 2 children
      await createSubTaskHandler.handle({ 
        title: 'Child 1',
        parentEntryId: parent.id
      });
      await createSubTaskHandler.handle({ 
        title: 'Child 2',
        parentEntryId: parent.id
      });

      const allTasks = await projection.getTasks();
      const children = allTasks.filter(t => t.parentEntryId === parent.id);

      // Manually migrate children to different collections (Phase 2 individual migration)
      await moveEntryHandler.handle({ 
        entryId: children[0]!.id, 
        collectionId: 'daily-2026-02-11' 
      });
      await moveEntryHandler.handle({ 
        entryId: children[1]!.id, 
        collectionId: 'daily-2026-02-12' 
      });

      // Verify children are in different collections
      const preMigrateTasks = await projection.getTasks();
      const child1 = preMigrateTasks.find(t => t.id === children[0]!.id)!;
      const child2 = preMigrateTasks.find(t => t.id === children[1]!.id)!;
      expect(child1.collectionId).toBe('daily-2026-02-11');
      expect(child2.collectionId).toBe('daily-2026-02-12');

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Migrate parent to 'collection-2'
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: 'collection-2'
      });

      // Assert: 3 EntryMovedToCollection events (parent + ALL children)
      // Children belong to parent, not collection - ALL children follow
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(3); // Parent + BOTH children
      expect(moveEvents[0]!.aggregateId).toBe(parent.id);
      expect(moveEvents[0]!.payload.collectionId).toBe('collection-2');

      // Verify ALL children followed parent to collection-2
      const finalTasks = await projection.getTasks();
      const finalChild1 = finalTasks.find(t => t.id === children[0]!.id)!;
      const finalChild2 = finalTasks.find(t => t.id === children[1]!.id)!;
      expect(finalChild1.collectionId).toBe('collection-2'); // Followed parent
      expect(finalChild2.collectionId).toBe('collection-2'); // Followed parent
    });
  });

  describe('Parent with mixed children (some migrated, some not)', () => {
    it('should cascade ALL children when parent migrates (including previously migrated)', async () => {
      // Arrange: Create parent in 'work-projects'
      await createTaskHandler.handle({ 
        title: 'App launch',
        collectionId: 'work-projects'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      // Create 3 children
      await createSubTaskHandler.handle({ 
        title: 'Set up analytics',
        parentEntryId: parent.id
      });
      await createSubTaskHandler.handle({ 
        title: 'Write blog post',
        parentEntryId: parent.id
      });
      await createSubTaskHandler.handle({ 
        title: 'Deploy to production',
        parentEntryId: parent.id
      });

      const allTasks = await projection.getTasks();
      const children = allTasks.filter(t => t.parentEntryId === parent.id);
      expect(children).toHaveLength(3);

      // Migrate 1 child to different collection (Phase 2 individual migration)
      const blogPostChild = children.find(c => c.title === 'Write blog post')!;
      await moveEntryHandler.handle({ 
        entryId: blogPostChild.id, 
        collectionId: 'daily-2026-02-11' 
      });

      // Verify state before parent migration
      const preMoveTasks = await projection.getTasks();
      const preParent = preMoveTasks.find(t => t.id === parent.id)!;
      const preChildren = preMoveTasks.filter(t => t.parentEntryId === parent.id);
      
      expect(preParent.collectionId).toBe('work-projects');
      
      const analyticsChild = preChildren.find(c => c.title === 'Set up analytics')!;
      const blogChild = preChildren.find(c => c.title === 'Write blog post')!;
      const deployChild = preChildren.find(c => c.title === 'Deploy to production')!;
      
      expect(analyticsChild.collectionId).toBe('work-projects'); // Unmigrated
      expect(blogChild.collectionId).toBe('daily-2026-02-11'); // Migrated
      expect(deployChild.collectionId).toBe('work-projects'); // Unmigrated

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Migrate parent to 'monthly-2026-02'
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: 'monthly-2026-02'
      });

      // Assert: 4 EntryMovedToCollection events (parent + ALL 3 children)
      // Children belong to parent, not collection - ALL children follow
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(4); // Parent + ALL 3 children
      
      // Parent moved
      const parentMoveEvent = moveEvents.find(e => e.aggregateId === parent.id);
      expect(parentMoveEvent).toBeDefined();
      expect(parentMoveEvent!.payload.collectionId).toBe('monthly-2026-02');
      
      // ALL 3 children moved
      const childMoveEvents = moveEvents.filter(e => e.aggregateId !== parent.id);
      expect(childMoveEvents).toHaveLength(3);
      expect(childMoveEvents.some(e => e.aggregateId === analyticsChild.id)).toBe(true);
      expect(childMoveEvents.some(e => e.aggregateId === deployChild.id)).toBe(true);
      expect(childMoveEvents.some(e => e.aggregateId === blogChild.id)).toBe(true); // Now included!

      // Verify final state - ALL children in monthly-2026-02
      const finalTasks = await projection.getTasks();
      const finalParent = finalTasks.find(t => t.id === parent.id)!;
      const finalChildren = finalTasks.filter(t => t.parentEntryId === parent.id);
      
      expect(finalParent.collectionId).toBe('monthly-2026-02');
      
      const finalAnalytics = finalChildren.find(c => c.title === 'Set up analytics')!;
      const finalBlog = finalChildren.find(c => c.title === 'Write blog post')!;
      const finalDeploy = finalChildren.find(c => c.title === 'Deploy to production')!;
      
      expect(finalAnalytics.collectionId).toBe('monthly-2026-02'); // Followed parent ✅
      expect(finalBlog.collectionId).toBe('monthly-2026-02'); // Followed parent (even though previously migrated) ✅
      expect(finalDeploy.collectionId).toBe('monthly-2026-02'); // Followed parent ✅
    });
  });

  describe('Edge cases', () => {
    it('should throw error if entry does not exist', async () => {
      // Act & Assert
      await expect(
        moveParentTaskHandler.handle({
          entryId: 'non-existent-task-id',
          collectionId: 'collection-2'
        })
      ).rejects.toThrow('Entry non-existent-task-id not found');
    });

    it('should be idempotent: no events if parent already in target collection', async () => {
      // Arrange: Create parent in 'collection-1'
      await createTaskHandler.handle({ 
        title: 'Parent task',
        collectionId: 'collection-1'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Move parent to 'collection-1' (already there)
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: 'collection-1'
      });

      // Assert: No new events created
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      expect(newEvents).toHaveLength(0);
    });

    it('should support moving to null collection (uncategorized)', async () => {
      // Arrange: Create parent + child in 'collection-1'
      await createTaskHandler.handle({ 
        title: 'Parent task',
        collectionId: 'collection-1'
      });
      
      const tasks = await projection.getTasks();
      const parent = tasks[0]!;

      await createSubTaskHandler.handle({ 
        title: 'Child task',
        parentEntryId: parent.id
      });

      const eventCountBefore = (await eventStore.getAll()).length;

      // Act: Move parent to null (uncategorized)
      await moveParentTaskHandler.handle({
        entryId: parent.id,
        collectionId: null
      });

      // Assert: 2 events (parent + child)
      const allEvents = await eventStore.getAll();
      const newEvents = allEvents.slice(eventCountBefore);
      const moveEvents = newEvents.filter(e => e.type === 'EntryMovedToCollection') as EntryMovedToCollection[];
      
      expect(moveEvents).toHaveLength(2);
      expect(moveEvents.every(e => e.payload.collectionId === null)).toBe(true);
    });
  });
});
