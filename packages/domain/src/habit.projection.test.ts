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
} from './habit.types';

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

/** Returns today's local date as a YYYY-MM-DD string (matches todayKey() in projection). */
function localDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
      createdAt: overrides.createdAt ?? `${localDateKey()}T00:00:00.000Z`,
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
        createdAt: `${today}T00:00:00.000Z`,
        order: 'a0',
      });
      const habits = await projection.getHabitsForDate(today);
      expect(habits).toHaveLength(1);
    });

    it('should not return every-n-days habit when not on schedule', async () => {
      // createdAt = yesterday (days diff = 1), n = 3 → 1 % 3 = 1 ≠ 0 → not scheduled
      await appendHabitCreated(eventStore, {
        frequency: { type: 'every-n-days', n: 3 },
        createdAt: `${yesterday}T00:00:00.000Z`,
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
        createdAt: `${today}T00:00:00.000Z`,
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
      // Pin clock to 2026-03-26T12:00:00Z (UTC noon).
      // At UTC noon, the local calendar date equals '2026-03-26' in every timezone
      // from UTC-11 through UTC+11, making localToday deterministic on any CI runner.
      // The buggy todayKey() would use toISOString().slice(0,10) (UTC), but the fixed
      // version uses getFullYear/getMonth/getDate (local). Both agree at noon UTC, so
      // this test validates the last-entry and no-future-entry invariants portably.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));

      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Create a daily habit with a createdAt well in the past (30+ days back)
      const createdAt = '2026-02-20T00:00:00.000Z'; // ~33 days before local today
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

  // ── Fix 2: asOf option — history grid "as-of" threading ──────────────────

  describe('asOf option: history grid treats viewed date as "today"', () => {
    it('getHabitsForDate with asOf=yesterday: today slot shows future, not completed', async () => {
      // Arrange: habit created 30 days ago, completed today
      const createdAt = makeDate(-30) + 'T00:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      // Complete for real today
      await appendHabitCompleted(eventStore, habitId, today);

      // Act: query habits for yesterday's date, with asOf=yesterday
      // The history should be computed relative to yesterday, so today's slot = future
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
      // Arrange: habit created 30 days ago, completed today
      const createdAt = makeDate(-30) + 'T00:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      await appendHabitCompleted(eventStore, habitId, today);

      // Act: query active habits with asOf=yesterday
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
      // Arrange: habit completed for yesterday
      const createdAt = makeDate(-30) + 'T00:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
        order: 'a0',
      });
      await appendHabitCompleted(eventStore, habitId, yesterday);

      // Act: query all habits with asOf=yesterday
      const habits = await projection.getAllHabits({ asOf: yesterday });

      expect(habits).toHaveLength(1);
      const habit = habits[0]!;

      // Since completed for yesterday and asOf=yesterday, isCompletedToday must be true
      expect(habit.isCompletedToday).toBe(true);
    });

    it('getHabitById with asOf=yesterday: history window ends at yesterday', async () => {
      // Arrange
      const createdAt = makeDate(-30) + 'T00:00:00.000Z';
      const habitId = await appendHabitCreated(eventStore, {
        frequency: { type: 'daily' },
        createdAt,
      });
      await appendHabitCompleted(eventStore, habitId, today);

      // Act
      const habit = await projection.getHabitById(habitId, { asOf: yesterday });

      expect(habit).toBeDefined();
      // Last history entry should be yesterday when asOf=yesterday
      const lastEntry = habit!.history[habit!.history.length - 1]!;
      expect(lastEntry.date).toBe(yesterday);
    });

    it('backwards-compatible: no asOf defaults to todayKey() behaviour', async () => {
      // Existing calls without asOf must behave exactly as before
      const createdAt = makeDate(-30) + 'T00:00:00.000Z';
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
      createdAt: `${yesterday}T00:00:00.000Z`,
    });
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('returns relative every-n-days habit when overdue (completed 4 days ago, n=3)', async () => {
    const fourDaysAgo = makeDate(-4);
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    await appendHabitCompleted(eventStore, habitId, fourDaysAgo);
    // Last completed 4 days ago, interval 3 → next due 1 day ago → overdue → should appear today
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('does NOT return relative every-n-days habit when not yet due (completed yesterday, n=3)', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    await appendHabitCompleted(eventStore, habitId, yesterday);
    // Last completed yesterday, interval 3 → next due in 2 days → NOT due today
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(false);
  });

  it('does NOT return relative habit for a historical date when there is no completion on that date', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    const habits = await projection.getHabitsForDate(yesterday, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(false);
  });

  it('DOES return relative habit for a historical date when there IS a completion on that date', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    await appendHabitCompleted(eventStore, habitId, yesterday);
    const habits = await projection.getHabitsForDate(yesterday, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(true);
  });

  it('archived relative habit is excluded from getHabitsForDate', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'daily', mode: 'relative' },
      createdAt: `${yesterday}T00:00:00.000Z`,
    });
    await appendHabitArchived(eventStore, habitId);
    const habits = await projection.getHabitsForDate(today, { asOf: today });
    expect(habits.some(h => h.id === habitId)).toBe(false);
  });

  it('isScheduledToday is true for relative habit when overdue', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    // Completed 4 days ago → next due 1 day ago → overdue
    await appendHabitCompleted(eventStore, habitId, makeDate(-4));
    const habit = await projection.getHabitById(habitId, { asOf: today });
    expect(habit!.isScheduledToday).toBe(true);
  });

  it('isScheduledToday is false for relative habit when not yet due (completed today already)', async () => {
    const habitId = await appendHabitCreated(eventStore, {
      frequency: { type: 'every-n-days', n: 3, mode: 'relative' },
      createdAt: `${makeDate(-10)}T00:00:00.000Z`,
    });
    // Completed today → next due in 3 days → not due today anymore
    await appendHabitCompleted(eventStore, habitId, today);
    const habit = await projection.getHabitById(habitId, { asOf: today });
    expect(habit!.isScheduledToday).toBe(false);
  });

  it('history for relative habit shows completed on completion dates, not-scheduled on all other past days', async () => {
    const createdAt = `${makeDate(-5)}T00:00:00.000Z`;
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
      createdAt: `${thursday}T00:00:00.000Z`,
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
});
