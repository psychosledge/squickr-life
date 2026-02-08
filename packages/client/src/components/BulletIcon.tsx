import type { Entry } from '@squickr/domain';
import { ENTRY_ICONS } from '../utils/constants';

interface BulletIconProps {
  entry: Entry;
  onClick?: () => void;
  className?: string;
  /** Phase 2: Indicates if this is a migrated sub-task (show 🔗 icon) */
  isSubTaskMigrated?: boolean;
  /** 
   * Multi-collection: Indicates if this is a ghost entry (show ➜ icon)
   * NOTE: Should be true when entry has renderAsGhost: true
   * Takes precedence over all other states (completion, migration)
   */
  isGhost?: boolean;
  /** Optional tooltip text to show on hover */
  title?: string;
}

interface BulletStyle {
  icon: string;
  color: string;
  isInteractive: boolean;
  ariaLabel: string;
}

function getBulletStyle(entry: Entry, isSubTaskMigrated: boolean = false, isGhost: boolean = false): BulletStyle {
  /**
   * Icon Precedence Order (first match wins):
   * 1. Ghost (removed from collection) - ➜
   * 2. Migrated sub-task - 🔗☐ or 🔗✓
   * 3. Old-style migrated - ➜
   * 4. Completion status - ✓
   * 5. Entry type default - ☐, 📝, 📅
   */
  
  // Multi-collection ghost (removed from current collection) - takes precedence
  if (isGhost) {
    return {
      icon: ENTRY_ICONS.MIGRATED,
      color: 'text-blue-500 dark:text-blue-400',
      isInteractive: false,
      ariaLabel: 'Moved to another collection',
    };
  }
  
  // Task bullets
  if (entry.type === 'task') {
    // Phase 2: Migrated sub-task (has parent + different collection) - show 🔗 icon
    if (isSubTaskMigrated) {
      const baseIcon = entry.status === 'completed' 
        ? ENTRY_ICONS.TASK_COMPLETED 
        : ENTRY_ICONS.TASK_OPEN;
      
      return {
        icon: `🔗${baseIcon}`,
        color: 'text-blue-600 dark:text-blue-400', // Blue to indicate migration
        isInteractive: !entry.migratedTo, // Can interact if not already migrated (original)
        ariaLabel: entry.status === 'completed' 
          ? 'Migrated sub-task (completed) - click to reopen'
          : 'Migrated sub-task (open) - click to complete',
      };
    }
    
    if (entry.migratedTo) {
      // Migrated task (OLD-STYLE migration, legacy system)
      return {
        icon: ENTRY_ICONS.MIGRATED,
        color: 'text-blue-500 dark:text-blue-400',
        isInteractive: false,
        ariaLabel: 'Migrated task',
      };
    }

    if (entry.status === 'completed') {
      // Completed task
      return {
        icon: ENTRY_ICONS.TASK_COMPLETED,
        color: 'text-gray-500 dark:text-gray-400', // Fixed contrast: gray-500 has better AA compliance
        isInteractive: true,
        ariaLabel: 'Completed task - click to reopen',
      };
    }

    // Open task
    return {
      icon: ENTRY_ICONS.TASK_OPEN,
      color: 'text-gray-600 dark:text-gray-400',
      isInteractive: true,
      ariaLabel: 'Open task - click to complete',
    };
  }

  // Note bullets
  if (entry.type === 'note') {
    if (entry.migratedTo) {
      return {
        icon: ENTRY_ICONS.MIGRATED,
        color: 'text-blue-500 dark:text-blue-400',
        isInteractive: false,
        ariaLabel: 'Migrated note',
      };
    }

    return {
      icon: ENTRY_ICONS.NOTE,
      color: 'text-gray-600 dark:text-gray-400',
      isInteractive: false,
      ariaLabel: 'Note',
    };
  }

  // Event bullets
  if (entry.type === 'event') {
    if (entry.migratedTo) {
      return {
        icon: ENTRY_ICONS.MIGRATED,
        color: 'text-blue-500 dark:text-blue-400',
        isInteractive: false,
        ariaLabel: 'Migrated event',
      };
    }

    return {
      icon: ENTRY_ICONS.EVENT,
      color: 'text-gray-600 dark:text-gray-400',
      isInteractive: false,
      ariaLabel: 'Event',
    };
  }

  // Fallback (should never happen)
  return {
    icon: ENTRY_ICONS.TASK_OPEN,
    color: 'text-gray-600 dark:text-gray-400',
    isInteractive: false,
    ariaLabel: 'Entry',
  };
}

export function BulletIcon({ entry, onClick, className = '', isSubTaskMigrated = false, isGhost = false, title }: BulletIconProps) {
  const { icon, color, isInteractive, ariaLabel } = getBulletStyle(entry, isSubTaskMigrated, isGhost);

  const baseStyles = `
    text-2xl leading-none pt-1 flex-shrink-0 select-none font-mono
    ${color}
    ${isInteractive ? 'hover:scale-110 transition-transform cursor-pointer' : 'cursor-default'}
  `.trim();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <span
      className={`${baseStyles} ${className}`}
      onClick={isInteractive ? onClick : undefined}
      role={isInteractive ? 'button' : undefined}
      aria-label={ariaLabel}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      title={title}
    >
      {icon}
    </span>
  );
}
