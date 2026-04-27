/**
 * habitReminderIndexWriter tests
 *
 * Verifies that uploaded habit events are correctly mirrored into the
 * users/{userId}/habitReminders Firestore index collection so the
 * Cloud Function can find reminders due for firing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock firebase/firestore ───────────────────────────────────────────────────

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { id: 'fake-ref' };
const mockDoc = vi.fn().mockReturnValue(mockDocRef);
const mockServerTimestamp = vi.fn(() => ({ _isServerTimestamp: true }));
const mockArrayUnion = vi.fn((...items: unknown[]) => ({ _type: 'arrayUnion', items }));
const mockArrayRemove = vi.fn((...items: unknown[]) => ({ _type: 'arrayRemove', items }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  arrayUnion: (...items: unknown[]) => mockArrayUnion(...items),
  arrayRemove: (...items: unknown[]) => mockArrayRemove(...items),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createHabitReminderIndexWriter } from './habitReminderIndexWriter';
import type { DomainEvent } from '@squickr/domain';
import type { HabitProjection } from '@squickr/domain';
import type { Firestore } from 'firebase/firestore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeFirestore = {} as Firestore;
const userId = 'user-abc';

const defaultFrequency = { type: 'daily' as const };

function makeHabitProjection(habit?: {
  id?: string;
  title?: string;
  frequency?: { type: 'daily' };
  notificationTime?: string;
} | undefined): HabitProjection {
  return {
    getHabitById: vi.fn().mockResolvedValue(
      habit !== undefined
        ? {
            id: habit.id ?? 'habit-1',
            title: habit.title ?? 'Morning run',
            frequency: habit.frequency ?? defaultFrequency,
            notificationTime: habit.notificationTime,
            currentStreak: 0,
            longestStreak: 0,
            history: [],
            isScheduledToday: true,
            isCompletedToday: false,
            order: '0',
          }
        : undefined,
    ),
  } as unknown as HabitProjection;
}

function makeHabitCreatedEvent(options: {
  habitId?: string;
  title?: string;
  notificationTime?: string;
} = {}): DomainEvent {
  const habitId = options.habitId ?? 'habit-1';
  return {
    id: 'evt-1',
    type: 'HabitCreated',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      title: options.title ?? 'Morning run',
      frequency: defaultFrequency,
      order: '0',
      createdAt: '2026-04-01T06:00:00.000Z',
      ...(options.notificationTime ? { notificationTime: options.notificationTime } : {}),
    },
  } as unknown as DomainEvent;
}

function makeHabitNotificationTimeSetEvent(habitId = 'habit-1', notificationTime = '07:30'): DomainEvent {
  return {
    id: 'evt-2',
    type: 'HabitNotificationTimeSet',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      notificationTime,
      updatedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitNotificationTimeClearedEvent(habitId = 'habit-1'): DomainEvent {
  return {
    id: 'evt-3',
    type: 'HabitNotificationTimeCleared',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      clearedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitArchivedEvent(habitId = 'habit-1'): DomainEvent {
  return {
    id: 'evt-4',
    type: 'HabitArchived',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      archivedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitRestoredEvent(habitId = 'habit-1'): DomainEvent {
  return {
    id: 'evt-5',
    type: 'HabitRestored',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      restoredAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitTitleChangedEvent(habitId = 'habit-1', title = 'Evening walk'): DomainEvent {
  return {
    id: 'evt-6',
    type: 'HabitTitleChanged',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      title,
      updatedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitFrequencyChangedEvent(habitId = 'habit-1'): DomainEvent {
  return {
    id: 'evt-7',
    type: 'HabitFrequencyChanged',
    aggregateId: habitId,
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      frequency: { type: 'every-n-days', n: 3 },
      updatedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeHabitCompletedEvent(habitId = 'habit-1', date = '2026-04-27'): DomainEvent {
  return {
    id: 'evt-8',
    type: 'HabitCompleted',
    aggregateId: habitId,
    timestamp: '2026-04-27T07:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      date,
      completedAt: '2026-04-27T07:00:00.000Z',
      collectionId: 'col-1',
    },
  } as unknown as DomainEvent;
}

function makeHabitCompletionRevertedEvent(habitId = 'habit-1', date = '2026-04-27'): DomainEvent {
  return {
    id: 'evt-9',
    type: 'HabitCompletionReverted',
    aggregateId: habitId,
    timestamp: '2026-04-27T08:00:00.000Z',
    version: 1,
    payload: {
      habitId,
      date,
      revertedAt: '2026-04-27T08:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

function makeUnrelatedEvent(): DomainEvent {
  return {
    id: 'evt-unrelated',
    type: 'HabitReordered',
    aggregateId: 'habit-1',
    timestamp: '2026-04-01T06:00:00.000Z',
    version: 1,
    payload: {
      habitId: 'habit-1',
      order: '1',
      reorderedAt: '2026-04-01T06:00:00.000Z',
    },
  } as unknown as DomainEvent;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createHabitReminderIndexWriter', () => {
  let habitProjection: HabitProjection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    habitProjection = makeHabitProjection({ notificationTime: '07:30' });
  });

  // ── HabitCreated ────────────────────────────────────────────────────────────

  it('upserts habitReminders doc when HabitCreated has notificationTime', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitCreatedEvent({ habitId: 'habit-1', title: 'Morning run', notificationTime: '07:30' })]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.habitId).toBe('habit-1');
    expect(setArgs.title).toBe('Morning run');
    expect(setArgs.frequency).toEqual(defaultFrequency);
    expect(setArgs.notificationTime).toBe('07:30');
    expect(setArgs.completedDates).toEqual([]);
    expect(setArgs.userId).toBe(userId);
    expect(setArgs.updatedAt).toBeDefined();
  });

  it('is a no-op when HabitCreated has no notificationTime', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitCreatedEvent({ habitId: 'habit-1', title: 'Morning run' })]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── HabitNotificationTimeSet ────────────────────────────────────────────────

  it('upserts habitReminders doc when HabitNotificationTimeSet', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Morning run',
      frequency: defaultFrequency,
      notificationTime: '07:30',
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitNotificationTimeSetEvent('habit-1', '07:30')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.habitId).toBe('habit-1');
    expect(setArgs.title).toBe('Morning run');
    expect(setArgs.frequency).toEqual(defaultFrequency);
    expect(setArgs.notificationTime).toBe('07:30');
    expect(setArgs.completedDates).toEqual([]);
    expect(setArgs.userId).toBe(userId);
    expect(setArgs.updatedAt).toBeDefined();
  });

  it('is a no-op when HabitNotificationTimeSet but habit not found in projection', async () => {
    const projection = makeHabitProjection(undefined);
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitNotificationTimeSetEvent('habit-unknown', '07:30')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('resolves title and frequency from projection for HabitNotificationTimeSet', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Evening walk',
      frequency: { type: 'daily' },
      notificationTime: '20:00',
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitNotificationTimeSetEvent('habit-1', '20:00')]);

    const setArgs = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(setArgs.title).toBe('Evening walk');
    expect(setArgs.notificationTime).toBe('20:00');
  });

  // ── HabitNotificationTimeCleared ────────────────────────────────────────────

  it('deletes habitReminders doc when HabitNotificationTimeCleared', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitNotificationTimeClearedEvent('habit-1')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── HabitArchived ───────────────────────────────────────────────────────────

  it('deletes habitReminders doc when HabitArchived', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitArchivedEvent('habit-1')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── HabitRestored ───────────────────────────────────────────────────────────

  it('is a no-op when HabitRestored', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitRestoredEvent('habit-1')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── HabitTitleChanged ───────────────────────────────────────────────────────

  it('merges title into habitReminders doc when HabitTitleChanged and habit has notificationTime', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Evening walk',
      frequency: defaultFrequency,
      notificationTime: '20:00',
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitTitleChangedEvent('habit-1', 'Evening walk')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data, options] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(data.title).toBe('Evening walk');
    expect(data.updatedAt).toBeDefined();
    expect(options).toEqual({ merge: true });
  });

  it('is a no-op when HabitTitleChanged but habit has no notificationTime', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Evening walk',
      frequency: defaultFrequency,
      // notificationTime absent
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitTitleChangedEvent('habit-1', 'Evening walk')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when HabitTitleChanged but habit not found in projection', async () => {
    const projection = makeHabitProjection(undefined);
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitTitleChangedEvent('habit-unknown', 'Whatever')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── HabitFrequencyChanged ───────────────────────────────────────────────────

  it('merges frequency into habitReminders doc when HabitFrequencyChanged and habit has notificationTime', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Morning run',
      frequency: { type: 'daily' },
      notificationTime: '07:30',
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitFrequencyChangedEvent('habit-1')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data, options] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(data.frequency).toEqual({ type: 'every-n-days', n: 3 });
    expect(data.updatedAt).toBeDefined();
    expect(options).toEqual({ merge: true });
  });

  it('is a no-op when HabitFrequencyChanged but habit has no notificationTime', async () => {
    const projection = makeHabitProjection({
      id: 'habit-1',
      title: 'Morning run',
      frequency: { type: 'daily' },
      // notificationTime absent
    });
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitFrequencyChangedEvent('habit-1')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when HabitFrequencyChanged but habit not found in projection', async () => {
    const projection = makeHabitProjection(undefined);
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, projection);

    await callback([makeHabitFrequencyChangedEvent('habit-unknown')]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── HabitCompleted ──────────────────────────────────────────────────────────

  it('calls updateDoc with arrayUnion(date) when HabitCompleted', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitCompletedEvent('habit-1', '2026-04-27')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(updateArgs.completedDates).toEqual({ _type: 'arrayUnion', items: ['2026-04-27'] });
    expect(updateArgs.updatedAt).toBeDefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── HabitCompletionReverted ─────────────────────────────────────────────────

  it('calls updateDoc with arrayRemove(date) when HabitCompletionReverted', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeHabitCompletionRevertedEvent('habit-1', '2026-04-27')]);

    expect(mockDoc).toHaveBeenCalledWith(fakeFirestore, `users/${userId}/habitReminders/habit-1`);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(updateArgs.completedDates).toEqual({ _type: 'arrayRemove', items: ['2026-04-27'] });
    expect(updateArgs.updatedAt).toBeDefined();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ── Unrelated events ────────────────────────────────────────────────────────

  it('ignores unrelated event types', async () => {
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([makeUnrelatedEvent()]);

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ── Batch processing ────────────────────────────────────────────────────────

  it('handles multiple events in a single batch', async () => {
    const docRef1 = { id: 'ref-1' };
    const docRef2 = { id: 'ref-2' };
    mockDoc
      .mockReturnValueOnce(docRef1)
      .mockReturnValueOnce(docRef2);

    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([
      makeHabitNotificationTimeClearedEvent('habit-1'),
      makeHabitArchivedEvent('habit-2'),
    ]);

    expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
    expect(mockDeleteDoc).toHaveBeenNthCalledWith(1, docRef1);
    expect(mockDeleteDoc).toHaveBeenNthCalledWith(2, docRef2);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('catches per-event errors and continues processing remaining events', async () => {
    mockDeleteDoc
      .mockRejectedValueOnce(new Error('Firestore permission denied'))
      .mockResolvedValueOnce(undefined);

    const { logger } = await import('../utils/logger');
    const callback = createHabitReminderIndexWriter(fakeFirestore, userId, habitProjection);

    await callback([
      makeHabitArchivedEvent('habit-1'),
      makeHabitNotificationTimeClearedEvent('habit-2'),
    ]);

    expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
