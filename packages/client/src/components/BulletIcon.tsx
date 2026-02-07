import type { Entry } from '@squickr/domain';
import { ENTRY_ICONS } from '../utils/constants';

interface BulletIconProps {
  entry: Entry;
  onClick?: () => void;
  className?: string;
}

interface BulletStyle {
  icon: string;
  color: string;
  isInteractive: boolean;
  ariaLabel: string;
}

function getBulletStyle(entry: Entry): BulletStyle {
  // Task bullets
  if (entry.type === 'task') {
    if (entry.migratedTo) {
      // Migrated task (migration takes precedence)
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

export function BulletIcon({ entry, onClick, className = '' }: BulletIconProps) {
  const { icon, color, isInteractive, ariaLabel } = getBulletStyle(entry);

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
    >
      {icon}
    </span>
  );
}
