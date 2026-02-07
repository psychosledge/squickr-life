import type { IEventStore } from './event-store';
import type { UpdateUserPreferencesCommand, UserPreferencesUpdated } from './user-preferences.types';
import type { CompletedTaskBehavior } from './collection.types';
import { generateEventMetadata } from './event-helpers';

/**
 * Command Handler for UpdateUserPreferences
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Create domain events
 * - Persist events to EventStore
 * 
 * This is the "write side" of CQRS
 * 
 * Note: This uses a singleton aggregate pattern with aggregateId: 'user-preferences'
 * There is only one UserPreferences aggregate per user.
 */
export class UpdateUserPreferencesHandler {
  constructor(private readonly eventStore: IEventStore) {}

  /**
   * Handle UpdateUserPreferences command
   * 
   * Validation rules:
   * - At least one preference field must be provided
   * - Partial updates are supported (only update what's provided)
   * 
   * Idempotency:
   * - This handler always emits an event (not idempotent by design)
   * - The projection handles merging updates to build final state
   * 
   * @param command - The UpdateUserPreferences command
   * @throws Error if validation fails
   */
  async handle(command: UpdateUserPreferencesCommand): Promise<void> {
    // Validate: at least one preference field must be provided
    const hasPreferenceField = 
      command.defaultCompletedTaskBehavior !== undefined ||
      command.autoFavoriteRecentDailyLogs !== undefined;

    if (!hasPreferenceField) {
      throw new Error('At least one preference field must be provided');
    }

    // Validate CompletedTaskBehavior enum values
    if (command.defaultCompletedTaskBehavior !== undefined) {
      const validBehaviors: CompletedTaskBehavior[] = ['keep-in-place', 'move-to-bottom', 'collapse'];
      if (!validBehaviors.includes(command.defaultCompletedTaskBehavior)) {
        throw new Error(
          `Invalid defaultCompletedTaskBehavior: ${command.defaultCompletedTaskBehavior}. ` +
          `Must be one of: ${validBehaviors.join(', ')}`
        );
      }
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Build payload with only provided fields
    const payload: {
      defaultCompletedTaskBehavior?: typeof command.defaultCompletedTaskBehavior;
      autoFavoriteRecentDailyLogs?: boolean;
      updatedAt: string;
    } = {
      updatedAt: metadata.timestamp,
    };

    if (command.defaultCompletedTaskBehavior !== undefined) {
      payload.defaultCompletedTaskBehavior = command.defaultCompletedTaskBehavior;
    }

    if (command.autoFavoriteRecentDailyLogs !== undefined) {
      payload.autoFavoriteRecentDailyLogs = command.autoFavoriteRecentDailyLogs;
    }

    // Create UserPreferencesUpdated event
    const event: UserPreferencesUpdated = {
      ...metadata,
      type: 'UserPreferencesUpdated',
      aggregateId: 'user-preferences', // Singleton aggregate
      userId: command.userId,
      payload,
    };

    // Persist event
    await this.eventStore.append(event);
  }
}
