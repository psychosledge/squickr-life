import { useMemo } from 'react';
import type { Entry } from '@squickr/shared';

interface CollectionStatsProps {
  entries: Entry[];
  className?: string;
}

interface CollectionStats {
  openTasks: number;
  completedTasks: number;
  notes: number;
  events: number;
}

/**
 * Calculate statistics for a collection's entries
 * Counts open tasks, completed tasks, notes, and events
 */
function calculateStats(entries: Entry[]): CollectionStats {
  return entries.reduce((stats, entry) => {
    switch (entry.type) {
      case 'task':
        if (entry.status === 'completed') {
          stats.completedTasks++;
        } else {
          stats.openTasks++;
        }
        break;
      case 'note':
        stats.notes++;
        break;
      case 'event':
        stats.events++;
        break;
    }
    return stats;
  }, {
    openTasks: 0,
    completedTasks: 0,
    notes: 0,
    events: 0
  });
}

/**
 * CollectionStats Component
 * 
 * Displays entry counts below collection names using bullet journal symbols.
 * Only shows non-zero counts in the correct order.
 * 
 * Symbol mapping:
 * - • = Open tasks
 * - × = Completed tasks
 * - – = Notes
 * - ○ = Events
 * 
 * Example: "• 3  × 12  – 5  ○ 2"
 */
export function CollectionStats({ entries, className }: CollectionStatsProps) {
  const stats = useMemo(() => calculateStats(entries), [entries]);
  const parts: string[] = [];
  
  // Build stats string with only non-zero counts, in correct order
  if (stats.openTasks > 0) parts.push(`• ${stats.openTasks}`);
  if (stats.completedTasks > 0) parts.push(`× ${stats.completedTasks}`);
  if (stats.notes > 0) parts.push(`– ${stats.notes}`);
  if (stats.events > 0) parts.push(`○ ${stats.events}`);
  
  // Return null if no stats to show
  if (parts.length === 0) return null;
  
  return (
    <div className={`text-xs text-gray-500 dark:text-gray-400 pl-8 ${className || ''}`}>
      {parts.join('  ')}
    </div>
  );
}
