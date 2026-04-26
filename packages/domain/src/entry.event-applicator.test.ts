import { describe, it, expect } from 'vitest';
import { EntryEventApplicator } from './entry.event-applicator';
import type { DomainEvent } from './domain-event';
import type { Entry, Task } from './task.types';

// ---------------------------------------------------------------------------
// Minimal event factories (inline) — no external helper dependency
// ---------------------------------------------------------------------------

const ts = (offset = 0) => new Date(1_000_000 + offset).toISOString();

function taskCreatedEvent(id: string, title: string, offset = 0): DomainEvent {
  return {
    id: `evt-${id}`,
    type: 'TaskCreated',
    aggregateId: id,
    timestamp: ts(offset),
    payload: {
      id,
      content: title,
      createdAt: ts(offset),
      status: 'open',
      order: `a${id}`,
      userId: 'user-1',
    },
  } as unknown as DomainEvent;
}

function taskCompletedEvent(taskId: string, offset = 0): DomainEvent {
  return {
    id: `evt-complete-${taskId}`,
    type: 'TaskCompleted',
    aggregateId: taskId,
    timestamp: ts(offset),
    payload: {
      taskId,
      completedAt: ts(offset),
    },
  } as unknown as DomainEvent;
}

function noteTitleEvent(id: string, content: string, offset = 0): DomainEvent {
  return {
    id: `evt-note-${id}`,
    type: 'NoteCreated',
    aggregateId: id,
    timestamp: ts(offset),
    payload: {
      id,
      content,
      createdAt: ts(offset),
      order: `b${id}`,
      userId: 'user-1',
    },
  } as unknown as DomainEvent;
}

// ---------------------------------------------------------------------------
// Reminder event factories
// ---------------------------------------------------------------------------

function taskReminderSetEvent(taskId: string, reminderAt: string, offset = 0): DomainEvent {
  return {
    id: `evt-reminder-set-${taskId}`,
    type: 'TaskReminderSet',
    aggregateId: taskId,
    timestamp: ts(offset),
    payload: {
      taskId,
      reminderAt,
      setAt: ts(offset),
    },
  } as unknown as DomainEvent;
}

function taskReminderClearedEvent(taskId: string, reason: 'user' | 'fired', offset = 0): DomainEvent {
  return {
    id: `evt-reminder-cleared-${taskId}`,
    type: 'TaskReminderCleared',
    aggregateId: taskId,
    timestamp: ts(offset),
    payload: {
      taskId,
      clearedAt: ts(offset),
      reason,
    },
  } as unknown as DomainEvent;
}

// ---------------------------------------------------------------------------

describe('EntryEventApplicator — TaskReminderSet / TaskReminderCleared', () => {
  const applicator = new EntryEventApplicator();

  it('TaskReminderSet sets reminderAt on the task projection', () => {
    const reminderAt = '2026-04-08T10:00:00.000Z';
    const events = [
      taskCreatedEvent('t1', 'My task'),
      taskReminderSetEvent('t1', reminderAt, 100),
    ];
    const result = applicator.applyEvents(events);
    const task = result.find(e => e.id === 't1') as Task;
    expect(task.reminderAt).toBe(reminderAt);
  });

  it('a second TaskReminderSet overwrites the previous reminderAt', () => {
    const firstReminder = '2026-04-08T10:00:00.000Z';
    const secondReminder = '2026-04-09T12:00:00.000Z';
    const events = [
      taskCreatedEvent('t1', 'My task'),
      taskReminderSetEvent('t1', firstReminder, 100),
      taskReminderSetEvent('t1', secondReminder, 200),
    ];
    const result = applicator.applyEvents(events);
    const task = result.find(e => e.id === 't1') as Task;
    expect(task.reminderAt).toBe(secondReminder);
  });

  it('TaskReminderCleared removes reminderAt from the task', () => {
    const reminderAt = '2026-04-08T10:00:00.000Z';
    const events = [
      taskCreatedEvent('t1', 'My task'),
      taskReminderSetEvent('t1', reminderAt, 100),
      taskReminderClearedEvent('t1', 'user', 200),
    ];
    const result = applicator.applyEvents(events);
    const task = result.find(e => e.id === 't1') as Task;
    expect(task.reminderAt).toBeUndefined();
  });

  it('TaskReminderCleared on a task with no reminder is a no-op', () => {
    const events = [
      taskCreatedEvent('t1', 'My task'),
      taskReminderClearedEvent('t1', 'user', 100),
    ];
    const result = applicator.applyEvents(events);
    const task = result.find(e => e.id === 't1') as Task;
    expect(task.reminderAt).toBeUndefined();
    expect(task.content).toBe('My task'); // task still intact
  });
});

// ---------------------------------------------------------------------------

describe('EntryEventApplicator.applyEventsOnto', () => {
  const applicator = new EntryEventApplicator();

  // ---- 1. empty seed, no delta ----
  it('returns empty array when seed and deltaEvents are both empty', () => {
    const result = applicator.applyEventsOnto([], []);
    expect(result).toEqual([]);
  });

  // ---- 2. non-empty seed, no delta ----
  it('returns seed unchanged when deltaEvents is empty', () => {
    const allEvents = [taskCreatedEvent('t1', 'Task one')];
    const seed = applicator.applyEvents(allEvents);

    const result = applicator.applyEventsOnto(seed, []);

    // Same entries
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 't1', content: 'Task one', status: 'open' });
  });

  // ---- 3. seed + delta correctly applied ----
  it('applies delta events onto the seed state', () => {
    // Seed: t1 open
    const baseEvents: DomainEvent[] = [taskCreatedEvent('t1', 'Task one')];
    const seed = applicator.applyEvents(baseEvents);

    // Delta: complete t1
    const delta: DomainEvent[] = [taskCompletedEvent('t1', 100)];

    const result = applicator.applyEventsOnto(seed, delta);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 't1', status: 'completed' });
  });

  // ---- 4. delta adds new entries ----
  it('adds new entries from delta events to existing seed', () => {
    const baseEvents: DomainEvent[] = [taskCreatedEvent('t1', 'Task one')];
    const seed = applicator.applyEvents(baseEvents);

    const delta: DomainEvent[] = [taskCreatedEvent('t2', 'Task two', 50)];

    const result = applicator.applyEventsOnto(seed, delta);

    expect(result).toHaveLength(2);
    const ids = result.map(e => e.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
  });

  // ---- 5. mixed entry types in seed + delta ----
  it('handles mixed entry types (tasks and notes) in seed and delta', () => {
    const baseEvents: DomainEvent[] = [
      taskCreatedEvent('t1', 'Task one'),
      noteTitleEvent('n1', 'Note one', 10),
    ];
    const seed = applicator.applyEvents(baseEvents);

    const delta: DomainEvent[] = [taskCompletedEvent('t1', 200)];

    const result = applicator.applyEventsOnto(seed, delta);

    expect(result).toHaveLength(2);
    const task = result.find(e => e.id === 't1');
    const note = result.find(e => e.id === 'n1');
    expect(task).toMatchObject({ type: 'task', status: 'completed' });
    expect(note).toMatchObject({ type: 'note', id: 'n1' });
  });

  // ---- 6. equivalence: applyEventsOnto([], all) === applyEvents(all) ----
  it('produces the same result as applyEvents when seed is empty and all events are delta', () => {
    const allEvents: DomainEvent[] = [
      taskCreatedEvent('t1', 'Task one'),
      noteTitleEvent('n1', 'Note one', 10),
      taskCompletedEvent('t1', 20),
    ];

    const fromFull = applicator.applyEvents(allEvents);
    const fromDelta = applicator.applyEventsOnto([], allEvents);

    // Normalise: strip type tags added by mapsToSortedEntries (they come from the map values)
    // Both paths call mapsToSortedEntries so the shape should be identical.
    expect(fromDelta).toEqual(fromFull);
  });

  // ---- 7. applyEventsOnto(seed, delta) === applyEvents(base + delta) ----
  it('produces the same final state whether splitting at any point or doing a full replay', () => {
    const t1 = taskCreatedEvent('t1', 'Task one', 0);
    const n1 = noteTitleEvent('n1', 'Note one', 10);
    const complete = taskCompletedEvent('t1', 20);

    const allEvents: DomainEvent[] = [t1, n1, complete];
    const splitAt = 2; // seed = first 2 events, delta = last 1

    const seed: Entry[] = applicator.applyEvents(allEvents.slice(0, splitAt));
    const delta = allEvents.slice(splitAt);

    const fromSplit = applicator.applyEventsOnto(seed, delta);
    const fromFull = applicator.applyEvents(allEvents);

    expect(fromSplit).toEqual(fromFull);
  });
});
