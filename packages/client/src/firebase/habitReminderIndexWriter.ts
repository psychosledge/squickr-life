/**
 * habitReminderIndexWriter
 *
 * Creates the onEventsUploaded callback for SyncManager that maintains the
 * users/{userId}/habitReminders Firestore index collection.
 *
 * The Cloud Function (habitReminderFanOut) queries this collection to find
 * reminders due for firing. Without these index docs, the function finds
 * nothing to fire.
 *
 * Behaviour per event type:
 *   HabitCreated (with notificationTime)  → setDoc (full document, completedDates: [])
 *   HabitCreated (without notificationTime) → no-op
 *   HabitNotificationTimeSet              → setDoc (upsert full document, completedDates: [])
 *   HabitNotificationTimeCleared          → deleteDoc
 *   HabitArchived                         → deleteDoc
 *   HabitRestored                         → no-op
 *   HabitTitleChanged                     → if habit has notificationTime: setDoc merge {title, updatedAt}; else no-op
 *   HabitFrequencyChanged                 → if habit has notificationTime: setDoc merge {frequency, updatedAt}; else no-op
 *   HabitCompleted                        → updateDoc {completedDates: arrayUnion(date), updatedAt}
 *   HabitCompletionReverted               → updateDoc {completedDates: arrayRemove(date), updatedAt}
 *   everything else                       → ignore
 */

import {
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type Firestore,
} from 'firebase/firestore';
import type { DomainEvent } from '@squickr/domain';
import type {
  HabitCreated,
  HabitNotificationTimeSet,
  HabitNotificationTimeCleared,
  HabitArchived,
  HabitTitleChanged,
  HabitFrequencyChanged,
  HabitCompleted,
  HabitCompletionReverted,
} from '@squickr/domain';
import type { HabitProjection } from '@squickr/domain';
import { logger } from '../utils/logger';

/**
 * Returns the onEventsUploaded callback to pass to SyncManager.
 *
 * @param firestore       - The Firestore instance from firebase/config
 * @param userId          - The authenticated user's UID
 * @param habitProjection - Used to resolve habit state (title, frequency, notificationTime)
 */
export function createHabitReminderIndexWriter(
  firestore: Firestore,
  userId: string,
  habitProjection: HabitProjection,
): (events: DomainEvent[]) => Promise<void> {
  return async (events: DomainEvent[]) => {
    for (const event of events) {
      try {
        if (event.type === 'HabitCreated') {
          const { payload } = event as HabitCreated;

          if (!payload.notificationTime) {
            // No reminder configured at creation — nothing to index
            continue;
          }

          const docRef = doc(firestore, `users/${userId}/habitReminders/${payload.habitId}`);
          await setDoc(docRef, {
            habitId: payload.habitId,
            title: payload.title,
            frequency: payload.frequency,
            notificationTime: payload.notificationTime,
            completedDates: [],
            userId,
            updatedAt: serverTimestamp(),
          });

          logger.info('[habitReminderIndexWriter] Upserted habitReminders doc for habit:', payload.habitId);
        } else if (event.type === 'HabitNotificationTimeSet') {
          const { payload } = event as HabitNotificationTimeSet;
          const { habitId, notificationTime } = payload;

          const habit = await habitProjection.getHabitById(habitId);
          if (!habit) {
            // Habit not found — skip to avoid writing a doc with empty fields
            continue;
          }

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await setDoc(docRef, {
            habitId,
            title: habit.title,
            frequency: habit.frequency,
            notificationTime,
            completedDates: [],
            userId,
            updatedAt: serverTimestamp(),
          });

          logger.info('[habitReminderIndexWriter] Upserted habitReminders doc for habit:', habitId);
        } else if (event.type === 'HabitNotificationTimeCleared') {
          const { payload } = event as HabitNotificationTimeCleared;
          const { habitId } = payload;

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await deleteDoc(docRef);

          logger.info('[habitReminderIndexWriter] Deleted habitReminders doc for habit:', habitId);
        } else if (event.type === 'HabitArchived') {
          const { payload } = event as HabitArchived;
          const { habitId } = payload;

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await deleteDoc(docRef);

          logger.info('[habitReminderIndexWriter] Deleted habitReminders doc (archived) for habit:', habitId);
        } else if (event.type === 'HabitTitleChanged') {
          const { payload } = event as HabitTitleChanged;
          const { habitId, title } = payload;

          const habit = await habitProjection.getHabitById(habitId);
          if (!habit || !habit.notificationTime) {
            continue; // no reminder set (or habit not found) — nothing to update
          }

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await setDoc(docRef, { title, updatedAt: serverTimestamp() }, { merge: true });

          logger.info('[habitReminderIndexWriter] Updated title in habitReminders doc for habit:', habitId);
        } else if (event.type === 'HabitFrequencyChanged') {
          const { payload } = event as HabitFrequencyChanged;
          const { habitId, frequency } = payload;

          const habit = await habitProjection.getHabitById(habitId);
          if (!habit || !habit.notificationTime) {
            continue; // no reminder set (or habit not found) — nothing to update
          }

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await setDoc(docRef, { frequency, updatedAt: serverTimestamp() }, { merge: true });

          logger.info('[habitReminderIndexWriter] Updated frequency in habitReminders doc for habit:', habitId);
        } else if (event.type === 'HabitCompleted') {
          const { payload } = event as HabitCompleted;
          const { habitId, date } = payload;

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await updateDoc(docRef, {
            completedDates: arrayUnion(date),
            updatedAt: serverTimestamp(),
          });

          logger.info('[habitReminderIndexWriter] Added completion date to habitReminders doc for habit:', habitId);
        } else if (event.type === 'HabitCompletionReverted') {
          const { payload } = event as HabitCompletionReverted;
          const { habitId, date } = payload;

          const docRef = doc(firestore, `users/${userId}/habitReminders/${habitId}`);
          await updateDoc(docRef, {
            completedDates: arrayRemove(date),
            updatedAt: serverTimestamp(),
          });

          logger.info('[habitReminderIndexWriter] Removed completion date from habitReminders doc for habit:', habitId);
        }
        // All other event types are intentionally ignored
      } catch (err) {
        logger.error('[habitReminderIndexWriter] Error processing event:', event.type, err);
      }
    }
  };
}
