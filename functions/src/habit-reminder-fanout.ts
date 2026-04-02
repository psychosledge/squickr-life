/**
 * habitReminderFanOut — Cloud Function (v2 onSchedule)
 *
 * Runs every 15 minutes. For each user with active FCM tokens:
 *   1. Prunes stale FCM tokens (lastSeenAt older than 60 days)
 *   2. Gets habits with notification times
 *   3. Checks time window, schedule, completion, and idempotency
 *   4. Sends FCM notification + writes idempotency log
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  getActiveHabitsWithNotifications,
  isHabitScheduledForDate,
  isHabitCompletedForDate,
} from "./habit-event-reader";
import {
  getCurrentLocalTime,
  getCurrentLocalDate,
  isWithinTimeWindow,
} from "./time-utils";

// ============================================================================
// Types
// ============================================================================

export interface TokenDoc {
  id: string;
  token: string;
  timezone: string;
}

// ============================================================================
// Token pruning
// ============================================================================

/**
 * Deletes FCM token documents whose lastSeenAt is older than 60 days.
 * Uses a collectionGroup query across all users' fcmTokens subcollections.
 * Deletes in batches of 500 to stay within Firestore write limits.
 */
export async function pruneStaleTokens(
  db: admin.firestore.Firestore
): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

  const snapshot = await db
    .collectionGroup("fcmTokens")
    .where("lastSeenAt", "<", cutoffTimestamp)
    .get();

  if (snapshot.docs.length === 0) {
    return;
  }

  // Delete in batches of 500 to respect Firestore write limits
  const BATCH_LIMIT = 500;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + BATCH_LIMIT).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  console.log(`pruneStaleTokens: deleted ${snapshot.docs.length} stale token(s)`);
}

// ============================================================================
// Core fan-out logic (exported for testing)
// ============================================================================

/**
 * Processes habit notifications for a single user across all their FCM tokens.
 *
 * Algorithm (habit-first, then token fan-out):
 *   - Gets the user's active habits with notification times
 *   - For each habit, writes idempotency log FIRST (optimistic lock), then fans out
 *     to ALL tokens — "may miss one send" is preferable to "may double-send"
 *   - Uses the first token's timezone for local time/date (all tokens belong to
 *     the same user — timezones should be consistent)
 */
export async function processUserHabitNotifications(
  db: admin.firestore.Firestore,
  messaging: admin.messaging.Messaging,
  userId: string,
  tokenDocs: TokenDoc[]
): Promise<void> {
  // Get active habits for this user — catch errors so caller can continue with other users
  let habits;
  try {
    habits = await getActiveHabitsWithNotifications(db, userId);
  } catch (err) {
    console.error(
      `processUserHabitNotifications: error fetching habits for user ${userId}`,
      err
    );
    return;
  }

  if (habits.length === 0) {
    console.log(`processUserHabitNotifications: no active habits with notificationTime for user ${userId}`);
    return;
  }

  if (tokenDocs.length === 0) {
    console.log(`processUserHabitNotifications: no token docs for user ${userId}`);
    return;
  }

  // Use the first token's timezone to determine the current local time/date
  // (all tokens for a user share the same user — pick the first available timezone)
  const rawTimezone = tokenDocs[0]?.timezone;
  if (!rawTimezone) {
    console.warn(
      `processUserHabitNotifications: missing timezone for user ${userId}, falling back to UTC`
    );
  }
  const primaryTimezone = rawTimezone ?? "UTC";
  const currentTime = getCurrentLocalTime(primaryTimezone);
  const currentDate = getCurrentLocalDate(primaryTimezone);

  console.log(`processUserHabitNotifications: user ${userId} has ${habits.length} habit(s) with notifications, localTime=${currentTime}, localDate=${currentDate}, tz=${primaryTimezone}`);

  // Process each habit independently
  for (const habit of habits) {
    try {
      // Check 1: Time window
      if (!isWithinTimeWindow(currentTime, habit.notificationTime)) {
        console.log(`processUserHabitNotifications: habit ${habit.habitId} ("${habit.title}") skipped — time window (current=${currentTime}, target=${habit.notificationTime})`);
        continue;
      }

      // Check 2: Scheduled for today
      if (!isHabitScheduledForDate(habit, currentDate)) {
        console.log(`processUserHabitNotifications: habit ${habit.habitId} ("${habit.title}") skipped — not scheduled for ${currentDate}`);
        continue;
      }

      // Check 3: Not already completed today
      if (isHabitCompletedForDate(habit, currentDate)) {
        console.log(`processUserHabitNotifications: habit ${habit.habitId} ("${habit.title}") skipped — already completed for ${currentDate}`);
        continue;
      }

      // Check 4: Idempotency — has this notification already been sent today?
      const logDocId = `${habit.habitId}-${currentDate}`;
      const logRef = db
        .collection(`users/${userId}/notificationLog`)
        .doc(logDocId);
      const logSnap = await logRef.get();

      if (logSnap.exists) {
        console.log(`processUserHabitNotifications: habit ${habit.habitId} ("${habit.title}") skipped — idempotency log exists for ${currentDate}`);
        continue;
      }

      // Write idempotency log FIRST (optimistic lock) before fan-out.
      // This ensures we never double-send even if the function is interrupted
      // mid fan-out. The trade-off: a crash after this write but before any
      // send means the notification is silently missed for that day.
      const now = new Date();
      const ttl = admin.firestore.Timestamp.fromDate(
        new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      );
      await logRef.set({
        habitId: habit.habitId,
        userId,
        date: currentDate,
        sentAt: now.toISOString(),
        ttl,
      });

      // Fan-out to ALL tokens
      for (const tokenDoc of tokenDocs) {
        const { id: tokenDocId, token: fcmToken } = tokenDoc;

        // Guard: skip empty/missing tokens (malformed Firestore doc)
        if (!fcmToken) {
          console.warn(
            `processUserHabitNotifications: skipping empty token ${tokenDocId} for user ${userId}`
          );
          continue;
        }

        const message: admin.messaging.Message = {
          notification: {
            title: "Squickr",
            body: `Time for: ${habit.title}`,
          },
          data: {
            // TODO: deep-link to specific habit once client routing supports it
            url: "/",
          },
          token: fcmToken,
        };

        try {
          const messageId = await messaging.send(message);
          console.log(`processUserHabitNotifications: sent notification for habit ${habit.habitId} ("${habit.title}") to token ${tokenDocId} — messageId=${messageId}`);
        } catch (sendErr) {
          // Check if the token is invalid/unregistered — delete it
          const errorCode = (sendErr as { errorInfo?: { code?: string } })
            ?.errorInfo?.code;

          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            console.warn(
              `processUserHabitNotifications: deleting invalid token ${tokenDocId} for user ${userId}`,
              errorCode
            );
            await db
              .collection(`users/${userId}/fcmTokens`)
              .doc(tokenDocId)
              .delete();
          } else {
            // Non-fatal error — log and continue to next token
            console.error(
              `processUserHabitNotifications: failed to send to token ${tokenDocId} for user ${userId}`,
              sendErr
            );
          }
        }
      }
    } catch (habitErr) {
      // Per-habit error — log and continue processing other habits
      console.error(
        `processUserHabitNotifications: error processing habit ${habit.habitId} for user ${userId}`,
        habitErr
      );
    }
  }
}

// ============================================================================
// Cloud Function trigger
// ============================================================================

export const habitReminderFanOut = onSchedule(
  {
    schedule: "every 15 minutes",
    region: "us-central1",
    timeoutSeconds: 300, // 5 minutes — allows for multi-user fan-out
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    console.log("habitReminderFanOut: starting run");

    // Step 1: Prune stale tokens
    try {
      await pruneStaleTokens(db);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? String(err);
      console.error(
        `habitReminderFanOut: error pruning stale tokens — ${message}`,
        err
      );
      // Non-fatal — continue with fan-out
    }

    // Step 2: Query all users with active (non-stale) fcmTokens
    // Requires a Firestore composite index on fcmTokens.lastSeenAt (COLLECTION_GROUP)
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
      console.error(
        `habitReminderFanOut: error querying fcmTokens — ${message}`,
        err
      );
      return;
    }

    // Group token docs by userId
    // Path structure: users/{userId}/fcmTokens/{tokenId}
    const userTokenMap = new Map<string, TokenDoc[]>();
    for (const doc of tokenSnapshot.docs) {
      const pathParts = doc.ref.path.split("/");
      const userId = pathParts[1]; // index 0=users, 1=userId, 2=fcmTokens, 3=tokenId
      if (!userId) continue;

      const data = doc.data();

      // Validate token field before adding to map
      const rawToken = data.token;
      if (typeof rawToken !== "string" || !rawToken) {
        console.warn(
          `habitReminderFanOut: skipping token doc ${doc.id} with missing/invalid token field`
        );
        continue;
      }

      const rawTz = data.timezone;
      if (!rawTz) {
        console.warn(
          `habitReminderFanOut: token doc ${doc.id} for user ${userId} missing timezone, will fall back to UTC`
        );
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

    console.log(`habitReminderFanOut: processing ${userTokenMap.size} user(s)`);

    // Step 3: Process users in batches to avoid overwhelming Firestore + FCM
    const BATCH_SIZE = 50;
    const userEntries = [...userTokenMap.entries()];
    for (let i = 0; i < userEntries.length; i += BATCH_SIZE) {
      const batch = userEntries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(([userId, tokens]) =>
          processUserHabitNotifications(db, messaging, userId, tokens).catch(
            (err) => {
              console.error(
                `habitReminderFanOut: error processing user ${userId}`,
                err
              );
            }
          )
        )
      );
    }

    console.log("habitReminderFanOut: run complete");
  }
);
