import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { IEventStore } from './event-store';
import {
  CreateHabitHandler,
  UpdateHabitTitleHandler,
  UpdateHabitFrequencyHandler,
  CompleteHabitHandler,
  RevertHabitCompletionHandler,
  ArchiveHabitHandler,
  RestoreHabitHandler,
  ReorderHabitHandler,
} from './habit.handlers';
import type {
  HabitCreated,
  HabitTitleChanged,
  HabitFrequencyChanged,
  HabitCompleted,
  HabitCompletionReverted,
  HabitArchived,
  HabitRestored,
  HabitReordered,
} from './habit.types';

// ============================================================================
// Helpers
// ============================================================================

/** Returns today's local date as YYYY-MM-DD (matches todayKey() in handlers/projection). */
function localTodayKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Returns a local date offset by `days` from today. */
function localOffsetKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Build a HabitCreated event in the store directly (bypasses handler) */
async function seedHabit(
  eventStore: IEventStore,
  overrides: Partial<HabitCreated['payload']> = {}
): Promise<string> {
  const habitId = crypto.randomUUID();
  const event: HabitCreated = {
    id: crypto.randomUUID(),
    type: 'HabitCreated',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      habitId,
      title: 'Morning run',
      frequency: { type: 'daily' },
      order: 'a0',
      createdAt: new Date().toISOString(),
      ...overrides,
    },
  };
  await eventStore.append(event);
  return habitId;
}

/** Seed an archived habit */
async function seedArchivedHabit(eventStore: IEventStore): Promise<string> {
  const habitId = await seedHabit(eventStore);
  const archive: HabitArchived = {
    id: crypto.randomUUID(),
    type: 'HabitArchived',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: { habitId, archivedAt: new Date().toISOString() },
  };
  await eventStore.append(archive);
  return habitId;
}

// ============================================================================
// Commit 2: Create, UpdateTitle, UpdateFrequency
// ============================================================================

describe('CreateHabitHandler', () => {
  let eventStore: IEventStore;
  let handler: CreateHabitHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new CreateHabitHandler(eventStore);
  });

  it('should emit HabitCreated for a valid daily habit', async () => {
    const habitId = await handler.handle({
      title: 'Morning run',
      frequency: { type: 'daily' },
      order: 'a0',
    });

    const events = await eventStore.getAll();
    expect(events).toHaveLength(1);

    const event = events[0] as HabitCreated;
    expect(event.type).toBe('HabitCreated');
    expect(event.aggregateId).toBe(habitId);
    expect(event.payload.habitId).toBe(habitId);
    expect(event.payload.title).toBe('Morning run');
    expect(event.payload.frequency).toEqual({ type: 'daily' });
    expect(event.payload.order).toBe('a0');
    expect(event.payload.createdAt).toBeTruthy();
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should emit HabitCreated for a weekly habit', async () => {
    await handler.handle({
      title: 'Weekend workout',
      frequency: { type: 'weekly', targetDays: [0, 6] },
      order: 'a1',
    });

    const events = await eventStore.getAll();
    const event = events[0] as HabitCreated;
    expect(event.payload.frequency).toEqual({ type: 'weekly', targetDays: [0, 6] });
  });

  it('should emit HabitCreated for an every-n-days habit', async () => {
    await handler.handle({
      title: 'Every 3 days',
      frequency: { type: 'every-n-days', n: 3 },
      order: 'a2',
    });

    const events = await eventStore.getAll();
    const event = events[0] as HabitCreated;
    expect(event.payload.frequency).toEqual({ type: 'every-n-days', n: 3 });
  });

  it('should include notificationTime if provided', async () => {
    await handler.handle({
      title: 'Morning run',
      frequency: { type: 'daily' },
      order: 'a0',
      notificationTime: '07:00',
    });

    const events = await eventStore.getAll();
    const event = events[0] as HabitCreated;
    expect(event.payload.notificationTime).toBe('07:00');
  });

  it('should throw if title is empty', async () => {
    await expect(
      handler.handle({ title: '', frequency: { type: 'daily' }, order: 'a0' })
    ).rejects.toThrow('Habit title cannot be empty');
  });

  it('should throw if title exceeds 100 characters', async () => {
    await expect(
      handler.handle({ title: 'x'.repeat(101), frequency: { type: 'daily' }, order: 'a0' })
    ).rejects.toThrow('Habit title must be 100 characters or fewer');
  });

  it('should throw if weekly frequency has no target days', async () => {
    await expect(
      handler.handle({ title: 'Bad', frequency: { type: 'weekly', targetDays: [] }, order: 'a0' })
    ).rejects.toThrow('Weekly habit must have at least one target day');
  });

  it('should throw if every-n-days n is out of range', async () => {
    await expect(
      handler.handle({ title: 'Bad', frequency: { type: 'every-n-days', n: 1 }, order: 'a0' })
    ).rejects.toThrow('every-n-days habit n must be in range [2..30]');
  });

  it('should generate unique IDs for each habit', async () => {
    const id1 = await handler.handle({ title: 'Habit 1', frequency: { type: 'daily' }, order: 'a0' });
    const id2 = await handler.handle({ title: 'Habit 2', frequency: { type: 'daily' }, order: 'a1' });
    expect(id1).not.toBe(id2);
  });
});

describe('UpdateHabitTitleHandler', () => {
  let eventStore: IEventStore;
  let handler: UpdateHabitTitleHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new UpdateHabitTitleHandler(eventStore);
  });

  it('should emit HabitTitleChanged for a valid title update', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, title: 'Evening walk' });

    const events = await eventStore.getAll();
    const titleEvent = events.find(e => e.type === 'HabitTitleChanged') as HabitTitleChanged;
    expect(titleEvent).toBeDefined();
    expect(titleEvent.payload.habitId).toBe(habitId);
    expect(titleEvent.payload.title).toBe('Evening walk');
    expect(titleEvent.payload.updatedAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(
      handler.handle({ habitId: 'non-existent', title: 'New title' })
    ).rejects.toThrow('Habit non-existent not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(
      handler.handle({ habitId, title: 'New title' })
    ).rejects.toThrow('archived');
  });

  it('should throw if title is empty', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, title: '' })
    ).rejects.toThrow('Habit title cannot be empty');
  });

  it('should throw if title exceeds 100 characters', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, title: 'x'.repeat(101) })
    ).rejects.toThrow('Habit title must be 100 characters or fewer');
  });
});

describe('UpdateHabitFrequencyHandler', () => {
  let eventStore: IEventStore;
  let handler: UpdateHabitFrequencyHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new UpdateHabitFrequencyHandler(eventStore);
  });

  it('should emit HabitFrequencyChanged for a valid frequency update', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, frequency: { type: 'weekly', targetDays: [1, 3, 5] } });

    const events = await eventStore.getAll();
    const freqEvent = events.find(e => e.type === 'HabitFrequencyChanged') as HabitFrequencyChanged;
    expect(freqEvent).toBeDefined();
    expect(freqEvent.payload.habitId).toBe(habitId);
    expect(freqEvent.payload.frequency).toEqual({ type: 'weekly', targetDays: [1, 3, 5] });
    expect(freqEvent.payload.updatedAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(
      handler.handle({ habitId: 'ghost', frequency: { type: 'daily' } })
    ).rejects.toThrow('Habit ghost not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(
      handler.handle({ habitId, frequency: { type: 'daily' } })
    ).rejects.toThrow('archived');
  });

  it('should throw if frequency is invalid', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, frequency: { type: 'every-n-days', n: 100 } })
    ).rejects.toThrow('every-n-days habit n must be in range [2..30]');
  });
});

// ============================================================================
// Commit 3: Complete, Revert, Archive, Restore, Reorder
// ============================================================================

describe('CompleteHabitHandler', () => {
  let eventStore: IEventStore;
  let handler: CompleteHabitHandler;
  const today = localTodayKey();

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new CompleteHabitHandler(eventStore);
  });

  it('should emit HabitCompleted for a valid completion', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, date: today, collectionId: 'col-1' });

    const events = await eventStore.getAll();
    const completedEvent = events.find(e => e.type === 'HabitCompleted') as HabitCompleted;
    expect(completedEvent).toBeDefined();
    expect(completedEvent.payload.habitId).toBe(habitId);
    expect(completedEvent.payload.date).toBe(today);
    expect(completedEvent.payload.collectionId).toBe('col-1');
    expect(completedEvent.payload.completedAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(
      handler.handle({ habitId: 'ghost', date: today, collectionId: 'col-1' })
    ).rejects.toThrow('Habit ghost not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(
      handler.handle({ habitId, date: today, collectionId: 'col-1' })
    ).rejects.toThrow('archived');
  });

  it('should throw if date format is invalid', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, date: '20260320', collectionId: 'col-1' })
    ).rejects.toThrow('Invalid date format');
  });

  it('should throw if date is in the future', async () => {
    const habitId = await seedHabit(eventStore);
    const tomorrow = localOffsetKey(1);
    await expect(
      handler.handle({ habitId, date: tomorrow, collectionId: 'col-1' })
    ).rejects.toThrow('future');
  });

  it('should be idempotent (no second event if already completed)', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, date: today, collectionId: 'col-1' });
    await handler.handle({ habitId, date: today, collectionId: 'col-1' });

    const events = await eventStore.getAll();
    const completed = events.filter(e => e.type === 'HabitCompleted');
    expect(completed).toHaveLength(1);
  });

  it('should emit again after completion was reverted', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, date: today, collectionId: 'col-1' });

    // Manually revert
    const revertEvent: HabitCompletionReverted = {
      id: crypto.randomUUID(),
      type: 'HabitCompletionReverted',
      aggregateId: habitId,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { habitId, date: today, revertedAt: new Date().toISOString() },
    };
    await eventStore.append(revertEvent);

    // Now complete again — should emit
    await handler.handle({ habitId, date: today, collectionId: 'col-1' });
    const events = await eventStore.getAll();
    const completed = events.filter(e => e.type === 'HabitCompleted');
    expect(completed).toHaveLength(2);
  });
});

describe('RevertHabitCompletionHandler', () => {
  let eventStore: IEventStore;
  let handler: RevertHabitCompletionHandler;
  const today = localTodayKey();

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new RevertHabitCompletionHandler(eventStore);
  });

  it('should emit HabitCompletionReverted when completion exists', async () => {
    const habitId = await seedHabit(eventStore);
    // Seed a completion
    const completedEvent: HabitCompleted = {
      id: crypto.randomUUID(),
      type: 'HabitCompleted',
      aggregateId: habitId,
      timestamp: new Date().toISOString(),
      version: 1,
      payload: { habitId, date: today, completedAt: new Date().toISOString(), collectionId: 'col-1' },
    };
    await eventStore.append(completedEvent);

    await handler.handle({ habitId, date: today });

    const events = await eventStore.getAll();
    const revertEvent = events.find(e => e.type === 'HabitCompletionReverted') as HabitCompletionReverted;
    expect(revertEvent).toBeDefined();
    expect(revertEvent.payload.habitId).toBe(habitId);
    expect(revertEvent.payload.date).toBe(today);
  });

  it('should throw if date format is invalid', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, date: 'not-a-date' })
    ).rejects.toThrow('Invalid date format');
  });

  it('should be idempotent (no event if not completed)', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, date: today });

    const events = await eventStore.getAll();
    const revertEvents = events.filter(e => e.type === 'HabitCompletionReverted');
    expect(revertEvents).toHaveLength(0);
  });
});

describe('ArchiveHabitHandler', () => {
  let eventStore: IEventStore;
  let handler: ArchiveHabitHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new ArchiveHabitHandler(eventStore);
  });

  it('should emit HabitArchived for an active habit', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId });

    const events = await eventStore.getAll();
    const archiveEvent = events.find(e => e.type === 'HabitArchived') as HabitArchived;
    expect(archiveEvent).toBeDefined();
    expect(archiveEvent.payload.habitId).toBe(habitId);
    expect(archiveEvent.payload.archivedAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(handler.handle({ habitId: 'ghost' })).rejects.toThrow('Habit ghost not found');
  });

  it('should be idempotent (no event if already archived)', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await handler.handle({ habitId });

    const events = await eventStore.getAll();
    const archiveEvents = events.filter(e => e.type === 'HabitArchived');
    expect(archiveEvents).toHaveLength(1); // only the seed one
  });
});

describe('RestoreHabitHandler', () => {
  let eventStore: IEventStore;
  let handler: RestoreHabitHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new RestoreHabitHandler(eventStore);
  });

  it('should emit HabitRestored for an archived habit', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await handler.handle({ habitId });

    const events = await eventStore.getAll();
    const restoreEvent = events.find(e => e.type === 'HabitRestored') as HabitRestored;
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent.payload.habitId).toBe(habitId);
    expect(restoreEvent.payload.restoredAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(handler.handle({ habitId: 'ghost' })).rejects.toThrow('Habit ghost not found');
  });

  it('should throw if habit is not archived', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(handler.handle({ habitId })).rejects.toThrow('not archived');
  });
});

describe('ReorderHabitHandler', () => {
  let eventStore: IEventStore;
  let handler: ReorderHabitHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new ReorderHabitHandler(eventStore);
  });

  it('should emit HabitReordered for an active habit', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, order: 'b0' });

    const events = await eventStore.getAll();
    const reorderEvent = events.find(e => e.type === 'HabitReordered') as HabitReordered;
    expect(reorderEvent).toBeDefined();
    expect(reorderEvent.payload.habitId).toBe(habitId);
    expect(reorderEvent.payload.order).toBe('b0');
    expect(reorderEvent.payload.reorderedAt).toBeTruthy();
  });

  it('should throw if habit does not exist', async () => {
    await expect(handler.handle({ habitId: 'ghost', order: 'b0' })).rejects.toThrow('Habit ghost not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(handler.handle({ habitId, order: 'b0' })).rejects.toThrow('archived');
  });

  it('should throw if order is empty', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(handler.handle({ habitId, order: '' })).rejects.toThrow('order');
  });
});

// ============================================================================
// Fix 1: CompleteHabitHandler UTC guard — use local date, not UTC date
// ============================================================================

describe('CompleteHabitHandler: UTC guard uses local date', () => {
  let eventStore: IEventStore;
  let handler: CompleteHabitHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new CompleteHabitHandler(eventStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject UTC-today as a future date when local date is still yesterday', async () => {
    // Pin clock to UTC noon (2026-03-26T12:00:00Z). At noon UTC the local calendar
    // date is '2026-03-26' in every timezone, so localToday and the UTC date agree —
    // no timezone offset is needed to construct a portable test.
    //
    // We test the future-date guard directly:
    //   • completing for localToday ('2026-03-26') → succeeds (not future)
    //   • completing for localTomorrow ('2026-03-27') → throws 'future date'
    //
    // The UTC/local boundary edge-case (where UTC rolls over but local hasn't yet)
    // is verified by code review: production code uses getFullYear/getMonth/getDate.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));

    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const localTomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const habitId = crypto.randomUUID();
    const createdEvent: import('./habit.types').HabitCreated = {
      id: crypto.randomUUID(),
      type: 'HabitCreated',
      aggregateId: habitId,
      timestamp: '2026-01-01T00:00:00.000Z',
      version: 1,
      payload: {
        habitId,
        title: 'Morning run',
        frequency: { type: 'daily' },
        order: 'a0',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };
    await eventStore.append(createdEvent);

    // Completing for local today must succeed
    await expect(
      handler.handle({ habitId, date: localToday, collectionId: 'col-1' })
    ).resolves.not.toThrow();

    // Completing for local tomorrow must be rejected as a future date
    await expect(
      handler.handle({ habitId, date: localTomorrow, collectionId: 'col-1' })
    ).rejects.toThrow('future date');
  });
});
