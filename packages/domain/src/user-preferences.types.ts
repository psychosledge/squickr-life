import type { DomainEvent } from './domain-event';
import type { CompletedTaskBehavior } from './collection.types';

// ============================================================================
// User Preferences Domain Types
// ============================================================================

/**
 * RitualSchedule — days of week and/or time of day a ritual reminder fires.
 */
export interface RitualSchedule {
  /** Days of week: 0=Sun … 6=Sat */
  readonly daysOfWeek?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  /** Time of day in "HH:MM" format (local time) */
  readonly timeOfDay?: string;
}

/**
 * RitualReminder — a reminder associated with a Ritual (Phase 3 habit).
 */
export interface RitualReminder {
  readonly id: string;
  readonly habitId: string;
  readonly schedule: RitualSchedule;
  readonly enabled: boolean;
}

/**
 * User preferences - global settings for the application
 * This is a singleton aggregate with aggregateId: 'user-preferences'
 */
export interface UserPreferences {
  /** Optional: User who owns these preferences (for future multi-user support) */
  readonly userId?: string;
  
  /** Default behavior for completed tasks in collections */
  readonly defaultCompletedTaskBehavior: CompletedTaskBehavior;
  
  /** Auto-favorite daily logs accessed in the last 7 days */
  readonly autoFavoriteRecentDailyLogs: boolean;
  
  /** Auto-favorite monthly logs for last month, current month, and next month */
  readonly autoFavoriteRecentMonthlyLogs: boolean;
  
  /** Auto-favorite daily and monthly logs that have at least one open task */
  readonly autoFavoriteCalendarWithActiveTasks: boolean;
  
  /** Ritual reminders for habit-based rituals (Phase 3) */
  readonly ritualReminders?: RitualReminder[];

  /** When preferences were last updated (ISO 8601) */
  readonly updatedAt?: string;
}

/**
 * Default user preferences
 * Used when no preferences have been set yet
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultCompletedTaskBehavior: 'keep-in-place',
  autoFavoriteRecentDailyLogs: false,
  autoFavoriteRecentMonthlyLogs: false,
  autoFavoriteCalendarWithActiveTasks: false,
};

// ============================================================================
// User Preferences Events
// ============================================================================

/**
 * UserPreferencesUpdated Event
 * Emitted when user preferences are updated
 * 
 * Invariants:
 * - aggregateId must always be 'user-preferences' (singleton)
 * - payload must contain at least one preference field
 * - updatedAt must not be in the future
 */
export interface UserPreferencesUpdated extends DomainEvent {
  readonly type: 'UserPreferencesUpdated';
  readonly aggregateId: string; // Always 'user-preferences'
  readonly payload: {
    readonly defaultCompletedTaskBehavior?: CompletedTaskBehavior;
    readonly autoFavoriteRecentDailyLogs?: boolean;
    readonly autoFavoriteRecentMonthlyLogs?: boolean;
    readonly autoFavoriteCalendarWithActiveTasks?: boolean;
    readonly ritualReminders?: RitualReminder[];
    readonly updatedAt: string;
  };
}

// ============================================================================
// User Preferences Commands
// ============================================================================

/**
 * UpdateUserPreferences Command
 * Represents the user's intent to update preferences
 * 
 * Validation rules:
 * - At least one preference field must be provided
 * - Partial updates are supported (only update what's provided)
 */
export interface UpdateUserPreferencesCommand {
  readonly defaultCompletedTaskBehavior?: CompletedTaskBehavior;
  readonly autoFavoriteRecentDailyLogs?: boolean;
  readonly autoFavoriteRecentMonthlyLogs?: boolean;
  readonly autoFavoriteCalendarWithActiveTasks?: boolean;
  readonly ritualReminders?: RitualReminder[];
  readonly userId?: string;
}

/**
 * Union type of all user preferences events
 * This enables type-safe event handling with discriminated unions
 */
export type UserPreferencesEvent = UserPreferencesUpdated;
