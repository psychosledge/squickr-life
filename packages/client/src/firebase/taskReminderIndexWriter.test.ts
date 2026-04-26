/**
 * taskReminderIndexWriter tests (ADR-029)
 *
 * Verifies that uploaded events are correctly mirrored into the
 * users/{userId}/taskReminders Firestore index collection so the
 * Cloud Function can find them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock firebase/firestore ───────────────────────────────────────────────────

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { id: 'fake-ref' };
const mockDoc = vi.fn().mockReturnValue(mockDocRef);
const mockTimestampFromDate = vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  Timestamp: {
    fromDate: (d: Date) => mockTimestampFromDate(d),
  },
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createTaskReminderIndexWriter } from './taskReminderIndexWriter';
import type { DomainEvent, EntryListProjection } from '@squickr/domain';
import type { Firestore } from 'firebase/firestore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeFirestore = {} as Firestore;
const userId = 'user-abc';

function makeEntryProjection(content = 'Buy milk'): EntryListProjection {
  return {
    getTaskById: vi.fn().mockResolvedValue({ id: 'task-1', content }),
  } as unknown as EntryListProjection;
}

function makeTaskReminderSetEvent(taskId = 'task-1', reminderAt = '2026-12-31T10:00:00.000Z'): DomainEvent {
  return {
    id: 'evt-1',
    type: 'TaskReminderSet',
    aggregateId: taskId,
    timestamp: '2026-04-07T09:00:00.000Z',
    version: 1,
    payload: {
      taskId,
      reminderAt,
      setAt: '2026-04-07T09:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeTaskReminderClearedEvent(taskId = 'task-1', reason: 'user' | 'fired' = 'user'): DomainEvent {
  return {
    id: 'evt-2',
    type: 'TaskReminderCleared',
    aggregateId: taskId,
    timestamp: '2026-04-07T10:00:00.000Z',
    version: 1,
    payload: {
      taskId,
      clearedAt: '2026-04-07T10:00:00.000Z',
      reason,
    },
  } as unknown as DomainEvent;
}

function makeUnrelatedEvent(): DomainEvent {
  return {
    id: 'evt-3',
    type: 'TaskCompleted',
    aggregateId: 'task-1',
    timestamp: '2026-04-07T11:00:00.000Z',
    version: 1,
    payload: { taskId: 'task-1', completedAt: '2026-04-07T11:00:00.000Z' },
  } as unknown as DomainEvent;
}

function makeTaskTitleChangedEvent(taskId = 'task-1', newContent = 'Updated title'): DomainEvent {
  return {
    id: 'evt-4',
    type: 'TaskTitleChanged',
    aggregateId: taskId,
    timestamp: '2026-04-07T12:00:00.000Z',
    version: 1,
    payload: {
      taskId,
      newContent,
      changedAt: '2026-04-07T12:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createTaskReminderIndexWriter', () => {
  let entryProjection: EntryListProjection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    entryProjection = makeEntryProjection('Buy milk');
  });

  it('upserts taskReminders doc when TaskReminderSet event is uploaded', async () => {
    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    const events = [makeTaskReminderSetEvent('task-1', '2026-12-31T10:00:00.000Z')];
    await callback(events);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/taskReminders/task-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.taskId).toBe('task-1');
    expect(setArgs.content).toBe('Buy milk');
    expect(setArgs.userId).toBe(userId);
    expect(setArgs.reminderAt).toBeDefined();
    expect(setArgs.setAt).toBeDefined();
  });

  it('deletes taskReminders doc when TaskReminderCleared with reason user', async () => {
    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    const events = [makeTaskReminderClearedEvent('task-1', 'user')];
    await callback(events);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/taskReminders/task-1`);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('skips TaskReminderCleared with reason fired (Cloud Function already deleted the doc)', async () => {
    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    const events = [makeTaskReminderClearedEvent('task-1', 'fired')];
    await callback(events);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('ignores unrelated event types', async () => {
    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    const events = [makeUnrelatedEvent()];
    await callback(events);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('uses task title from projection for content field', async () => {
    entryProjection = makeEntryProjection('Walk the dog');
    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    await callback([makeTaskReminderSetEvent('task-1', '2026-12-31T10:00:00.000Z')]);

    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.content).toBe('Walk the dog');
  });

  it('falls back to empty string content if task not found in projection', async () => {
    entryProjection = {
      getTaskById: vi.fn().mockResolvedValue(undefined),
    } as unknown as EntryListProjection;

    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    await callback([makeTaskReminderSetEvent('task-unknown', '2026-12-31T10:00:00.000Z')]);

    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.content).toBe('');
  });

  it('handles multiple events in a single batch', async () => {
    const docRef1 = { id: 'ref-1' };
    const docRef2 = { id: 'ref-2' };
    mockDoc
      .mockReturnValueOnce(docRef1)
      .mockReturnValueOnce(docRef2);

    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, entryProjection);

    await callback([
      makeTaskReminderSetEvent('task-1', '2026-12-31T10:00:00.000Z'),
      makeTaskReminderClearedEvent('task-2', 'user'),
    ]);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith(docRef1, expect.any(Object));
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledWith(docRef2);
  });

  // ── TaskTitleChanged ───────────────────────────────────────────────────────

  it('updates content in taskReminders doc when TaskTitleChanged and reminder exists', async () => {
    // Projection reports the task has a reminder set (reminderAt present)
    const taskWithReminder = {
      id: 'task-1',
      content: 'Updated title',
      reminderAt: '2026-12-31T10:00:00.000Z',
    };
    const projection = {
      getTaskById: vi.fn().mockResolvedValue(taskWithReminder),
    } as unknown as EntryListProjection;

    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeTaskTitleChangedEvent('task-1', 'Updated title')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/taskReminders/task-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.content).toBe('Updated title');
  });

  it('skips taskReminders update on TaskTitleChanged when task has no reminder', async () => {
    // Projection reports the task exists but has no reminderAt
    const taskWithoutReminder = {
      id: 'task-1',
      content: 'Updated title',
      // reminderAt deliberately absent
    };
    const projection = {
      getTaskById: vi.fn().mockResolvedValue(taskWithoutReminder),
    } as unknown as EntryListProjection;

    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeTaskTitleChangedEvent('task-1', 'Updated title')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('skips taskReminders update on TaskTitleChanged when task not found in projection', async () => {
    const projection = {
      getTaskById: vi.fn().mockResolvedValue(undefined),
    } as unknown as EntryListProjection;

    const callback = createTaskReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeTaskTitleChangedEvent('task-unknown', 'Whatever')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});
