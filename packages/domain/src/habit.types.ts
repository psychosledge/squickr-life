import type { DomainEvent } from './domain-event';

// ============================================================================
// Habit Frequency
// ============================================================================

export type HabitFrequency =
  // `mode` has no functional effect for daily (1-day interval means relative ≡ fixed behaviour).
  // It is structurally present for type consistency but the UI never sets it on daily habits.
  | { type: 'daily'; mode?: 'fixed' | 'relative' }
  | { type: 'weekly'; targetDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>; mode?: 'fixed' | 'relative' }
  | { type: 'every-n-days'; n: number; mode?: 'fixed' | 'relative' }; // n ∈ [2..30]

// ============================================================================
// Habit Read Models
// ============================================================================

export interface Habit {
  readonly id: string;
  readonly title: string;
  readonly frequency: HabitFrequency;
  readonly createdAt: string;
  readonly archivedAt?: string;
  readonly order: string;
  readonly userId?: string;
  readonly notificationTime?: string; // "HH:MM", Phase 3
}

export interface HabitDayStatus {
  readonly date: string; // YYYY-MM-DD
  readonly status: 'completed' | 'missed' | 'not-scheduled' | 'future';
}

export interface HabitReadModel {
  readonly id: string;
  readonly title: string;
  readonly frequency: HabitFrequency;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly history: HabitDayStatus[]; // last 30 days, oldest-first
  readonly isScheduledToday: boolean;
  readonly isCompletedToday: boolean;
  readonly archivedAt?: string;
  readonly order: string;
  readonly notificationTime?: string;
}

// ============================================================================
// Habit Events
// ============================================================================

export interface HabitCreated extends DomainEvent {
  readonly type: 'HabitCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly title: string;
    readonly frequency: HabitFrequency;
    readonly order: string;
    readonly createdAt: string;
    readonly notificationTime?: string;
  };
}

export interface HabitTitleChanged extends DomainEvent {
  readonly type: 'HabitTitleChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly title: string;
    readonly updatedAt: string;
  };
}

export interface HabitFrequencyChanged extends DomainEvent {
  readonly type: 'HabitFrequencyChanged';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly frequency: HabitFrequency;
    readonly updatedAt: string;
  };
}

export interface HabitCompleted extends DomainEvent {
  readonly type: 'HabitCompleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly date: string; // YYYY-MM-DD
    readonly completedAt: string; // ISO
    readonly collectionId: string;
  };
}

export interface HabitCompletionReverted extends DomainEvent {
  readonly type: 'HabitCompletionReverted';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly date: string;
    readonly revertedAt: string;
  };
}

export interface HabitArchived extends DomainEvent {
  readonly type: 'HabitArchived';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly archivedAt: string;
  };
}

export interface HabitRestored extends DomainEvent {
  readonly type: 'HabitRestored';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly restoredAt: string;
  };
}

export interface HabitReordered extends DomainEvent {
  readonly type: 'HabitReordered';
  readonly aggregateId: string;
  readonly payload: {
    readonly habitId: string;
    readonly order: string;
    readonly reorderedAt: string;
  };
}

export interface HabitNotificationTimeSet extends DomainEvent {
  readonly type: 'HabitNotificationTimeSet';
  readonly aggregateId: string; // habitId
  readonly payload: {
    readonly habitId: string;
    readonly notificationTime: string; // "HH:MM" 24-hour, e.g. "07:30"
    readonly updatedAt: string; // ISO timestamp
  };
}

export interface HabitNotificationTimeCleared extends DomainEvent {
  readonly type: 'HabitNotificationTimeCleared';
  readonly aggregateId: string; // habitId
  readonly payload: {
    readonly habitId: string;
    readonly clearedAt: string; // ISO timestamp
  };
}

// ============================================================================
// Serialisable snapshot shape for HabitProjection
// ============================================================================

/**
 * Plain-object representation of a habit's state suitable for JSON
 * serialisation inside a {@link ProjectionSnapshot}.
 *
 * `completions` is stored as a `Record<date, completedAt>` (plain object)
 * because `Map` is not JSON-serialisable.
 * `reverted` is stored as `string[]` because `Set` is not JSON-serialisable.
 */
export interface SerializableHabitState {
  readonly id: string;
  readonly title: string;
  readonly frequency: HabitFrequency;
  readonly createdAt: string;
  readonly order: string;
  readonly archivedAt?: string;
  readonly notificationTime?: string;
  /** Map<date, completedAt> serialised as a plain object */
  readonly completions: Record<string, string>;
  /** Set<string> serialised as an array */
  readonly reverted: string[];
}

/** Union type of all habit domain events */
export type HabitEvent =
  | HabitCreated
  | HabitTitleChanged
  | HabitFrequencyChanged
  | HabitCompleted
  | HabitCompletionReverted
  | HabitArchived
  | HabitRestored
  | HabitReordered
  | HabitNotificationTimeSet
  | HabitNotificationTimeCleared;

// ============================================================================
// Habit Commands
// ============================================================================

export interface CreateHabitCommand {
  readonly title: string;
  readonly frequency: HabitFrequency;
  readonly order: string;
  readonly notificationTime?: string;
}

export interface UpdateHabitTitleCommand {
  readonly habitId: string;
  readonly title: string;
}

export interface UpdateHabitFrequencyCommand {
  readonly habitId: string;
  readonly frequency: HabitFrequency;
}

export interface CompleteHabitCommand {
  readonly habitId: string;
  readonly date: string;
  readonly collectionId: string;
}

export interface RevertHabitCompletionCommand {
  readonly habitId: string;
  readonly date: string;
}

export interface ArchiveHabitCommand {
  readonly habitId: string;
}

export interface RestoreHabitCommand {
  readonly habitId: string;
}

export interface ReorderHabitCommand {
  readonly habitId: string;
  readonly order: string;
}

export interface SetHabitNotificationTimeCommand {
  readonly habitId: string;
  readonly notificationTime: string; // "HH:MM" validated in handler
}

export interface ClearHabitNotificationTimeCommand {
  readonly habitId: string;
}
