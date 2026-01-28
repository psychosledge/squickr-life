/**
 * Route Constants
 * 
 * Centralized route definitions for the application.
 * Phase 2A: Infrastructure setup
 * Phase 2B: Collection Index becomes default
 */

export const ROUTES = {
  index: '/',
  collections: '/collections',
  collection: '/collection/:id',
  dailyLogs: '/daily-logs',
  uncategorized: '/uncategorized',
} as const;

/**
 * Helper to build collection detail path
 */
export const buildCollectionPath = (id: string): string => 
  `/collection/${id}`;
