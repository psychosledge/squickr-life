import {
  getActiveHabitsWithNotifications,
  isHabitScheduledForDate,
  isHabitCompletedForDate,
  HabitState,
  HabitFrequency,
} from "./habit-event-reader";
import { Firestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Minimal Firestore fake — returns a snapshot of in-memory documents
// ---------------------------------------------------------------------------

function makeFakeFirestore(events: object[]): Firestore {
  const fakeQuery = {
    orderBy: () => fakeQuery,
    get: async () => ({
      docs: events.map((e, i) => ({
        id: `event-${i}`,
        data: () => e,
      })),
    }),
  };

  const fakeCollection = () => fakeQuery;

  return {
    collection: fakeCollection,
  } as unknown as Firestore;
}

// Helper to make a HabitCreated event
function habitCreated(
  habitId: string,
  title: string,
  frequency: HabitFrequency,
  opts: { notificationTime?: string } = {}
) {
  return {
    type: "HabitCreated",
    aggregateId: habitId,
    id: `evt-created-${habitId}`,
    timestamp: "2024-01-01T00:00:00.000Z",
    version: 1,
    payload: {
      habitId,
      title,
      frequency,
      order: "a0",
      createdAt: "2024-01-01T00:00:00.000Z",
      ...(opts.notificationTime !== undefined
        ? { notificationTime: opts.notificationTime }
        : {}),
    },
  };
}

function habitNotificationTimeSet(habitId: string, notificationTime: string) {
  return {
    type: "HabitNotificationTimeSet",
    aggregateId: habitId,
    id: `evt-notif-${habitId}`,
    timestamp: "2024-01-02T00:00:00.000Z",
    version: 1,
    payload: { habitId, notificationTime, updatedAt: "2024-01-02T00:00:00.000Z" },
  };
}

function habitNotificationTimeCleared(habitId: string) {
  return {
    type: "HabitNotificationTimeCleared",
    aggregateId: habitId,
    id: `evt-notif-clear-${habitId}`,
    timestamp: "2024-01-03T00:00:00.000Z",
    version: 1,
    payload: { habitId, clearedAt: "2024-01-03T00:00:00.000Z" },
  };
}

function habitArchived(habitId: string) {
  return {
    type: "HabitArchived",
    aggregateId: habitId,
    id: `evt-archived-${habitId}`,
    timestamp: "2024-01-04T00:00:00.000Z",
    version: 1,
    payload: { habitId, archivedAt: "2024-01-04T00:00:00.000Z" },
  };
}

function habitRestored(habitId: string) {
  return {
    type: "HabitRestored",
    aggregateId: habitId,
    id: `evt-restored-${habitId}`,
    timestamp: "2024-01-05T00:00:00.000Z",
    version: 1,
    payload: { habitId, restoredAt: "2024-01-05T00:00:00.000Z" },
  };
}

function habitTitleChanged(habitId: string, title: string) {
  return {
    type: "HabitTitleChanged",
    aggregateId: habitId,
    id: `evt-title-${habitId}`,
    timestamp: "2024-01-02T00:00:00.000Z",
    version: 1,
    payload: { habitId, title, updatedAt: "2024-01-02T00:00:00.000Z" },
  };
}

function habitFrequencyChanged(habitId: string, frequency: HabitFrequency) {
  return {
    type: "HabitFrequencyChanged",
    aggregateId: habitId,
    id: `evt-freq-${habitId}`,
    timestamp: "2024-01-02T00:00:00.000Z",
    version: 1,
    payload: { habitId, frequency, updatedAt: "2024-01-02T00:00:00.000Z" },
  };
}

function habitCompleted(habitId: string, date: string) {
  return {
    type: "HabitCompleted",
    aggregateId: habitId,
    id: `evt-done-${habitId}-${date}`,
    timestamp: `${date}T10:00:00.000Z`,
    version: 1,
    payload: {
      habitId,
      date,
      completedAt: `${date}T10:00:00.000Z`,
      collectionId: "col-1",
    },
  };
}

function habitCompletionReverted(habitId: string, date: string) {
  return {
    type: "HabitCompletionReverted",
    aggregateId: habitId,
    id: `evt-revert-${habitId}-${date}`,
    timestamp: `${date}T11:00:00.000Z`,
    version: 1,
    payload: { habitId, date, revertedAt: `${date}T11:00:00.000Z` },
  };
}

// ---------------------------------------------------------------------------
// Tests: getActiveHabitsWithNotifications
// ---------------------------------------------------------------------------

describe("getActiveHabitsWithNotifications", () => {
  it("returns empty array when there are no events", async () => {
    const db = makeFakeFirestore([]);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toEqual([]);
  });

  it("returns habits that have a notificationTime set via HabitCreated", async () => {
    const events = [
      habitCreated("h1", "Morning Run", { type: "daily" }, { notificationTime: "07:00" }),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      habitId: "h1",
      title: "Morning Run",
      notificationTime: "07:00",
      isArchived: false,
    });
  });

  it("returns habits where notificationTime was set via HabitNotificationTimeSet", async () => {
    const events = [
      habitCreated("h1", "Morning Run", { type: "daily" }),
      habitNotificationTimeSet("h1", "08:30"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].notificationTime).toBe("08:30");
  });

  it("excludes habits without a notificationTime", async () => {
    const events = [
      habitCreated("h1", "No Reminder", { type: "daily" }),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(0);
  });

  it("excludes archived habits", async () => {
    const events = [
      habitCreated("h1", "Archived Habit", { type: "daily" }, { notificationTime: "07:00" }),
      habitArchived("h1"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(0);
  });

  it("includes restored habits (archived then restored)", async () => {
    const events = [
      habitCreated("h1", "Back Again", { type: "daily" }, { notificationTime: "07:00" }),
      habitArchived("h1"),
      habitRestored("h1"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].isArchived).toBe(false);
  });

  it("correctly folds HabitNotificationTimeCleared — removes from results", async () => {
    const events = [
      habitCreated("h1", "Cleared Notif", { type: "daily" }, { notificationTime: "07:00" }),
      habitNotificationTimeCleared("h1"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(0);
  });

  it("correctly updates title via HabitTitleChanged", async () => {
    const events = [
      habitCreated("h1", "Old Title", { type: "daily" }, { notificationTime: "07:00" }),
      habitTitleChanged("h1", "New Title"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result[0].title).toBe("New Title");
  });

  it("correctly updates frequency via HabitFrequencyChanged", async () => {
    const events = [
      habitCreated("h1", "Habit", { type: "daily" }, { notificationTime: "07:00" }),
      habitFrequencyChanged("h1", { type: "weekly", targetDays: [1, 3, 5] }),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result[0].frequency).toEqual({ type: "weekly", targetDays: [1, 3, 5] });
  });

  it("builds completedDates from HabitCompleted events", async () => {
    const events = [
      habitCreated("h1", "Habit", { type: "daily" }, { notificationTime: "07:00" }),
      habitCompleted("h1", "2024-03-01"),
      habitCompleted("h1", "2024-03-02"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result[0].completedDates).toContain("2024-03-01");
    expect(result[0].completedDates).toContain("2024-03-02");
  });

  it("removes from completedDates on HabitCompletionReverted", async () => {
    const events = [
      habitCreated("h1", "Habit", { type: "daily" }, { notificationTime: "07:00" }),
      habitCompleted("h1", "2024-03-01"),
      habitCompleted("h1", "2024-03-02"),
      habitCompletionReverted("h1", "2024-03-01"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result[0].completedDates).not.toContain("2024-03-01");
    expect(result[0].completedDates).toContain("2024-03-02");
  });

  it("ignores non-Habit event types", async () => {
    const events = [
      habitCreated("h1", "Habit", { type: "daily" }, { notificationTime: "07:00" }),
      {
        type: "TaskCreated",
        aggregateId: "t1",
        id: "evt-task",
        timestamp: "2024-01-01T00:00:00.000Z",
        version: 1,
        payload: { taskId: "t1", title: "A task" },
      },
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].habitId).toBe("h1");
  });

  it("handles multiple habits independently", async () => {
    const events = [
      habitCreated("h1", "Habit One", { type: "daily" }, { notificationTime: "07:00" }),
      habitCreated("h2", "Habit Two", { type: "daily" }),
      habitCreated("h3", "Habit Three", { type: "daily" }, { notificationTime: "09:00" }),
      habitArchived("h3"),
    ];
    const db = makeFakeFirestore(events);
    const result = await getActiveHabitsWithNotifications(db, "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].habitId).toBe("h1");
  });
});

// ---------------------------------------------------------------------------
// Tests: isHabitScheduledForDate
// ---------------------------------------------------------------------------

describe("isHabitScheduledForDate", () => {
  const baseHabit: HabitState = {
    habitId: "h1",
    title: "Test Habit",
    frequency: { type: "daily" },
    notificationTime: "08:00",
    isArchived: false,
    completedDates: [],
  };

  describe("daily frequency", () => {
    it("returns true for any day", () => {
      expect(isHabitScheduledForDate({ ...baseHabit, frequency: { type: "daily" } }, "2024-03-01")).toBe(true);
      expect(isHabitScheduledForDate({ ...baseHabit, frequency: { type: "daily" } }, "2024-03-15")).toBe(true);
      expect(isHabitScheduledForDate({ ...baseHabit, frequency: { type: "daily" } }, "2024-03-31")).toBe(true);
    });
  });

  describe("weekly frequency", () => {
    it("returns true on a scheduled day of week", () => {
      // 2024-03-11 is a Monday (dayOfWeek = 1)
      const habit = { ...baseHabit, frequency: { type: "weekly" as const, targetDays: [1, 3, 5] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> } };
      expect(isHabitScheduledForDate(habit, "2024-03-11")).toBe(true); // Monday
      expect(isHabitScheduledForDate(habit, "2024-03-13")).toBe(true); // Wednesday
      expect(isHabitScheduledForDate(habit, "2024-03-15")).toBe(true); // Friday
    });

    it("returns false on days not in targetDays", () => {
      const habit = { ...baseHabit, frequency: { type: "weekly" as const, targetDays: [1, 3, 5] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> } };
      expect(isHabitScheduledForDate(habit, "2024-03-10")).toBe(false); // Sunday = 0
      expect(isHabitScheduledForDate(habit, "2024-03-12")).toBe(false); // Tuesday = 2
      expect(isHabitScheduledForDate(habit, "2024-03-14")).toBe(false); // Thursday = 4
      expect(isHabitScheduledForDate(habit, "2024-03-16")).toBe(false); // Saturday = 6
    });

    it("returns true on Sunday when Sunday (0) is in targetDays", () => {
      const habit = { ...baseHabit, frequency: { type: "weekly" as const, targetDays: [0] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> } };
      expect(isHabitScheduledForDate(habit, "2024-03-10")).toBe(true); // Sunday
    });
  });

  describe("every-n-days frequency", () => {
    it("returns true on the correct interval days (n=2, epoch 2020-01-01)", () => {
      // 2020-01-01 = epoch day 0
      // 2020-01-01 → day 0 (0 % 2 === 0) → true
      // 2020-01-02 → day 1 (1 % 2 === 1) → false
      // 2020-01-03 → day 2 (2 % 2 === 0) → true
      const habit = { ...baseHabit, frequency: { type: "every-n-days" as const, n: 2 } };
      expect(isHabitScheduledForDate(habit, "2020-01-01")).toBe(true);
      expect(isHabitScheduledForDate(habit, "2020-01-02")).toBe(false);
      expect(isHabitScheduledForDate(habit, "2020-01-03")).toBe(true);
      expect(isHabitScheduledForDate(habit, "2020-01-04")).toBe(false);
    });

    it("returns true on every 3rd day (n=3)", () => {
      const habit = { ...baseHabit, frequency: { type: "every-n-days" as const, n: 3 } };
      // 2020-01-01 = day 0 (0 % 3 === 0) → true
      // 2020-01-02 = day 1 → false
      // 2020-01-03 = day 2 → false
      // 2020-01-04 = day 3 (3 % 3 === 0) → true
      expect(isHabitScheduledForDate(habit, "2020-01-01")).toBe(true);
      expect(isHabitScheduledForDate(habit, "2020-01-02")).toBe(false);
      expect(isHabitScheduledForDate(habit, "2020-01-03")).toBe(false);
      expect(isHabitScheduledForDate(habit, "2020-01-04")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: isHabitCompletedForDate
// ---------------------------------------------------------------------------

describe("isHabitCompletedForDate", () => {
  const baseHabit: HabitState = {
    habitId: "h1",
    title: "Test Habit",
    frequency: { type: "daily" },
    notificationTime: "08:00",
    isArchived: false,
    completedDates: ["2024-03-01", "2024-03-05"],
  };

  it("returns true when the date is in completedDates", () => {
    expect(isHabitCompletedForDate(baseHabit, "2024-03-01")).toBe(true);
    expect(isHabitCompletedForDate(baseHabit, "2024-03-05")).toBe(true);
  });

  it("returns false when the date is not in completedDates", () => {
    expect(isHabitCompletedForDate(baseHabit, "2024-03-02")).toBe(false);
    expect(isHabitCompletedForDate(baseHabit, "2024-03-10")).toBe(false);
  });

  it("returns false for a habit with no completed dates", () => {
    const emptyHabit = { ...baseHabit, completedDates: [] };
    expect(isHabitCompletedForDate(emptyHabit, "2024-03-01")).toBe(false);
  });
});
