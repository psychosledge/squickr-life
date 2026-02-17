import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler } from './task.handlers';
import { 
  AddTaskToCollectionHandler, 
  RemoveTaskFromCollectionHandler,
  MoveTaskToCollectionHandler 
} from './collection-management.handlers';
import { BulkMigrateEntriesHandler } from './bulk-migrate-entries.handler';
import type { Task, TaskAddedToCollection, TaskRemovedFromCollection } from './task.types';
import type { DomainEvent } from './domain-event';

/**
 * Phase 4: Multi-Collection Integration Tests
 * 
 * These tests verify the complete end-to-end flow of the multi-collection fix
 * across the full stack (domain handlers → projections → event store).
 * 
 * Core Issue #7G: Tasks were being MIGRATED (creating new IDs) instead of MOVED (preserving IDs)
 * 
 * What We Fixed:
 * 1. Move semantics now remove from current collection only (not all)
 * 2. BulkMigrateEntriesHandler uses multi-collection pattern (no TaskMigrated events)
 * 3. Task IDs are preserved throughout migration
 * 4. Full collectionHistory is maintained
 */
describe('Multi-Collection Integration Tests', () => {
  let eventStore: InMemoryEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let addHandler: AddTaskToCollectionHandler;
  let removeHandler: RemoveTaskFromCollectionHandler;
  let moveHandler: MoveTaskToCollectionHandler;
  let bulkMigrateHandler: BulkMigrateEntriesHandler;
  
  beforeEach(() => {
    // Setup fresh event store and projections for each test
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    
    // Setup handlers
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
    addHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);
    removeHandler = new RemoveTaskFromCollectionHandler(eventStore, entryProjection);
    moveHandler = new MoveTaskToCollectionHandler(addHandler, removeHandler, entryProjection);
    bulkMigrateHandler = new BulkMigrateEntriesHandler(eventStore, entryProjection);
  });

  /**
   * Test Scenario 1: Task Migration Preserves ID (Core Issue #7G)
   * 
   * This is the CORE regression test for Issue #7G.
   * 
   * Previously: migrate created NEW task ID (TaskMigrated event)
   * Now: migrate PRESERVES task ID (TaskAddedToCollection + TaskRemovedFromCollection)
   */
  describe('Scenario 1: Task Migration Preserves ID (Issue #7G)', () => {
    it('should preserve task ID when migrating with mode=move', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Find eye doctor',
        collectionId: 'monthly-2026-01',
      });

      // Act: Migrate to Collection B using bulk migrate (mode='move')
      await bulkMigrateHandler.handle({
        entryIds: [taskId],
        sourceCollectionId: 'monthly-2026-01',
        targetCollectionId: 'daily-2026-01-14',
        mode: 'move',
      });

      // Assert: Task ID is preserved (same ID in both collections)
      const taskInB = await entryProjection.getTaskById(taskId);
      expect(taskInB).toBeDefined();
      expect(taskInB!.id).toBe(taskId); // SAME ID (not a new UUID)

      // Assert: Task is active in Collection B
      expect(taskInB!.collections).toContain('daily-2026-01-14');
      
      // Assert: Task is a ghost in Collection A (removed)
      expect(taskInB!.collections).not.toContain('monthly-2026-01');
      
      // Assert: NO TaskMigrated events were generated
      const allEvents = await eventStore.getAll();
      const taskMigratedEvents = allEvents.filter(e => e.type === 'TaskMigrated');
      expect(taskMigratedEvents).toHaveLength(0);
      
      // Assert: TaskAddedToCollection and TaskRemovedFromCollection events exist
      const addedEvents = allEvents.filter(
        e => e.type === 'TaskAddedToCollection'
      ) as TaskAddedToCollection[];
      const removedEvents = allEvents.filter(
        e => e.type === 'TaskRemovedFromCollection'
      ) as TaskRemovedFromCollection[];
      
      expect(addedEvents).toHaveLength(1);
      expect(addedEvents[0]!.payload.taskId).toBe(taskId);
      expect(addedEvents[0]!.payload.collectionId).toBe('daily-2026-01-14');
      
      expect(removedEvents).toHaveLength(1);
      expect(removedEvents[0]!.payload.taskId).toBe(taskId);
      expect(removedEvents[0]!.payload.collectionId).toBe('monthly-2026-01');
    });

    it('should NOT have migratedTo pointer (tasks preserve same ID)', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to migrate',
        collectionId: 'collection-a',
      });

      // Act: Migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: [taskId],
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: Task does NOT have migratedTo (legacy migration pointer)
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.migratedTo).toBeUndefined(); // No migratedTo (same ID preserved)
    });
  });

  /**
   * Test Scenario 2: Collection History Preservation (Core Issue #7G)
   * 
   * The user's "Find eye doctor" task only showed 1 entry in collectionHistory.
   * Expected: 3 entries (Monthly created, Yesterday added then removed, Today added)
   */
  describe('Scenario 2: Collection History Preservation (Issue #7G)', () => {
    it('should maintain full collection history across multiple migrations', async () => {
      // Arrange: Create task in Collection A (Monthly)
      const taskId = await createTaskHandler.handle({
        title: 'Find eye doctor',
        collectionId: 'monthly-2026-01',
      });

      // Act 1: Add to Collection B (Yesterday) - mode='add' for multi-collection
      await addHandler.handle({
        taskId,
        collectionId: 'daily-2026-01-14',
      });

      // Act 2: Move from Collection A to Collection C (Today) - mode='move'
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'monthly-2026-01',
        targetCollectionId: 'daily-2026-01-15',
      });

      // Assert: Task has 3 collectionHistory entries
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collectionHistory).toHaveLength(3);

      // Assert: Collection A (Monthly) - has addedAt and removedAt
      const monthlyHistory = task!.collectionHistory!.find(
        h => h.collectionId === 'monthly-2026-01'
      );
      expect(monthlyHistory).toBeDefined();
      expect(monthlyHistory!.addedAt).toBeDefined();
      expect(monthlyHistory!.removedAt).toBeDefined(); // Removed when moved to Today

      // Assert: Collection B (Yesterday) - has addedAt only (still active)
      const yesterdayHistory = task!.collectionHistory!.find(
        h => h.collectionId === 'daily-2026-01-14'
      );
      expect(yesterdayHistory).toBeDefined();
      expect(yesterdayHistory!.addedAt).toBeDefined();
      expect(yesterdayHistory!.removedAt).toBeUndefined(); // Still in this collection

      // Assert: Collection C (Today) - has addedAt only (still active)
      const todayHistory = task!.collectionHistory!.find(
        h => h.collectionId === 'daily-2026-01-15'
      );
      expect(todayHistory).toBeDefined();
      expect(todayHistory!.addedAt).toBeDefined();
      expect(todayHistory!.removedAt).toBeUndefined(); // Still in this collection

      // Assert: Task appears in B and C, ghost in A
      expect(task!.collections).toContain('daily-2026-01-14'); // Yesterday (active)
      expect(task!.collections).toContain('daily-2026-01-15'); // Today (active)
      expect(task!.collections).not.toContain('monthly-2026-01'); // Monthly (ghost)
    });

    it('should render as ghost in removed collection with ghostNewLocation', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to move',
        collectionId: 'collection-a',
      });

      // Act: Move to Collection B
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
      });

      // Assert: Ghost entry in Collection A
      const entriesInA = await entryProjection.getEntriesForCollectionView('collection-a');
      expect(entriesInA).toHaveLength(1);
      
      const ghostEntry = entriesInA[0] as any;
      expect(ghostEntry.renderAsGhost).toBe(true);
      expect(ghostEntry.ghostNewLocation).toBe('collection-b');
      expect(ghostEntry.id).toBe(taskId);

      // Assert: Real entry in Collection B
      const entriesInB = await entryProjection.getEntriesForCollectionView('collection-b');
      expect(entriesInB).toHaveLength(1);
      
      const realEntry = entriesInB[0] as Task;
      expect((realEntry as any).renderAsGhost).toBeFalsy(); // Not a ghost
      expect(realEntry.id).toBe(taskId); // Same task ID
    });
  });

  /**
   * Test Scenario 3: Move Mode Removes From Current Collection Only
   * 
   * This verifies the Phase 1 fix: move should remove from CURRENT collection only,
   * not all collections.
   */
  describe('Scenario 3: Move Mode Removes From Current Collection Only', () => {
    it('should remove from current collection only when moving (not all collections)', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Multi-collection task',
        collectionId: 'collection-a',
      });

      // Act 1: Add to Collection B (mode='add') → task in [A, B]
      await addHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Verify task is in both A and B
      let task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toContain('collection-a');
      expect(task!.collections).toContain('collection-b');
      expect(task!.collections).toHaveLength(2);

      // Act 2: Move from A to Collection C (mode='move') → should be [B, C], NOT just [C]
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-c',
      });

      // Assert: Task is in B and C (NOT just C)
      task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toContain('collection-b'); // Still in B!
      expect(task!.collections).toContain('collection-c'); // Added to C
      expect(task!.collections).not.toContain('collection-a'); // Removed from A only
      expect(task!.collections).toHaveLength(2);

      // Assert: Task is ghost in A, active in B and C
      const entriesInA = await entryProjection.getEntriesForCollectionView('collection-a');
      const entriesInB = await entryProjection.getEntriesForCollectionView('collection-b');
      const entriesInC = await entryProjection.getEntriesForCollectionView('collection-c');

      expect(entriesInA).toHaveLength(1);
      expect((entriesInA[0] as any).renderAsGhost).toBe(true);

      expect(entriesInB).toHaveLength(1);
      expect((entriesInB[0] as any).renderAsGhost).toBeFalsy();

      expect(entriesInC).toHaveLength(1);
      expect((entriesInC[0] as any).renderAsGhost).toBeFalsy();
    });

    it('should have 3 collectionHistory entries after move (A → add B → move A to C)', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Multi-collection task',
        collectionId: 'collection-a',
      });

      // Act 1: Add to Collection B
      await addHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Act 2: Move from A to C
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-c',
      });

      // Assert: Collection history shows all 3 collections
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collectionHistory).toHaveLength(3);

      // A: removed
      const historyA = task!.collectionHistory!.find(h => h.collectionId === 'collection-a');
      expect(historyA!.removedAt).toBeDefined();

      // B: still active
      const historyB = task!.collectionHistory!.find(h => h.collectionId === 'collection-b');
      expect(historyB!.removedAt).toBeUndefined();

      // C: active
      const historyC = task!.collectionHistory!.find(h => h.collectionId === 'collection-c');
      expect(historyC!.removedAt).toBeUndefined();
    });
  });

  /**
   * Test Scenario 4: Add Mode Preserves All Collections
   * 
   * This verifies that 'add' mode doesn't remove from any collections.
   */
  describe('Scenario 4: Add Mode Preserves All Collections', () => {
    it('should preserve all collections when adding to new collection', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to add',
        collectionId: 'collection-a',
      });

      // Act: Add to Collection B (mode='add')
      await addHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Assert: Task is active in BOTH A and B
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toContain('collection-a');
      expect(task!.collections).toContain('collection-b');
      expect(task!.collections).toHaveLength(2);

      // Assert: NO ghost entries (task is active in both)
      const entriesInA = await entryProjection.getEntriesForCollectionView('collection-a');
      const entriesInB = await entryProjection.getEntriesForCollectionView('collection-b');

      expect(entriesInA).toHaveLength(1);
      expect((entriesInA[0] as any).renderAsGhost).toBeFalsy();

      expect(entriesInB).toHaveLength(1);
      expect((entriesInB[0] as any).renderAsGhost).toBeFalsy();

      // Assert: Collection history has both A and B with addedAt only
      expect(task!.collectionHistory).toHaveLength(2);
      
      const historyA = task!.collectionHistory!.find(h => h.collectionId === 'collection-a');
      expect(historyA!.addedAt).toBeDefined();
      expect(historyA!.removedAt).toBeUndefined();

      const historyB = task!.collectionHistory!.find(h => h.collectionId === 'collection-b');
      expect(historyB!.addedAt).toBeDefined();
      expect(historyB!.removedAt).toBeUndefined();
    });

    it('should allow adding to multiple collections (multi-collection)', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Multi-collection task',
        collectionId: 'collection-a',
      });

      // Act: Add to B, C, D
      await addHandler.handle({ taskId, collectionId: 'collection-b' });
      await addHandler.handle({ taskId, collectionId: 'collection-c' });
      await addHandler.handle({ taskId, collectionId: 'collection-d' });

      // Assert: Task is in all 4 collections
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toHaveLength(4);
      expect(task!.collections).toContain('collection-a');
      expect(task!.collections).toContain('collection-b');
      expect(task!.collections).toContain('collection-c');
      expect(task!.collections).toContain('collection-d');

      // Assert: All 4 are active (no ghosts)
      for (const collectionId of ['collection-a', 'collection-b', 'collection-c', 'collection-d']) {
        const entries = await entryProjection.getEntriesForCollectionView(collectionId);
        expect(entries).toHaveLength(1);
        expect((entries[0] as any).renderAsGhost).toBeFalsy();
      }

      // Assert: Collection history has all 4 with no removedAt
      expect(task!.collectionHistory).toHaveLength(4);
      for (const history of task!.collectionHistory!) {
        expect(history.removedAt).toBeUndefined();
      }
    });
  });

  /**
   * Test Scenario 5: Idempotency Checks
   * 
   * Verifies that duplicate operations are handled gracefully.
   */
  describe('Scenario 5: Idempotency Checks', () => {
    it('should be idempotent when adding to same collection twice', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to add',
        collectionId: 'collection-a',
      });

      // Act 1: Add to Collection B
      await addHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Act 2: Try adding to B again (should be no-op)
      await addHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Assert: Only 1 TaskAddedToCollection event for B
      const allEvents = await eventStore.getAll();
      const addedToBEvents = allEvents.filter(
        e => e.type === 'TaskAddedToCollection' && 
            (e as TaskAddedToCollection).payload.collectionId === 'collection-b'
      );
      expect(addedToBEvents).toHaveLength(1);

      // Assert: Collection history[B] has single addedAt timestamp
      const task = await entryProjection.getTaskById(taskId);
      const historyB = task!.collectionHistory!.filter(h => h.collectionId === 'collection-b');
      expect(historyB).toHaveLength(1);
      expect(historyB[0]!.addedAt).toBeDefined();
      expect(historyB[0]!.removedAt).toBeUndefined();
    });

    it('should be idempotent when removing from collection not in', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to remove',
        collectionId: 'collection-a',
      });

      // Act: Try removing from Collection B (task is not in B)
      await removeHandler.handle({
        taskId,
        collectionId: 'collection-b',
      });

      // Assert: No TaskRemovedFromCollection events for B
      const allEvents = await eventStore.getAll();
      const removedFromBEvents = allEvents.filter(
        e => e.type === 'TaskRemovedFromCollection' && 
            (e as TaskRemovedFromCollection).payload.collectionId === 'collection-b'
      );
      expect(removedFromBEvents).toHaveLength(0);

      // Assert: Task is still in Collection A
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toContain('collection-a');
    });

    it('should be idempotent when bulk migrating same entries twice', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task to bulk migrate',
        collectionId: 'collection-a',
      });

      // Act 1: Bulk migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: [taskId],
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Get event count after first migration
      const eventsAfterFirst = await eventStore.getAll();
      const firstCount = eventsAfterFirst.length;

      // Act 2: Bulk migrate to B again (should be no-op - already in B, not in A)
      await bulkMigrateHandler.handle({
        entryIds: [taskId],
        sourceCollectionId: 'collection-b',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: No additional events generated
      const eventsAfterSecond = await eventStore.getAll();
      expect(eventsAfterSecond.length).toBe(firstCount); // No new events

      // Assert: Task is still in Collection B only
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toEqual(['collection-b']);
    });
  });

  /**
   * Test Scenario 6: Bulk Migration Atomicity
   * 
   * Verifies that bulk operations are atomic and efficient.
   */
  describe('Scenario 6: Bulk Migration Atomicity', () => {
    it('should preserve task IDs for all 5 tasks in bulk migration', async () => {
      // Arrange: Create 5 tasks in Collection A
      const taskIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const taskId = await createTaskHandler.handle({
          title: `Task ${i}`,
          collectionId: 'collection-a',
        });
        taskIds.push(taskId);
      }

      // Act: Bulk migrate all 5 to Collection B (mode='move')
      await bulkMigrateHandler.handle({
        entryIds: taskIds,
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: All 5 preserve their task IDs
      for (const taskId of taskIds) {
        const task = await entryProjection.getTaskById(taskId);
        expect(task).toBeDefined();
        expect(task!.id).toBe(taskId); // Same ID preserved
      }
    });

    it('should render all 5 tasks as ghosts in source collection', async () => {
      // Arrange: Create 5 tasks in Collection A
      const taskIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const taskId = await createTaskHandler.handle({
          title: `Task ${i}`,
          collectionId: 'collection-a',
        });
        taskIds.push(taskId);
      }

      // Act: Bulk migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: taskIds,
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: All 5 appear as ghosts in Collection A
      const entriesInA = await entryProjection.getEntriesForCollectionView('collection-a');
      expect(entriesInA).toHaveLength(5);
      
      for (const entry of entriesInA) {
        expect((entry as any).renderAsGhost).toBe(true);
        expect((entry as any).ghostNewLocation).toBe('collection-b');
      }
    });

    it('should render all 5 tasks as active in target collection', async () => {
      // Arrange: Create 5 tasks in Collection A
      const taskIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const taskId = await createTaskHandler.handle({
          title: `Task ${i}`,
          collectionId: 'collection-a',
        });
        taskIds.push(taskId);
      }

      // Act: Bulk migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: taskIds,
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: All 5 appear active in Collection B
      const entriesInB = await entryProjection.getEntriesForCollectionView('collection-b');
      expect(entriesInB).toHaveLength(5);
      
      for (const entry of entriesInB) {
        expect((entry as any).renderAsGhost).toBeFalsy();
        expect(taskIds).toContain(entry.id); // Same IDs as created
      }
    });

    it('should use single batch of events for bulk migration', async () => {
      // Arrange: Create 5 tasks in Collection A
      const taskIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const taskId = await createTaskHandler.handle({
          title: `Task ${i}`,
          collectionId: 'collection-a',
        });
        taskIds.push(taskId);
      }

      // Track appendBatch calls
      const appendBatchCalls: DomainEvent[][] = [];
      const originalAppendBatch = eventStore.appendBatch.bind(eventStore);
      eventStore.appendBatch = async (events: DomainEvent[]) => {
        appendBatchCalls.push(events);
        return originalAppendBatch(events);
      };

      // Act: Bulk migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: taskIds,
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: Single appendBatch call (not 5 separate calls)
      expect(appendBatchCalls).toHaveLength(1);
      
      // Assert: Batch contains 10 events (5 tasks × 2 events each)
      // Each task: 1 TaskRemovedFromCollection + 1 TaskAddedToCollection
      const batch = appendBatchCalls[0]!;
      expect(batch).toHaveLength(10);

      // Verify event types
      const removedEvents = batch.filter(e => e.type === 'TaskRemovedFromCollection');
      const addedEvents = batch.filter(e => e.type === 'TaskAddedToCollection');
      const migratedEvents = batch.filter(e => e.type === 'TaskMigrated');

      expect(removedEvents).toHaveLength(5);
      expect(addedEvents).toHaveLength(5);
      expect(migratedEvents).toHaveLength(0); // NO TaskMigrated events!
    });

    it('should maintain collection history for all tasks after bulk migration', async () => {
      // Arrange: Create 5 tasks in Collection A
      const taskIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const taskId = await createTaskHandler.handle({
          title: `Task ${i}`,
          collectionId: 'collection-a',
        });
        taskIds.push(taskId);
      }

      // Act: Bulk migrate to Collection B
      await bulkMigrateHandler.handle({
        entryIds: taskIds,
        sourceCollectionId: 'collection-a',
        targetCollectionId: 'collection-b',
        mode: 'move',
      });

      // Assert: All tasks have complete collection history
      for (const taskId of taskIds) {
        const task = await entryProjection.getTaskById(taskId);
        
        // Should have 2 history entries: A (removed) and B (active)
        expect(task!.collectionHistory).toHaveLength(2);

        const historyA = task!.collectionHistory!.find(h => h.collectionId === 'collection-a');
        expect(historyA!.addedAt).toBeDefined();
        expect(historyA!.removedAt).toBeDefined(); // Removed from A

        const historyB = task!.collectionHistory!.find(h => h.collectionId === 'collection-b');
        expect(historyB!.addedAt).toBeDefined();
        expect(historyB!.removedAt).toBeUndefined(); // Still in B
      }
    });
  });

  /**
   * Additional Edge Cases and Regression Tests
   */
  describe('Additional Edge Cases', () => {
    it('should handle move when task is in multiple collections (remove from current only)', async () => {
      // Arrange: Create task in A, add to B and C
      const taskId = await createTaskHandler.handle({
        title: 'Multi-collection task',
        collectionId: 'collection-a',
      });
      await addHandler.handle({ taskId, collectionId: 'collection-b' });
      await addHandler.handle({ taskId, collectionId: 'collection-c' });

      // Verify task is in [A, B, C]
      let task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toHaveLength(3);

      // Act: Move from B to D (should result in [A, C, D])
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-b',
        targetCollectionId: 'collection-d',
      });

      // Assert: Task is in A, C, D (NOT B)
      task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toContain('collection-a');
      expect(task!.collections).not.toContain('collection-b'); // Removed from B only
      expect(task!.collections).toContain('collection-c');
      expect(task!.collections).toContain('collection-d');
      expect(task!.collections).toHaveLength(3);
    });

    it('should throw error when moving from collection task is not in', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task in A',
        collectionId: 'collection-a',
      });

      // Act & Assert: Trying to move from B (not in B) should throw
      await expect(
        moveHandler.handle({
          taskId,
          currentCollectionId: 'collection-b',
          targetCollectionId: 'collection-c',
        })
      ).rejects.toThrow(/not in collection/i);
    });

    it('should be no-op when moving to same collection (idempotent)', async () => {
      // Arrange: Create task in Collection A
      const taskId = await createTaskHandler.handle({
        title: 'Task in A',
        collectionId: 'collection-a',
      });

      const eventsBefore = await eventStore.getAll();
      const countBefore = eventsBefore.length;

      // Act: Move from A to A (should be no-op)
      await moveHandler.handle({
        taskId,
        currentCollectionId: 'collection-a',
        targetCollectionId: 'collection-a',
      });

      // Assert: No new events generated
      const eventsAfter = await eventStore.getAll();
      expect(eventsAfter.length).toBe(countBefore);

      // Assert: Task still in Collection A
      const task = await entryProjection.getTaskById(taskId);
      expect(task!.collections).toEqual(['collection-a']);
    });
  });
});
