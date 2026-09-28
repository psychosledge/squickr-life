import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { IEventStore } from './event-store';
import { HabitProjection } from './habit.projection';
import type {
  HabitCreated,
  HabitArchived,
  HabitRestored,
  HabitCompleted,
  HabitCompletionReverted,
  SerializableHabitState,
} from './habit.types';
import { getLocalDateKey } from './date-utils';

// ============================================================================
// Helpers
// ============================================================================

function makeDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function localNoon(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toISOString();
}

const HISTORY_WINDOW_DAYS = 30;
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
      createdAt: overrides.createdAt ?? localNoon(getLocalDateKey()),
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
      await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: localNoon(today),
        order: 'a0',
      });
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(1);
    });

    it('should not return every-n-days habit when not on schedule', async () => {
      await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: localNoon(yesterday),
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
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'weekly', targetDays: [dayOfWeek] },
        createdAt: localNoon(makeDate(-HISTORY_WINDOW_DAYS)),
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
      const habitId = await appendHabitCreated(eventStore, {
        createdAt: localNoon(makeDate(-HISTORY_WINDOW_DAYS)),
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
        createdAt: localNoon(today),
      });
      // Complete today (which is in window 0)
      await appendHabitCompleted(eventStore, habitId, today);
      const habit = await projection.getHabitById(habitId);
      expect(habit!.currentStreak).toBe(1);
    });
  });

  // ── todayKey: local date (UTC-offset bug regression) ──────────────────────

  describe('history: timezone / local date', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('history: last entry is today (local date) and no future date is marked missed', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));

      const localToday = getLocalDateKey();

      const createdAt = localNoon('2026-02-20');
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });

      // Complete the habit for the local date
      await appendHabitCompleted(eventStore, habitId, localToday);

      const habit = await projection.getHabitById(habitId);
      const history = habit!.history;

      // Assertion 1: the last (most-recent) entry has date === local today
      const lastEntry = history[history.length - 1]!;
      expect(lastEntry.date).toBe(localToday);

      // Assertion 2: no entry with date > local today exists
      const futureDates = history.filter(h => h.date > localToday);
      expect(futureDates).toHaveLength(0);

      // Assertion 3: the entry for local today has status 'completed'
      const todayEntry = history.find(h => h.date === localToday);
      expect(todayEntry).toBeDefined();
      expect(todayEntry!.status).toBe('completed');
    });
  });

  // ── buildHistory: pre-creation days should be not-scheduled ───────────────

  describe('buildHistory: days before createdAt are not-scheduled', () => {
    it('should mark all 25 days before creation as not-scheduled for a daily habit', async () => {
      // Habit created 5 days ago
      const createdDate = makeDate(-5);
      const createdAt = localNoon(createdDate);
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
      const createdAt = localNoon(createdDate);
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
      const createdDate = makeDate(-5);
      const createdAt = localNoon(createdDate);
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

  // ── Fix 2: asOf option — history grid "as-of" threading ──────────────────

  describe('asOf option: history grid treats viewed date as "today"', () => {
    it('getHabitsForDate with asOf=yesterday: today slot shows future, not completed', async () => {
      const createdAt = localNoon(makeDate(-HISTORY_WINDOW_DAYS));
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      // Complete for real today
      await appendHabitCompleted(eventStore, habitId, today);

      const habits = await projection.getHabitsForDate(yesterday, { asOf: yesterday });

      expect(habits).toHaveLength(1);
      const habit = habits[0]!;

      // Today's date should appear as 'future' (it's after asOf=yesterday)
      const todayEntry = habit.history.find(h => h.date === today);
      // todayEntry might not exist if it's outside the 30-day window; but since asOf=yesterday,
      // the 30-day window is [yesterday-29 .. yesterday], so today is outside → no entry expected.
      // The key assertion: the completion for today must NOT appear as 'completed'.
      if (todayEntry) {
        expect(todayEntry.status).toBe('future');
      } else {
        // today is outside the window when asOf=yesterday → OK, no future leak
        expect(todayEntry).toBeUndefined();
      }

      // And yesterday itself should be 'missed' (not completed for yesterday)
      const yesterdayEntry = habit.history.find(h => h.date === yesterday);
      expect(yesterdayEntry).toBeDefined();
      expect(yesterdayEntry!.status).toBe('missed');
    });

    it('getActiveHabits with asOf=yesterday: today slot shows future, not completed', async () => {
      const createdAt = localNoon(makeDate(-HISTORY_WINDOW_DAYS));
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      await appendHabitCompleted(eventStore, habitId, today);

      const habits = await projection.getActiveHabits({ asOf: yesterday });

      expect(habits).toHaveLength(1);
      const habit = habits[0]!;

      // isCompletedToday should reflect asOf (yesterday), not real today
      // Since the habit was not completed for yesterday, isCompletedToday must be false
      expect(habit.isCompletedToday).toBe(false);
      expect(habit.isScheduledToday).toBe(true); // daily → scheduled on any day

      // The last history entry should be yesterday (asOf), not today
      const lastEntry = habit.history[habit.history.length - 1]!;
      expect(lastEntry.date).toBe(yesterday);
    });

    it('getAllHabits with asOf=yesterday: isCompletedToday reflects yesterday', async () => {
      const createdAt = localNoon(makeDate(-HISTORY_WINDOW_DAYS));
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      await appendHabitCompleted(eventStore, habitId, yesterday);

      const habits = await projection.getAllHabits({ asOf: yesterday });

      expect(habits).toHaveLength(1);
      const habit = habits[0]!;

      // Since completed for yesterday and asOf=yesterday, isCompletedToday must be true
      expect(habit.isCompletedToday).toBe(true);
    });

    it('getHabitById with asOf=yesterday: history window ends at yesterday', async () => {
      const createdAt = localNoon(makeDate(-HISTORY_WINDOW_DAYS));
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });
      await appendHabitCompleted(eventStore, habitId, today);

      const habit = await projection.getHabitById(habitId, { asOf: yesterday });

      expect(habit).toBeDefined();
      // Last history entry should be yesterday when asOf=yesterday
      const lastEntry = habit!.history[habit!.history.length - 1]!;
      expect(lastEntry.date).toBe(yesterday);
    });

    it('backwards-compatible: no asOf defaults to the local date', async () => {
      const createdAt = localNoon(makeDate(-HISTORY_WINDOW_DAYS));
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });
      await appendHabitCompleted(eventStore, habitId, today);

      const [byActive, byAll, byId, byDate] = await Promise.all([
        projection.getActiveHabits(),
        projection.getAllHabits(),
        projection.getHabitById(habitId),
        projection.getHabitsForDate(today),
      ]);

      expect(byActive[0]!.isCompletedToday).toBe(true);
      expect(byAll[0]!.isCompletedToday).toBe(true);
      expect(byId!.isCompletedToday).toBe(true);
      expect(byDate[0]!.isCompletedToday).toBe(true);
    });
  });
});

// ============================================================================
// getHabitsForDate: relative habits
// ============================================================================

describe('getHabitsForDate: relative habits', () => {
  let eventStore: IEventStore;
  let projection: HabitProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new HabitProjection(eventStore);
  });

  it('returns relative daily habit when due today (never completed, created yesterday)', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: localNoon(yesterday),
    });
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('returns relative every-n-days habit when overdue (completed 4 days ago, n=3)', async () => {
    const fourDaysAgo = makeDate(-4);
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, fourDaysAgo);
    // Last completed 4 days ago, interval 3 → next due 1 day ago → overdue → should appear today
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('does NOT return relative every-n-days habit when not yet due (completed yesterday, n=3)', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, yesterday);
    // Last completed yesterday, interval 3 → next due in 2 days → NOT due today
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(false);
  });

  it('returns never-completed relative habit for a historical date after its creation', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    const habits = await projection.getHabitsForDate(yesterday, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('DOES return relative habit for a historical date when there IS a completion on that date', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, yesterday);
    const habits = await projection.getHabitsForDate(yesterday, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('archived relative habit is excluded from getHabitsForDate', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: localNoon(yesterday),
    });
    await appendHabitArchived(eventStore, habitId);
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(false);
  });

  it('isScheduledToday is true for relative habit when overdue', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    // Completed 4 days ago → next due 1 day ago → overdue
    await appendHabitCompleted(eventStore, habitId, makeDate(-4));
    const habit = await projection.getHabitById(habitId, { asOf: today });
    expect(habit!.isScheduledToday).toBe(true);
  });

  it('isScheduledToday is false for relative habit when not yet due (completed today already)', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    // Completed today → next due in 3 days → not due today anymore
    await appendHabitCompleted(eventStore, habitId, today);
    const habit = await projection.getHabitById(habitId, { asOf: today });
    expect(habit!.isScheduledToday).toBe(false);
  });

  it('history for relative habit shows completed on completion dates, not-scheduled on all other past days', async () => {
    const createdAt = localNoon(makeDate(-5));
    const completionDate = makeDate(-3);
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt,
    });
    await appendHabitCompleted(eventStore, habitId, completionDate);
    const habit = await projection.getHabitById(habitId, { asOf: today });
    const history = habit!.history;

    // Completion date should be 'completed'
    const completionEntry = history.find(h => h.date === completionDate);
    expect(completionEntry?.status).toBe('completed');

    // Past days (that are not today and not completion date) should be 'not-scheduled'
    const pastNonCompletion = history.filter(
      h => h.date < today && h.date >= makeDate(-5) && h.date !== completionDate
    );
    for (const entry of pastNonCompletion) {
      expect(entry.status).toBe('not-scheduled');
    }
  });

  it('relative weekly habit uses 7-day interval not targetDays (complete Thursday → due following Thursday)', async () => {
    // Thursday = day 4
    // Use a known Thursday: 2026-01-01 is a Thursday
    const thursday = '2026-01-01';
    const nextThursday = '2026-01-08';
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'weekly', targetDays: [4], mode: 'relative' },
      createdAt: localNoon(thursday),
    });
    await appendHabitCompleted(eventStore, habitId, thursday);
    // Should be due on next Thursday
    const habits = await projection.getHabitsForDate(nextThursday, { asOf: nextThursday });
    expect(habits.some(h => h.id === habitId)).toBe(true);
    // Should NOT be due on the day before next Thursday
    const wednesday = '2026-01-07';
    const habitsWed = await projection.getHabitsForDate(wednesday, { asOf: wednesday });
    expect(habitsWed.some(h => h.id === habitId)).toBe(false);
  });

  it('returns relative every-n-days habit completed today, marked completed', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, today);

    const habits = await projection.getHabitsForDate(today, { asOf: today });

    const habit = habits.find(h => h.id === habitId);
    expect(habit).toBeDefined();
    expect(habit!.isCompletedToday).toBe(true);
  });

  it('returns relative weekly habit completed today, marked completed', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'weekly', targetDays: [1], mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, today);

    const habits = await projection.getHabitsForDate(today, { asOf: today });

    const habit = habits.find(h => h.id === habitId);
    expect(habit).toBeDefined();
    expect(habit!.isCompletedToday).toBe(true);
  });

  it('returns relative habit completed then reverted today, marked not completed', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, today);
    await appendHabitCompletionReverted(eventStore, habitId, today);

    const habits = await projection.getHabitsForDate(today, { asOf: today });

    const habit = habits.find(h => h.id === habitId);
    expect(habit).toBeDefined();
    expect(habit!.isCompletedToday).toBe(false);
  });

  it('returns relative habit on a past date it was completed, viewed as of that date', async () => {
    const pastDate = makeDate(-5);
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: localNoon(makeDate(-10)),
    });
    await appendHabitCompleted(eventStore, habitId, pastDate);
    await appendHabitCompleted(eventStore, habitId, yesterday);

    const habits = await projection.getHabitsForDate(pastDate, { asOf: pastDate });

    const habit = habits.find(h => h.id === habitId);
    expect(habit).toBeDefined();
    expect(habit!.isCompletedToday).toBe(true);
  });

  describe('due on a past date, judged from completions before that date', () => {
    const dayA = -12;

    async function createEveryThreeDaysHabitCompletedOn(offsets: number[]): Promise<string> {
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
        createdAt: localNoon(makeDate(dayA - 3)),
      });
      for (const offset of offsets) {
        await appendHabitCompleted(eventStore, habitId, makeDate(dayA + offset));
      }
      return habitId;
    }

    it.each([6, 7, 8])('returns habit skipped on day A+%i, marked not completed', async (offset) => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3, 9]);
      const date = makeDate(dayA + offset);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      const habit = habits.find(h => h.id === habitId);
      expect(habit).toBeDefined();
      expect(habit!.isCompletedToday).toBe(false);
    });

    it.each([4, 5])('does not return habit on day A+%i, before it is due', async (offset) => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3, 9]);
      const date = makeDate(dayA + offset);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      expect(habits.some(h => h.id === habitId)).toBe(false);
    });

    it('ignores a completion reverted before the date', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3, 9]);
      await appendHabitCompletionReverted(eventStore, habitId, makeDate(dayA + 3));
      const date = makeDate(dayA + 4);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      expect(habits.some(h => h.id === habitId)).toBe(true);
    });

    it('returns habit never completed before the date, from its creation date on', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([9]);
      const date = makeDate(dayA - 3);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      expect(habits.some(h => h.id === habitId)).toBe(true);
    });

    it('does not return habit for a date before its creation', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([9]);
      const date = makeDate(dayA - 4);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      expect(habits.some(h => h.id === habitId)).toBe(false);
    });

    it('returns an overdue habit on a future date, marked not completed', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3]);
      const futureDate = makeDate(3);

      const habits = await projection.getHabitsForDate(futureDate, { asOf: futureDate });

      const habit = habits.find(h => h.id === habitId);
      expect(habit).toBeDefined();
      expect(habit!.isCompletedToday).toBe(false);
    });

    it('does not return habit on a future date before its next due date', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3, 12]);
      const futureDate = makeDate(2);

      const habits = await projection.getHabitsForDate(futureDate, { asOf: futureDate });

      expect(habits.some(h => h.id === habitId)).toBe(false);
    });

    it('returns habit completed then reverted on a skipped past day, marked not completed', async () => {
      const habitId = await createEveryThreeDaysHabitCompletedOn([0, 3, 9]);
      const date = makeDate(dayA + 7);
      await appendHabitCompleted(eventStore, habitId, date);
      await appendHabitCompletionReverted(eventStore, habitId, date);

      const habits = await projection.getHabitsForDate(date, { asOf: date });

      const habit = habits.find(h => h.id === habitId);
      expect(habit).toBeDefined();
      expect(habit!.isCompletedToday).toBe(false);
    });
  });
});

describe('creation day is the local calendar day of createdAt', () => {
  const localCreationDay = '2026-03-26';
  let eventStore: IEventStore;
  let projection: HabitProjection;
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T20:30:00-07:00'));
    eventStore = new InMemoryEventStore();
    projection = new HabitProjection(eventStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  function createHabitNow(frequency: HabitCreated['payload']['frequency']): Promise<string> {
    return appendHabitCreated(eventStore, { frequency, createdAt: new Date().toISOString() });
  }

  it('returns a relative habit on the local day it was created', async () => {
    const habitId = await createHabitNow({ type: 'every-n-days', n: 3, mode: 'relative' });

    const habits = await projection.getHabitsForDate(localCreationDay);

    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('anchors a fixed every-n-days habit on the local creation day', async () => {
    const habitId = await createHabitNow({ type: 'every-n-days', n: 3 });

    const scheduledDays: string[] = [];
    for (const date of ['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29']) {
      const habits = await projection.getHabitsForDate(date);
      if (habits.some(h => h.id === habitId)) scheduledDays.push(date);
    }

    expect(scheduledDays).toEqual(['2026-03-26', '2026-03-29']);
  });

  it('history treats the local creation day as scheduled', async () => {
    const habitId = await createHabitNow({ type: 'daily' });

    const habit = await projection.getHabitById(habitId);

    expect(habit!.history.at(-1)).toEqual({ date: localCreationDay, status: 'missed' });
  });

  it('counts a completion on the local creation day in the every-n-days longest streak', async () => {
    const habitId = await createHabitNow({ type: 'every-n-days', n: 3 });
    await appendHabitCompleted(eventStore, habitId, '2026-03-26');
    await appendHabitCompleted(eventStore, habitId, '2026-03-29');

    const habit = await projection.getHabitById(habitId, { asOf: '2026-04-10' });

    expect(habit!.longestStreak).toBe(2);
  });
});

// ============================================================================
// ADR-026: Snapshot hydration / serialisation
// ============================================================================

describe('HabitProjection — snapshot support (ADR-026)', () => {
  let eventStore: IEventStore;
  let projection: HabitProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new HabitProjection(eventStore);
  });

  // ── hydrateFromSnapshot ────────────────────────────────────────────────────

  describe('hydrateFromSnapshot()', () => {
    it('deserialises completions from Record to Map and populates cache', async () => {
      // Arrange
      const states: SerializableHabitState[] = [
        {
          id: 'habit-1',
          title: 'Morning run',
          frequency: { type: 'daily' },
          createdAt: localNoon('2026-01-01'),
          order: 'a0',
          completions: { '2026-01-01': '2026-01-01T08:00:00.000Z' },
          reverted: [],
        },
      ];

      // Act
      projection.hydrateFromSnapshot(states);

      // Assert — getActiveHabits should use the hydrated state
      const habits = await projection.getActiveHabits({ asOf: '2026-01-01' });
      expect(habits).toHaveLength(1);
      expect(habits[0]!.id).toBe('habit-1');
      expect(habits[0]!.isCompletedToday).toBe(true);
    });

    it('deserialises reverted from string[] to Set so reverted dates are excluded', async () => {
      // Arrange — habit has a completion on 2026-01-01, but it is reverted
      const states: SerializableHabitState[] = [
        {
          id: 'habit-2',
          title: 'Evening yoga',
          frequency: { type: 'daily' },
          createdAt: localNoon('2026-01-01'),
          order: 'a0',
          completions: { '2026-01-01': '2026-01-01T20:00:00.000Z' },
          reverted: ['2026-01-01'],
        },
      ];

      // Act
      projection.hydrateFromSnapshot(states);

      // Assert — completion should be treated as reverted
      const habits = await projection.getActiveHabits({ asOf: '2026-01-01' });
      expect(habits[0]!.isCompletedToday).toBe(false);
    });

    it('deserialises optional fields (archivedAt, notificationTime)', async () => {
      // Arrange
      const states: SerializableHabitState[] = [
        {
          id: 'habit-3',
          title: 'Archived habit',
          frequency: { type: 'daily' },
          createdAt: localNoon('2026-01-01'),
          order: 'a0',
          archivedAt: '2026-01-15T00:00:00.000Z',
          notificationTime: '07:30',
          completions: {},
          reverted: [],
        },
      ];

      // Act
      projection.hydrateFromSnapshot(states);

      // Assert — archived habit should NOT appear in active habits
      const activeHabits = await projection.getActiveHabits();
      expect(activeHabits.find(h => h.id === 'habit-3')).toBeUndefined();

      // But should appear in all habits
      const allHabits = await projection.getAllHabits();
      const found = allHabits.find(h => h.id === 'habit-3');
      expect(found).toBeDefined();
      expect(found!.archivedAt).toBe('2026-01-15T00:00:00.000Z');
      expect(found!.notificationTime).toBe('07:30');
    });

    it('notifies subscribers after hydration', async () => {
      let notified = false;
      projection.subscribe(() => { notified = true; });

      const states: SerializableHabitState[] = [];
      projection.hydrateFromSnapshot(states);

      expect(notified).toBe(true);
    });
  });

  // ── cache invalidation ─────────────────────────────────────────────────────

  describe('cache invalidation', () => {
    it('applies habit events incrementally — does not clear cache or trigger full replay', async () => {
      // Arrange — hydrate so cache is populated (empty habits)
      projection.hydrateFromSnapshot([]);

      // Spy on getAll to verify no full replay occurs
      const getAllSpy = vi.spyOn(eventStore, 'getAll');

      // Append a HabitCreated event — should be applied incrementally to the cache
      await appendHabitCreated(eventStore);

      // Act — query after event
      const habits = await projection.getActiveHabits();

      // Assert — getAll NOT called (incremental update, no full replay)
      expect(getAllSpy).not.toHaveBeenCalled();
      // And the new habit is present
      expect(habits).toHaveLength(1);
    });
  });

  // ── getStatesForSnapshot ───────────────────────────────────────────────────

  describe('getStatesForSnapshot()', () => {
    it('serialises completions Map to Record', async () => {
      // Arrange — create a habit and complete it
      const habitId = await appendHabitCreated(eventStore, { order: 'a0' });
      await appendHabitCompleted(eventStore, habitId, today);

      // Warm the cache by querying
      await projection.getActiveHabits();

      // Act
      const states = await projection.getStatesForSnapshot();

      // Assert
      expect(states).toHaveLength(1);
      expect(states[0]!.completions).toBeTypeOf('object');
      expect(states[0]!.completions).not.toBeInstanceOf(Map);
      expect(states[0]!.completions[today]).toBeTruthy();
    });

    it('serialises reverted Set to string[]', async () => {
      // Arrange — create a habit, complete it, then revert it
      const habitId = await appendHabitCreated(eventStore, { order: 'a0' });
      await appendHabitCompleted(eventStore, habitId, today);
      await appendHabitCompletionReverted(eventStore, habitId, today);

      // Warm cache
      await projection.getActiveHabits();

      // Act
      const states = await projection.getStatesForSnapshot();

      // Assert
      expect(Array.isArray(states[0]!.reverted)).toBe(true);
      expect(states[0]!.reverted).toContain(today);
    });

    it('returns all habits (active + archived) in snapshot', async () => {
      // Arrange
      const id1 = await appendHabitCreated(eventStore, { order: 'a0' });
      const id2 = await appendHabitCreated(eventStore, { order: 'a1' });
      await appendHabitArchived(eventStore, id2);

      // Warm cache
      await projection.getAllHabits();

      // Act
      const states = await projection.getStatesForSnapshot();

      // Assert — both habits (active + archived) are in the snapshot
      const ids = states.map(s => s.id);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });

    it('round-trips correctly: getStatesForSnapshot then hydrateFromSnapshot', async () => {
      // Arrange — build state via events
      const habitId = await appendHabitCreated(eventStore, {
        title: 'Run',
        order: 'a0',
        frequency: { type: 'daily' },
      });
      await appendHabitCompleted(eventStore, habitId, today);

      // Warm cache and serialise
      await projection.getActiveHabits();
      const serialised = await projection.getStatesForSnapshot();

      // Create fresh projection and hydrate from the serialised state
      const freshProjection = new HabitProjection(eventStore);
      freshProjection.hydrateFromSnapshot(serialised);

      // Query the fresh projection
      const habits = await freshProjection.getActiveHabits({ asOf: today });
      expect(habits).toHaveLength(1);
      expect(habits[0]!.id).toBe(habitId);
      expect(habits[0]!.isCompletedToday).toBe(true);
    });
  });
});
