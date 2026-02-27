/**
 * Debug test to understand current migration chain state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, MigrateTaskHandler } from './task.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';

describe('Migration Chain - Debug', () => {
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
    createSubTaskHandler = new CreateSubTaskHandler(eventStore, entryProjection);
    migrateTaskHandler = new MigrateTaskHandler(eventStore, entryProjection);
  });

  it('should log migration chain state for debugging', async () => {
    // Create parent with sub-task in "Work Projects"
    await createTaskHandler.handle({
      title: 'Parent',
      collectionId: 'work-projects'
    });

    const tasks = await entryProjection.getTasks();
    const parent = tasks[0]!;

    await createSubTaskHandler.handle({ title: 'Sub-task', parentEntryId: parent.id });
    
    const allTasksAfterCreate = await entryProjection.getTasks();
    const subTask = allTasksAfterCreate.find(t => t.title === 'Sub-task')!;

    console.log('\n=== INITIAL STATE ===');
    console.log('Parent:', {
      id: parent.id.substring(0, 8),
      title: parent.title,
      collectionId: parent.collectionId,
      parentEntryId: parent.parentEntryId,
      migratedFrom: parent.migratedFrom,
      migratedTo: parent.migratedTo,
    });
    console.log('Sub-task:', {
      id: subTask.id.substring(0, 8),
      title: subTask.title,
      collectionId: subTask.collectionId,
      parentEntryId: subTask.parentEntryId?.substring(0, 8),
      migratedFrom: subTask.migratedFrom,
      migratedTo: subTask.migratedTo,
    });

    // Migrate sub-task to "Today's Log"
    const firstMigrationId = await migrateTaskHandler.handle({
      taskId: subTask.id,
      targetCollectionId: 'todays-log'
    });

    const tasksAfterFirstMigration = await entryProjection.getTasks();
    const subTaskOriginal = tasksAfterFirstMigration.find(t => t.id === subTask.id)!;
    const subTaskFirstMigration = tasksAfterFirstMigration.find(t => t.id === firstMigrationId)!;

    console.log('\n=== AFTER FIRST MIGRATION (sub-task to Today\'s Log) ===');
    console.log('Sub-task (original in Work Projects):', {
      id: subTaskOriginal.id.substring(0, 8),
      title: subTaskOriginal.title,
      collectionId: subTaskOriginal.collectionId,
      parentEntryId: subTaskOriginal.parentEntryId?.substring(0, 8),
      migratedFrom: subTaskOriginal.migratedFrom?.substring(0, 8),
      migratedFromCollectionId: subTaskOriginal.migratedFromCollectionId,
      migratedTo: subTaskOriginal.migratedTo?.substring(0, 8),
      migratedToCollectionId: subTaskOriginal.migratedToCollectionId,
    });
    console.log('Sub-task (first migration in Today\'s Log):', {
      id: subTaskFirstMigration.id.substring(0, 8),
      title: subTaskFirstMigration.title,
      collectionId: subTaskFirstMigration.collectionId,
      parentEntryId: subTaskFirstMigration.parentEntryId?.substring(0, 8),
      migratedFrom: subTaskFirstMigration.migratedFrom?.substring(0, 8),
      migratedFromCollectionId: subTaskFirstMigration.migratedFromCollectionId,
      migratedTo: subTaskFirstMigration.migratedTo?.substring(0, 8),
      migratedToCollectionId: subTaskFirstMigration.migratedToCollectionId,
    });

    // Migrate parent to "Monthly Log"
    const parentMigratedId = await migrateTaskHandler.handle({
      taskId: parent.id,
      targetCollectionId: 'monthly-log'
    });

    const finalTasks = await entryProjection.getTasks();
    const subTaskOriginalFinal = finalTasks.find(t => t.id === subTask.id)!;
    const subTaskFirstMigrationFinal = finalTasks.find(t => t.id === firstMigrationId)!;
    const parentOriginalFinal = finalTasks.find(t => t.id === parent.id)!;
    const parentMigrated = finalTasks.find(t => t.id === parentMigratedId)!;

    console.log('\n=== AFTER PARENT MIGRATION (parent to Monthly Log) ===');
    console.log('Parent (original in Work Projects):', {
      id: parentOriginalFinal.id.substring(0, 8),
      title: parentOriginalFinal.title,
      collectionId: parentOriginalFinal.collectionId,
      parentEntryId: parentOriginalFinal.parentEntryId,
      migratedFrom: parentOriginalFinal.migratedFrom?.substring(0, 8),
      migratedTo: parentOriginalFinal.migratedTo?.substring(0, 8),
      migratedToCollectionId: parentOriginalFinal.migratedToCollectionId,
    });
    console.log('Parent (migrated to Monthly Log):', {
      id: parentMigrated.id.substring(0, 8),
      title: parentMigrated.title,
      collectionId: parentMigrated.collectionId,
      parentEntryId: parentMigrated.parentEntryId,
      migratedFrom: parentMigrated.migratedFrom?.substring(0, 8),
      migratedFromCollectionId: parentMigrated.migratedFromCollectionId,
      migratedTo: parentMigrated.migratedTo?.substring(0, 8),
    });
    console.log('Sub-task (original in Work Projects):', {
      id: subTaskOriginalFinal.id.substring(0, 8),
      title: subTaskOriginalFinal.title,
      collectionId: subTaskOriginalFinal.collectionId,
      parentEntryId: subTaskOriginalFinal.parentEntryId?.substring(0, 8),
      migratedFrom: subTaskOriginalFinal.migratedFrom?.substring(0, 8),
      migratedTo: subTaskOriginalFinal.migratedTo?.substring(0, 8),
      migratedToCollectionId: subTaskOriginalFinal.migratedToCollectionId,
    });
    console.log('Sub-task (first migration in Today\'s Log):', {
      id: subTaskFirstMigrationFinal.id.substring(0, 8),
      title: subTaskFirstMigrationFinal.title,
      collectionId: subTaskFirstMigrationFinal.collectionId,
      parentEntryId: subTaskFirstMigrationFinal.parentEntryId?.substring(0, 8),
      migratedFrom: subTaskFirstMigrationFinal.migratedFrom?.substring(0, 8),
      migratedFromCollectionId: subTaskFirstMigrationFinal.migratedFromCollectionId,
      migratedTo: subTaskFirstMigrationFinal.migratedTo?.substring(0, 8),
      migratedToCollectionId: subTaskFirstMigrationFinal.migratedToCollectionId,
    });

    // Check if second migration exists
    const secondMigrationId = subTaskFirstMigrationFinal.migratedTo;
    if (secondMigrationId) {
      const subTaskSecondMigration = finalTasks.find(t => t.id === secondMigrationId)!;
      console.log('Sub-task (second migration in Monthly Log):', {
        id: subTaskSecondMigration.id.substring(0, 8),
        title: subTaskSecondMigration.title,
        collectionId: subTaskSecondMigration.collectionId,
        parentEntryId: subTaskSecondMigration.parentEntryId?.substring(0, 8),
        migratedFrom: subTaskSecondMigration.migratedFrom?.substring(0, 8),
        migratedFromCollectionId: subTaskSecondMigration.migratedFromCollectionId,
        migratedTo: subTaskSecondMigration.migratedTo?.substring(0, 8),
        migratedToCollectionId: subTaskSecondMigration.migratedToCollectionId,
      });

      // UI CHECK: Can we detect this is a migration chain?
      console.log('\n=== UI DETECTION CHECKS ===');
      console.log('Can detect second migration has chain?', {
        hasMigratedFrom: !!subTaskSecondMigration.migratedFrom,
        migratedFromCollectionId: subTaskSecondMigration.migratedFromCollectionId,
        shouldShowGoBackTo: subTaskSecondMigration.migratedFromCollectionId,
      });

      console.log('Can detect first migration has forward link?', {
        hasMigratedTo: !!subTaskFirstMigrationFinal.migratedTo,
        migratedToCollectionId: subTaskFirstMigrationFinal.migratedToCollectionId,
        shouldShowGoTo: subTaskFirstMigrationFinal.migratedToCollectionId,
      });

      // Verify expectations
      expect(subTaskSecondMigration.migratedFrom).toBe(firstMigrationId);
      expect(subTaskSecondMigration.migratedFromCollectionId).toBe('todays-log');
      expect(subTaskFirstMigrationFinal.migratedTo).toBe(secondMigrationId);
      expect(subTaskFirstMigrationFinal.migratedToCollectionId).toBe('monthly-log');
    } else {
      console.log('ERROR: Second migration not created!');
      expect(secondMigrationId).toBeDefined();
    }
  });
});
