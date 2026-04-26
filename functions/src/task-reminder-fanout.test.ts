/**
 * Tests for taskReminderFanOut Cloud Function.
 * We test the extracted pure function `processUserTaskReminders`
 * rather than the onSchedule trigger itself.
 */

import * as admin from "firebase-admin";
import {
  processUserTaskReminders,
} from "./task-reminder-fanout";

// ---------------------------------------------------------------------------
// Fake Firestore builder (mirrors habit-reminder-fanout.test.ts pattern)
// ---------------------------------------------------------------------------

interface FakeDocData {
  [key: string]: unknown;
}

interface FakeDoc {
  id: string;
  ref: { path: string; delete: jest.Mock };
  data(): FakeDocData;
}

function makeFakeFirestore() {
  const store = new Map<string, FakeDocData>();
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

  function seedDoc(path: string, data: FakeDocData) {
    store.set(path, data);
  }

  function makeSubcollectionDocs(prefix: string): FakeDoc[] {
    const docs: FakeDoc[] = [];
    for (const [path, data] of store.entries()) {
      if (path.startsWith(prefix + "/")) {
        const remaining = path.slice(prefix.length + 1);
        if (!remaining.includes("/")) {
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

  function makeCollectionGroupDocs(collectionName: string): FakeDoc[] {
    const docs: FakeDoc[] = [];
    for (const [path, data] of store.entries()) {
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

  const db = {
    _store: store,
    _writes: writes,
    _deletes: deletes,
    _seedDoc: seedDoc,

    collection: (collectionPath: string) => ({
      get: jest.fn(async () => ({
        docs: makeSubcollectionDocs(collectionPath),
      })),
      where: jest.fn(() => ({
        get: jest.fn(async () => ({
          docs: makeSubcollectionDocs(collectionPath),
        })),
      })),
      doc: (docId: string) => makeDocRef(`${collectionPath}/${docId}`),
    }),

    collectionGroup: (collectionName: string) => ({
      where: jest.fn((_field: string, _op: string, _value: unknown) => ({
        where: jest.fn(() => ({
          get: jest.fn(async () => ({
            docs: makeCollectionGroupDocs(collectionName),
          })),
        })),
        get: jest.fn(async () => ({
          docs: makeCollectionGroupDocs(collectionName),
        })),
      })),
    }),

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
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-04-07T10:15:00.000Z");
const WINDOW_START = new Date("2026-04-07T10:00:00.000Z");
// reminderAt within window
const REMINDER_IN_WINDOW = new Date("2026-04-07T10:05:00.000Z").toISOString();
// reminderAt before window
const REMINDER_BEFORE_WINDOW = new Date("2026-04-07T09:50:00.000Z").toISOString();

function makeTokenDoc(overrides: { id?: string; token?: string; timezone?: string } = {}) {
  return {
    id: overrides.id ?? "token-doc-1",
    token: overrides.token ?? "fcm-token-abc123",
    timezone: overrides.timezone ?? "UTC",
  };
}

function seedReminder(
  db: ReturnType<typeof makeFakeFirestore>,
  userId: string,
  taskId: string,
  reminderAt: string,
  content = "Buy milk"
) {
  db._seedDoc(`users/${userId}/taskReminders/${taskId}`, {
    taskId,
    content,
    reminderAt: admin.firestore.Timestamp.fromDate(new Date(reminderAt)),
    userId,
    setAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-07T09:00:00.000Z")),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("processUserTaskReminders", () => {
  let db: ReturnType<typeof makeFakeFirestore>;
  let messaging: ReturnType<typeof makeFakeMessaging>;
  const userId = "user-1";
  const taskId = "task-abc";

  beforeEach(() => {
    db = makeFakeFirestore();
    messaging = makeFakeMessaging();
    jest.clearAllMocks();
  });

  it("skips users with no reminders in window", async () => {
    // Seed a reminder OUTSIDE the window (before window start)
    seedReminder(db, userId, taskId, REMINDER_BEFORE_WINDOW);

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    expect(messaging.send).not.toHaveBeenCalled();
  });

  it("skips already-logged reminders (idempotency)", async () => {
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW);

    // Pre-seed idempotency log
    const epoch = new Date(REMINDER_IN_WINDOW).getTime();
    db._seedDoc(`users/${userId}/notificationLog/${taskId}-${epoch}`, {
      taskId,
      userId,
      sentAt: "2026-04-07T10:05:00.000Z",
    });

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    expect(messaging.send).not.toHaveBeenCalled();
  });

  it("sends correct FCM message for a due reminder", async () => {
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW, "Buy milk");

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    expect(messaging.send).toHaveBeenCalledTimes(1);
    expect(messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Squickr",
          body: "Reminder: Buy milk",
          url: "/",
        }),
        token: "fcm-token-abc123",
      })
    );
  });

  it("deletes taskReminders doc after sending", async () => {
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW);

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    const reminderPath = `users/${userId}/taskReminders/${taskId}`;
    expect(db._deletes).toContain(reminderPath);
  });

  it("writes TaskReminderCleared event to Firestore events collection", async () => {
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW);

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    // An event should have been written to users/{userId}/events/
    const eventWritten = db._writes.find(
      (w) => w.path.startsWith(`users/${userId}/events/`) && (w.data.type as string) === "TaskReminderCleared"
    );
    expect(eventWritten).toBeDefined();
    expect(eventWritten?.data.payload).toMatchObject({
      taskId,
      reason: "fired",
    });
  });

  it("handles invalid FCM token by deleting it", async () => {
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW);

    const tokenPath = `users/${userId}/fcmTokens/token-doc-1`;
    db._seedDoc(tokenPath, { token: "fcm-token-abc123", timezone: "UTC" });

    (messaging.send as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Invalid token"), {
        errorInfo: { code: "messaging/invalid-registration-token" },
      })
    );

    await processUserTaskReminders(
      db,
      messaging,
      userId,
      [makeTokenDoc({ id: "token-doc-1" })],
      WINDOW_START,
      NOW
    );

    expect(db._deletes).toContain(tokenPath);
  });

  it("continues processing other reminders if one fails", async () => {
    const taskId2 = "task-xyz";
    seedReminder(db, userId, taskId, REMINDER_IN_WINDOW, "Task one");
    seedReminder(db, userId, taskId2, REMINDER_IN_WINDOW, "Task two");

    // First send fails, second succeeds
    (messaging.send as jest.Mock)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("message-id-2");

    await processUserTaskReminders(db, messaging, userId, [makeTokenDoc()], WINDOW_START, NOW);

    // Both were attempted
    expect(messaging.send).toHaveBeenCalledTimes(2);
  });
});
