import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from './event-store';
import { UpdateUserPreferencesHandler } from './user-preferences.handlers';
import type { UserPreferencesUpdated, UpdateUserPreferencesCommand } from './user-preferences.types';

describe('UpdateUserPreferencesHandler', () => {
  let eventStore: EventStore;
  let handler: UpdateUserPreferencesHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    handler = new UpdateUserPreferencesHandler(eventStore);
  });

  describe('Command Validation', () => {
    it('should throw error if no preferences provided', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {};

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow(
        'At least one preference field must be provided'
      );
    });

    it('should throw error for invalid defaultCompletedTaskBehavior', async () => {
      // Arrange
      const command = {
        defaultCompletedTaskBehavior: 'invalid-value' as any,
      };

      // Act & Assert
      await expect(handler.handle(command)).rejects.toThrow(
        'Invalid defaultCompletedTaskBehavior: invalid-value. Must be one of: keep-in-place, move-to-bottom, collapse'
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit UserPreferencesUpdated event with defaultCompletedTaskBehavior', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'move-to-bottom',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      
      const event = events[0] as UserPreferencesUpdated;
      expect(event.type).toBe('UserPreferencesUpdated');
      expect(event.aggregateId).toBe('user-preferences');
      expect(event.payload.defaultCompletedTaskBehavior).toBe('move-to-bottom');
      expect(event.payload.updatedAt).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.version).toBe(1);
    });

    it('should emit UserPreferencesUpdated event with autoFavoriteRecentDailyLogs', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        autoFavoriteRecentDailyLogs: true,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      
      const event = events[0] as UserPreferencesUpdated;
      expect(event.type).toBe('UserPreferencesUpdated');
      expect(event.aggregateId).toBe('user-preferences');
      expect(event.payload.autoFavoriteRecentDailyLogs).toBe(true);
      expect(event.payload.updatedAt).toBeDefined();
    });

    it('should emit UserPreferencesUpdated event with multiple preferences', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'collapse',
        autoFavoriteRecentDailyLogs: true,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      
      const event = events[0] as UserPreferencesUpdated;
      expect(event.type).toBe('UserPreferencesUpdated');
      expect(event.aggregateId).toBe('user-preferences');
      expect(event.payload.defaultCompletedTaskBehavior).toBe('collapse');
      expect(event.payload.autoFavoriteRecentDailyLogs).toBe(true);
      expect(event.payload.updatedAt).toBeDefined();
    });

    it('should include userId in event if provided in command', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'keep-in-place',
        userId: 'user-123',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      
      const event = events[0] as UserPreferencesUpdated;
      expect(event.userId).toBe('user-123');
    });

    it('should support all CompletedTaskBehavior values', async () => {
      // Test 'keep-in-place'
      await handler.handle({ defaultCompletedTaskBehavior: 'keep-in-place' });
      
      // Test 'move-to-bottom'
      await handler.handle({ defaultCompletedTaskBehavior: 'move-to-bottom' });
      
      // Test 'collapse'
      await handler.handle({ defaultCompletedTaskBehavior: 'collapse' });

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(3);
      expect((events[0] as UserPreferencesUpdated).payload.defaultCompletedTaskBehavior).toBe('keep-in-place');
      expect((events[1] as UserPreferencesUpdated).payload.defaultCompletedTaskBehavior).toBe('move-to-bottom');
      expect((events[2] as UserPreferencesUpdated).payload.defaultCompletedTaskBehavior).toBe('collapse');
    });
  });

  describe('Partial Updates', () => {
    it('should allow updating only defaultCompletedTaskBehavior', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'move-to-bottom',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const event = events[0] as UserPreferencesUpdated;
      expect(event.payload.defaultCompletedTaskBehavior).toBe('move-to-bottom');
      expect(event.payload.autoFavoriteRecentDailyLogs).toBeUndefined();
    });

    it('should allow updating only autoFavoriteRecentDailyLogs', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        autoFavoriteRecentDailyLogs: false,
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const event = events[0] as UserPreferencesUpdated;
      expect(event.payload.autoFavoriteRecentDailyLogs).toBe(false);
      expect(event.payload.defaultCompletedTaskBehavior).toBeUndefined();
    });
  });

  describe('Aggregate ID', () => {
    it('should always use "user-preferences" as aggregateId', async () => {
      // Arrange
      const command: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'collapse',
      };

      // Act
      await handler.handle(command);

      // Assert
      const events = await eventStore.getAll();
      const event = events[0] as UserPreferencesUpdated;
      expect(event.aggregateId).toBe('user-preferences');
    });

    it('should use same aggregateId for multiple updates', async () => {
      // Arrange
      const command1: UpdateUserPreferencesCommand = {
        defaultCompletedTaskBehavior: 'collapse',
      };
      const command2: UpdateUserPreferencesCommand = {
        autoFavoriteRecentDailyLogs: true,
      };

      // Act
      await handler.handle(command1);
      await handler.handle(command2);

      // Assert
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[0].aggregateId).toBe('user-preferences');
      expect(events[1].aggregateId).toBe('user-preferences');
    });
  });
});
