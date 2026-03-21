import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { IEventStore } from './event-store';
import { HabitProjection } from './habit.projection';
import type {
  HabitCreated,
  HabitArchived,
  HabitRestored,
  HabitCompleted,
  HabitCompletionReverted,
  HabitFrequencyChanged,
} from './habit.types';

// ============================================================================
// Helpers
// ============================================================================

function makeDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

const today = makeDate(0);
const yesterday = makeDate(-1);

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

async function appendHabitArchived(eventStore: IEventStore, habitId: string): Promise<void> {
  const event: HabitArchived = {
    id: crypto.randomUUID(),
    type: 'HabitArchived',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: { habitId, archivedAt: new Date().toISOString() },
  };
  await eventStore.append(event);
}

async function appendHabitRestored(eventStore: IEventStore, habitId: string): Promise<void> {
  const event: HabitRestored = {
    id: crypto.randomUUID(),
    type: 'HabitRestored',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: { habitId, restoredAt: new Date().toISOString() },
  };
  await eventStore.append(event);
}

async function appendHabitCompleted(
  eventStore: IEventStore,
  habitId: string,
  date: string
): Promise<void> {
  const event: HabitCompleted = {
    id: crypto.randomUUID(),
    type: 'HabitCompleted',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: { habitId, date, completedAt: new Date().toISOString(), collectionId: 'col-1' },
  };
  await eventStore.append(event);
}

async function appendHabitCompletionReverted(
  eventStore: IEventStore,
  habitId: string,
  date: string
): Promise<void> {
  const event: HabitCompletionReverted = {
    id: crypto.randomUUID(),
    type: 'HabitCompletionReverted',
    aggregateId: habitId,
    timestamp: new Date().toISOString(),
    version: 1,
    payload: { habitId, date, revertedAt: new Date().toISOString() },
  };
  await eventStore.append(event);
}

// ============================================================================
// Tests
// ============================================================================

describe('HabitProjection', () => {
  let eventStore: IEventStore;
  let projection: HabitProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new HabitProjection(eventStore);
  });

  // ── getActiveHabits ────────────────────────────────────────────────────────

  describe('getActiveHabits', () => {
    it('should return empty array when no events exist', async () => {
      const habits = await projection.getActiveHabits();
      expect(habits).toEqual([]);
    });

    it('should return habit after HabitCreated', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habits = await projection.getActiveHabits();
      expect(habits).toHaveLength(1);
      expect(habits[0]!.id).toBe(habitId);
      expect(habits[0]!.title).toBe('Morning run');
    });

    it('should not return archived habits', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitArchived(eventStore, habitId);
      const habits = await projection.getActiveHabits();
      expect(habits).toHaveLength(0);
    });

    it('should return habit after restore', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitArchived(eventStore, habitId);
      await appendHabitRestored(eventStore, habitId);
      const habits = await projection.getActiveHabits();
      expect(habits).toHaveLength(1);
    });

    it('should sort by order field', async () => {
      const id1 = await appendHabitCreated(eventStore, { order: 'a1' });
      const id2 = await appendHabitCreated(eventStore, { order: 'a0' });
      const habits = await projection.getActiveHabits();
      expect(habits[0]!.id).toBe(id2); // 'a0' < 'a1'
      expect(habits[1]!.id).toBe(id1);
    });
  });

  // ── getAllHabits ───────────────────────────────────────────────────────────

  describe('getAllHabits', () => {
    it('should include archived habits', async () => {
      const id1 = await appendHabitCreated(eventStore, { order: 'a0' });
      const id2 = await appendHabitCreated(eventStore, { order: 'a1' });
      await appendHabitArchived(eventStore, id2);

      const habits = await projection.getAllHabits();
      expect(habits).toHaveLength(2);
      const ids = habits.map(h => h.id);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });

    it('should mark archived habits with archivedAt', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitArchived(eventStore, habitId);
      const habits = await projection.getAllHabits();
      expect(habits[0]!.archivedAt).toBeTruthy();
    });
  });

  // ── getHabitById ───────────────────────────────────────────────────────────

  describe('getHabitById', () => {
    it('should return habit by id', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habit = await projection.getHabitById(habitId);
      expect(habit).toBeDefined();
      expect(habit!.id).toBe(habitId);
    });

    it('should return undefined for non-existent id', async () => {
      const habit = await projection.getHabitById('ghost');
      expect(habit).toBeUndefined();
    });
  });

  // ── getHabitsForDate ───────────────────────────────────────────────────────

  describe('getHabitsForDate', () => {
    it('should return all active habits for daily frequency', async () => {
      await appendHabitCreated(eventStore, { frequency: { type: 'daily' }, order: 'a0' });
      await appendHabitCreated(eventStore, { frequency: { type: 'daily' }, order: 'a1' });
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(2);
    });

    it('should return only habits scheduled for day of week (weekly)', async () => {
      const dayOfWeek = new Date(today).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const otherDay = ((dayOfWeek + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

      await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [dayOfWeek] },
        order: 'a0',
      });
      await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [otherDay] },
        order: 'a1',
      });

      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(1);
    });

    it('should use modulo logic for every-n-days frequency', async () => {
      // createdAt = today (days diff = 0), n = 3 → 0 % 3 = 0 → scheduled
      await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: new Date().toISOString(),
        order: 'a0',
      });
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(1);
    });

    it('should not return every-n-days habit when not on schedule', async () => {
      // createdAt = yesterday (days diff = 1), n = 3 → 1 % 3 = 1 ≠ 0 → not scheduled
      const yesterdayISO = new Date(Date.now() - 86400000).toISOString();
      await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: yesterdayISO,
        order: 'a0',
      });
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(0);
    });

    it('should not return archived habits', async () => {
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        order: 'a0',
      });
      await appendHabitArchived(eventStore, habitId);
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(0);
    });
  });

  // ── history array ──────────────────────────────────────────────────────────

  describe('history', () => {
    it('should return exactly 30 entries in history', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.history).toHaveLength(30);
    });

    it('should set completed status for completed date', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      const todayStatus = habit!.history.find(h => h.date === today);
      expect(todayStatus!.status).toBe('completed');
    });

    it('should revert to missed after HabitCompletionReverted', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, today);
      await appendHabitCompletionReverted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      const todayStatus = habit!.history.find(h => h.date === today);
      expect(todayStatus!.status).toBe('missed');
    });

    it('should mark not-scheduled days for weekly habit', async () => {
      const dayOfWeek = new Date(today).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const otherDay = ((dayOfWeek + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [dayOfWeek] },
        // Created 30 days ago so the full history window is within the habit's lifetime
        createdAt: makeDate(-30) + 'T00:00:00.000Z',
      });
      const habit = await projection.getHabitById(habitId);

      // Yesterday should be missed or not-scheduled depending on its day
      const yesterdayStatus = habit!.history.find(h => h.date === yesterday);
      const yesterdayDow = new Date(yesterday + 'T12:00:00').getDay();
      if (yesterdayDow === dayOfWeek) {
        expect(yesterdayStatus!.status).toBe('missed');
      } else {
        expect(yesterdayStatus!.status).toBe('not-scheduled');
      }
    });

    it('should mark past scheduled days as missed (daily habit)', async () => {
      // Created 30 days ago so the full 30-day history window is within the habit's lifetime
      const habitId = await appendHabitCreated(eventStore, {
        createdAt: makeDate(-30) + 'T00:00:00.000Z',
      });
      const habit = await projection.getHabitById(habitId);
      // yesterday should be missed (daily, not completed)
      const yesterdayStatus = habit!.history.find(h => h.date === yesterday);
      expect(yesterdayStatus!.status).toBe('missed');
    });

    it('history should be ordered oldest-first', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habit = await projection.getHabitById(habitId);
      const dates = habit!.history.map(h => h.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });

    it('should have streak placeholders of 0 (pre-Commit5)', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      // After commit 4 implementation, streaks are computed — these tests
      // simply verify the fields exist and are numbers
      expect(typeof habit!.currentStreak).toBe('number');
      expect(typeof habit!.longestStreak).toBe('number');
    });
  });

  // ── isScheduledToday / isCompletedToday ─────────────────────────────────

  describe('isScheduledToday and isCompletedToday', () => {
    it('should mark daily habit as scheduled today', async () => {
      const habitId = await appendHabitCreated(eventStore, { frequency: { type: 'daily' } });
      const habit = await projection.getHabitById(habitId);
      expect(habit!.isScheduledToday).toBe(true);
    });

    it('should mark isCompletedToday after completion', async () => {
      const habitId = await appendHabitCreated(eventStore, { frequency: { type: 'daily' } });
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.isCompletedToday).toBe(true);
    });

    it('should mark isCompletedToday as false before completion', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.isCompletedToday).toBe(false);
    });
  });

  // ── Commit 5: Streaks ─────────────────────────────────────────────────────

  describe('streaks (daily frequency)', () => {
    it('should return currentStreak=0 when never completed', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(0);
    });

    it('should return currentStreak=1 when completed only today', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(1);
    });

    it('should return currentStreak=1 when only yesterday is completed (today not completed)', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, yesterday);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(1);
    });

    it('should count consecutive days including today', async () => {
      const habitId = await appendHabitCreated(eventStore);
      const dayBeforeYesterday = makeDate(-2);
      await appendHabitCompleted(eventStore, habitId, dayBeforeYesterday);
      await appendHabitCompleted(eventStore, habitId, yesterday);
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(3);
    });

    it('should break streak when a day in the middle is not completed', async () => {
      const habitId = await appendHabitCreated(eventStore);
      // Only today and day-3 (gap at day-1 and day-2)
      await appendHabitCompleted(eventStore, habitId, makeDate(-3));
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(1); // just today
    });

    it('should return 0 when today and yesterday are both not completed', async () => {
      const habitId = await appendHabitCreated(eventStore);
      // Only day-3 completed
      await appendHabitCompleted(eventStore, habitId, makeDate(-3));
      const habit = await projection.getHabitById(habitId);
      // today not completed, yesterday not completed → streak = 0
      expect(habit!.currentStreak).toBe(0);
    });

    it('longestStreak >= currentStreak always', async () => {
      const habitId = await appendHabitCreated(eventStore);
      await appendHabitCompleted(eventStore, habitId, makeDate(-5));
      await appendHabitCompleted(eventStore, habitId, makeDate(-4));
      await appendHabitCompleted(eventStore, habitId, makeDate(-3));
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.longestStreak).toBeGreaterThanOrEqual(habit!.currentStreak);
    });

    it('longestStreak should track the longest historical run', async () => {
      const habitId = await appendHabitCreated(eventStore);
      // Streak of 3 five days ago
      await appendHabitCompleted(eventStore, habitId, makeDate(-7));
      await appendHabitCompleted(eventStore, habitId, makeDate(-6));
      await appendHabitCompleted(eventStore, habitId, makeDate(-5));
      // Only 1 today
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.longestStreak).toBeGreaterThanOrEqual(3);
      expect(habit!.currentStreak).toBe(1);
    });
  });

  describe('streaks (weekly frequency)', () => {
    it('should return 0 when no completions for this week', async () => {
      const dayOfWeek = new Date(today).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [dayOfWeek] },
      });
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(0);
    });

    it('should return 1 when this week has all target days completed', async () => {
      const dayOfWeek = new Date(today).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [dayOfWeek] },
      });
      // Complete today (which is the target day)
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });

  describe('streaks (every-n-days frequency)', () => {
    it('should return 0 when no completions', async () => {
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
      });
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(0);
    });

    it('should return 1 when the most recent window has a completion', async () => {
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: new Date().toISOString(),
      });
      // Complete today (which is in window 0)
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(1);
    });
  });

  // ── buildHistory: pre-creation days should be not-scheduled ───────────────

  describe('buildHistory: days before createdAt are not-scheduled', () => {
    it('should mark all 25 days before creation as not-scheduled for a daily habit', async () => {
      // Habit created 5 days ago
      const createdDate = makeDate(-5);
      const createdAt = createdDate + 'T12:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });

      const habit = await projection.getHabitById(habitId);
      const history = habit!.history;

      // History covers 30 days total (i=29 down to i=0 = today)
      // Days 29..5 days ago are before creation → not-scheduled
      const beforeCreation = history.filter(h => h.date < createdDate);
      expect(beforeCreation.length).toBeGreaterThan(0);
      for (const day of beforeCreation) {
        expect(day.status).toBe('not-scheduled');
      }
    });

    it('should mark the 5 days since creation (excluding today) as missed when no completions', async () => {
      // Habit created 5 days ago, no completions
      const createdDate = makeDate(-5);
      const createdAt = createdDate + 'T12:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });

      const habit = await projection.getHabitById(habitId);
      const history = habit!.history;

      // Days from creation up to (but not including today), plus today itself should be missed
      const onOrAfterCreation = history.filter(h => h.date >= createdDate);
      // All 6 days (creation day + 4 days between + today) have no completions → missed
      expect(onOrAfterCreation.length).toBe(6); // -5, -4, -3, -2, -1, today
      for (const day of onOrAfterCreation) {
        expect(day.status).toBe('missed');
      }
    });

    it('should treat the createdAt boundary day itself as scheduled (missed, not not-scheduled)', async () => {
      // Habit created exactly on createdDate
      const createdDate = makeDate(-5);
      const createdAt = createdDate + 'T00:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });

      const habit = await projection.getHabitById(habitId);
      const creationDay = habit!.history.find(h => h.date === createdDate);
      expect(creationDay).toBeDefined();
      // The creation day is scheduled — should be missed (not not-scheduled)
      expect(creationDay!.status).toBe('missed');
    });

    it('should NOT show not-scheduled for days on or after createdAt', async () => {
      const createdDate = makeDate(-3);
      const createdAt = createdDate + 'T09:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });

      const habit = await projection.getHabitById(habitId);
      const afterOrOnCreation = habit!.history.filter(h => h.date >= createdDate);
      for (const day of afterOrOnCreation) {
        expect(day.status).not.toBe('not-scheduled');
      }
    });
  });
});
