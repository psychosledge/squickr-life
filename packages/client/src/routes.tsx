/**
 * Route Constants
 * 
 * Centralized route definitions for the application.
 * Phase 2D: Collections as primary interface
 */

export const ROUTES = {
  index: '/',
  collection: '/collection/:id',
} as const;

/**
 * Helper to build collection detail path
 */
export const buildCollectionPath = (id: string): string => 
  `/collection/${id}`;

/**
 * Special collection ID for uncategorized entries
 */
export const UNCATEGORIZED_COLLECTION_ID = 'uncategorized';
