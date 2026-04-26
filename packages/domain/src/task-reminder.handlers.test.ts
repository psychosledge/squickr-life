import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SetTaskReminderHandler, ClearTaskReminderHandler } from './task-reminder.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import type { TaskCreated, TaskReminderSet, TaskReminderCleared } from './task.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTaskCreatedEvent(taskId: string): TaskCreated {
  return {
    id: `evt-created-${taskId}`,
    type: 'TaskCreated',
    aggregateId: taskId,
    timestamp: new Date('2026-04-07T09:00:00.000Z').toISOString(),
    version: 1,
    payload: {
      id: taskId,
      content: 'Test task',
      createdAt: new Date('2026-04-07T09:00:00.000Z').toISOString(),
      status: 'open',
    },
  };
}

/** A valid future ISO datetime — 1 hour from the mocked "now" */
const MOCKED_NOW = new Date('2026-04-07T10:00:00.000Z');
const FUTURE_REMINDER = new Date(MOCKED_NOW.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
const PAST_REMINDER = new Date(MOCKED_NOW.getTime() - 60 * 1000).toISOString(); // -1 min
const TOO_SOON_REMINDER = new Date(MOCKED_NOW.getTime() + 30 * 1000).toISOString(); // +30s (< 1 min)

// ---------------------------------------------------------------------------

describe('SetTaskReminderHandler', () => {
  let eventStore: IEventStore;
  let entryProjection: EntryListProjection;
  let handler: SetTaskReminderHandler;

  beforeEach(() => {
    // Fix "now" so past/future tests are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(MOCKED_NOW);

    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new SetTaskReminderHandler(eventStore, entryProjection);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appends a TaskReminderSet event for a valid future datetime', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await handler.handle({ taskId, reminderAt: FUTURE_REMINDER });

    const events = await eventStore.getAll();
    const reminderEvent = events.find(e => e.type === 'TaskReminderSet') as TaskReminderSet;
    expect(reminderEvent).toBeDefined();
    expect(reminderEvent.aggregateId).toBe(taskId);
    expect(reminderEvent.payload.taskId).toBe(taskId);
    expect(reminderEvent.payload.reminderAt).toBe(FUTURE_REMINDER);
    expect(reminderEvent.payload.setAt).toBeDefined();
  });

  it('rejects empty reminderAt', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await expect(handler.handle({ taskId, reminderAt: '' })).rejects.toThrow();
  });

  it('rejects non-ISO reminderAt', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await expect(handler.handle({ taskId, reminderAt: 'not-a-date' })).rejects.toThrow();
  });

  it('rejects reminderAt in the past', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await expect(handler.handle({ taskId, reminderAt: PAST_REMINDER })).rejects.toThrow(/past/i);
  });

  it('rejects reminderAt less than 1 minute in the future', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await expect(handler.handle({ taskId, reminderAt: TOO_SOON_REMINDER })).rejects.toThrow(/minute/i);
  });

  it('rejects command for a non-existent task', async () => {
    await expect(handler.handle({ taskId: 'no-such-task', reminderAt: FUTURE_REMINDER })).rejects.toThrow(/not found/i);
  });

  it('a second call appends a second TaskReminderSet (replace semantics via applicator)', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    const secondReminder = new Date(MOCKED_NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    await handler.handle({ taskId, reminderAt: FUTURE_REMINDER });
    await handler.handle({ taskId, reminderAt: secondReminder });

    const events = await eventStore.getAll();
    const reminderEvents = events.filter(e => e.type === 'TaskReminderSet') as TaskReminderSet[];
    expect(reminderEvents).toHaveLength(2);
    expect(reminderEvents[1].payload.reminderAt).toBe(secondReminder);
  });
});

// ---------------------------------------------------------------------------

describe('ClearTaskReminderHandler', () => {
  let eventStore: IEventStore;
  let entryProjection: EntryListProjection;
  let handler: ClearTaskReminderHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new ClearTaskReminderHandler(eventStore, entryProjection);
  });

  it('appends a TaskReminderCleared event with reason "user"', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await handler.handle({ taskId, reason: 'user' });

    const events = await eventStore.getAll();
    const clearedEvent = events.find(e => e.type === 'TaskReminderCleared') as TaskReminderCleared;
    expect(clearedEvent).toBeDefined();
    expect(clearedEvent.aggregateId).toBe(taskId);
    expect(clearedEvent.payload.taskId).toBe(taskId);
    expect(clearedEvent.payload.reason).toBe('user');
    expect(clearedEvent.payload.clearedAt).toBeDefined();
  });

  it('only accepts reason "user" (fired is dead code on the command)', async () => {
    // The 'fired' branch is only ever written by the Cloud Function via Admin SDK,
    // so the command union only allows 'user'. Verify the handler works with 'user'
    // and that the resulting event carries reason 'user'.
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    await handler.handle({ taskId, reason: 'user' });

    const events = await eventStore.getAll();
    const clearedEvent = events.find(e => e.type === 'TaskReminderCleared') as TaskReminderCleared;
    expect(clearedEvent).toBeDefined();
    expect(clearedEvent.payload.reason).toBe('user');
  });

  it('works even if no reminder is currently set (idempotent)', async () => {
    const taskId = 'task-1';
    await eventStore.append(makeTaskCreatedEvent(taskId));

    // No reminder set — should not throw
    await expect(handler.handle({ taskId, reason: 'user' })).resolves.not.toThrow();

    const events = await eventStore.getAll();
    const clearedEvent = events.find(e => e.type === 'TaskReminderCleared');
    expect(clearedEvent).toBeDefined();
  });

  it('rejects command for a non-existent task', async () => {
    await expect(handler.handle({ taskId: 'no-such-task', reason: 'user' })).rejects.toThrow(/not found/i);
  });
});
