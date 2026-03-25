import type { Task } from './task.types';
import type { EntryListProjection } from './entry.projections';
import type { Entry } from './task.types';

/**
 * SubTaskProjection — sub-task query helpers extracted from EntryListProjection.
 *
 * This class is an internal implementation detail of EntryListProjection.
 * It is NOT intended to be used directly by callers; EntryListProjection
 * delegates to it via private facade fields and exposes the same public API.
 */
export class SubTaskProjection {
  constructor(private readonly entryProjection: EntryListProjection) {}

  /**
   * Get all sub-tasks of a parent task
   * Returns tasks that have parentEntryId === parentEntryId
   * NOTE: This is a cross-collection query - returns sub-tasks from ALL collections
   *
   * Symlink behavior (Phase 2):
   * - Excludes original versions of migrated tasks (tasks with migratedTo pointer)
   * - Includes migrated versions (tasks with migratedFrom pointer)
   * - Result: Sub-task appears only once in the list (the active version)
   *
   * @param parentEntryId - The parent entry ID
   * @returns Array of sub-tasks (tasks with this parentEntryId), sorted by order
   */
  async getSubTasks(parentEntryId: string): Promise<Task[]> {
    const allTasks = await this.entryProjection.getTasks();
    return allTasks.filter(task =>
      task.parentEntryId === parentEntryId && !task.migratedTo && !task.deletedAt
    );
  }

  /**
   * Batch query for sub-tasks of multiple parents (Phase 2 optimization)
   * Reduces N queries to 1 query by fetching all tasks once
   *
   * Performance: O(n) instead of O(n²) for large task lists
   * - Single call to getTasks() instead of N calls
   * - Single iteration over all tasks to group by parent
   *
   * @param parentIds - Array of parent task IDs
   * @returns Map of parent ID to sub-tasks array
   */
  async getSubTasksForMultipleParents(parentIds: string[]): Promise<Map<string, Task[]>> {
    const allTasks = await this.entryProjection.getTasks();
    const resultMap = new Map<string, Task[]>();

    // Group tasks by parentEntryId in a single pass
    for (const task of allTasks) {
      // Skip if not a sub-task, or if migrated (original version), or if deleted
      if (!task.parentEntryId || task.migratedTo || task.deletedAt) {
        continue;
      }

      // Only include if this is one of the requested parents
      if (parentIds.includes(task.parentEntryId)) {
        if (!resultMap.has(task.parentEntryId)) {
          resultMap.set(task.parentEntryId, []);
        }
        resultMap.get(task.parentEntryId)!.push(task);
      }
    }

    return resultMap;
  }

  /**
   * Check if a task is a sub-task
   * A task is a sub-task if it has a parentEntryId set
   *
   * @param task - The task to check
   * @returns true if task is a sub-task, false otherwise
   */
  isSubTask(task: Task): boolean {
    return task.parentEntryId !== undefined;
  }

  /**
   * Check if a task is a parent task (has children)
   * A task is a parent if at least one other task has parentEntryId === this task's ID
   *
   * @param taskId - The task ID to check
   * @returns true if task has children, false otherwise
   */
  async isParentTask(taskId: string): Promise<boolean> {
    const children = await this.getSubTasks(taskId);
    return children.length > 0;
  }

  /**
   * Get completion status for a parent task's children
   *
   * Returns:
   * - total: Total number of sub-tasks
   * - completed: Number of completed sub-tasks
   * - allComplete: true if all sub-tasks are complete (or no sub-tasks exist)
   *
   * @param parentEntryId - The parent entry ID
   * @returns Completion status object
   */
  async getParentCompletionStatus(parentEntryId: string): Promise<{
    total: number;
    completed: number;
    allComplete: boolean;
  }> {
    const children = await this.getSubTasks(parentEntryId);
    const completed = children.filter(child => child.status === 'completed').length;

    return {
      total: children.length,
      completed,
      allComplete: children.length === 0 || completed === children.length, // Vacuous truth: 0/0 = all complete
    };
  }

  /**
   * Get parent task for a sub-task (Phase 2: Migration/Symlink)
   *
   * Returns the parent task if the given task is a sub-task.
   * Returns undefined if:
   * - Task is not a sub-task (no parentEntryId)
   * - Parent task doesn't exist (deleted)
   *
   * @param task - The task to get parent for
   * @returns Parent task or undefined
   */
  async getParentTask(task: Task): Promise<Task | undefined> {
    if (!task.parentEntryId) {
      return undefined;
    }
    const parent = await this.entryProjection.getTaskById(task.parentEntryId);
    // Treat soft-deleted parents as non-existent (orphaned sub-task)
    if (!parent || parent.deletedAt) {
      return undefined;
    }
    return parent;
  }

  /**
   * Check if a sub-task has been migrated to a different collection (Phase 2: Migration/Symlink)
   *
   * A sub-task is considered "migrated" when its collections[] array shares NO collection
   * with its parent's collections[] array (i.e. the intersection is empty).
   *
   * This uses a collections[] intersection check rather than a scalar collectionId comparison
   * (ADR-021 fix) because:
   * - The scalar collectionId field can be stale (written from parentTask.collectionId at creation)
   * - Multi-collection tasks (added to multiple collections via TaskAddedToCollection) need
   *   to be compared by their full collections[] membership, not just a single scalar
   *
   * Returns false if:
   * - Task is not a sub-task (no parentEntryId)
   * - Task shares at least one collection with its parent (unmigrated sub-task)
   * - Parent task doesn't exist (edge case - orphaned sub-task)
   *
   * This determines whether to show the 🔗 icon and migration indicators.
   *
   * @param task - The task to check
   * @returns true if sub-task shares no collection with parent (is migrated), false otherwise
   */
  async isSubTaskMigrated(task: Task): Promise<boolean> {
    // Not a sub-task - cannot be migrated
    if (!task.parentEntryId) {
      return false;
    }

    // Get parent task
    const parent = await this.getParentTask(task);

    // Parent doesn't exist (deleted or never existed) - treat as not migrated
    if (!parent) {
      return false;
    }

    // Compare collection IDs using collections[] array intersection (ADR-021 fix)
    // A sub-task is migrated if it shares NO collection with its parent.
    // This correctly handles multi-collection tasks and avoids stale scalar collectionId comparisons.
    const taskInParentCollection = task.collections.some(
      id => parent.collections.includes(id)
    );

    // Migrated if task shares no collection with parent
    return !taskInParentCollection;
  }

  /**
   * Get parent task titles for a list of sub-task IDs (Phase 2: Batch Query for Parent Titles)
   *
   * This is a performance optimization for displaying parent context in entry lists.
   * Returns a Map<subTaskId, parentTitle> only for entries where:
   * - Entry is a task
   * - Entry has a parentEntryId
   * - Parent task exists and is a task
   *
   * This does NOT filter by collection - filtering happens in the UI layer.
   * UI decides whether to show parent title based on whether sub-task is migrated.
   *
   * @param subTaskIds - Array of task IDs to check for parent titles
   * @returns Map of sub-task ID to parent title (only includes entries with valid parents)
   */
  async getParentTitlesForSubTasks(subTaskIds: string[]): Promise<Map<string, string>> {
    const parentTitles = new Map<string, string>();

    // Get all entries (including deleted) and build a lookup map
    // Uses getAllEntriesIncludingDeleted() which is the public equivalent of resolveCache()
    const entries: Entry[] = await this.entryProjection.getAllEntriesIncludingDeleted();

    // Build a lookup map for fast access
    const entriesMap = new Map<string, Entry>();
    for (const entry of entries) {
      entriesMap.set(entry.id, entry);
    }

    // For each sub-task ID, find parent and extract title
    for (const subTaskId of subTaskIds) {
      const subTask = entriesMap.get(subTaskId);

      // Skip if entry doesn't exist or is not a task
      if (!subTask || subTask.type !== 'task') continue;

      // Skip if task has no parent
      if (!subTask.parentEntryId) continue;

      // Find parent task
      const parent = entriesMap.get(subTask.parentEntryId);

      // Skip if parent doesn't exist, is not a task, or is soft-deleted
      if (!parent || parent.type !== 'task' || parent.deletedAt) continue;

      // Add parent content to map
      parentTitles.set(subTaskId, parent.content);
    }

    return parentTitles;
  }

  /**
   * Get all sub-entries of a parent entry (any type: tasks, notes, events)
   *
   * Unlike getSubTasks() which only returns tasks, this returns ALL entry types
   * (tasks, notes, and events) that have the given parentEntryId.
   *
   * @param parentEntryId - The parent entry ID
   * @returns Array of all sub-entries (any type), sorted by order
   */
  async getSubEntries(parentEntryId: string): Promise<Entry[]> {
    const allEntries = await this.entryProjection.getEntries('all');
    return allEntries.filter(entry =>
      entry.parentEntryId === parentEntryId && !entry.migratedTo && !entry.deletedAt
    );
  }
}
