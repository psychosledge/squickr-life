import type { Entry } from '@squickr/domain';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';

/**
 * Format a set of entries as a type breakdown: "(N tasks, N notes, N events)"
 * Only open (non-migrated) tasks are counted — consistent with day/custom behaviour.
 * Returns empty string if no matching entries.
 */
function formatTypeBreakdown(entries: Entry[]): string {
  const tasks  = entries.filter(e => e.type === 'task' && e.status === 'open').length;
  const notes  = entries.filter(e => e.type === 'note').length;
  const events = entries.filter(e => e.type === 'event').length;

  const parts: string[] = [];
  if (tasks  > 0) parts.push(`${tasks} ${tasks  === 1 ? 'task'  : 'tasks'}`);
  if (notes  > 0) parts.push(`${notes} ${notes  === 1 ? 'note'  : 'notes'}`);
  if (events > 0) parts.push(`${events} ${events === 1 ? 'event' : 'events'}`);

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/**
 * Format collection stats for inline display
 */
export function formatCollectionStats(
  node: HierarchyNode,
  entriesByCollection?: Map<string | null, Entry[]>
): string {
  // Handle month nodes with attached monthly log (Feature 3)
  if (node.type === 'month' && node.monthlyLog) {
    const allEntries = entriesByCollection?.get(node.monthlyLog.id) || [];
    const entries = allEntries.filter(e => !e.migratedTo && !e.deletedAt && !e.parentEntryId);
    return formatTypeBreakdown(entries);
  }

  // Handle container nodes (year/month without monthly log)
  if (node.type === 'year' || node.type === 'month') {
    if (node.count !== undefined) {
      return `(${node.count} ${node.count === 1 ? 'log' : 'logs'})`;
    }
    return '';
  }

  // Handle leaf nodes (monthly/day/custom) - must have collection
  if (!node.collection) {
    return '';
  }

  const allEntries = entriesByCollection?.get(node.collection.id) || [];
  // Exclude migrated, deleted, and sub-item entries (sub-items should not count in stats)
  const entries = allEntries.filter(e => !e.migratedTo && !e.deletedAt && !e.parentEntryId);

  if (node.type === 'monthly') {
    return formatTypeBreakdown(entries);
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
