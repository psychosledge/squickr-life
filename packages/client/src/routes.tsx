/**
 * Route Constants
 * 
 * Centralized route definitions for the application.
 * Phase 2D: Collections as primary interface
 */

export const ROUTES = {
  index: '/',
  collection: '/collection/:id',
  review: '/review',
} as const;

/**
 * Helper to build collection detail path
 */
export const buildCollectionPath = (id: string): string => 
  `/collection/${id}`;

/**
 * Helper to build review path with optional period
 */
export function buildReviewPath(period: 'weekly' | 'monthly' = 'weekly'): string {
  return period === 'monthly' ? '/review?period=monthly' : '/review';
}

/**
 * Special collection ID for uncategorized entries
 */
export const UNCATEGORIZED_COLLECTION_ID = 'uncategorized';
