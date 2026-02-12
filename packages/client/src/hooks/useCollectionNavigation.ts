/**
 * useCollectionNavigation Hook
 * 
 * Provides navigation capabilities between collections with keyboard shortcuts
 * and touch gestures for a page-flipping experience.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Collection } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { buildNavigationEntries } from '../utils/navigationEntries';
import { useUserPreferences } from './useUserPreferences';
import { useSwipeProgress } from './useSwipeProgress';
import { SWIPE } from '../utils/constants';

export interface UseCollectionNavigationResult {
  previousCollection: Collection | null;
  nextCollection: Collection | null;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
  // Swipe progress state for visual feedback
  isSwipeActive: boolean;
  swipeProgress: number;
}

export function useCollectionNavigation(
  currentCollectionId: string
): UseCollectionNavigationResult {
  const { collectionProjection, entryProjection } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const userPreferences = useUserPreferences();
  const [collections, setCollections] = useState<Collection[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Swipe progress hook for visual feedback
  const swipeProgress = useSwipeProgress();

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
    
    setCollections(allCollections);
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

  // Memoize current time to ensure consistent calculations
  const now = useMemo(() => new Date(), []);

  // Build navigation entries with URL metadata
  const navigationEntries = useMemo(() => {
    return buildNavigationEntries(collections, userPreferences, now);
  }, [collections, userPreferences, now]);

  // Find current entry by URL (not collection ID!)
  const currentEntry = useMemo(() => {
    return navigationEntries.find(entry => entry.url === location.pathname);
  }, [navigationEntries, location.pathname]);

  // Calculate previous and next collections based on URL-based navigation
  const { previousCollection, nextCollection, previousUrl, nextUrl } = useMemo(() => {
    if (!currentEntry) {
      return { 
        previousCollection: null, 
        nextCollection: null,
        previousUrl: null,
        nextUrl: null,
      };
    }
    
    const currentIndex = navigationEntries.indexOf(currentEntry);
    const previousEntry = currentIndex > 0 ? navigationEntries[currentIndex - 1] : null;
    const nextEntry = currentIndex < navigationEntries.length - 1 ? navigationEntries[currentIndex + 1] : null;
    
    return {
      previousCollection: previousEntry?.collection ?? null,
      nextCollection: nextEntry?.collection ?? null,
      previousUrl: previousEntry?.url ?? null,
      nextUrl: nextEntry?.url ?? null,
    };
  }, [currentEntry, navigationEntries]);

  // Navigation functions using URLs from entries
  const navigateToPrevious = useCallback(() => {
    if (previousUrl) {
      navigate(previousUrl);
    } else {
      // If at the first collection and no previous, navigate back to index
      navigate('/');
    }
  }, [previousUrl, navigate]);

  const navigateToNext = useCallback(() => {
    if (nextUrl) {
      navigate(nextUrl);
    }
  }, [nextUrl, navigate]);

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
        touchStartY.current = event.touches[0]?.clientY ?? null;
        // Delegate to swipe progress hook
        swipeProgress.handleTouchStart(event);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      // Delegate to swipe progress hook for visual feedback
      swipeProgress.handleTouchMove(event);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null || event.changedTouches.length === 0) {
        // Delegate to swipe progress hook to reset state
        swipeProgress.handleTouchEnd(event);
        return;
      }

      const touchEndX = event.changedTouches[0]?.clientX;
      const touchEndY = event.changedTouches[0]?.clientY;
      if (touchEndX === undefined || touchEndY === undefined) {
        swipeProgress.handleTouchEnd(event);
        return;
      }
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;
      
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Only navigate if:
      // 1. Horizontal movement exceeds threshold
      // 2. Horizontal movement dominates vertical movement (not a scroll gesture)
      const isHorizontalSwipe = absDeltaX > SWIPE.THRESHOLD && absDeltaX > absDeltaY * SWIPE.VERTICAL_PRIORITY_RATIO;

      if (isHorizontalSwipe) {
        // Carousel "Push Away" Metaphor:
        // Collections are like pages in a carousel laid out horizontally
        // Higher index = later page (further to the right)
        // 
        // Swipe left (finger moves left, deltaX < 0) = go to NEXT (higher index)
        // - Like pushing the current page left to reveal the next page underneath
        // - Matches Instagram, Photos app, and standard carousel behavior
        // 
        // Swipe right (finger moves right, deltaX > 0) = go to PREVIOUS (lower index)
        // - Like pushing the current page right to reveal the previous page underneath
        //
        // This matches the "push away" mental model: swipe in the direction
        // you want to push the current page to reveal what's behind it
        if (deltaX < 0) {
          navigateToNext();  // Swipe left → next (higher index)
        } else {
          navigateToPrevious();  // Swipe right → previous (lower index)
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
      
      // Delegate to swipe progress hook to reset state
      swipeProgress.handleTouchEnd(event);
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove); // Add touchmove listener
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove); // Clean up touchmove
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigateToPrevious, navigateToNext, swipeProgress]);

  return {
    previousCollection,
    nextCollection,
    navigateToPrevious,
    navigateToNext,
    // Expose swipe progress state for visual feedback
    isSwipeActive: swipeProgress.isSwipeActive,
    swipeProgress: swipeProgress.swipeProgress,
  };
}
