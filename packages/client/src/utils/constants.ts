/**
 * UI Constants
 * 
 * Centralized constants for UI interactions and layout.
 * Ensures consistency across the application.
 */

/**
 * Drag and Drop Configuration
 * 
 * These values are optimized for both desktop and mobile:
 * - MOUSE_DRAG_DISTANCE: Prevents accidental drags on desktop
 * - TOUCH_DRAG_DELAY: Allows scrolling before drag on mobile (iOS/Android best practice)
 * - TOUCH_DRAG_TOLERANCE: Allows slight finger movement during delay
 * 
 * Based on WCAG 2.1 Level AAA and mobile UX best practices.
 */
export const DRAG_SENSOR_CONFIG = {
  /** Minimum pixels of mouse movement before drag starts (prevents accidental drags) */
  MOUSE_DRAG_DISTANCE: 8,
  
  /** Milliseconds to hold before touch drag starts (allows scrolling) */
  TOUCH_DRAG_DELAY: 250,
  
  /** Pixels of movement allowed during touch delay */
  TOUCH_DRAG_TOLERANCE: 5,
} as const;

/**
 * Touch Target Sizes
 * 
 * Minimum touch target sizes per WCAG 2.1 Level AAA (2.5.5)
 * and mobile platform guidelines (iOS HIG, Material Design).
 */
export const TOUCH_TARGET = {
  /** Minimum touch target size for interactive elements */
  MIN_SIZE: 48,
  
  /** Recommended touch target size for important actions */
  COMFORTABLE_SIZE: 56,
} as const;

/**
 * Debounce Timings
 * 
 * Debounce delays for various operations to prevent
 * performance issues and memory leaks.
 */
export const DEBOUNCE = {
  /** Debounce for UI updates triggered by projection changes */
  UI_UPDATE: 100,
  
  /** Debounce for sync operations to prevent concurrent requests */
  SYNC_OPERATION: 5000,
} as const;

/**
 * Sync Configuration
 * 
 * Configuration for background synchronization with Firestore.
 */
export const SYNC_CONFIG = {
  /** Maximum number of events per Firestore batch write */
  FIRESTORE_BATCH_SIZE: 500,
  
  /** Interval between background syncs (milliseconds) */
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Entry Type Icons
 * 
 * Consistent icon representations for entry types and states
 * across the application. Used in stats, tree nodes, and entry items.
 */
export const ENTRY_ICONS = {
  /** Open task icon (unchecked box) */
  TASK_OPEN: '☐',
  
  /** Completed task icon (check mark) */
  TASK_COMPLETED: '✓',
  
  /** Note icon */
  NOTE: '📝',
  
  /** Event icon */
  EVENT: '📅',
  
  /** Migrated entry icon */
  MIGRATED: '>',
  
  /** Favorite/starred collection icon */
  FAVORITE: '⭐',
  
  /** Calendar collection icon */
  CALENDAR: '🗓️',
} as const;
