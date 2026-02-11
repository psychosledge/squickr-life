import type { Entry } from '@squickr/domain';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';

/**
 * Format collection stats for inline display
 */
export function formatCollectionStats(
  node: HierarchyNode,
  entriesByCollection?: Map<string | null, Entry[]>
): string {
  if (!node.collection) {
    if (node.count !== undefined) {
      return `(${node.count} ${node.count === 1 ? 'log' : 'logs'})`;
    }
    return '';
  }

  const allEntries = entriesByCollection?.get(node.collection.id) || [];
  // Exclude migrated entries (ghost entries should not count in stats)
  const entries = allEntries.filter(e => !e.migratedTo);

  if (node.type === 'monthly') {
    const count = entries.length;
    return count > 0 ? `(${count} ${count === 1 ? 'entry' : 'entries'})` : '';
  }

  // Daily and custom collections: breakdown by type
  // BUG FIX #1: Only count incomplete (open) tasks, not completed ones
  const tasks = entries.filter(e => e.type === 'task' && e.status === 'open').length;
  const notes = entries.filter(e => e.type === 'note').length;
  const events = entries.filter(e => e.type === 'event').length;

  const parts: string[] = [];
  if (tasks > 0) parts.push(`${tasks} ${tasks === 1 ? 'task' : 'tasks'}`);
  if (notes > 0) parts.push(`${notes} ${notes === 1 ? 'note' : 'notes'}`);
  if (events > 0) parts.push(`${events} ${events === 1 ? 'event' : 'events'}`);

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}
