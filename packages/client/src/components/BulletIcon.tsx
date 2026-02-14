import type { Entry } from '@squickr/domain';
import { ENTRY_ICONS } from '../utils/constants';

interface BulletIconProps {
  entry: Entry;
  onClick?: () => void;
  className?: string;
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

function getBulletStyle(entry: Entry, isGhost: boolean = false): BulletStyle {
  /**
   * Icon Precedence Order (first match wins):
   * 1. Ghost (removed from collection) - ➜
   * 2. Old-style migrated - ➜
   * 3. Completion status - ✓
   * 4. Entry type default - ☐, 📝, 📅
   * 
   * Note: Issue #5 - Link icon (🔗) no longer shown in bullet, 
   *       now rendered separately in TaskEntryItem after title
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
    // Issue #5: Removed link icon from bullet (now shown separately in TaskEntryItem)
    // isSubTaskMigrated no longer affects the bullet icon
    
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

export function BulletIcon({ entry, onClick, className = '', isGhost = false, title }: BulletIconProps) {
  const { icon, color, isInteractive, ariaLabel } = getBulletStyle(entry, isGhost);

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
