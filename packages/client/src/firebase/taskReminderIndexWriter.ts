/**
 * taskReminderIndexWriter (ADR-029)
 *
 * Creates the onEventsUploaded callback for SyncManager that maintains the
 * users/{userId}/taskReminders Firestore index collection.
 *
 * The Cloud Function (taskReminderFanOut) queries this collection to find
 * reminders due for firing. Without these index docs, the function finds
 * nothing to fire.
 *
 * Behaviour per event type:
 *   TaskReminderSet       → upsert users/{userId}/taskReminders/{taskId}
 *   TaskReminderCleared (reason: 'user')   → delete the doc
 *   TaskReminderCleared (reason: 'fired')  → skip (CF already deleted the doc)
 *   everything else       → ignore
 */

import { doc, setDoc, deleteDoc, Timestamp, type Firestore } from 'firebase/firestore';
import type { DomainEvent, EntryListProjection } from '@squickr/domain';
import { logger } from '../utils/logger';

/**
 * Returns the onEventsUploaded callback to pass to SyncManager.
 *
 * @param firestore  - The Firestore instance from firebase/config
 * @param userId     - The authenticated user's UID
 * @param entryProjection - Used to resolve task content (title) for the index doc
 */
export function createTaskReminderIndexWriter(
  firestore: Firestore,
  userId: string,
  entryProjection: EntryListProjection,
): (events: DomainEvent[]) => Promise<void> {
  return async (events: DomainEvent[]) => {
    for (const event of events) {
      try {
        if (event.type === 'TaskReminderSet') {
          const payload = (event as { payload: { taskId: string; reminderAt: string; setAt: string } }).payload;
          const { taskId, reminderAt, setAt } = payload;

          // Resolve task content from the projection
          const task = await entryProjection.getTaskById(taskId);
          const content = task?.content ?? '';

          const docRef = doc(firestore, `users/${userId}/taskReminders/${taskId}`);
          await setDoc(docRef, {
            taskId,
            content,
            reminderAt: Timestamp.fromDate(new Date(reminderAt)),
            userId,
            setAt: Timestamp.fromDate(new Date(setAt)),
          });

          logger.info('[taskReminderIndexWriter] Upserted taskReminders doc for task:', taskId);
        } else if (event.type === 'TaskTitleChanged') {
          const payload = (event as { payload: { taskId: string; newContent: string } }).payload;
          const { taskId } = payload;

          // Only update the index doc if the task currently has a reminder set.
          const task = await entryProjection.getTaskById(taskId);
          if (!task?.reminderAt) {
            continue;
          }

          const docRef = doc(firestore, `users/${userId}/taskReminders/${taskId}`);
          await setDoc(docRef, { content: task.content }, { merge: true });

          logger.info('[taskReminderIndexWriter] Updated content in taskReminders doc for task:', taskId);
        } else if (event.type === 'TaskReminderCleared') {
          const payload = (event as { payload: { taskId: string; reason: 'user' | 'fired' } }).payload;
          const { taskId, reason } = payload;

          if (reason === 'fired') {
            // Cloud Function already deleted the doc — skip to avoid a
            // permission error or race condition.
            logger.info(
              '[taskReminderIndexWriter] Skipping TaskReminderCleared (fired) for task:',
              taskId,
            );
            continue;
          }

          // reason === 'user' — delete the index doc
          const docRef = doc(firestore, `users/${userId}/taskReminders/${taskId}`);
          await deleteDoc(docRef);

          logger.info('[taskReminderIndexWriter] Deleted taskReminders doc for task:', taskId);
        }
        // All other event types are intentionally ignored
      } catch (err) {
        logger.error('[taskReminderIndexWriter] Error processing event:', event.type, err);
      }
    }
  };
}
