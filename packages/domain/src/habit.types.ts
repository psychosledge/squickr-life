import type { DomainEvent } from './domain-event';

// ============================================================================
// Habit Frequency
// ============================================================================

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekly'; targetDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6> }
  | { type: 'every-n-days'; n: number }; // n ∈ [2..30]

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

/** Union type of all habit domain events */
export type HabitEvent =
  | HabitCreated
  | HabitTitleChanged
  | HabitFrequencyChanged
  | HabitCompleted
  | HabitCompletionReverted
  | HabitArchived
  | HabitRestored
  | HabitReordered;

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
