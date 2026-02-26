/**
 * Tests for Bug Fixes - Phase 3 Parent Migration Cascade (UI/Projection Issues)
 * 
 * User Scenario:
 * 1. Created parent in "Work Projects" with 3 sub-tasks
 * 2. Migrated one sub-task to "Today's Log" (creates symlink)
 * 3. Migrated the parent to "Monthly Log"
 * 
 * Expected Results (from user testing):
 * - Bug 1: All 3 sub-tasks should appear under parent in "Monthly Log" (including previously migrated one)
 * - Bug 2: Migrated parent in "Monthly Log" should have "Go back to Work Projects" option
 * - Bug 3: Original parent in "Work Projects" should not show sub-tasks (they're migrated)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MigrateTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';

describe('Parent Migration Cascade - UI/Projection Bugs', () => {
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

  it('Bug 1: Migrated sub-task should appear under parent in new location', async () => {
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
    const blogChild = children.find(c => c.title === 'Write blog post')!;

    // Step 2: Migrate 1 sub-task to "Today's Log"
    await migrateTaskHandler.handle({
      taskId: blogChild.id,
      targetCollectionId: 'todays-log'
    });

    // Step 3: Migrate parent to "Monthly Log"
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // BUG 1 TEST: All 3 sub-tasks should appear under migrated parent in "Monthly Log"
    const migratedParentSubTasks = await entryProjection.getSubTasks(parentMigratedId);
    
    console.log('Sub-tasks under migrated parent:', migratedParentSubTasks.map(t => ({
      title: t.title,
      id: t.id,
      parentEntryId: t.parentEntryId,
      collectionId: t.collectionId
    })));

    // EXPECTED: 3 sub-tasks (analytics migrated, blog second migration, deploy migrated)
    expect(migratedParentSubTasks).toHaveLength(3);
    
    // Verify each sub-task is in "monthly-log" collection
    const analyticsInMonthly = migratedParentSubTasks.find(t => t.title === 'Set up analytics');
    const blogInMonthly = migratedParentSubTasks.find(t => t.title === 'Write blog post');
    const deployInMonthly = migratedParentSubTasks.find(t => t.title === 'Deploy to production');
    
    expect(analyticsInMonthly).toBeDefined();
    expect(blogInMonthly).toBeDefined();
    expect(deployInMonthly).toBeDefined();
    
    expect(analyticsInMonthly?.collectionId).toBe('monthly-log');
    expect(blogInMonthly?.collectionId).toBe('monthly-log');
    expect(deployInMonthly?.collectionId).toBe('monthly-log');
    
    // Verify they all point to migrated parent
    expect(analyticsInMonthly?.parentEntryId).toBe(parentMigratedId);
    expect(blogInMonthly?.parentEntryId).toBe(parentMigratedId);
    expect(deployInMonthly?.parentEntryId).toBe(parentMigratedId);
  });

  it('Bug 2: Migrated parent should have migratedFrom pointer for "Go back" navigation', async () => {
    // Step 1: Create parent in "Work Projects"
    await createTaskHandler.handle({
      title: 'App launch',
      collectionId: 'work-projects'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;

    // Step 2: Migrate parent to "Monthly Log"
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // BUG 2 TEST: Migrated parent should have migratedFrom pointer
    const migratedParent = await entryProjection.getTaskById(parentMigratedId);
    
    expect(migratedParent).toBeDefined();
    expect(migratedParent?.migratedFrom).toBe(parent.id);
    expect(migratedParent?.collectionId).toBe('monthly-log');
    
    // Phase 3 FIX: migratedFromCollectionId should be set for "Go back" navigation
    expect(migratedParent?.migratedFromCollectionId).toBe('work-projects');
    // UI can now show "Go back to Work Projects" without fetching original task
  });

  it('Bug 3: Original parent should not show migrated sub-tasks', async () => {
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

    // Step 2: Migrate parent to "Monthly Log"
    await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // BUG 3 TEST: Original parent should show 0 sub-tasks (all migrated with parent)
    const originalParentSubTasks = await entryProjection.getSubTasks(parent.id);
    
    console.log('Sub-tasks under original parent:', originalParentSubTasks.map(t => ({
      title: t.title,
      id: t.id,
      parentEntryId: t.parentEntryId,
      migratedTo: t.migratedTo
    })));

    // EXPECTED: 0 sub-tasks (all were migrated with parent)
    // The getSubTasks query filters out tasks with migratedTo pointer
    expect(originalParentSubTasks).toHaveLength(0);
  });

  it('Comprehensive test: Viewing entries in each collection', async () => {
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
    const blogChild = children.find(c => c.title === 'Write blog post')!;

    // Step 2: Migrate 1 sub-task to "Today's Log"
    await migrateTaskHandler.handle({
      taskId: blogChild.id,
      targetCollectionId: 'todays-log'
    });

    // Step 3: Migrate parent to "Monthly Log"
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    // VERIFY: What user sees in "Work Projects"
    const workProjectsEntries = await entryProjection.getEntriesByCollection('work-projects');
    const workProjectsTasks = workProjectsEntries.filter(e => e.type === 'task');
    
    console.log('\n=== Work Projects ===');
    console.log('Tasks:', workProjectsTasks.map(t => ({
      title: t.title,
      migratedTo: t.migratedTo,
      parentEntryId: t.type === 'task' ? t.parentEntryId : undefined
    })));
    
    // EXPECTED: Original parent + original children (all with migratedTo pointers)
    // User should see these as "archived" or with migration indicators
    const workParent = workProjectsTasks.find(t => t.id === parent.id);
    expect(workParent).toBeDefined();
    expect(workParent?.migratedTo).toBeDefined();

    // VERIFY: What user sees in "Today's Log"
    const todaysLogEntries = await entryProjection.getEntriesByCollection('todays-log');
    const todaysLogTasks = todaysLogEntries.filter(e => e.type === 'task');
    
    console.log('\n=== Todays Log ===');
    console.log('Tasks:', todaysLogTasks.map(t => ({
      title: t.title,
      migratedFrom: t.migratedFrom,
      migratedTo: t.migratedTo,
      parentEntryId: t.type === 'task' ? t.parentEntryId : undefined
    })));
    
    // EXPECTED: First migration of blog child (with migratedTo pointing to second migration)
    const todaysBlog = todaysLogTasks.find(t => t.title === 'Write blog post');
    expect(todaysBlog).toBeDefined();
    expect(todaysBlog?.migratedFrom).toBeDefined();
    expect(todaysBlog?.migratedTo).toBeDefined(); // Chain continues
    expect(todaysBlog?.collectionId).toBe('todays-log');

    // VERIFY: What user sees in "Monthly Log"
    const monthlyLogEntries = await entryProjection.getEntriesByCollection('monthly-log');
    const monthlyLogTasks = monthlyLogEntries.filter(e => e.type === 'task');
    
    console.log('\n=== Monthly Log ===');
    console.log('Tasks:', monthlyLogTasks.map(t => ({
      title: t.title,
      migratedFrom: t.migratedFrom,
      parentEntryId: t.type === 'task' ? t.parentEntryId : undefined
    })));
    
    // EXPECTED: Migrated parent + 3 migrated children
    const monthlyParent = monthlyLogTasks.find(t => t.id === parentMigratedId);
    expect(monthlyParent).toBeDefined();
    expect(monthlyParent?.title).toBe('App launch');
    expect(monthlyParent?.migratedFrom).toBe(parent.id);
    
    // All 3 children should be here
    const monthlyChildren = monthlyLogTasks.filter(t => t.type === 'task' && t.parentEntryId === parentMigratedId);
    expect(monthlyChildren).toHaveLength(3);
    
    const analyticsInMonthly = monthlyChildren.find(t => t.title === 'Set up analytics');
    const blogInMonthly = monthlyChildren.find(t => t.title === 'Write blog post');
    const deployInMonthly = monthlyChildren.find(t => t.title === 'Deploy to production');
    
    expect(analyticsInMonthly).toBeDefined();
    expect(blogInMonthly).toBeDefined();
    expect(deployInMonthly).toBeDefined();
  });
});
