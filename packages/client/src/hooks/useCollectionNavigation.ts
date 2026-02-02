/**
 * useCollectionNavigation Hook
 * 
 * Provides navigation capabilities between collections with keyboard shortcuts
 * and touch gestures for a page-flipping experience.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Collection } from '@squickr/shared';
import { useApp } from '../context/AppContext';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { sortCollectionsHierarchically } from '../utils/collectionSorting';

const SWIPE_THRESHOLD = 50; // Minimum pixels for swipe detection

export interface UseCollectionNavigationResult {
  previousCollection: Collection | null;
  nextCollection: Collection | null;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
}

export function useCollectionNavigation(
  currentCollectionId: string
): UseCollectionNavigationResult {
  const { collectionProjection, entryProjection } = useApp();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const touchStartX = useRef<number | null>(null);

  // Load collections including virtual uncategorized if needed
  const loadCollections = useCallback(async () => {
    const realCollections = await collectionProjection.getCollections();
    
    // Check if there are orphaned entries (for virtual uncategorized collection)
    const orphanedEntries = await entryProjection.getEntriesByCollection(null);
    
    let allCollections: Collection[];
    if (orphanedEntries.length > 0) {
      // Add virtual uncategorized collection at the start
      const virtualUncategorized: Collection = {
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        type: 'custom',
        order: '!', // Comes before all other collections
        createdAt: new Date().toISOString(),
      };
      allCollections = [virtualUncategorized, ...realCollections];
    } else {
      allCollections = realCollections;
    }
    
    // Sort collections hierarchically to match index page order
    // Order: 1) Favorited customs, 2) Daily logs (newest first), 3) Other customs
    const sortedCollections = sortCollectionsHierarchically(allCollections);
    setCollections(sortedCollections);
  }, [collectionProjection, entryProjection]);

  // Load collections on mount and when they change
  useEffect(() => {
    loadCollections();

    const unsubscribeCollection = collectionProjection.subscribe(() => {
      loadCollections();
    });

    const unsubscribeEntry = entryProjection.subscribe(() => {
      loadCollections();
    });

    return () => {
      unsubscribeCollection();
      unsubscribeEntry();
    };
  }, [collectionProjection, entryProjection, loadCollections]);

  // Calculate previous and next collections
  const { previousCollection, nextCollection } = useMemo(() => {
    const currentIndex = collections.findIndex(c => c.id === currentCollectionId);
    
    if (currentIndex === -1) {
      return { previousCollection: null, nextCollection: null };
    }

    return {
      previousCollection: currentIndex > 0 ? (collections[currentIndex - 1] ?? null) : null,
      nextCollection: currentIndex < collections.length - 1 ? (collections[currentIndex + 1] ?? null) : null,
    };
  }, [collections, currentCollectionId]);

  // Navigation functions
  const navigateToPrevious = useCallback(() => {
    if (previousCollection) {
      navigate(`/collection/${previousCollection.id}`);
    }
  }, [previousCollection, navigate]);

  const navigateToNext = useCallback(() => {
    if (nextCollection) {
      navigate(`/collection/${nextCollection.id}`);
    }
  }, [nextCollection, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle arrow keys
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateToPrevious, navigateToNext]);

  // Touch gestures
  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartX.current === null || event.changedTouches.length === 0) {
        return;
      }

      const touchEndX = event.changedTouches[0]?.clientX;
      if (touchEndX === undefined) return;
      
      const deltaX = touchEndX - touchStartX.current;

      // Swipe left = next (moving finger to the left)
      if (deltaX < -SWIPE_THRESHOLD) {
        navigateToNext();
      }
      // Swipe right = previous (moving finger to the right)
      else if (deltaX > SWIPE_THRESHOLD) {
        navigateToPrevious();
      }

      touchStartX.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigateToPrevious, navigateToNext]);

  return {
    previousCollection,
    nextCollection,
    navigateToPrevious,
    navigateToNext,
  };
}
