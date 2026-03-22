import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { IEventStore } from './event-store';
import {
  SetHabitNotificationTimeHandler,
  ClearHabitNotificationTimeHandler,
} from './habit.handlers';
import type {
  HabitCreated,
  HabitArchived,
  HabitNotificationTimeSet,
  HabitNotificationTimeCleared,
} from './habit.types';

// ============================================================================
// Helpers
// ============================================================================

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
// SetHabitNotificationTimeHandler
// ============================================================================

describe('SetHabitNotificationTimeHandler', () => {
  let eventStore: IEventStore;
  let handler: SetHabitNotificationTimeHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new SetHabitNotificationTimeHandler(eventStore);
  });

  it('should emit HabitNotificationTimeSet on an active habit', async () => {
    const habitId = await seedHabit(eventStore);
    await handler.handle({ habitId, notificationTime: '07:30' });

    const events = await eventStore.getAll();
    const setEvent = events.find(
      e => e.type === 'HabitNotificationTimeSet'
    ) as HabitNotificationTimeSet;
    expect(setEvent).toBeDefined();
    expect(setEvent.type).toBe('HabitNotificationTimeSet');
    expect(setEvent.aggregateId).toBe(habitId);
    expect(setEvent.payload.habitId).toBe(habitId);
    expect(setEvent.payload.notificationTime).toBe('07:30');
    expect(setEvent.payload.updatedAt).toBeTruthy();
  });

  it('should accept boundary valid time "00:00"', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '00:00' })
    ).resolves.not.toThrow();

    const events = await eventStore.getAll();
    const setEvent = events.find(
      e => e.type === 'HabitNotificationTimeSet'
    ) as HabitNotificationTimeSet;
    expect(setEvent.payload.notificationTime).toBe('00:00');
  });

  it('should accept boundary valid time "23:59"', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '23:59' })
    ).resolves.not.toThrow();

    const events = await eventStore.getAll();
    const setEvent = events.find(
      e => e.type === 'HabitNotificationTimeSet'
    ) as HabitNotificationTimeSet;
    expect(setEvent.payload.notificationTime).toBe('23:59');
  });

  it('should throw for invalid format "7:30" (missing leading zero)', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '7:30' })
    ).rejects.toThrow('Invalid notificationTime "7:30": expected HH:MM in 24-hour format');
  });

  it('should throw for invalid format "25:00" (hour out of range)', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '25:00' })
    ).rejects.toThrow('Invalid notificationTime "25:00": expected HH:MM in 24-hour format');
  });

  it('should throw for invalid format "08:60" (minute out of range)', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '08:60' })
    ).rejects.toThrow('Invalid notificationTime "08:60": expected HH:MM in 24-hour format');
  });

  it('should throw for empty string ""', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '' })
    ).rejects.toThrow('Invalid notificationTime "": expected HH:MM in 24-hour format');
  });

  it('should throw for invalid format "8am"', async () => {
    const habitId = await seedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '8am' })
    ).rejects.toThrow('Invalid notificationTime "8am": expected HH:MM in 24-hour format');
  });

  it('should throw if habit does not exist', async () => {
    await expect(
      handler.handle({ habitId: 'non-existent', notificationTime: '07:30' })
    ).rejects.toThrow('Habit non-existent not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(
      handler.handle({ habitId, notificationTime: '07:30' })
    ).rejects.toThrow('archived');
  });
});

// ============================================================================
// ClearHabitNotificationTimeHandler
// ============================================================================

describe('ClearHabitNotificationTimeHandler', () => {
  let eventStore: IEventStore;
  let handler: ClearHabitNotificationTimeHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    handler = new ClearHabitNotificationTimeHandler(eventStore);
  });

  it('should emit HabitNotificationTimeCleared on a habit that has a notificationTime', async () => {
    const habitId = await seedHabit(eventStore, { notificationTime: '08:00' });
    await handler.handle({ habitId });

    const events = await eventStore.getAll();
    const clearEvent = events.find(
      e => e.type === 'HabitNotificationTimeCleared'
    ) as HabitNotificationTimeCleared;
    expect(clearEvent).toBeDefined();
    expect(clearEvent.type).toBe('HabitNotificationTimeCleared');
    expect(clearEvent.aggregateId).toBe(habitId);
    expect(clearEvent.payload.habitId).toBe(habitId);
    expect(clearEvent.payload.clearedAt).toBeTruthy();
  });

  it('should NOT throw when habit has no notificationTime (idempotent clear)', async () => {
    const habitId = await seedHabit(eventStore); // no notificationTime
    await expect(handler.handle({ habitId })).resolves.not.toThrow();
  });

  it('should still emit HabitNotificationTimeCleared even when notificationTime is already absent', async () => {
    const habitId = await seedHabit(eventStore); // no notificationTime
    await handler.handle({ habitId });

    const events = await eventStore.getAll();
    const clearEvent = events.find(e => e.type === 'HabitNotificationTimeCleared');
    expect(clearEvent).toBeDefined();
  });

  it('should throw if habit does not exist', async () => {
    await expect(
      handler.handle({ habitId: 'non-existent' })
    ).rejects.toThrow('Habit non-existent not found');
  });

  it('should throw if habit is archived', async () => {
    const habitId = await seedArchivedHabit(eventStore);
    await expect(handler.handle({ habitId })).rejects.toThrow('archived');
  });
});
