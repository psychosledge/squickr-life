import type { DomainEvent } from './domain-event';
import type { CompletedTaskBehavior } from './collection.types';

// ============================================================================
// User Preferences Domain Types
// ============================================================================

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
  readonly userId?: string;
}

/**
 * Union type of all user preferences events
 * This enables type-safe event handling with discriminated unions
 */
export type UserPreferencesEvent = UserPreferencesUpdated;
