/**
 * bootstrapHabitReminderIndex
 *
 * One-shot bootstrap that seeds the users/{userId}/habitReminders Firestore
 * index for existing habits on first app load after deployment.
 *
 * The index writer (habitReminderIndexWriter) only fires when events are
 * uploaded. On first load after deployment nothing is uploaded, so existing
 * habits must be seeded directly.
 *
 * Behaviour:
 * - For each active (non-archived) habit with a notificationTime:
 *     1. Check whether the index doc already exists (getDoc)
 *     2. If it does NOT exist: write the full document shape (setDoc)
 *     3. If it DOES exist: skip (idempotent)
 * - Habits without notificationTime: skip entirely, no Firestore calls
 * - Per-habit errors: caught and logged; remaining habits are still processed
 * - The function itself never throws
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { HabitProjection } from '@squickr/domain';
import { logger } from '../utils/logger';

export async function bootstrapHabitReminderIndex(
  firestore: Firestore,
  userId: string,
  habitProjection: HabitProjection,
): Promise<void> {
  const habits = await habitProjection.getActiveHabits();

  for (const habit of habits) {
    if (!habit.notificationTime) {
      // No reminder configured — nothing to index
      continue;
    }

    try {
      const docRef = doc(firestore, `users/${userId}/habitReminders/${habit.id}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Already indexed — skip to preserve any existing completedDates
        continue;
      }

      await setDoc(docRef, {
        habitId: habit.id,
        title: habit.title,
        frequency: habit.frequency,
        notificationTime: habit.notificationTime,
        completedDates: [],
        userId,
        updatedAt: serverTimestamp(),
      });

      logger.info('[bootstrapHabitReminderIndex] Seeded habitReminders doc for habit:', habit.id);
    } catch (err) {
      logger.error('[bootstrapHabitReminderIndex] Error seeding habit:', habit.id, err);
    }
  }
}
