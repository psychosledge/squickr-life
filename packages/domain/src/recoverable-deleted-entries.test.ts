/**
 * Item 3: Recoverable Deleted Entries
 *
 * Tests for soft-delete, restore, multi-collection delete, sub-task cascade,
 * stats filtering, and getDeletedEntries projection.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import { CreateTaskHandler, DeleteTaskHandler } from './task.handlers';
import { RestoreTaskHandler } from './task.handlers';
import { CreateNoteHandler, DeleteNoteHandler } from './note.handlers';
import { RestoreNoteHandler } from './note.handlers';
import { CreateEventHandler, DeleteEventHandler } from './event.handlers';
import { RestoreEventHandler } from './event.handlers';
import { CreateSubTaskHandler } from './sub-task.handlers';
import { DeleteParentTaskHandler } from './delete-parent-task.handler';
import { AddTaskToCollectionHandler } from './collection-management.handlers';
import type { IEventStore } from './event-store';
import type {
  TaskRestored,
  NoteRestored,
  EventRestored,
  RestoreTaskCommand,
  RestoreNoteCommand,
  RestoreEventCommand,
} from './task.types';

// ============================================================================
// Helper setup
// ============================================================================

function makeSetup() {
  const eventStore: IEventStore = new InMemoryEventStore();
  const entryProjection = new EntryListProjection(eventStore);
  const taskProjection = new TaskListProjection(eventStore);

  const createTaskHandler = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
  const deleteTaskHandler = new DeleteTaskHandler(eventStore, entryProjection);
  const restoreTaskHandler = new RestoreTaskHandler(eventStore, entryProjection);

  const createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
  const deleteNoteHandler = new DeleteNoteHandler(eventStore, entryProjection);
  const restoreNoteHandler = new RestoreNoteHandler(eventStore, entryProjection);

  const createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  const deleteEventHandler = new DeleteEventHandler(eventStore, entryProjection);
  const restoreEventHandler = new RestoreEventHandler(eventStore, entryProjection);

  const createSubTaskHandler = new CreateSubTaskHandler(eventStore, entryProjection);
  const deleteParentTaskHandler = new DeleteParentTaskHandler(eventStore, entryProjection);
  const addToCollectionHandler = new AddTaskToCollectionHandler(eventStore, entryProjection);

  return {
    eventStore,
    entryProjection,
    createTaskHandler,
    deleteTaskHandler,
    restoreTaskHandler,
    createNoteHandler,
    deleteNoteHandler,
    restoreNoteHandler,
    createEventHandler,
    deleteEventHandler,
    restoreEventHandler,
    createSubTaskHandler,
    deleteParentTaskHandler,
    addToCollectionHandler,
  };
}

// ============================================================================
// 1. Soft Delete: Task
// ============================================================================

describe('Soft Delete - Task', () => {
  it('should set deletedAt on task after TaskDeleted (not hard-remove from projection)', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });

    // Task should still be retrievable (not hard-deleted from map)
    // BUT should have deletedAt set
    const deletedTask = await entryProjection.getTaskById(taskId);
    expect(deletedTask).toBeDefined();
    expect(deletedTask!.deletedAt).toBeDefined();
    expect(deletedTask!.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should NOT return deleted tasks in getEntries (active entries)', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });

    const entries = await entryProjection.getEntries();
    expect(entries.find(e => e.id === taskId)).toBeUndefined();
  });

  it('should NOT return deleted tasks in getEntriesByCollection', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });

    const entries = await entryProjection.getEntriesByCollection('col-1');
    expect(entries.find(e => e.id === taskId)).toBeUndefined();
  });
});

// ============================================================================
// 2. Soft Delete: Note
// ============================================================================

describe('Soft Delete - Note', () => {
  it('should set deletedAt on note after NoteDeleted', async () => {
    const { createNoteHandler, deleteNoteHandler, entryProjection } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'My note', collectionId: 'col-1' });
    await deleteNoteHandler.handle({ noteId });

    const deletedNote = await entryProjection.getNoteById(noteId);
    expect(deletedNote).toBeDefined();
    expect(deletedNote!.deletedAt).toBeDefined();
  });

  it('should NOT return deleted notes in getEntries', async () => {
    const { createNoteHandler, deleteNoteHandler, entryProjection } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'My note', collectionId: 'col-1' });
    await deleteNoteHandler.handle({ noteId });

    const entries = await entryProjection.getEntries();
    expect(entries.find(e => e.id === noteId)).toBeUndefined();
  });
});

// ============================================================================
// 3. Soft Delete: Event Entry
// ============================================================================

describe('Soft Delete - Event Entry', () => {
  it('should set deletedAt on event entry after EventDeleted', async () => {
    const { createEventHandler, deleteEventHandler, entryProjection } = makeSetup();

    const eventId = await createEventHandler.handle({ content: 'My event', collectionId: 'col-1' });
    await deleteEventHandler.handle({ eventId });

    const deletedEvent = await entryProjection.getEventById(eventId);
    expect(deletedEvent).toBeDefined();
    expect(deletedEvent!.deletedAt).toBeDefined();
  });

  it('should NOT return deleted events in getEntries', async () => {
    const { createEventHandler, deleteEventHandler, entryProjection } = makeSetup();

    const eventId = await createEventHandler.handle({ content: 'My event', collectionId: 'col-1' });
    await deleteEventHandler.handle({ eventId });

    const entries = await entryProjection.getEntries();
    expect(entries.find(e => e.id === eventId)).toBeUndefined();
  });
});

// ============================================================================
// 4. Restore Task
// ============================================================================

describe('RestoreTaskHandler', () => {
  it('should emit TaskRestored event', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler, eventStore } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });
    await restoreTaskHandler.handle({ taskId });

    const events = await eventStore.getAll();
    const restoreEvent = events.find(e => e.type === 'TaskRestored');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent!.aggregateId).toBe(taskId);
    const restored = restoreEvent as TaskRestored;
    expect(restored.payload.id).toBe(taskId);
    expect(restored.payload.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should clear deletedAt after restore', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });
    await restoreTaskHandler.handle({ taskId });

    const task = await entryProjection.getTaskById(taskId);
    expect(task).toBeDefined();
    expect(task!.deletedAt).toBeUndefined();
  });

  it('should return restored task in getEntries again', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });
    await restoreTaskHandler.handle({ taskId });

    const entries = await entryProjection.getEntries();
    expect(entries.find(e => e.id === taskId)).toBeDefined();
  });

  it('should throw error when restoring a non-deleted task', async () => {
    const { createTaskHandler, restoreTaskHandler } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'My task' });
    await expect(restoreTaskHandler.handle({ taskId })).rejects.toThrow();
  });

  it('should throw error when restoring a non-existent task', async () => {
    const { restoreTaskHandler } = makeSetup();
    await expect(restoreTaskHandler.handle({ taskId: 'non-existent' })).rejects.toThrow();
  });
});

// ============================================================================
// 5. Restore Note
// ============================================================================

describe('RestoreNoteHandler', () => {
  it('should emit NoteRestored event', async () => {
    const { createNoteHandler, deleteNoteHandler, restoreNoteHandler, eventStore } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'My note', collectionId: 'col-1' });
    await deleteNoteHandler.handle({ noteId });
    await restoreNoteHandler.handle({ noteId });

    const events = await eventStore.getAll();
    const restoreEvent = events.find(e => e.type === 'NoteRestored');
    expect(restoreEvent).toBeDefined();
    const restored = restoreEvent as NoteRestored;
    expect(restored.payload.id).toBe(noteId);
    expect(restored.payload.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should clear deletedAt after note restore', async () => {
    const { createNoteHandler, deleteNoteHandler, restoreNoteHandler, entryProjection } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'My note', collectionId: 'col-1' });
    await deleteNoteHandler.handle({ noteId });
    await restoreNoteHandler.handle({ noteId });

    const note = await entryProjection.getNoteById(noteId);
    expect(note!.deletedAt).toBeUndefined();
  });

  it('should throw error when restoring a non-deleted note', async () => {
    const { createNoteHandler, restoreNoteHandler } = makeSetup();
    const noteId = await createNoteHandler.handle({ content: 'My note' });
    await expect(restoreNoteHandler.handle({ noteId })).rejects.toThrow();
  });
});

// ============================================================================
// 6. Restore Event Entry
// ============================================================================

describe('RestoreEventHandler', () => {
  it('should emit EventRestored event', async () => {
    const { createEventHandler, deleteEventHandler, restoreEventHandler, eventStore } = makeSetup();

    const eventId = await createEventHandler.handle({ content: 'My event', collectionId: 'col-1' });
    await deleteEventHandler.handle({ eventId });
    await restoreEventHandler.handle({ eventId });

    const events = await eventStore.getAll();
    const restoreEvent = events.find(e => e.type === 'EventRestored');
    expect(restoreEvent).toBeDefined();
    const restored = restoreEvent as EventRestored;
    expect(restored.payload.id).toBe(eventId);
    expect(restored.payload.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should clear deletedAt after event restore', async () => {
    const { createEventHandler, deleteEventHandler, restoreEventHandler, entryProjection } = makeSetup();

    const eventId = await createEventHandler.handle({ content: 'My event', collectionId: 'col-1' });
    await deleteEventHandler.handle({ eventId });
    await restoreEventHandler.handle({ eventId });

    const evt = await entryProjection.getEventById(eventId);
    expect(evt!.deletedAt).toBeUndefined();
  });

  it('should throw error when restoring a non-deleted event', async () => {
    const { createEventHandler, restoreEventHandler } = makeSetup();
    const eventId = await createEventHandler.handle({ content: 'My event' });
    await expect(restoreEventHandler.handle({ eventId })).rejects.toThrow();
  });
});

// ============================================================================
// 7. Multi-Collection Delete Logic
// ============================================================================

describe('Multi-Collection Delete', () => {
  it('should emit TaskRemovedFromCollection when deleting from one collection while in multiple', async () => {
    const { createTaskHandler, addToCollectionHandler, deleteTaskHandler, eventStore, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Multi-col task', collectionId: 'col-A' });
    await addToCollectionHandler.handle({ taskId, collectionId: 'col-B' });

    // Delete from col-A, but task is still in col-B
    await deleteTaskHandler.handle({ taskId, currentCollectionId: 'col-A' });

    const events = await eventStore.getAll();
    const removedEvent = events.find(e => e.type === 'TaskRemovedFromCollection');
    const deletedEvent = events.find(e => e.type === 'TaskDeleted');

    expect(removedEvent).toBeDefined();
    expect(deletedEvent).toBeUndefined(); // No full delete — task still in col-B

    // Task should still be active (not deleted)
    const task = await entryProjection.getTaskById(taskId);
    expect(task).toBeDefined();
    expect(task!.deletedAt).toBeUndefined();
  });

  it('should emit TaskDeleted (soft) when deleting from last collection', async () => {
    const { createTaskHandler, addToCollectionHandler, deleteTaskHandler, eventStore, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Multi-col task', collectionId: 'col-A' });
    await addToCollectionHandler.handle({ taskId, collectionId: 'col-B' });

    // Delete from col-A (now only in col-B)
    await deleteTaskHandler.handle({ taskId, currentCollectionId: 'col-A' });
    // Delete from col-B (last collection)
    await deleteTaskHandler.handle({ taskId, currentCollectionId: 'col-B' });

    const task = await entryProjection.getTaskById(taskId);
    expect(task!.deletedAt).toBeDefined();
  });

  it('should emit TaskDeleted (soft) when no currentCollectionId provided', async () => {
    const { createTaskHandler, addToCollectionHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task in 2 cols', collectionId: 'col-A' });
    await addToCollectionHandler.handle({ taskId, collectionId: 'col-B' });

    // Delete without specifying collection → full soft delete
    await deleteTaskHandler.handle({ taskId });

    const task = await entryProjection.getTaskById(taskId);
    expect(task!.deletedAt).toBeDefined();
  });

  it('should emit TaskDeleted (soft) when task is in only one collection', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Single-col task', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId, currentCollectionId: 'col-A' });

    const task = await entryProjection.getTaskById(taskId);
    expect(task!.deletedAt).toBeDefined();
  });
});

// ============================================================================
// 8. Sub-Task Cascade on Delete
// ============================================================================

describe('Sub-Task Cascade Delete', () => {
  it('should soft-delete children when parent is deleted via DeleteParentTaskHandler', async () => {
    const { createTaskHandler, createSubTaskHandler, deleteParentTaskHandler, entryProjection } = makeSetup();

    const parentId = await createTaskHandler.handle({ title: 'Parent task', collectionId: 'col-1' });
    const child1Id = await createSubTaskHandler.handle({ title: 'Child 1', parentEntryId: parentId });
    const child2Id = await createSubTaskHandler.handle({ title: 'Child 2', parentEntryId: parentId });

    await deleteParentTaskHandler.handle({ taskId: parentId, confirmed: true });

    // Parent should be soft-deleted
    const parent = await entryProjection.getTaskById(parentId);
    expect(parent!.deletedAt).toBeDefined();

    // Children should be soft-deleted too
    const child1 = await entryProjection.getTaskById(child1Id);
    const child2 = await entryProjection.getTaskById(child2Id);
    expect(child1!.deletedAt).toBeDefined();
    expect(child2!.deletedAt).toBeDefined();
  });

  it('should not return soft-deleted children in getSubTasks', async () => {
    const { createTaskHandler, createSubTaskHandler, deleteParentTaskHandler, entryProjection } = makeSetup();

    const parentId = await createTaskHandler.handle({ title: 'Parent task', collectionId: 'col-1' });
    await createSubTaskHandler.handle({ title: 'Child 1', parentEntryId: parentId });
    await createSubTaskHandler.handle({ title: 'Child 2', parentEntryId: parentId });

    await deleteParentTaskHandler.handle({ taskId: parentId, confirmed: true });

    const subTasks = await entryProjection.getSubTasks(parentId);
    expect(subTasks).toHaveLength(0);
  });
});

// ============================================================================
// 9. Sub-Task Cascade Restore
// ============================================================================

describe('Sub-Task Cascade Restore', () => {
  it('should restore sub-tasks deleted within 1 second of parent when parent is restored', async () => {
    const { createTaskHandler, createSubTaskHandler, deleteParentTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const parentId = await createTaskHandler.handle({ title: 'Parent task', collectionId: 'col-1' });
    const child1Id = await createSubTaskHandler.handle({ title: 'Child 1', parentEntryId: parentId });
    const child2Id = await createSubTaskHandler.handle({ title: 'Child 2', parentEntryId: parentId });

    // Delete parent + children (all deleted at near-same time)
    await deleteParentTaskHandler.handle({ taskId: parentId, confirmed: true });

    // Restore parent
    await restoreTaskHandler.handle({ taskId: parentId });

    // All children should be restored
    const child1 = await entryProjection.getTaskById(child1Id);
    const child2 = await entryProjection.getTaskById(child2Id);
    expect(child1!.deletedAt).toBeUndefined();
    expect(child2!.deletedAt).toBeUndefined();
  });

  it('should restore parent in getSubTasks after restore', async () => {
    const { createTaskHandler, createSubTaskHandler, deleteParentTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const parentId = await createTaskHandler.handle({ title: 'Parent task', collectionId: 'col-1' });
    const child1Id = await createSubTaskHandler.handle({ title: 'Child 1', parentEntryId: parentId });

    await deleteParentTaskHandler.handle({ taskId: parentId, confirmed: true });
    await restoreTaskHandler.handle({ taskId: parentId });

    const subTasks = await entryProjection.getSubTasks(parentId);
    expect(subTasks.length).toBeGreaterThan(0);
  });

  it('should NOT restore sub-tasks that were already deleted before parent', async () => {
    const { createTaskHandler, createSubTaskHandler, deleteTaskHandler, deleteParentTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const parentId = await createTaskHandler.handle({ title: 'Parent task', collectionId: 'col-1' });
    const child1Id = await createSubTaskHandler.handle({ title: 'Child 1', parentEntryId: parentId });
    const child2Id = await createSubTaskHandler.handle({ title: 'Child 2', parentEntryId: parentId });

    // Delete child1 independently — must be sufficiently before parent deletion
    // so that child1's deletedAt is > 1000ms before parent's deletedAt.
    await deleteTaskHandler.handle({ taskId: child1Id });

    // Advance fake time by 2 seconds so child1's deletion is clearly outside the
    // 1-second restore window relative to the upcoming parent deletion.
    // (In the test environment Date.now() is the same millisecond unless we wait.)
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Let's delete parent (only child2 is still active, child1 already deleted)
    // getSubTasks only returns non-deleted, so only child2 gets deleted by DeleteParentTask
    await deleteParentTaskHandler.handle({ taskId: parentId, confirmed: true });

    await restoreTaskHandler.handle({ taskId: parentId });

    // child2 should be restored (deleted at same time as parent)
    const child2 = await entryProjection.getTaskById(child2Id);
    expect(child2!.deletedAt).toBeUndefined();

    // child1 was deleted independently BEFORE the parent — should NOT be restored
    const child1After = await entryProjection.getTaskById(child1Id);
    expect(child1After).toBeDefined();
    expect(child1After!.deletedAt).toBeDefined(); // child1 was deleted BEFORE parent, should NOT be restored
  });
});

// ============================================================================
// 10. Stats: Deleted entries excluded
// ============================================================================

describe('Stats - Deleted entries excluded', () => {
  it('getEntryCountsByCollection should not count deleted entries', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-A' });
    const taskId2 = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-A' });

    let counts = await entryProjection.getEntryCountsByCollection();
    expect(counts.get('col-A')).toBe(2);

    await deleteTaskHandler.handle({ taskId: taskId2 });

    counts = await entryProjection.getEntryCountsByCollection();
    expect(counts.get('col-A')).toBe(1);
  });

  it('getActiveTaskCountsByCollection should not count deleted tasks', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-A' });
    const taskId2 = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-A' });

    await deleteTaskHandler.handle({ taskId: taskId2 });

    const counts = await entryProjection.getActiveTaskCountsByCollection();
    expect(counts.get('col-A')).toBe(1);
  });

  it('getEntryStatsByCollection should not count deleted entries', async () => {
    const { createTaskHandler, createNoteHandler, deleteTaskHandler, deleteNoteHandler, entryProjection } = makeSetup();

    await createTaskHandler.handle({ title: 'Task 1', collectionId: 'col-A' });
    const taskId2 = await createTaskHandler.handle({ title: 'Task 2', collectionId: 'col-A' });
    const noteId = await createNoteHandler.handle({ content: 'Note 1', collectionId: 'col-A' });

    // Before deletes
    let stats = await entryProjection.getEntryStatsByCollection();
    expect(stats.get('col-A')!.openTasks).toBe(2);
    expect(stats.get('col-A')!.notes).toBe(1);

    // Delete one task and one note
    await deleteTaskHandler.handle({ taskId: taskId2 });
    await deleteNoteHandler.handle({ noteId });

    stats = await entryProjection.getEntryStatsByCollection();
    expect(stats.get('col-A')!.openTasks).toBe(1);
    expect(stats.get('col-A')!.notes).toBe(0);
  });
});

// ============================================================================
// 11. getDeletedEntries projection
// ============================================================================

describe('EntryListProjection.getDeletedEntries', () => {
  it('should return deleted entries for a collection', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task to delete', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe(taskId);
  });

  it('should return empty array when no deleted entries for collection', async () => {
    const { createTaskHandler, entryProjection } = makeSetup();

    await createTaskHandler.handle({ title: 'Active task', collectionId: 'col-A' });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(0);
  });

  it('should not return active entries in getDeletedEntries', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId1 = await createTaskHandler.handle({ title: 'Active task', collectionId: 'col-A' });
    const taskId2 = await createTaskHandler.handle({ title: 'Deleted task', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId: taskId2 });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe(taskId2);
  });

  it('should handle deleted notes and events too', async () => {
    const { createNoteHandler, createEventHandler, deleteNoteHandler, deleteEventHandler, entryProjection } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'Deleted note', collectionId: 'col-A' });
    const eventId = await createEventHandler.handle({ content: 'Deleted event', collectionId: 'col-A' });

    await deleteNoteHandler.handle({ noteId });
    await deleteEventHandler.handle({ eventId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(2);
    const ids = deleted.map(e => e.id);
    expect(ids).toContain(noteId);
    expect(ids).toContain(eventId);
  });

  it('should not return deleted entries from a different collection', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task in B', collectionId: 'col-B' });
    await deleteTaskHandler.handle({ taskId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(0);
  });

  it('should not return restored entries in getDeletedEntries', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task to restore', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId });
    await restoreTaskHandler.handle({ taskId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(0);
  });
});

// ============================================================================
// 12. getEntriesForCollectionView - active entries should exclude deleted
// ============================================================================

describe('getEntriesForCollectionView - excludes deleted from active', () => {
  it('should not include deleted entries in active entries section', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const activeId = await createTaskHandler.handle({ title: 'Active', collectionId: 'col-A' });
    const deletedId = await createTaskHandler.handle({ title: 'Deleted', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId: deletedId });

    const collectionView = await entryProjection.getEntriesForCollectionView('col-A');
    const activeEntries = collectionView.filter(e => !e.renderAsGhost);
    expect(activeEntries.find(e => e.id === deletedId)).toBeUndefined();
    expect(activeEntries.find(e => e.id === activeId)).toBeDefined();
  });
});

// ============================================================================
// 13. Backward compatibility: existing delete tests still pass
// ============================================================================

describe('Backward Compatibility - Delete still works end-to-end', () => {
  it('should not return deleted task when querying by ID after double-delete attempt', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task' });
    await deleteTaskHandler.handle({ taskId });

    // Second delete should fail (task not found as active)
    await expect(deleteTaskHandler.handle({ taskId })).rejects.toThrow();
  });

  it('getDailyLogs should not show deleted entries', async () => {
    const { createTaskHandler, deleteTaskHandler, createNoteHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'To be deleted' });
    await createNoteHandler.handle({ content: 'Stays' });
    await deleteTaskHandler.handle({ taskId });

    const logs = await entryProjection.getDailyLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].entries).toHaveLength(1);
    expect(logs[0].entries[0].type).toBe('note');
  });
});

// ============================================================================
// T2: should throw if task is not soft-deleted
// ============================================================================

describe('RestoreTaskHandler - error cases', () => {
  it('T2: should throw if task is not soft-deleted (active task)', async () => {
    const { createTaskHandler, restoreTaskHandler } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Active task', collectionId: 'col-1' });

    // Attempt to restore an active (non-deleted) task — should throw
    await expect(restoreTaskHandler.handle({ taskId })).rejects.toThrow(
      `Task ${taskId} is not deleted`
    );
  });

  it('T3: should throw on double restore (restore twice)', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Task', collectionId: 'col-1' });
    await deleteTaskHandler.handle({ taskId });
    await restoreTaskHandler.handle({ taskId }); // first restore succeeds

    // Second restore: task is no longer deleted, so it should throw
    await expect(restoreTaskHandler.handle({ taskId })).rejects.toThrow();
  });
});

// ============================================================================
// T4: getDeletedEntries returns empty array when no deleted entries
// ============================================================================

describe('getDeletedEntries - edge cases', () => {
  it('T4: returns empty array when no deleted entries exist', async () => {
    const { entryProjection } = makeSetup();

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(0);
  });

  it('T5: does not return deleted entries from other collections', async () => {
    const { createTaskHandler, deleteTaskHandler, entryProjection } = makeSetup();

    // Delete task from col-B
    const taskId = await createTaskHandler.handle({ title: 'Task in B', collectionId: 'col-B' });
    await deleteTaskHandler.handle({ taskId });

    // col-A should have no deleted entries
    const deletedInA = await entryProjection.getDeletedEntries('col-A');
    expect(deletedInA).toHaveLength(0);

    // col-B should have the deleted entry
    const deletedInB = await entryProjection.getDeletedEntries('col-B');
    expect(deletedInB).toHaveLength(1);
    expect(deletedInB[0].id).toBe(taskId);
  });

  it('T7: returns deleted notes in getDeletedEntries', async () => {
    const { createNoteHandler, deleteNoteHandler, entryProjection } = makeSetup();

    const noteId = await createNoteHandler.handle({ content: 'Deleted note', collectionId: 'col-A' });
    await deleteNoteHandler.handle({ noteId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe(noteId);
    expect(deleted[0].type).toBe('note');
    expect(deleted[0].deletedAt).toBeDefined();
  });

  it('T8: returns deleted events in getDeletedEntries', async () => {
    const { createEventHandler, deleteEventHandler, entryProjection } = makeSetup();

    const eventId = await createEventHandler.handle({ content: 'Deleted event', collectionId: 'col-A' });
    await deleteEventHandler.handle({ eventId });

    const deleted = await entryProjection.getDeletedEntries('col-A');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe(eventId);
    expect(deleted[0].type).toBe('event');
    expect(deleted[0].deletedAt).toBeDefined();
  });
});

// ============================================================================
// T6: should soft-delete (not remove-from-collection) when currentCollectionId
//     is not actually a member of the task's collections (verifies I3 fix)
// ============================================================================

describe('DeleteTaskHandler - I3 membership guard', () => {
  it('T6: should emit TaskDeleted (full soft-delete) when currentCollectionId is not a member of task collections', async () => {
    const { createTaskHandler, addToCollectionHandler, deleteTaskHandler, eventStore, entryProjection } = makeSetup();

    // Task is in col-A and col-B
    const taskId = await createTaskHandler.handle({ title: 'Multi-col task', collectionId: 'col-A' });
    await addToCollectionHandler.handle({ taskId, collectionId: 'col-B' });

    // Attempt to delete with a bogus/non-member collectionId
    // Even though task is in 2 collections, col-X is NOT a member — should full soft-delete
    await deleteTaskHandler.handle({ taskId, currentCollectionId: 'col-X' });

    const events = await eventStore.getAll();
    const removedEvent = events.find(e => e.type === 'TaskRemovedFromCollection');
    const deletedEvent = events.find(e => e.type === 'TaskDeleted');

    // Should be a full soft-delete, not a collection removal
    expect(removedEvent).toBeUndefined();
    expect(deletedEvent).toBeDefined();

    const task = await entryProjection.getTaskById(taskId);
    expect(task!.deletedAt).toBeDefined();
  });
});

// ============================================================================
// T9: restored task reappears in getEntriesForCollectionView
// ============================================================================

describe('getEntriesForCollectionView - restored entries reappear', () => {
  it('T9: restored task reappears in getEntriesForCollectionView as active entry', async () => {
    const { createTaskHandler, deleteTaskHandler, restoreTaskHandler, entryProjection } = makeSetup();

    const taskId = await createTaskHandler.handle({ title: 'Restorable task', collectionId: 'col-A' });
    await deleteTaskHandler.handle({ taskId });

    // After delete: should NOT appear as active entry
    let view = await entryProjection.getEntriesForCollectionView('col-A');
    expect(view.filter(e => !e.renderAsGhost).find(e => e.id === taskId)).toBeUndefined();

    // Restore task
    await restoreTaskHandler.handle({ taskId });

    // After restore: should appear as active entry again
    view = await entryProjection.getEntriesForCollectionView('col-A');
    expect(view.filter(e => !e.renderAsGhost).find(e => e.id === taskId)).toBeDefined();
  });
});
