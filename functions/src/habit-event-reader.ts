/**
 * Reads Firestore events for a user and reconstructs minimum habit state
 * needed for the habitReminderFanOut function.
 *
 * NO imports from @squickr/domain — all types are defined locally.
 */
import { Firestore } from "firebase-admin/firestore";

// ============================================================================
// Local type definitions — do NOT import from @squickr/domain
// ============================================================================

export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekly"; targetDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }
  | { type: "every-n-days"; n: number };

export interface HabitState {
  habitId: string;
  title: string;
  frequency: HabitFrequency;
  notificationTime: string; // "HH:MM" — only habits WITH a time are returned
  isArchived: boolean;
  completedDates: string[]; // YYYY-MM-DD dates
}

// Internal mutable state used during event folding (before filtering)
interface HabitMutableState {
  habitId: string;
  title: string;
  frequency: HabitFrequency;
  notificationTime?: string;
  isArchived: boolean;
  completedDates: string[];
}

// ============================================================================
// Raw event types (shape of documents stored in Firestore)
// ============================================================================

interface RawEvent {
  type: string;
  aggregateId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Fixed epoch for every-n-days calculation (2020-01-01).
 * We use a stable epoch rather than habit creation date since creation date
 * is not always available on HabitState.
 */
const EPOCH_DATE = "2020-01-01";

/**
 * Returns the number of whole days between two YYYY-MM-DD date strings.
 * Both dates are treated as midnight UTC.
 */
function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(`${dateA}T00:00:00.000Z`).getTime();
  const b = new Date(`${dateB}T00:00:00.000Z`).getTime();
  // Both dates are UTC-anchored midnight — difference is always an exact multiple of msPerDay
  return Math.floor((b - a) / msPerDay);
}

/**
 * Reads all Firestore events for a user (type starts with 'Habit'),
 * folds them into HabitState objects, and returns only active habits
 * (not archived) that have a notificationTime set.
 *
 * Event collection path: users/{userId}/events
 * (same path used by the client-side event store)
 */
export async function getActiveHabitsWithNotifications(
  db: Firestore,
  userId: string
): Promise<HabitState[]> {
  const snapshot = await db
    .collection(`users/${userId}/events`)
    .orderBy("timestamp", "asc")
    .get();

  const habitMap = new Map<string, HabitMutableState>();

  for (const doc of snapshot.docs) {
    const event = doc.data() as RawEvent;

    // Only process Habit events
    if (!event.type.startsWith("Habit")) {
      continue;
    }

    const payload = event.payload;
    const habitId = (payload.habitId as string) ?? event.aggregateId;

    switch (event.type) {
    case "HabitCreated": {
      const state: HabitMutableState = {
        habitId,
        title: payload.title as string,
        frequency: payload.frequency as HabitFrequency,
        isArchived: false,
        completedDates: [],
      };
      if (typeof payload.notificationTime === "string") {
        state.notificationTime = payload.notificationTime;
      }
      habitMap.set(habitId, state);
      break;
    }

    case "HabitTitleChanged": {
      const state = habitMap.get(habitId);
      if (state) {
        state.title = payload.title as string;
      }
      break;
    }

    case "HabitFrequencyChanged": {
      const state = habitMap.get(habitId);
      if (state) {
        state.frequency = payload.frequency as HabitFrequency;
      }
      break;
    }

    case "HabitArchived": {
      const state = habitMap.get(habitId);
      if (state) {
        state.isArchived = true;
      }
      break;
    }

    case "HabitRestored": {
      const state = habitMap.get(habitId);
      if (state) {
        state.isArchived = false;
      }
      break;
    }

    case "HabitNotificationTimeSet": {
      const state = habitMap.get(habitId);
      if (state) {
        state.notificationTime = payload.notificationTime as string;
      }
      break;
    }

    case "HabitNotificationTimeCleared": {
      const state = habitMap.get(habitId);
      if (state) {
        delete state.notificationTime;
      }
      break;
    }

    case "HabitCompleted": {
      const state = habitMap.get(habitId);
      if (state) {
        const date = payload.date as string;
        if (!state.completedDates.includes(date)) {
          state.completedDates.push(date);
        }
      }
      break;
    }

    case "HabitCompletionReverted": {
      const state = habitMap.get(habitId);
      if (state) {
        const date = payload.date as string;
        state.completedDates = state.completedDates.filter((d) => d !== date);
      }
      break;
    }

    // HabitReordered and other events — ignore
    default:
      break;
    }
  }

  // Filter: active (not archived) AND has a notificationTime
  const result: HabitState[] = [];
  for (const state of habitMap.values()) {
    if (!state.isArchived && state.notificationTime !== undefined) {
      result.push({
        habitId: state.habitId,
        title: state.title,
        frequency: state.frequency,
        notificationTime: state.notificationTime,
        isArchived: state.isArchived,
        completedDates: state.completedDates,
      });
    }
  }

  return result;
}

/**
 * Returns true if the habit should fire on the given date (YYYY-MM-DD).
 * Uses the habit's frequency to determine scheduling.
 */
export function isHabitScheduledForDate(
  habit: HabitState,
  dateYYYYMMDD: string
): boolean {
  const { frequency } = habit;

  switch (frequency.type) {
  case "daily":
    return true;

  case "weekly": {
    // Parse the date in UTC to get the day of week (0=Sun, 6=Sat)
    const date = new Date(`${dateYYYYMMDD}T00:00:00.000Z`);
    const dayOfWeek = date.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    return (frequency.targetDays as number[]).includes(dayOfWeek);
  }

  case "every-n-days": {
    const daysSinceEpoch = daysBetween(EPOCH_DATE, dateYYYYMMDD);
    return daysSinceEpoch % frequency.n === 0;
  }

  default: {
    const _exhaustive: never = frequency;
    throw new Error(`Unknown frequency type: ${JSON.stringify(_exhaustive)}`);
  }
  }
}

/**
 * Returns true if the habit has a HabitCompleted event for the given date
 * that hasn't been reverted by HabitCompletionReverted.
 */
export function isHabitCompletedForDate(
  habit: HabitState,
  dateYYYYMMDD: string
): boolean {
  return habit.completedDates.includes(dateYYYYMMDD);
}
