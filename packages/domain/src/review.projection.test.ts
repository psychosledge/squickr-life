import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import { TaskListProjection } from './task.projections';
import {
  CreateTaskHandler,
  CompleteTaskHandler,
} from './index';
import type { Collection } from './collection.types';
import type { DomainEvent } from './domain-event';
import type { TaskCreated, TaskAddedToCollection } from './task.types';
import { ReviewProjection } from './review.projection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Collection stub for testing */
function makeCollection(id: string, type: Collection['type'], name: string = 'Test Collection'): Collection {
  return {
    id,
    name,
    type,
    order: 'a0',
    createdAt: new Date().toISOString(),
  };
}

/** Return a getCollection callback that looks up from a map */
function makeGetCollection(collections: Collection[]): (id: string) => Collection | undefined {
  const map = new Map(collections.map(c => [c.id, c]));
  return (id: string) => map.get(id);
}

/** Build a TaskCreated event with a specific timestamp for the aggregate */
function taskCreatedEventAt(taskId: string, timestamp: string, collectionId?: string): TaskCreated {
  return {
    id: crypto.randomUUID(),
    type: 'TaskCreated',
    aggregateId: taskId,
    timestamp,
    version: 1,
    payload: {
      id: taskId,
      content: 'Test task',
      createdAt: timestamp,
      status: 'open',
      collectionId,
    },
  };
}

/** Return an ISO timestamp N days ago from now */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('ReviewProjection.getCompletedInRange', () => {
  let eventStore: InstanceType<typeof InMemoryEventStore>;
  let entryProjection: EntryListProjection;
  let review: ReviewProjection;
  let createTask: CreateTaskHandler;
  let completeTask: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    const taskProjection = new TaskListProjection(eventStore);
    createTask = new CreateTaskHandler(eventStore, taskProjection, entryProjection);
    completeTask = new CompleteTaskHandler(eventStore, entryProjection);
    review = new ReviewProjection(entryProjection, eventStore);
  });

  it('returns empty array when no tasks exist', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');

    const result = await review.getCompletedInRange(from, to);

    expect(result).toEqual([]);
  });

  it('returns completed task with completedAt within range', async () => {
    const taskId = await createTask.handle({ content: 'Completed in range' });
    await completeTask.handle({ taskId });

    const now = new Date();
    const from = new Date(now.getTime() - 60_000); // 1 minute ago
    const to = new Date(now.getTime() + 60_000);   // 1 minute from now

    const result = await review.getCompletedInRange(from, to);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'task', id: taskId });
  });

  it('excludes task completed before range start', async () => {
    const taskId = await createTask.handle({ content: 'Old task' });
    await completeTask.handle({ taskId });

    // Range is in the future
    const from = new Date(Date.now() + 10_000);
    const to = new Date(Date.now() + 20_000);

    const result = await review.getCompletedInRange(from, to);

    expect(result).toEqual([]);
  });

  it('excludes task completed after range end', async () => {
    const taskId = await createTask.handle({ content: 'Future task' });
    await completeTask.handle({ taskId });

    // Range ended before the task was completed
    const to = new Date(Date.now() - 10_000);
    const from = new Date(Date.now() - 60_000);

    const result = await review.getCompletedInRange(from, to);

    expect(result).toEqual([]);
  });

  it('excludes open tasks (no completedAt)', async () => {
    await createTask.handle({ content: 'Open task' });

    const from = new Date(Date.now() - 60_000);
    const to = new Date(Date.now() + 60_000);

    const result = await review.getCompletedInRange(from, to);

    expect(result).toEqual([]);
  });

  it('excludes notes (type !== task)', async () => {
    // Directly append a NoteCreated event so we don't need a note handler dep
    const noteId = crypto.randomUUID();
    const completedAt = new Date().toISOString();
    await eventStore.append({
      id: crypto.randomUUID(),
      type: 'NoteCreated',
      aggregateId: noteId,
      timestamp: completedAt,
      version: 1,
      payload: { id: noteId, content: 'Some note', createdAt: completedAt },
    } as DomainEvent);

    const from = new Date(Date.now() - 60_000);
    const to = new Date(Date.now() + 60_000);

    const result = await review.getCompletedInRange(from, to);

    expect(result).toEqual([]);
  });

  it('includes multiple completed tasks within range', async () => {
    const id1 = await createTask.handle({ content: 'Task 1' });
    const id2 = await createTask.handle({ content: 'Task 2' });
    const id3 = await createTask.handle({ content: 'Task 3' });
    await completeTask.handle({ taskId: id1 });
    await completeTask.handle({ taskId: id2 });
    await completeTask.handle({ taskId: id3 });

    const from = new Date(Date.now() - 60_000);
    const to = new Date(Date.now() + 60_000);

    const result = await review.getCompletedInRange(from, to);

    expect(result).toHaveLength(3);
    const ids = result.map(e => e.id);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);
    expect(ids).toContain(id3);
  });
});

// ---------------------------------------------------------------------------
// getStalledMonthlyTasks
// ---------------------------------------------------------------------------

describe('ReviewProjection.getStalledMonthlyTasks', () => {
  let eventStore: InstanceType<typeof InMemoryEventStore>;
  let entryProjection: EntryListProjection;
  let review: ReviewProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    review = new ReviewProjection(entryProjection, eventStore);
  });

  // Helper: directly append a TaskCreated event with a specific timestamp
  // (bypasses the handler's "use current time" logic so we can set old timestamps)
  async function appendTaskCreated(
    taskId: string,
    timestamp: string,
    collectionId?: string,
  ): Promise<void> {
    const event = taskCreatedEventAt(taskId, timestamp, collectionId);
    await eventStore.append(event);
  }

  // Helper: append a TaskAddedToCollection event (collection-management, NOT content)
  async function appendTaskAddedToCollection(
    taskId: string,
    collectionId: string,
    timestamp: string = new Date().toISOString(),
  ): Promise<void> {
    const event: TaskAddedToCollection = {
      id: crypto.randomUUID(),
      type: 'TaskAddedToCollection',
      aggregateId: taskId,
      timestamp,
      version: 1,
      payload: { taskId, collectionId, addedAt: timestamp },
    };
    await eventStore.append(event);
  }

  it('returns empty array when no tasks exist', async () => {
    const result = await review.getStalledMonthlyTasks(7, () => undefined);
    expect(result).toEqual([]);
  });

  it('returns open task on monthly collection whose last content event is > threshold days ago', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    // Task created 10 days ago, in a monthly collection
    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(taskId);
    expect(result[0].collectionId).toBe(collectionId);
    expect(result[0].collectionName).toBe('March 2026');
    expect(result[0].staleDays).toBeGreaterThanOrEqual(10);
  });

  it('excludes open task on daily collection (not monthly)', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'daily-col-1';
    const dailyCol = makeCollection(collectionId, 'daily', 'Today');

    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([dailyCol]));

    expect(result).toHaveLength(0);
  });

  it('excludes completed task on monthly collection', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    // Complete the task
    await eventStore.append({
      id: crypto.randomUUID(),
      type: 'TaskCompleted',
      aggregateId: taskId,
      timestamp: daysAgo(8),
      version: 1,
      payload: { taskId, completedAt: daysAgo(8) },
    } as DomainEvent);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result).toHaveLength(0);
  });

  it('excludes open task on monthly collection whose last content event is within threshold', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    // Task created only 3 days ago → within threshold of 7
    await appendTaskCreated(taskId, daysAgo(3), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result).toHaveLength(0);
  });

  it('handles task with legacy collectionId field (not in collections[] array)', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-legacy';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'Legacy Monthly');

    // TaskCreated with collectionId in payload — the applicator will use this as legacy collectionId
    // but NOT put it in collections[] for older-style events
    await appendTaskCreated(taskId, daysAgo(15), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    // Even with legacy collectionId, the task should be detected as stalled
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(taskId);
  });

  it('sorts results most-stale-first', async () => {
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    const taskA = crypto.randomUUID();
    const taskB = crypto.randomUUID();
    const taskC = crypto.randomUUID();

    // taskB is most stale (30 days), taskA is middle (15 days), taskC is least (10 days)
    await appendTaskCreated(taskA, daysAgo(15), collectionId);
    await appendTaskCreated(taskB, daysAgo(30), collectionId);
    await appendTaskCreated(taskC, daysAgo(10), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result).toHaveLength(3);
    expect(result[0].entry.id).toBe(taskB); // most stale
    expect(result[1].entry.id).toBe(taskA);
    expect(result[2].entry.id).toBe(taskC); // least stale
  });

  it('sets staleDays correctly', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result).toHaveLength(1);
    // staleDays should be floor of (now - lastEventAt) in days
    // Should be 10 ± 1 due to test execution time
    expect(result[0].staleDays).toBe(10);
  });

  it('sets collectionName from getCollection callback', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'My Monthly Log');

    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    expect(result[0].collectionName).toBe('My Monthly Log');
  });

  it('returns collectionName as "Monthly Log" when collection not found', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'unknown-col';

    await appendTaskCreated(taskId, daysAgo(10), collectionId);

    // getCollection always returns undefined
    const result = await review.getStalledMonthlyTasks(7, () => undefined);

    // Task is in unknown-col but we can't confirm it's monthly without collection info.
    // So it should NOT appear in results (we can only detect monthly if the collection is found
    // OR if the task has collections[] that map to a known monthly collection).
    // Since collection is not found, the task has no confirmed monthly membership.
    expect(result).toHaveLength(0);
  });

  it('does NOT count TaskAddedToCollection / TaskMigratedToCollection as content events — task migrated repeatedly remains stale', async () => {
    const taskId = crypto.randomUUID();
    const collectionId = 'monthly-col-1';
    const monthlyCol = makeCollection(collectionId, 'monthly', 'March 2026');

    // Capture the creation timestamp once to compare later
    const creationTimestamp = daysAgo(20);

    // Task created 20 days ago (content event)
    await appendTaskCreated(taskId, creationTimestamp, collectionId);

    // Then migrated/added to collection repeatedly over the last few days (collection-management events)
    // These should NOT count as content events
    await appendTaskAddedToCollection(taskId, collectionId, daysAgo(3));
    await appendTaskAddedToCollection(taskId, 'another-col', daysAgo(2));
    await appendTaskAddedToCollection(taskId, 'yet-another-col', daysAgo(1));

    const result = await review.getStalledMonthlyTasks(7, makeGetCollection([monthlyCol]));

    // Task should still be considered stale (last CONTENT event was 20 days ago)
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(taskId);
    expect(result[0].staleDays).toBe(20);
    // lastEventAt should be the creation timestamp, not the collection-management timestamps
    expect(result[0].lastEventAt).toBe(creationTimestamp);
  });
});
