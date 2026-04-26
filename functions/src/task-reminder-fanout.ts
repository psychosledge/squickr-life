/**
 * taskReminderFanOut — Cloud Function (v2 onSchedule)
 *
 * Runs every 15 minutes. Queries taskReminders index documents within the
 * past 15-minute window, sends FCM notifications, writes idempotency logs,
 * appends TaskReminderCleared events, and deletes the reminder documents.
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { TokenDoc } from "./habit-reminder-fanout";
export type { TokenDoc };

// ============================================================================
// Core fan-out logic (exported for testing)
// ============================================================================

/**
 * Process task reminders for a single user.
 *
 * Algorithm:
 *   - For each taskReminders doc whose reminderAt is within [windowStart, now]:
 *     1. Check idempotency log
 *     2. Write idempotency log first
 *     3. Send FCM data-only message
 *     4. Append TaskReminderCleared event (reason: 'fired')
 *     5. Delete taskReminders doc
 *   - Continues processing other reminders if one fails
 */
export async function processUserTaskReminders(
  db: admin.firestore.Firestore,
  messaging: admin.messaging.Messaging,
  userId: string,
  tokenDocs: TokenDoc[],
  windowStart: Date,
  now: Date
): Promise<void> {
  if (tokenDocs.length === 0) {
    console.log(`processUserTaskReminders: no token docs for user ${userId}`);
    return;
  }

  // Query all taskReminders docs for this user
  let reminderDocs: admin.firestore.QuerySnapshot;
  try {
    reminderDocs = await db
      .collection(`users/${userId}/taskReminders`)
      .get();
  } catch (err) {
    console.error(`processUserTaskReminders: error fetching taskReminders for user ${userId}`, err);
    return;
  }

  if (reminderDocs.docs.length === 0) {
    console.log(`processUserTaskReminders: no taskReminders for user ${userId}`);
    return;
  }

  const windowStartMs = windowStart.getTime();
  const nowMs = now.getTime();

  for (const doc of reminderDocs.docs) {
    try {
      const data = doc.data();
      const taskId = data.taskId as string;
      const content = (data.content as string) ?? "task";

      // Convert reminderAt to a Date — could be a Firestore Timestamp or ISO string
      let reminderAtMs: number;
      const reminderAtRaw = data.reminderAt;
      if (reminderAtRaw && typeof (reminderAtRaw as admin.firestore.Timestamp).toMillis === "function") {
        reminderAtMs = (reminderAtRaw as admin.firestore.Timestamp).toMillis();
      } else if (typeof reminderAtRaw === "string") {
        reminderAtMs = new Date(reminderAtRaw).getTime();
      } else {
        console.warn(`processUserTaskReminders: invalid reminderAt for task ${taskId}, skipping`);
        continue;
      }

      // Only process reminders within the window [windowStart, now]
      if (reminderAtMs < windowStartMs || reminderAtMs > nowMs) {
        console.log(
          `processUserTaskReminders: task ${taskId} reminderAt=${new Date(reminderAtMs).toISOString()} outside window, skipping`
        );
        continue;
      }

      // Idempotency check
      const logDocId = `${taskId}-${reminderAtMs}`;
      const logRef = db.collection(`users/${userId}/notificationLog`).doc(logDocId);
      const logSnap = await logRef.get();

      if (logSnap.exists) {
        console.log(`processUserTaskReminders: task ${taskId} already logged, skipping`);
        continue;
      }

      // Write idempotency log FIRST (optimistic lock)
      const now_ = new Date();
      const ttl = admin.firestore.Timestamp.fromDate(
        new Date(now_.getTime() + 7 * 24 * 60 * 60 * 1000)
      );
      await logRef.set({
        taskId,
        userId,
        reminderAtMs,
        sentAt: now_.toISOString(),
        ttl,
      });

      // Fan-out to ALL tokens
      for (const tokenDoc of tokenDocs) {
        const { id: tokenDocId, token: fcmToken } = tokenDoc;

        if (!fcmToken) {
          console.warn(`processUserTaskReminders: skipping empty token ${tokenDocId} for user ${userId}`);
          continue;
        }

        const message: admin.messaging.Message = {
          data: {
            title: "Squickr",
            body: `Reminder: ${content}`,
            url: "/",
          },
          token: fcmToken,
        };

        try {
          const messageId = await messaging.send(message);
          console.log(
            `processUserTaskReminders: sent reminder for task ${taskId} to token ${tokenDocId} — messageId=${messageId}`
          );
        } catch (sendErr) {
          const errorCode = (sendErr as { errorInfo?: { code?: string } })?.errorInfo?.code;

          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            console.warn(
              `processUserTaskReminders: deleting invalid token ${tokenDocId} for user ${userId}`,
              errorCode
            );
            await db.collection(`users/${userId}/fcmTokens`).doc(tokenDocId).delete();
          } else {
            console.error(
              `processUserTaskReminders: failed to send to token ${tokenDocId} for user ${userId}`,
              sendErr
            );
          }
        }
      }

      // Append TaskReminderCleared event (reason: 'fired') to users/{userId}/events
      const eventId = crypto.randomUUID();
      const clearedAt = new Date().toISOString();
      await db.collection(`users/${userId}/events`).doc(eventId).set({
        id: eventId,
        type: "TaskReminderCleared",
        aggregateId: taskId,
        timestamp: clearedAt,
        version: 1,
        payload: {
          taskId,
          clearedAt,
          reason: "fired",
        },
      });

      // Delete the taskReminders index document
      await doc.ref.delete();

      console.log(`processUserTaskReminders: processed reminder for task ${taskId} of user ${userId}`);
    } catch (reminderErr) {
      console.error(
        `processUserTaskReminders: error processing reminder doc ${doc.id} for user ${userId}`,
        reminderErr
      );
    }
  }
}

// ============================================================================
// Cloud Function trigger
// ============================================================================

export const taskReminderFanOut = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    console.log("taskReminderFanOut: starting run");

    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    // Query all users with active (non-stale) fcmTokens
    let tokenSnapshot: admin.firestore.QuerySnapshot;
    try {
      tokenSnapshot = await db
        .collectionGroup("fcmTokens")
        .where(
          "lastSeenAt",
          ">",
          admin.firestore.Timestamp.fromDate(
            new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
          )
        )
        .get();
    } catch (err) {
      const message = (err as { message?: string })?.message ?? String(err);
      console.error(`taskReminderFanOut: error querying fcmTokens — ${message}`, err);
      return;
    }

    // Group token docs by userId
    const userTokenMap = new Map<string, TokenDoc[]>();
    for (const doc of tokenSnapshot.docs) {
      const pathParts = doc.ref.path.split("/");
      const userId = pathParts[1];
      if (!userId) continue;

      const data = doc.data();
      const rawToken = data.token;
      if (typeof rawToken !== "string" || !rawToken) {
        console.warn(`taskReminderFanOut: skipping token doc ${doc.id} with missing/invalid token field`);
        continue;
      }

      const tokenDoc: TokenDoc = {
        id: doc.id,
        token: rawToken,
        timezone: (data.timezone as string) ?? "UTC",
      };

      const existing = userTokenMap.get(userId) ?? [];
      existing.push(tokenDoc);
      userTokenMap.set(userId, existing);
    }

    console.log(`taskReminderFanOut: processing ${userTokenMap.size} user(s)`);

    const BATCH_SIZE = 50;
    const userEntries = [...userTokenMap.entries()];
    for (let i = 0; i < userEntries.length; i += BATCH_SIZE) {
      const batch = userEntries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(([userId, tokens]) =>
          processUserTaskReminders(db, messaging, userId, tokens, windowStart, now).catch((err) => {
            console.error(`taskReminderFanOut: error processing user ${userId}`, err);
          })
        )
      );
    }

    console.log("taskReminderFanOut: run complete");
  }
);
