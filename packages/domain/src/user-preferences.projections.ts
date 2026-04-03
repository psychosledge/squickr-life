import type { IEventStore } from './event-store';
import type { DomainEvent } from './domain-event';
import type { UserPreferences, UserPreferencesUpdated } from './user-preferences.types';
import { DEFAULT_USER_PREFERENCES } from './user-preferences.types';

/**
 * UserPreferencesProjection - Read Model for User Preferences
 * 
 * This projection creates a view of user preferences by replaying events
 * from the EventStore and building preferences state.
 * 
 * This demonstrates:
 * - Event sourcing projection pattern
 * - Reactive updates via event store subscription
 * - Singleton aggregate pattern (single set of preferences per user)
 * - Partial update merging
 */
export class UserPreferencesProjection {
  private subscribers = new Set<() => void>();
  /** In-memory cache. Null means the cache is cold and a replay is needed. */
  private preferencesCache: UserPreferences | null = null;

  constructor(private readonly eventStore: IEventStore) {
    // Apply preference events incrementally to preserve snapshot-seeded state
    // (ADR-025/026). Non-preference events are ignored — they cannot affect
    // user preferences. Clearing the cache on every event would cause a full
    // getAll() rebuild from an incomplete local store on new devices.
    this.eventStore.subscribe((event: DomainEvent) => {
      if (!this.isUserPreferencesEvent(event)) return;
      if (this.preferencesCache !== null) {
        this.preferencesCache = this.applyUserPreferencesEvent(this.preferencesCache, event);
      }
      // If cache was cold, the next getUserPreferences() will replay from the store.
      this.notifySubscribers();
    });
  }

  /**
   * Subscribe to projection changes
   * Callback is invoked whenever the projection data changes
   * Returns an unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers that the projection has changed
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  /**
   * Seed the projection cache from a previously saved snapshot (ADR-026).
   *
   * Sets the in-memory cache directly without replaying events, then notifies
   * all subscribers so that any React state depending on preferences is
   * refreshed immediately.
   */
  hydrateFromSnapshot(prefs: UserPreferences): void {
    this.preferencesCache = prefs;
    this.notifySubscribers();
  }

  /**
   * Get user preferences
   *
   * @returns UserPreferences built from events, or DEFAULT_USER_PREFERENCES if no events exist
   */
  async getUserPreferences(): Promise<UserPreferences> {
    if (this.preferencesCache !== null) {
      return this.preferencesCache;
    }
    const events = await this.eventStore.getAll();
    const prefs = this.applyEvents(events);
    this.preferencesCache = prefs;
    return prefs;
  }

  /**
   * Apply events to build user preferences state
   * This handles UserPreferencesUpdated events and merges partial updates
   */
  private applyEvents(events: readonly DomainEvent[]): UserPreferences {
    // Start with default preferences
    let preferences: UserPreferences = { ...DEFAULT_USER_PREFERENCES };

    for (const event of events) {
      if (this.isUserPreferencesEvent(event)) {
        preferences = this.applyUserPreferencesEvent(preferences, event);
      }
    }

    return preferences;
  }

  /**
   * Apply a single UserPreferencesUpdated event to the preferences state
   * This merges partial updates into the existing state
   */
  private applyUserPreferencesEvent(
    currentPreferences: UserPreferences,
    event: UserPreferencesUpdated
  ): UserPreferences {
    switch (event.type) {
      case 'UserPreferencesUpdated': {
        // Build new preferences object by merging the update
        return {
          ...currentPreferences,
          // Only update fields that are present in the event payload
          defaultCompletedTaskBehavior: 
            event.payload.defaultCompletedTaskBehavior !== undefined
              ? event.payload.defaultCompletedTaskBehavior
              : currentPreferences.defaultCompletedTaskBehavior,
          autoFavoriteRecentDailyLogs:
            event.payload.autoFavoriteRecentDailyLogs !== undefined
              ? event.payload.autoFavoriteRecentDailyLogs
              : currentPreferences.autoFavoriteRecentDailyLogs,
          autoFavoriteRecentMonthlyLogs:
            event.payload.autoFavoriteRecentMonthlyLogs !== undefined
              ? event.payload.autoFavoriteRecentMonthlyLogs
              : currentPreferences.autoFavoriteRecentMonthlyLogs,
          autoFavoriteCalendarWithActiveTasks:
            event.payload.autoFavoriteCalendarWithActiveTasks !== undefined
              ? event.payload.autoFavoriteCalendarWithActiveTasks
              : currentPreferences.autoFavoriteCalendarWithActiveTasks,
          userId: event.userId !== undefined ? event.userId : currentPreferences.userId,
          updatedAt: event.payload.updatedAt,
        };
      }
      default:
        return currentPreferences;
    }
  }

  /**
   * Type guard to check if an event is a user preferences event
   */
  private isUserPreferencesEvent(
    event: DomainEvent
  ): event is UserPreferencesUpdated {
    return event.type === 'UserPreferencesUpdated';
  }
}
