/**
 * Tests for MigrateTaskHandler - Phase 3 Parent Migration Cascade
 * 
 * When migrating a parent task (creating symlink):
 * - Parent task is symlinked to target collection ✅ (existing behavior)
 * - Unmigrated children (in same collection) should ALSO be symlinked to target ✅ (NEW - Phase 3)
 * - Already-migrated children (in different collection) should stay put ✅ (preserve existing symlinks)
 * 
 * This test documents the EXPECTED behavior for Phase 3 cascade migration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MigrateTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';

describe('MigrateTaskHandler - Phase 3 Parent Cascade (Symlink Pattern)', () => {
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

  it('should cascade migrate unmigrated children when parent is migrated (symlink pattern)', async () => {
    // Step 1: Create parent with 3 sub-tasks in "Work Projects"
    await createTaskHandler.handle({
      title: 'App launch',
      collectionId: 'work-projects'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;

    await createSubTaskHandler.handle({ title: 'Set up analytics', parentEntryId: parent.id });
    await createSubTaskHandler.handle({ title: 'Write blog post', parentEntryId: parent.id });
    await createSubTaskHandler.handle({ title: 'Deploy to production', parentEntryId: parent.id });

    const allTasks = await entryProjection.getTasks();
    const children = allTasks.filter(t => t.parentEntryId === parent.id);
    expect(children).toHaveLength(3);

    const analyticsChild = children.find(c => c.title === 'Set up analytics')!;
    const blogChild = children.find(c => c.title === 'Write blog post')!;
    const deployChild = children.find(c => c.title === 'Deploy to production')!;

    // Step 2: Migrate 1 child to "Today's Log" (creates symlink)
    const blogMigratedId = await migrateTaskHandler.handle({
      taskId: blogChild.id,
      targetCollectionId: 'todays-log'
    });

    // Verify symlink created
    const tasksAfterChildMigration = await entryProjection.getTasks();
    const blogOriginal = tasksAfterChildMigration.find(t => t.id === blogChild.id)!;
    const blogMigrated = tasksAfterChildMigration.find(t => t.id === blogMigratedId)!;
    
    expect(blogOriginal.migratedTo).toBe(blogMigratedId);
    expect(blogOriginal.collectionId).toBe('work-projects'); // Original stays
    expect(blogMigrated.migratedFrom).toBe(blogChild.id);
    expect(blogMigrated.collectionId).toBe('todays-log'); // Symlink in new collection

    // Step 3: Migrate parent to "Monthly Log" - THIS SHOULD CASCADE!
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // Step 4: Verify results
    const finalTasks = await entryProjection.getTasks();
    
    // Parent should have symlink in "monthly-log"
    const parentOriginal = finalTasks.find(t => t.id === parent.id)!;
    const parentMigrated = finalTasks.find(t => t.id === parentMigratedId)!;
    
    expect(parentOriginal.migratedTo).toBe(parentMigratedId);
    expect(parentOriginal.collectionId).toBe('work-projects'); // Original stays
    expect(parentMigrated.migratedFrom).toBe(parent.id);
    expect(parentMigrated.collectionId).toBe('monthly-log'); // Symlink created

    // EXPECTED BEHAVIOR (Phase 3):
    // - Analytics child (unmigrated) should have symlink in "monthly-log" (follow parent)
    // - Deploy child (unmigrated) should have symlink in "monthly-log" (follow parent)  
    // - Blog child (already migrated) should stay in "todays-log" (preserve existing symlink)

    // Analytics: Original in "work-projects" + Symlink in "monthly-log"
    const analyticsOriginal = finalTasks.find(t => t.id === analyticsChild.id)!;
    expect(analyticsOriginal.collectionId).toBe('work-projects');
    expect(analyticsOriginal.migratedTo).toBeDefined(); // Should have symlink now
    
    const analyticsMigrated = finalTasks.find(t => t.id === analyticsOriginal.migratedTo)!;
    expect(analyticsMigrated).toBeDefined();
    expect(analyticsMigrated.collectionId).toBe('monthly-log'); // Followed parent
    expect(analyticsMigrated.parentEntryId).toBe(parentMigratedId); // Points to migrated parent

    // Deploy: Original in "work-projects" + Symlink in "monthly-log"
    const deployOriginal = finalTasks.find(t => t.id === deployChild.id)!;
    expect(deployOriginal.collectionId).toBe('work-projects');
    expect(deployOriginal.migratedTo).toBeDefined(); // Should have symlink now
    
    const deployMigrated = finalTasks.find(t => t.id === deployOriginal.migratedTo)!;
    expect(deployMigrated).toBeDefined();
    expect(deployMigrated.collectionId).toBe('monthly-log'); // Followed parent
    expect(deployMigrated.parentEntryId).toBe(parentMigratedId); // Points to migrated parent

    // Blog: ALL children follow parent - blog gets ANOTHER migration to follow parent
    // This creates a migration CHAIN:
    // Original (work-projects) → First migration (todays-log) → Second migration (monthly-log)
    const blogOriginalFinal = finalTasks.find(t => t.id === blogChild.id)!;
    expect(blogOriginalFinal.collectionId).toBe('work-projects');
    expect(blogOriginalFinal.migratedTo).toBe(blogMigratedId); // Still points to first migration
    
    // First migration should now have a migratedTo pointer (chain continues)
    const blogFirstMigration = finalTasks.find(t => t.id === blogMigratedId)!;
    expect(blogFirstMigration.collectionId).toBe('todays-log'); // Still in todays-log
    expect(blogFirstMigration.migratedTo).toBeDefined(); // Now has a second migration
    
    // Second migration should be in monthly-log
    const blogSecondMigration = finalTasks.find(t => t.id === blogFirstMigration.migratedTo)!;
    expect(blogSecondMigration).toBeDefined();
    expect(blogSecondMigration.collectionId).toBe('monthly-log'); // Followed parent
    expect(blogSecondMigration.parentEntryId).toBe(parentMigratedId); // Points to migrated parent
    expect(blogSecondMigration.migratedFrom).toBe(blogMigratedId); // Links back to first migration (not original)
  });
});
