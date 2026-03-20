/**
 * ReviewStalledSection Component
 *
 * Phase 1 (Proactive Squickr — Review Screen): Displays open tasks that have
 * been stalled (no activity for a configurable number of days), grouped by
 * collection.
 */

import type { StalledTask } from '@squickr/domain';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewStalledSectionProps {
  stalledTasks: StalledTask[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Group stalled tasks by their collectionName (already resolved in StalledTask).
 */
function groupByCollectionName(
  stalledTasks: StalledTask[],
): Map<string, StalledTask[]> {
  const groups = new Map<string, StalledTask[]>();

  for (const task of stalledTasks) {
    const key = task.collectionName;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewStalledSection({ stalledTasks }: ReviewStalledSectionProps) {
  // ── Empty state ──────────────────────────────────────────────────────────
  if (stalledTasks.length === 0) {
    return (
      <section aria-label="Stalled projects">
        <p className="text-gray-500 dark:text-gray-400 text-sm italic py-2">
          No stalled projects 🎉
        </p>
      </section>
    );
  }

  // ── Group by collection name ─────────────────────────────────────────────
  const groups = groupByCollectionName(stalledTasks);

  return (
    <section aria-label="Stalled projects">
      {/* Section heading with count badge */}
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        Stalled Projects
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
          {stalledTasks.length}
        </span>
      </h2>

      {/* Collection groups */}
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([collectionName, tasks]) => (
          <div key={collectionName}>
            {/* Collection subheading */}
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {collectionName}
            </h3>

            {/* Task list */}
            <ul className="space-y-1">
              {tasks.map((stalledTask) => (
                <li
                  key={stalledTask.entry.id}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  {/* Bullet */}
                  <span
                    className="flex-shrink-0 text-gray-400 dark:text-gray-500 font-mono mt-px"
                    aria-hidden="true"
                  >
                    ☐
                  </span>

                  {/* Content */}
                  <span className="flex-1 min-w-0 break-words">
                    {stalledTask.entry.content}
                  </span>

                  {/* Staleness badge */}
                  <span
                    className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mt-px"
                    aria-label={`${stalledTask.staleDays} days stale`}
                  >
                    {stalledTask.staleDays}d
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
