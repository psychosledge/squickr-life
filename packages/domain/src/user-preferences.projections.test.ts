import { describe, it, expect, beforeEach } from 'vitest';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { UserPreferencesProjection } from './user-preferences.projections';
import type { UserPreferencesUpdated } from './user-preferences.types';
import { DEFAULT_USER_PREFERENCES } from './user-preferences.types';
import { generateEventMetadata } from './event-helpers';

describe('UserPreferencesProjection', () => {
  let eventStore: IEventStore;
  let projection: UserPreferencesProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new UserPreferencesProjection(eventStore);
  });

  describe('Default State', () => {
    it('should return default preferences when no events exist', async () => {
      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences).toEqual(DEFAULT_USER_PREFERENCES);
      expect(preferences.defaultCompletedTaskBehavior).toBe('keep-in-place');
      expect(preferences.autoFavoriteRecentDailyLogs).toBe(false);
    });
  });

  describe('Event Replay', () => {
    it('should rebuild state from single UserPreferencesUpdated event', async () => {
      // Arrange
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'move-to-bottom',
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.defaultCompletedTaskBehavior).toBe('move-to-bottom');
      expect(preferences.autoFavoriteRecentDailyLogs).toBe(false); // Default value
      expect(preferences.updatedAt).toBe(metadata.timestamp);
    });

    it('should rebuild state from multiple UserPreferencesUpdated events', async () => {
      // Arrange
      const metadata1 = generateEventMetadata();
      const event1: UserPreferencesUpdated = {
        ...metadata1,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata1.timestamp,
        },
      };
      await eventStore.append(event1);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const metadata2 = generateEventMetadata();
      const event2: UserPreferencesUpdated = {
        ...metadata2,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteRecentDailyLogs: true,
          updatedAt: metadata2.timestamp,
        },
      };
      await eventStore.append(event2);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.defaultCompletedTaskBehavior).toBe('collapse'); // From first event
      expect(preferences.autoFavoriteRecentDailyLogs).toBe(true); // From second event
      expect(preferences.updatedAt).toBe(metadata2.timestamp); // Latest timestamp
    });

    it('should support partial updates - only defaultCompletedTaskBehavior', async () => {
      // Arrange
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.defaultCompletedTaskBehavior).toBe('collapse');
      expect(preferences.autoFavoriteRecentDailyLogs).toBe(false); // Default value
    });

    it('should support partial updates - only autoFavoriteRecentDailyLogs', async () => {
      // Arrange
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteRecentDailyLogs: true,
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.defaultCompletedTaskBehavior).toBe('keep-in-place'); // Default value
      expect(preferences.autoFavoriteRecentDailyLogs).toBe(true);
    });

    it('should handle overriding previous values', async () => {
      // Arrange
      const metadata1 = generateEventMetadata();
      const event1: UserPreferencesUpdated = {
        ...metadata1,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'keep-in-place',
          updatedAt: metadata1.timestamp,
        },
      };
      await eventStore.append(event1);

      await new Promise(resolve => setTimeout(resolve, 10));

      const metadata2 = generateEventMetadata();
      const event2: UserPreferencesUpdated = {
        ...metadata2,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'move-to-bottom',
          updatedAt: metadata2.timestamp,
        },
      };
      await eventStore.append(event2);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.defaultCompletedTaskBehavior).toBe('move-to-bottom'); // Latest value wins
    });

    it('should include userId if present in event', async () => {
      // Arrange
      const metadata = generateEventMetadata('user-123');
      const event: UserPreferencesUpdated = {
        ...metadata,
        userId: 'user-123',
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.userId).toBe('user-123');
    });

    it('should handle all CompletedTaskBehavior values', async () => {
      // Test 'keep-in-place'
      const metadata1 = generateEventMetadata();
      await eventStore.append({
        ...metadata1,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'keep-in-place' as const,
          updatedAt: metadata1.timestamp,
        },
      });

      let preferences = await projection.getUserPreferences();
      expect(preferences.defaultCompletedTaskBehavior).toBe('keep-in-place');

      // Test 'move-to-bottom'
      const metadata2 = generateEventMetadata();
      await eventStore.append({
        ...metadata2,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'move-to-bottom' as const,
          updatedAt: metadata2.timestamp,
        },
      });

      preferences = await projection.getUserPreferences();
      expect(preferences.defaultCompletedTaskBehavior).toBe('move-to-bottom');

      // Test 'collapse'
      const metadata3 = generateEventMetadata();
      await eventStore.append({
        ...metadata3,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse' as const,
          updatedAt: metadata3.timestamp,
        },
      });

      preferences = await projection.getUserPreferences();
      expect(preferences.defaultCompletedTaskBehavior).toBe('collapse');
    });
  });

  describe('Reactive Updates', () => {
    it('should notify subscribers when preferences change', async () => {
      // Arrange
      let notificationCount = 0;
      projection.subscribe(() => {
        notificationCount++;
      });

      // Act
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Assert
      expect(notificationCount).toBe(1);
    });

    it('should allow unsubscribing from updates', async () => {
      // Arrange
      let notificationCount = 0;
      const unsubscribe = projection.subscribe(() => {
        notificationCount++;
      });

      // Act - First event (should notify)
      const metadata1 = generateEventMetadata();
      await eventStore.append({
        ...metadata1,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata1.timestamp,
        },
      });

      expect(notificationCount).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Act - Second event (should NOT notify)
      const metadata2 = generateEventMetadata();
      await eventStore.append({
        ...metadata2,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteRecentDailyLogs: true,
          updatedAt: metadata2.timestamp,
        },
      });

      // Assert - Still 1 (not incremented after unsubscribe)
      expect(notificationCount).toBe(1);
    });
  });

  describe('autoFavoriteCalendarWithActiveTasks', () => {
    it('should have default value of false', async () => {
      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.autoFavoriteCalendarWithActiveTasks).toBe(false);
    });

    it('should merge autoFavoriteCalendarWithActiveTasks from false to true', async () => {
      // Arrange
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteCalendarWithActiveTasks: true,
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert
      expect(preferences.autoFavoriteCalendarWithActiveTasks).toBe(true);
      // Other defaults should remain
      expect(preferences.defaultCompletedTaskBehavior).toBe('keep-in-place');
    });

    it('should retain autoFavoriteCalendarWithActiveTasks across unrelated updates', async () => {
      // Arrange - first set it to true
      const metadata1 = generateEventMetadata();
      await eventStore.append({
        ...metadata1,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteCalendarWithActiveTasks: true,
          updatedAt: metadata1.timestamp,
        },
      } as UserPreferencesUpdated);

      // Then update an unrelated preference
      const metadata2 = generateEventMetadata();
      await eventStore.append({
        ...metadata2,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'collapse' as const,
          updatedAt: metadata2.timestamp,
        },
      } as UserPreferencesUpdated);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert - autoFavoriteCalendarWithActiveTasks should still be true
      expect(preferences.autoFavoriteCalendarWithActiveTasks).toBe(true);
      expect(preferences.defaultCompletedTaskBehavior).toBe('collapse');
    });
  });

  describe('Edge Cases', () => {
    it('should ignore non-UserPreferences events', async () => {
      // Arrange - Create a non-user-preferences event
      const metadata = generateEventMetadata();
      const event = {
        ...metadata,
        type: 'SomeOtherEvent',
        aggregateId: 'some-other-aggregate',
        payload: {},
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert - Should return defaults
      expect(preferences).toEqual(DEFAULT_USER_PREFERENCES);
    });

    it('should handle events with different aggregateId', async () => {
      // Arrange - Create event with wrong aggregateId
      const metadata = generateEventMetadata();
      const event: UserPreferencesUpdated = {
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'wrong-aggregate-id',
        payload: {
          defaultCompletedTaskBehavior: 'collapse',
          updatedAt: metadata.timestamp,
        },
      };
      await eventStore.append(event);

      // Act
      const preferences = await projection.getUserPreferences();

      // Assert - Should still apply the event (projection doesn't validate aggregateId)
      expect(preferences.defaultCompletedTaskBehavior).toBe('collapse');
    });
  });
});

// ============================================================================
// ADR-026: Snapshot hydration / cache
// ============================================================================

describe('UserPreferencesProjection — snapshot support (ADR-026)', () => {
  let eventStore: IEventStore;
  let projection: UserPreferencesProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new UserPreferencesProjection(eventStore);
  });

  describe('hydrateFromSnapshot()', () => {
    it('sets cache so getUserPreferences() returns hydrated value without event store call', async () => {
      // Arrange
      const prefs = {
        ...DEFAULT_USER_PREFERENCES,
        defaultCompletedTaskBehavior: 'collapse' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      // Spy on getAll to detect if event store is called
      const getAllSpy = vi.spyOn(eventStore, 'getAll');

      // Act
      projection.hydrateFromSnapshot(prefs);
      const result = await projection.getUserPreferences();

      // Assert — cached value was returned, getAll not called
      expect(result.defaultCompletedTaskBehavior).toBe('collapse');
      expect(getAllSpy).not.toHaveBeenCalled();
    });

    it('notifies subscribers after hydration', async () => {
      let notified = false;
      projection.subscribe(() => { notified = true; });

      projection.hydrateFromSnapshot(DEFAULT_USER_PREFERENCES);

      expect(notified).toBe(true);
    });

    it('clears cache when a new event arrives after hydration', async () => {
      // Arrange — hydrate then append an event
      projection.hydrateFromSnapshot({
        ...DEFAULT_USER_PREFERENCES,
        defaultCompletedTaskBehavior: 'collapse' as const,
      });

      const getAllSpy = vi.spyOn(eventStore, 'getAll').mockResolvedValue([]);

      // Append an event (triggers subscriber → clears cache)
      const metadata = generateEventMetadata();
      await eventStore.append({
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          autoFavoriteRecentDailyLogs: true,
          updatedAt: metadata.timestamp,
        },
      } as UserPreferencesUpdated);

      // Act — next call should replay from event store
      await projection.getUserPreferences();

      // Assert — getAll called because cache was invalidated
      expect(getAllSpy).toHaveBeenCalled();
    });
  });

  describe('cache behaviour', () => {
    it('getUserPreferences() caches the result so second call does not re-query event store', async () => {
      // Arrange — append an event to give the projection something to replay
      const metadata = generateEventMetadata();
      await eventStore.append({
        ...metadata,
        type: 'UserPreferencesUpdated',
        aggregateId: 'user-preferences',
        payload: {
          defaultCompletedTaskBehavior: 'move-to-bottom' as const,
          updatedAt: metadata.timestamp,
        },
      } as UserPreferencesUpdated);

      const getAllSpy = vi.spyOn(eventStore, 'getAll');

      // First call — should hit event store
      await projection.getUserPreferences();
      const firstCallCount = getAllSpy.mock.calls.length;

      // Second call — should use cache, not hit event store again
      await projection.getUserPreferences();
      expect(getAllSpy.mock.calls.length).toBe(firstCallCount);
    });
  });
});
