/**
 * Integration Test: MoveEntryToCollectionHandler - Phase 3 Parent Cascade
 * 
 * This test reproduces the exact bug reported by the user:
 * - Create parent with 3 sub-tasks in "Work Projects"
 * - Migrate 1 sub-task to "Today's Log" (creates symlink)
 * - Migrate parent to "Monthly Log"
 * - Expected: 2 unmigrated children should follow parent ✅
 * - Bug: Children do NOT follow parent ❌
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MoveEntryToCollectionHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';

describe('MoveEntryToCollectionHandler - Phase 3 Parent Cascade (Bug Reproduction)', () => {
  let eventStore: InMemoryEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let moveEntryHandler: MoveEntryToCollectionHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, entryProjection);
    moveEntryHandler = new MoveEntryToCollectionHandler(eventStore, entryProjection);
  });

  it('should cascade ALL children when parent moves (including previously migrated)', async () => {
    // Step 1: Create parent task in "Work Projects" with 3 sub-tasks
    await createTaskHandler.handle({
      title: 'App launch',
      collectionId: 'work-projects'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;
    expect(parent.collectionId).toBe('work-projects');

    // Create 3 sub-tasks (all inherit parent's collection)
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

    // Verify all 3 children are in same collection as parent
    const allTasks = await entryProjection.getTasks();
    const children = allTasks.filter(t => t.parentEntryId === parent.id);
    expect(children).toHaveLength(3);
    expect(children.every(c => c.collectionId === 'work-projects')).toBe(true);

    const analyticsChild = children.find(c => c.title === 'Set up analytics')!;
    const blogChild = children.find(c => c.title === 'Write blog post')!;
    const deployChild = children.find(c => c.title === 'Deploy to production')!;

    // Step 2: Move 1 sub-task to "Today's Log"
    await moveEntryHandler.handle({
      entryId: blogChild.id,
      collectionId: 'todays-log'
    });

    // Verify blog post child moved to different collection
    const tasksAfterFirstMove = await entryProjection.getTasks();
    const blogChildAfterMove = tasksAfterFirstMove.find(t => t.id === blogChild.id)!;
    expect(blogChildAfterMove.collectionId).toBe('todays-log'); // Moved to different collection

    // Step 3: Move parent to "Monthly Log"
    await moveEntryHandler.handle({
      entryId: parent.id,
      collectionId: 'monthly-log'
    });

    // Step 4: Verify results
    const finalTasks = await entryProjection.getTasks();
    const finalParent = finalTasks.find(t => t.id === parent.id)!;
    const finalChildren = finalTasks.filter(t => t.parentEntryId === parent.id);

    // Parent should be in "monthly-log" ✅
    expect(finalParent.collectionId).toBe('monthly-log');

    // Find final child states
    const finalAnalytics = finalChildren.find(c => c.id === analyticsChild.id)!;
    const finalBlog = finalChildren.find(c => c.id === blogChild.id)!;
    const finalDeploy = finalChildren.find(c => c.id === deployChild.id)!;

    // CORRECT BEHAVIOR: ALL children follow parent (children belong to parent, not collection)
    expect(finalAnalytics.collectionId).toBe('monthly-log'); // Followed parent ✅
    expect(finalDeploy.collectionId).toBe('monthly-log'); // Followed parent ✅
    expect(finalBlog.collectionId).toBe('monthly-log'); // Followed parent (even though previously migrated) ✅
  });
});
