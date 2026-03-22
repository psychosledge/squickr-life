import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { IEventStore } from './event-store';
import { HabitProjection } from './habit.projection';
import type {
  HabitCreated,
  HabitNotificationTimeSet,
  HabitNotificationTimeCleared,
} from './habit.types';

// ============================================================================
// Helpers
// ============================================================================

async function appendHabitCreated(
  eventStore: IEventStore,
  overrides: Partial<HabitCreated['payload']> & { habitId?: string } = {}
): Promise<string> {
  const habitId = overrides.habitId ?? crypto.randomUUID();
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
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      ...overrides,
    },
  };
  await eventStore.append(event);
  return habitId;
}

async function appendHabitNotificationTimeSet(
  eventStore: IEventStore,
  habitId: string,
  notificationTime: string
): Promise<void> {
  const event: HabitNotificationTimeSet = {
    id: crypto.randomUUID(),
    type: 'HabitNotificationTimeSet',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      habitId,
      notificationTime,
      updatedAt: new Date().toISOString(),
    },
  };
  await eventStore.append(event);
}

async function appendHabitNotificationTimeCleared(
  eventStore: IEventStore,
  habitId: string
): Promise<void> {
  const event: HabitNotificationTimeCleared = {
    id: crypto.randomUUID(),
    type: 'HabitNotificationTimeCleared',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      habitId,
      clearedAt: new Date().toISOString(),
    },
  };
  await eventStore.append(event);
}

// ============================================================================
// Projection tests for notification time
// ============================================================================

describe('HabitProjection: notificationTime', () => {
  let eventStore: IEventStore;
  let projection: HabitProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new HabitProjection(eventStore);
  });

  it('should have notificationTime=undefined before any notification time events', async () => {
    const habitId = await appendHabitCreated(eventStore);
    const habit = await projection.getHabitById(habitId);
    expect(habit).toBeDefined();
    expect(habit!.notificationTime).toBeUndefined();
  });

  it('should set notificationTime after HabitNotificationTimeSet event', async () => {
    const habitId = await appendHabitCreated(eventStore);
    await appendHabitNotificationTimeSet(eventStore, habitId, '07:30');
    const habit = await projection.getHabitById(habitId);
    expect(habit!.notificationTime).toBe('07:30');
  });

  it('should clear notificationTime after HabitNotificationTimeCleared event', async () => {
    const habitId = await appendHabitCreated(eventStore);
    await appendHabitNotificationTimeSet(eventStore, habitId, '08:00');
    await appendHabitNotificationTimeCleared(eventStore, habitId);
    const habit = await projection.getHabitById(habitId);
    expect(habit!.notificationTime).toBeUndefined();
  });

  it('should reflect last value after set → clear → set sequence', async () => {
    const habitId = await appendHabitCreated(eventStore);
    await appendHabitNotificationTimeSet(eventStore, habitId, '06:00');
    await appendHabitNotificationTimeCleared(eventStore, habitId);
    await appendHabitNotificationTimeSet(eventStore, habitId, '09:15');
    const habit = await projection.getHabitById(habitId);
    expect(habit!.notificationTime).toBe('09:15');
  });

  it('should carry notificationTime from HabitCreated payload when provided', async () => {
    const habitId = await appendHabitCreated(eventStore, { notificationTime: '07:00' });
    const habit = await projection.getHabitById(habitId);
    expect(habit!.notificationTime).toBe('07:00');
  });

  it('should override HabitCreated notificationTime with subsequent HabitNotificationTimeSet', async () => {
    const habitId = await appendHabitCreated(eventStore, { notificationTime: '07:00' });
    await appendHabitNotificationTimeSet(eventStore, habitId, '10:00');
    const habit = await projection.getHabitById(habitId);
    expect(habit!.notificationTime).toBe('10:00');
  });
});
