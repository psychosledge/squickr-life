/**
 * Tests for habitReminderFanOut Cloud Function.
 * We test the extracted pure-ish function `processUserHabitNotifications`
 * and `pruneStaleTokens` rather than the onSchedule trigger itself.
 */

import * as admin from "firebase-admin";
import {
  processUserHabitNotifications,
  pruneStaleTokens,
} from "./habit-reminder-fanout";
import {
  getActiveHabitsWithNotifications,
  isHabitScheduledForDate,
  isHabitCompletedForDate,
  HabitState,
} from "./habit-event-reader";
import {
  getCurrentLocalTime,
  getCurrentLocalDate,
  isWithinTimeWindow,
} from "./time-utils";

// ---------------------------------------------------------------------------
// Jest module mocks — must be at the top
// ---------------------------------------------------------------------------

jest.mock("./habit-event-reader", () => ({
  getActiveHabitsWithNotifications: jest.fn(),
  isHabitScheduledForDate: jest.fn(),
  isHabitCompletedForDate: jest.fn(),
}));

jest.mock("./time-utils", () => ({
  getCurrentLocalTime: jest.fn(),
  getCurrentLocalDate: jest.fn(),
  isWithinTimeWindow: jest.fn(),
}));

// Typed mock helpers
const mockGetActiveHabits = getActiveHabitsWithNotifications as jest.MockedFunction<typeof getActiveHabitsWithNotifications>;
const mockIsScheduled = isHabitScheduledForDate as jest.MockedFunction<typeof isHabitScheduledForDate>;
const mockIsCompleted = isHabitCompletedForDate as jest.MockedFunction<typeof isHabitCompletedForDate>;
const mockGetCurrentLocalTime = getCurrentLocalTime as jest.MockedFunction<typeof getCurrentLocalTime>;
const mockGetCurrentLocalDate = getCurrentLocalDate as jest.MockedFunction<typeof getCurrentLocalDate>;
const mockIsWithinTimeWindow = isWithinTimeWindow as jest.MockedFunction<typeof isWithinTimeWindow>;

// ---------------------------------------------------------------------------
// Fake Firestore builder
// ---------------------------------------------------------------------------

interface FakeDocData {
  [key: string]: unknown;
}

interface FakeDoc {
  id: string;
  ref: { path: string; delete: jest.Mock };
  data(): FakeDocData;
}

/**
 * Creates a minimal fake Firestore that supports:
 * - collection().get()
 * - collectionGroup().where().get()
 * - doc().get() / doc().set() / doc().delete()
 * - collection().doc().get() / .set() / .delete()
 */
function makeFakeFirestore() {
  // In-memory store: path → data
  const store = new Map<string, FakeDocData>();
  // Track all writes and deletes for assertions
  const writes: Array<{ path: string; data: FakeDocData }> = [];
  const deletes: string[] = [];

  interface FakeDocRef {
    path: string;
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
  }

  function makeDocRef(path: string): FakeDocRef {
    const ref: FakeDocRef = {
      path,
      get: jest.fn(async () => {
        const data = store.get(path);
        return {
          exists: data !== undefined,
          data: () => data,
          id: path.split("/").pop() ?? "",
          ref,
        };
      }),
      set: jest.fn(async (data: FakeDocData) => {
        store.set(path, data);
        writes.push({ path, data });
      }),
      delete: jest.fn(async () => {
        store.delete(path);
        deletes.push(path);
      }),
    };
    return ref;
  }

  // Pre-populate helpers
  function seedDoc(path: string, data: FakeDocData) {
    store.set(path, data);
  }

  // Build a fake collectionGroup snapshot from seeded data matching the collection name
  function makeCollectionGroupDocs(collectionName: string): FakeDoc[] {
    const docs: FakeDoc[] = [];
    for (const [path, data] of store.entries()) {
      // e.g. "users/uid/fcmTokens/tokenId" — last segment of parent is collectionName
      const parts = path.split("/");
      if (parts[parts.length - 2] === collectionName) {
        docs.push({
          id: parts[parts.length - 1],
          ref: makeDocRef(path),
          data: () => data,
        });
      }
    }
    return docs;
  }

  // Build a fake subcollection snapshot for a given path prefix
  function makeSubcollectionDocs(prefix: string): FakeDoc[] {
    const docs: FakeDoc[] = [];
    for (const [path, data] of store.entries()) {
      if (path.startsWith(prefix + "/")) {
        const remaining = path.slice(prefix.length + 1);
        if (!remaining.includes("/")) {
          // Direct child only
          docs.push({
            id: remaining,
            ref: makeDocRef(path),
            data: () => data,
          });
        }
      }
    }
    return docs;
  }

  const db = {
    _store: store,
    _writes: writes,
    _deletes: deletes,
    _seedDoc: seedDoc,

    collection: (collectionPath: string) => {
      return {
        get: jest.fn(async () => ({
          docs: makeSubcollectionDocs(collectionPath),
        })),
        where: jest.fn(() => ({
          get: jest.fn(async () => ({
            docs: makeSubcollectionDocs(collectionPath),
          })),
        })),
        doc: (docId: string) => makeDocRef(`${collectionPath}/${docId}`),
      };
    },

    collectionGroup: (collectionName: string) => ({
      where: jest.fn((_field: string, _op: string, _value: unknown) => ({
        get: jest.fn(async () => ({
          docs: makeCollectionGroupDocs(collectionName),
        })),
      })),
    }),

    // Minimal WriteBatch fake — tracks deletes via the shared deletes array
    batch: () => {
      const batchOps: Array<() => void> = [];
      return {
        delete: jest.fn((ref: { path: string; delete: jest.Mock }) => {
          batchOps.push(() => {
            store.delete(ref.path);
            deletes.push(ref.path);
          });
        }),
        commit: jest.fn(async () => {
          batchOps.forEach((op) => op());
        }),
      };
    },
  };

  return db as unknown as admin.firestore.Firestore & {
    _store: Map<string, FakeDocData>;
    _writes: Array<{ path: string; data: FakeDocData }>;
    _deletes: string[];
    _seedDoc: (path: string, data: FakeDocData) => void;
  };
}

// ---------------------------------------------------------------------------
// Fake Messaging builder
// ---------------------------------------------------------------------------

function makeFakeMessaging(opts: { throwErrorCode?: string } = {}) {
  const sentMessages: unknown[] = [];

  const send = jest.fn(async (message: unknown) => {
    if (opts.throwErrorCode) {
      const err = new Error("FCM error") as Error & { errorInfo?: { code: string } };
      err.errorInfo = { code: opts.throwErrorCode };
      throw err;
    }
    sentMessages.push(message);
    return "message-id-" + sentMessages.length;
  });

  return {
    send,
    _sentMessages: sentMessages,
  } as unknown as admin.messaging.Messaging & {
    send: jest.Mock;
    _sentMessages: unknown[];
  };
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const BASE_TIMEZONE = "America/New_York";
const BASE_DATE = "2024-03-15";
const BASE_TIME = "08:00";

function makeHabit(overrides: Partial<HabitState> = {}): HabitState {
  return {
    habitId: "habit-1",
    title: "Morning Run",
    frequency: { type: "daily" },
    notificationTime: "08:00",
    isArchived: false,
    completedDates: [],
    ...overrides,
  };
}

function makeTokenDoc(overrides: { id?: string; token?: string; timezone?: string } = {}) {
  return {
    id: overrides.id ?? "token-doc-1",
    token: overrides.token ?? "fcm-token-abc123",
    timezone: overrides.timezone ?? BASE_TIMEZONE,
  };
}

// Default mock setup: habit scheduled, in time window, not completed
function setupDefaultMocks(habit: HabitState = makeHabit()) {
  mockGetActiveHabits.mockResolvedValue([habit]);
  mockGetCurrentLocalTime.mockReturnValue(BASE_TIME);
  mockGetCurrentLocalDate.mockReturnValue(BASE_DATE);
  mockIsWithinTimeWindow.mockReturnValue(true);
  mockIsScheduled.mockReturnValue(true);
  mockIsCompleted.mockReturnValue(false);
}

// ---------------------------------------------------------------------------
// Tests: processUserHabitNotifications
// ---------------------------------------------------------------------------

describe("processUserHabitNotifications", () => {
  let db: ReturnType<typeof makeFakeFirestore>;
  let messaging: ReturnType<typeof makeFakeMessaging>;
  const userId = "user-1";

  beforeEach(() => {
    db = makeFakeFirestore();
    messaging = makeFakeMessaging();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: Sends notification when all conditions are met
  // -------------------------------------------------------------------------
  it("sends notification when habit is scheduled, in time window, not completed, no idempotency log", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).toHaveBeenCalledTimes(1);
    expect(messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          title: "Squickr",
          body: "Time for: Morning Run",
        }),
        token: "fcm-token-abc123",
      })
    );
  });

  // -------------------------------------------------------------------------
  // Test 2: Skips when habit is NOT in time window
  // -------------------------------------------------------------------------
  it("skips when habit is NOT in time window", async () => {
    setupDefaultMocks();
    mockIsWithinTimeWindow.mockReturnValue(false);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 3: Skips when habit is NOT scheduled for current date
  // -------------------------------------------------------------------------
  it("skips when habit is NOT scheduled for current date", async () => {
    setupDefaultMocks();
    mockIsScheduled.mockReturnValue(false);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 4: Skips when habit IS already completed for today
  // -------------------------------------------------------------------------
  it("skips when habit IS already completed for today", async () => {
    const habit = makeHabit({ completedDates: [BASE_DATE] });
    setupDefaultMocks(habit);
    mockIsCompleted.mockReturnValue(true);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 5: Skips when idempotency log document already exists
  // -------------------------------------------------------------------------
  it("skips when idempotency log document already exists", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    // Pre-seed the idempotency log
    db._seedDoc(`users/${userId}/notificationLog/${habit.habitId}-${BASE_DATE}`, {
      habitId: habit.habitId,
      userId,
      date: BASE_DATE,
      sentAt: "2024-03-15T08:00:00.000Z",
    });

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 6: Writes idempotency log after sending
  // -------------------------------------------------------------------------
  it("writes idempotency log after sending notification", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    const logPath = `users/${userId}/notificationLog/${habit.habitId}-${BASE_DATE}`;
    const logData = db._store.get(logPath);

    expect(logData).toBeDefined();
    expect(logData).toMatchObject({
      habitId: habit.habitId,
      userId,
      date: BASE_DATE,
    });
    expect(logData?.sentAt).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 7: Sends to multiple tokens for same user
  // -------------------------------------------------------------------------
  it("sends to multiple tokens for same user", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    const tokenDocs = [
      makeTokenDoc({ id: "token-1", token: "fcm-token-111" }),
      makeTokenDoc({ id: "token-2", token: "fcm-token-222" }),
      makeTokenDoc({ id: "token-3", token: "fcm-token-333" }),
    ];

    await processUserHabitNotifications(db, messaging, userId, tokenDocs);

    // One send per token per habit
    expect(messaging.send).toHaveBeenCalledTimes(3);
    const calls = (messaging.send as jest.Mock).mock.calls;
    const sentTokens = calls.map((c: unknown[]) => (c[0] as { token: string }).token);
    expect(sentTokens).toContain("fcm-token-111");
    expect(sentTokens).toContain("fcm-token-222");
    expect(sentTokens).toContain("fcm-token-333");
  });

  // -------------------------------------------------------------------------
  // Test 8: Sends to multiple habits for same user (independent)
  // -------------------------------------------------------------------------
  it("sends to multiple habits for same user independently", async () => {
    const habit1 = makeHabit({ habitId: "habit-1", title: "Morning Run" });
    const habit2 = makeHabit({ habitId: "habit-2", title: "Evening Walk" });

    mockGetActiveHabits.mockResolvedValue([habit1, habit2]);
    mockGetCurrentLocalTime.mockReturnValue(BASE_TIME);
    mockGetCurrentLocalDate.mockReturnValue(BASE_DATE);
    mockIsWithinTimeWindow.mockReturnValue(true);
    mockIsScheduled.mockReturnValue(true);
    mockIsCompleted.mockReturnValue(false);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).toHaveBeenCalledTimes(2);
    const bodies = (messaging.send as jest.Mock).mock.calls.map(
      (c: unknown[]) => (c[0] as { notification: { body: string } }).notification.body
    );
    expect(bodies).toContain("Time for: Morning Run");
    expect(bodies).toContain("Time for: Evening Walk");
  });

  // -------------------------------------------------------------------------
  // Test 9: Handles multiple users independently (one failing doesn't block others)
  // -------------------------------------------------------------------------
  it("continues processing other habits when one getActiveHabits call fails", async () => {
    // Simulate getActiveHabitsWithNotifications throwing for one user
    // We test this by having the first call fail and second succeed
    const habit = makeHabit({ habitId: "habit-2", title: "Evening Walk" });

    mockGetActiveHabits
      .mockRejectedValueOnce(new Error("Firestore error for user"))
      .mockResolvedValueOnce([habit]);

    mockGetCurrentLocalTime.mockReturnValue(BASE_TIME);
    mockGetCurrentLocalDate.mockReturnValue(BASE_DATE);
    mockIsWithinTimeWindow.mockReturnValue(true);
    mockIsScheduled.mockReturnValue(true);
    mockIsCompleted.mockReturnValue(false);

    // First call with user-1 token (will fail)
    await expect(
      processUserHabitNotifications(db, messaging, "user-1", [makeTokenDoc()])
    ).resolves.not.toThrow();

    // Second call with user-2 token (will succeed)
    await processUserHabitNotifications(db, messaging, "user-2", [makeTokenDoc()]);

    expect(messaging.send).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Test 10: Deletes invalid token on messaging/invalid-registration-token
  // -------------------------------------------------------------------------
  it("deletes token document on messaging/invalid-registration-token error", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    // Seed the token document in Firestore
    const tokenPath = `users/${userId}/fcmTokens/token-doc-1`;
    db._seedDoc(tokenPath, { token: "fcm-token-abc123", timezone: BASE_TIMEZONE });

    // Make messaging.send throw the invalid token error
    (messaging.send as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Invalid token"), {
        errorInfo: { code: "messaging/invalid-registration-token" },
      })
    );

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc({ id: "token-doc-1" })]
    );

    // The token document should have been deleted
    expect(db._deletes).toContain(tokenPath);
  });

  // -------------------------------------------------------------------------
  // Test 11: Deletes invalid token on messaging/registration-token-not-registered
  // -------------------------------------------------------------------------
  it("deletes token document on messaging/registration-token-not-registered error", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    const tokenPath = `users/${userId}/fcmTokens/token-doc-1`;
    db._seedDoc(tokenPath, { token: "fcm-token-abc123", timezone: BASE_TIMEZONE });

    (messaging.send as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Token not registered"), {
        errorInfo: { code: "messaging/registration-token-not-registered" },
      })
    );

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc({ id: "token-doc-1" })]
    );

    expect(db._deletes).toContain(tokenPath);
  });

  // -------------------------------------------------------------------------
  // Test 12: Continues processing other tokens when one fails non-fatally
  // -------------------------------------------------------------------------
  it("continues processing other tokens when one fails with a non-recoverable error", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    // First token fails with a generic error
    (messaging.send as jest.Mock)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("message-id-2");

    const tokenDocs = [
      makeTokenDoc({ id: "token-1", token: "fcm-token-fail" }),
      makeTokenDoc({ id: "token-2", token: "fcm-token-ok" }),
    ];

    await processUserHabitNotifications(db, messaging, userId, tokenDocs);

    // Should have attempted both tokens
    expect(messaging.send).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Test 13: Does NOT send when no habits returned (all filtered by getActiveHabits)
  // -------------------------------------------------------------------------
  it("does not send when getActiveHabitsWithNotifications returns empty array", async () => {
    mockGetActiveHabits.mockResolvedValue([]);
    mockGetCurrentLocalTime.mockReturnValue(BASE_TIME);
    mockGetCurrentLocalDate.mockReturnValue(BASE_DATE);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    expect(messaging.send).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 14: Sends correct notification payload
  // -------------------------------------------------------------------------
  it("sends correct notification payload (title, body, data.url)", async () => {
    const habit = makeHabit({ title: "Drink Water" });
    setupDefaultMocks(habit);

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc({ token: "my-fcm-token" })]
    );

    expect(messaging.send).toHaveBeenCalledWith({
      notification: {
        title: "Squickr",
        body: "Time for: Drink Water",
      },
      data: {
        url: "/",
      },
      token: "my-fcm-token",
    });
  });

  // -------------------------------------------------------------------------
  // Test 15: Writes idempotency log with correct TTL (7 days from now)
  // -------------------------------------------------------------------------
  it("writes idempotency log with correct TTL (Firestore Timestamp ~7 days from now)", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    const beforeSend = Date.now();

    await processUserHabitNotifications(
      db,
      messaging,
      userId,
      [makeTokenDoc()]
    );

    const afterSend = Date.now();

    const logPath = `users/${userId}/notificationLog/${habit.habitId}-${BASE_DATE}`;
    const logData = db._store.get(logPath);

    expect(logData).toBeDefined();
    expect(logData?.ttl).toBeDefined();

    // TTL should be a Firestore Timestamp-like object with toMillis() or _seconds
    // In tests we use admin.firestore.Timestamp — check the seconds value
    const ttl = logData?.ttl as admin.firestore.Timestamp;
    expect(typeof ttl.toMillis).toBe("function");

    const ttlMs = ttl.toMillis();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(ttlMs).toBeGreaterThanOrEqual(beforeSend + sevenDaysMs - 1000);
    expect(ttlMs).toBeLessThanOrEqual(afterSend + sevenDaysMs + 1000);
  });

  // -------------------------------------------------------------------------
  // Test 16: idempotency log is keyed per-habit (not shared across habits)
  // -------------------------------------------------------------------------
  it("writes separate idempotency log entries per habit", async () => {
    const habit1 = makeHabit({ habitId: "habit-1", title: "Morning Run" });
    const habit2 = makeHabit({ habitId: "habit-2", title: "Evening Walk" });

    mockGetActiveHabits.mockResolvedValue([habit1, habit2]);
    mockGetCurrentLocalTime.mockReturnValue(BASE_TIME);
    mockGetCurrentLocalDate.mockReturnValue(BASE_DATE);
    mockIsWithinTimeWindow.mockReturnValue(true);
    mockIsScheduled.mockReturnValue(true);
    mockIsCompleted.mockReturnValue(false);

    await processUserHabitNotifications(db, messaging, userId, [makeTokenDoc()]);

    const log1 = db._store.get(`users/${userId}/notificationLog/habit-1-${BASE_DATE}`);
    const log2 = db._store.get(`users/${userId}/notificationLog/habit-2-${BASE_DATE}`);

    expect(log1).toBeDefined();
    expect(log2).toBeDefined();
    expect(log1?.habitId).toBe("habit-1");
    expect(log2?.habitId).toBe("habit-2");
  });

  // -------------------------------------------------------------------------
  // Test 17: Uses timezone from token doc to get local time/date
  // -------------------------------------------------------------------------
  it("uses timezone from token document when calling getCurrentLocalTime/Date", async () => {
    const habit = makeHabit();
    setupDefaultMocks(habit);

    const tokenDoc = makeTokenDoc({ timezone: "Asia/Tokyo" });

    await processUserHabitNotifications(db, messaging, userId, [tokenDoc]);

    expect(mockGetCurrentLocalTime).toHaveBeenCalledWith("Asia/Tokyo");
    expect(mockGetCurrentLocalDate).toHaveBeenCalledWith("Asia/Tokyo");
  });
});

// ---------------------------------------------------------------------------
// Tests: pruneStaleTokens
// ---------------------------------------------------------------------------

describe("pruneStaleTokens", () => {
  it("deletes token documents older than 60 days", async () => {
    const db = makeFakeFirestore();

    // Seed a stale token (older than 60 days)
    const staleTokenPath = "users/user-1/fcmTokens/stale-token";
    db._seedDoc(staleTokenPath, {
      token: "stale-fcm-token",
      timezone: "UTC",
      lastSeenAt: { toMillis: () => Date.now() - 61 * 24 * 60 * 60 * 1000 },
    });

    await pruneStaleTokens(db);

    // The pruneStaleTokens function uses collectionGroup query which returns
    // all seeded fcmToken docs; our fake returns all matching collection docs
    // Verify delete was called
    expect(db._deletes).toContain(staleTokenPath);
  });

  it("returns without error when there are no stale tokens", async () => {
    const db = makeFakeFirestore();
    // No tokens seeded

    await expect(pruneStaleTokens(db)).resolves.not.toThrow();
  });
});
