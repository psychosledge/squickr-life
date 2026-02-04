import { useMemo } from 'react';
import type { Entry } from '@squickr/shared';
import { ENTRY_ICONS } from '../utils/constants';

interface CollectionStatsProps {
  entries: Entry[];
  className?: string;
  style?: React.CSSProperties;
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
 * Excludes entries that have been migrated (migratedTo field is set)
 */
function calculateStats(entries: Entry[]): CollectionStats {
  return entries.reduce((stats, entry) => {
    // Skip migrated entries - they shouldn't count in the source collection
    if (entry.migratedTo) {
      return stats;
    }

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
 * Displays entry counts below collection names using emoji icons.
 * Only shows non-zero counts in the correct order.
 * Includes ARIA labels for screen reader accessibility (WCAG 2.1 Level A).
 * 
 * Icon mapping:
 * - ☐ = Open tasks
 * - ✓ = Completed tasks
 * - 📝 = Notes
 * - 📅 = Events
 * 
 * Example: "☐ 3    ✓ 12    📝 5    📅 2"
 */
export function CollectionStats({ entries, className, style }: CollectionStatsProps) {
  const stats = useMemo(() => calculateStats(entries), [entries]);
  
  // Build array of stat items with aria labels
  const statItems: Array<{ icon: string; count: number; label: string }> = [];
  
  if (stats.openTasks > 0) {
    statItems.push({ 
      icon: ENTRY_ICONS.TASK_OPEN, 
      count: stats.openTasks, 
      label: `${stats.openTasks} open ${stats.openTasks === 1 ? 'task' : 'tasks'}` 
    });
  }
  
  if (stats.completedTasks > 0) {
    statItems.push({ 
      icon: ENTRY_ICONS.TASK_COMPLETED, 
      count: stats.completedTasks, 
      label: `${stats.completedTasks} completed ${stats.completedTasks === 1 ? 'task' : 'tasks'}` 
    });
  }
  
  if (stats.notes > 0) {
    statItems.push({ 
      icon: ENTRY_ICONS.NOTE, 
      count: stats.notes, 
      label: `${stats.notes} ${stats.notes === 1 ? 'note' : 'notes'}` 
    });
  }
  
  if (stats.events > 0) {
    statItems.push({ 
      icon: ENTRY_ICONS.EVENT, 
      count: stats.events, 
      label: `${stats.events} ${stats.events === 1 ? 'event' : 'events'}` 
    });
  }
  
  // Return null if no stats to show
  if (statItems.length === 0) return null;
  
  return (
    <div className={`text-base text-gray-500 dark:text-gray-400 ${className || ''}`} style={style}>
      <span className="inline-flex gap-4">
        {statItems.map((item, index) => (
          <span key={index} aria-label={item.label}>
            {item.icon} {item.count}
          </span>
        ))}
      </span>
    </div>
  );
}
