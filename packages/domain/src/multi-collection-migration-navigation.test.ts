import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '@squickr/infrastructure';
import { EntryListProjection } from './entry.projections';
import { CreateTaskHandler } from './task.handlers';
import { MoveTaskToCollectionHandler, AddTaskToCollectionHandler, RemoveTaskFromCollectionHandler } from './collection-management.handlers';
import type { Task } from './task.types';

/**
 * Test: Multi-Collection Migration - Bidirectional Navigation
 * 
 * Verifies that when a task is moved from Collection A → Collection B:
 * - Collection A: Ghost entry with "Go to Collection B" (migratedTo + migratedToCollectionId)
 * - Collection B: Real entry with "Go back to Collection A" (migratedFrom + migratedFromCollectionId)
 */
describe('Multi-Collection Migration - Bidirectional Navigation', () => {
  let eventStore: InMemoryEventStore;
  let projection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let moveHandler: MoveTaskToCollectionHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, null as any, projection);
    
    const addHandler = new AddTaskToCollectionHandler(eventStore, projection);
    const removeHandler = new RemoveTaskFromCollectionHandler(eventStore, projection);
    moveHandler = new MoveTaskToCollectionHandler(addHandler, removeHandler, projection);
  });

  it('should set migratedFrom and migratedFromCollectionId when task is moved', async () => {
    // Arrange: Create a task in "work-projects" collection
    await createTaskHandler.handle({
      title: 'App launch task',
      collectionId: 'work-projects',
    });

    const tasks = await projection.getTasks();
    expect(tasks).toHaveLength(1);
    const taskId = tasks[0]!.id;

    // Act: Move task from "work-projects" → "todays-log"
    await moveHandler.handle({
      taskId,
      targetCollectionId: 'todays-log',
    });

    // Assert: Get task from projection
    const movedTask = await projection.getTaskById(taskId) as Task | null;
    expect(movedTask).toBeDefined();

    // Verify "Go back" navigation properties
    expect(movedTask!.migratedFrom).toBe(taskId); // Self-reference (indicates moved, not legacy migrated)
    expect(movedTask!.migratedFromCollectionId).toBe('work-projects'); // Source collection

    // Verify task is in new collection
    expect(movedTask!.collections).toEqual(['todays-log']);
    expect(movedTask!.collections).not.toContain('work-projects');
  });

  it('should show ghost entry in source collection and real entry in target collection', async () => {
    // Arrange: Create a task in "work-projects"
    await createTaskHandler.handle({
      title: 'Task to migrate',
      collectionId: 'work-projects',
    });

    const tasks = await projection.getTasks();
    const taskId = tasks[0]!.id;

    // Act: Move task to "monthly-log"
    await moveHandler.handle({
      taskId,
      targetCollectionId: 'monthly-log',
    });

    // Assert: Get entries for source collection (work-projects)
    const workProjectsEntries = await projection.getEntriesForCollectionView('work-projects');
    expect(workProjectsEntries).toHaveLength(1);
    const ghostEntry = workProjectsEntries[0] as any; // Ghost entries have extra properties
    
    // Verify ghost entry properties
    expect(ghostEntry.renderAsGhost).toBe(true);
    expect(ghostEntry.ghostNewLocation).toBe('monthly-log');
    expect(ghostEntry.id).toBe(taskId);

    // Assert: Get entries for target collection (monthly-log)
    const monthlyLogEntries = await projection.getEntriesForCollectionView('monthly-log');
    expect(monthlyLogEntries).toHaveLength(1);
    const realEntry = monthlyLogEntries[0] as Task;
    
    // Verify real entry has "Go back" properties
    expect((realEntry as any).renderAsGhost).toBeFalsy(); // Not a ghost (false or undefined)
    expect(realEntry.migratedFrom).toBe(taskId); // Can go back
    expect(realEntry.migratedFromCollectionId).toBe('work-projects'); // Source collection
  });

  it('should handle multiple moves correctly (A → B → C)', async () => {
    // Arrange: Create task in Collection A
    await createTaskHandler.handle({
      title: 'Multi-move task',
      collectionId: 'collection-a',
    });

    const tasks = await projection.getTasks();
    const taskId = tasks[0]!.id;

    // Act 1: Move A → B
    await moveHandler.handle({
      taskId,
      targetCollectionId: 'collection-b',
    });

    // Assert: Task in B should point back to A
    let task = await projection.getTaskById(taskId) as Task | null;
    expect(task!.migratedFromCollectionId).toBe('collection-a');
    expect(task!.collections).toEqual(['collection-b']);

    // Act 2: Move B → C
    await moveHandler.handle({
      taskId,
      targetCollectionId: 'collection-c',
    });

    // Assert: Task in C should point back to B (most recent source)
    task = await projection.getTaskById(taskId) as Task | null;
    expect(task!.migratedFromCollectionId).toBe('collection-b'); // Most recent source
    expect(task!.collections).toEqual(['collection-c']);

    // Verify collection history tracks all moves
    expect(task!.collectionHistory).toHaveLength(3);
    expect(task!.collectionHistory![0]!.collectionId).toBe('collection-a');
    expect(task!.collectionHistory![0]!.removedAt).toBeDefined(); // Removed from A
    expect(task!.collectionHistory![1]!.collectionId).toBe('collection-b');
    expect(task!.collectionHistory![1]!.removedAt).toBeDefined(); // Removed from B
    expect(task!.collectionHistory![2]!.collectionId).toBe('collection-c');
    expect(task!.collectionHistory![2]!.removedAt).toBeUndefined(); // Still in C
  });

  it('should NOT set migratedFrom when task is added (not moved) to a collection', async () => {
    // Arrange: Create uncategorized task (no collectionId)
    await createTaskHandler.handle({
      title: 'Uncategorized task',
    });

    const tasks = await projection.getTasks();
    const taskId = tasks[0]!.id;

    // Verify task starts uncategorized
    let task = await projection.getTaskById(taskId) as Task | null;
    expect(task!.collections).toEqual([]);

    // Act: Add task to a collection (NOT a move, since it wasn't in any collection)
    const addHandler = new AddTaskToCollectionHandler(eventStore, projection);
    await addHandler.handle({
      taskId,
      collectionId: 'new-collection',
    });

    // Assert: Task should NOT have migratedFrom (this was an ADD, not a MOVE)
    task = await projection.getTaskById(taskId) as Task | null;
    expect(task!.migratedFrom).toBeUndefined(); // No migratedFrom for ADD
    expect(task!.migratedFromCollectionId).toBeUndefined(); // No source collection
    expect(task!.collections).toEqual(['new-collection']);
  });
});
