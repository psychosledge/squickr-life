import type { CollectionSettings, CompletedTaskBehavior } from '@squickr/domain';
import type { UserPreferences } from '@squickr/domain';

/**
 * Resolves the effective completed-task display behavior for a collection.
 *
 * Priority:
 * 1. New enum value `completedTaskBehavior` (when non-null)
 * 2. Legacy boolean `collapseCompleted` (migrated to enum on read)
 * 3. Global user preference `defaultCompletedTaskBehavior`
 */
export function getCompletedTaskBehavior(
  settings: CollectionSettings | undefined,
  userPreferences: UserPreferences,
): CompletedTaskBehavior {
  if (settings?.completedTaskBehavior != null) {
    return settings.completedTaskBehavior;
  }

  if (settings?.collapseCompleted === true) {
    return 'collapse';
  }

  if (settings?.collapseCompleted === false) {
    return 'keep-in-place';
  }

  return userPreferences.defaultCompletedTaskBehavior;
}
