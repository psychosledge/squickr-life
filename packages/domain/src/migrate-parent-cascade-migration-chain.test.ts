/**
 * Tests for Migration Chain UI Indicators
 * 
 * Bug: When a sub-task is migrated to collection A, then parent migrates to collection B,
 * the sub-task in collection B loses the migration indicator showing it was also migrated to collection A.
 * 
 * Expected:
 * - Sub-task in collection B should show it has a migration chain
 * - UI should indicate it exists in BOTH collection A and collection B
 * - User should be able to navigate to BOTH locations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MigrateTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';

describe('Migration Chain - UI Indicators', () => {
  let eventStore: InMemoryEventStore;
  let taskProjection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createTaskHandler: CreateTaskHandler;
  let createSubTaskHandler: CreateSubTaskHandler;
  let migrateTaskHandler: MigrateTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    taskProjection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, taskProjection, entryProjection);
    migrateTaskHandler = new MigrateTaskHandler(eventStore, entryProjection);
  });

  it('should preserve migration chain information when parent migrates after child', async () => {
    // Step 1: Create parent with 3 sub-tasks in "Work Projects"
    await createTaskHandler.handle({
      title: 'Launch Project',
      collectionId: 'work-projects'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;

    await createSubTaskHandler.handle({ title: 'Sub-task A', parentTaskId: parent.id });
    await createSubTaskHandler.handle({ title: 'Sub-task B', parentTaskId: parent.id });
    await createSubTaskHandler.handle({ title: 'Sub-task C', parentTaskId: parent.id });

    const allTasks = await entryProjection.getTasks();
    const children = allTasks.filter(t => t.parentTaskId === parent.id);
    expect(children).toHaveLength(3);

    const subTaskB = children.find(c => c.title === 'Sub-task B')!;

    // Step 2: Migrate sub-task B to "Today's Log" (first migration)
    const firstMigrationId = await migrateTaskHandler.handle({
      taskId: subTaskB.id,
      targetCollectionId: 'todays-log'
    });

    // Verify first migration
    const tasksAfterFirstMigration = await entryProjection.getTasks();
    const subTaskBOriginal = tasksAfterFirstMigration.find(t => t.id === subTaskB.id)!;
    const subTaskBInTodaysLog = tasksAfterFirstMigration.find(t => t.id === firstMigrationId)!;

    expect(subTaskBOriginal.migratedTo).toBe(firstMigrationId);
    expect(subTaskBOriginal.collectionId).toBe('work-projects');
    expect(subTaskBInTodaysLog.migratedFrom).toBe(subTaskB.id);
    expect(subTaskBInTodaysLog.collectionId).toBe('todays-log');
    expect(subTaskBInTodaysLog.migratedFromCollectionId).toBe('work-projects');

    // Step 3: Migrate parent to "Monthly Log" (triggers cascade)
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // Step 4: Verify the migration chain for sub-task B
    const finalTasks = await entryProjection.getTasks();

    // Get all versions of sub-task B
    const subTaskBInTodaysLogAfterParentMigration = finalTasks.find(t => t.id === firstMigrationId)!;
    
    // The first migration should now have a second migration (to follow parent)
    expect(subTaskBInTodaysLogAfterParentMigration.migratedTo).toBeDefined();
    
    const secondMigrationId = subTaskBInTodaysLogAfterParentMigration.migratedTo!;
    const subTaskBInMonthlyLog = finalTasks.find(t => t.id === secondMigrationId)!;

    // ============================================================================
    // CRITICAL ASSERTIONS: These verify the UI can detect the migration chain
    // ============================================================================

    // Second migration should point BACK to first migration (not original)
    expect(subTaskBInMonthlyLog.migratedFrom).toBe(firstMigrationId);
    expect(subTaskBInMonthlyLog.migratedFromCollectionId).toBe('todays-log');

    // Second migration should be in monthly-log
    expect(subTaskBInMonthlyLog.collectionId).toBe('monthly-log');

    // Second migration should follow migrated parent
    expect(subTaskBInMonthlyLog.parentTaskId).toBe(parentMigratedId);

    // First migration should still exist in todays-log
    expect(subTaskBInTodaysLogAfterParentMigration.collectionId).toBe('todays-log');
    expect(subTaskBInTodaysLogAfterParentMigration.migratedFrom).toBe(subTaskB.id);
    expect(subTaskBInTodaysLogAfterParentMigration.migratedFromCollectionId).toBe('work-projects');

    // ============================================================================
    // UI NAVIGATION TESTS: Verify user can navigate the migration chain
    // ============================================================================

    // From Monthly Log view: User should see "Go back to Today's Log"
    expect(subTaskBInMonthlyLog.migratedFrom).toBe(firstMigrationId);
    expect(subTaskBInMonthlyLog.migratedFromCollectionId).toBe('todays-log');

    // From Today's Log view: User should see BOTH:
    // 1. "Go back to Work Projects" (via migratedFrom)
    // 2. "Go to Monthly Log" (via migratedTo)
    expect(subTaskBInTodaysLogAfterParentMigration.migratedFrom).toBe(subTaskB.id);
    expect(subTaskBInTodaysLogAfterParentMigration.migratedFromCollectionId).toBe('work-projects');
    expect(subTaskBInTodaysLogAfterParentMigration.migratedTo).toBe(secondMigrationId);
    expect(subTaskBInTodaysLogAfterParentMigration.migratedToCollectionId).toBe('monthly-log');

    // ============================================================================
    // MIGRATION CHAIN INDICATOR TEST
    // ============================================================================
    
    // The sub-task in Monthly Log should indicate it's part of a migration chain
    // by having a migratedFrom that is ITSELF a migrated task
    const previousMigration = finalTasks.find(t => t.id === subTaskBInMonthlyLog.migratedFrom)!;
    expect(previousMigration.migratedFrom).toBeDefined(); // Previous migration has a migratedFrom
    
    // This means the UI can detect:
    // - If task.migratedFrom exists → show "Go back to X"
    // - If task at migratedFrom ALSO has migratedFrom → this is part of a chain
    // - UI can traverse the chain by following migratedFrom pointers
  });

  it('should allow UI to detect if a task is part of a migration chain', async () => {
    // Helper function that UI would use to detect migration chains
    const isPartOfMigrationChain = (task: any, allTasks: any[]): boolean => {
      if (!task.migratedFrom) return false;
      
      const previousMigration = allTasks.find(t => t.id === task.migratedFrom);
      if (!previousMigration) return false;
      
      // If the previous migration also has a migratedFrom, we're in a chain
      return !!previousMigration.migratedFrom;
    };

    // Create scenario: Child migrated, then parent migrates
    await createTaskHandler.handle({
      title: 'Parent',
      collectionId: 'collection-a'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;

    await createSubTaskHandler.handle({ title: 'Child', parentTaskId: parent.id });
    const allTasksAfterCreate = await entryProjection.getTasks();
    const child = allTasksAfterCreate.find(t => t.title === 'Child')!;

    // First migration: Child to collection B
    await migrateTaskHandler.handle({
      taskId: child.id,
      targetCollectionId: 'collection-b'
    });

    // Second migration: Parent to collection C (child follows)
    await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'collection-c'
    });

    const finalTasks = await entryProjection.getTasks();
    
    // Find the child in collection C (second migration)
    const childInCollectionC = finalTasks.find(t => 
      t.title === 'Child' && 
      t.collectionId === 'collection-c'
    )!;

    // VERIFY: UI can detect this is part of a migration chain
    expect(isPartOfMigrationChain(childInCollectionC, finalTasks)).toBe(true);

    // The previous migration (in collection B) should also be detectable
    const previousMigration = finalTasks.find(t => t.id === childInCollectionC.migratedFrom)!;
    expect(previousMigration.collectionId).toBe('collection-b');
    expect(previousMigration.migratedFrom).toBeDefined(); // Links back to original
  });
});
