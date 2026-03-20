/**
 * ReviewCompletedSection Component
 *
 * Phase 1 (Proactive Squickr — Review Screen): Displays entries completed
 * within the review period, grouped by collection.
 */

import type { Entry, Collection } from '@squickr/domain';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewCompletedSectionProps {
  entries: Entry[];
  collectionMap: Map<string, Collection>;
  period: 'weekly' | 'monthly';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a completedAt ISO timestamp as a short date string, e.g. "Mar 19".
 */
function formatCompletedDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Group entries by collection.
 *
 * Each entry may belong to multiple collections (entry.collections[]).
 * An entry is placed under every collection it belongs to.
 * If an entry has no collections, it falls under a synthetic "Unknown Collection" key.
 */
function groupEntriesByCollection(
  entries: Entry[],
  collectionMap: Map<string, Collection>,
): Map<string, { name: string; entries: Entry[] }> {
  const groups = new Map<string, { name: string; entries: Entry[] }>();

  for (const entry of entries) {
    const collectionIds =
      entry.collections && entry.collections.length > 0
        ? entry.collections
        : null;

    if (!collectionIds) {
      // No collections — fall back to "Unknown Collection"
      const key = '__unknown__';
      if (!groups.has(key)) {
        groups.set(key, { name: 'Unknown Collection', entries: [] });
      }
      groups.get(key)!.entries.push(entry);
      continue;
    }

    for (const colId of collectionIds) {
      if (!groups.has(colId)) {
        const col = collectionMap.get(colId);
        const name = col?.name ?? 'Unknown Collection';
        groups.set(colId, { name, entries: [] });
      }
      groups.get(colId)!.entries.push(entry);
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewCompletedSection({
  entries,
  collectionMap,
  period,
}: ReviewCompletedSectionProps) {
  // ── Empty state ──────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <section aria-label="Completed entries">
        <p className="text-gray-500 dark:text-gray-400 text-sm italic py-2">
          {period === 'weekly'
            ? 'Nothing completed this week'
            : 'Nothing completed this month'}
        </p>
      </section>
    );
  }

  // ── Group by collection ──────────────────────────────────────────────────
  const groups = groupEntriesByCollection(entries, collectionMap);

  return (
    <section aria-label="Completed entries">
      {/* Section heading with count badge */}
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        Completed
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
          {entries.length}
        </span>
      </h2>

      {/* Collection groups */}
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([collectionId, group]) => (
          <div key={collectionId}>
            {/* Collection subheading */}
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {group.name}
            </h3>

            {/* Entry list */}
            <ul className="space-y-1">
              {group.entries.map((entry) => {
                const bullet = entry.type === 'task' ? '✓' : '–';
                const bulletColor =
                  entry.type === 'task'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500';
                const rawCompletedAt =
                  entry.type === 'task' ? entry.completedAt : undefined;
                const dateStr = rawCompletedAt
                  ? formatCompletedDate(rawCompletedAt)
                  : null;

                return (
                  <li
                    key={entry.id}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {/* Bullet */}
                    <span
                      className={`flex-shrink-0 font-mono mt-px ${bulletColor}`}
                      aria-hidden="true"
                    >
                      {bullet}
                    </span>

                    {/* Content */}
                    <span className="flex-1 min-w-0 break-words">
                      {entry.content}
                    </span>

                    {/* Date */}
                    {dateStr && (
                      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-px">
                        {dateStr}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
