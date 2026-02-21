/**
 * Collection Index View
 * 
 * Displays all collections with ability to create and navigate.
 * 
 * Phase 2B: Full implementation with collection list
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Collection, Entry } from '@squickr/domain';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../firebase/auth';
import { HierarchicalCollectionList } from '../components/HierarchicalCollectionList';
import { CreateCollectionModal } from '../components/CreateCollectionModal';
import { SettingsModal } from '../components/SettingsModal';
import { FAB } from '../components/FAB';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { CollectionNavigationControls } from '../components/CollectionNavigationControls';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { logger } from '../utils/logger';
import { sortCollectionsHierarchically } from '../utils/collectionSorting';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useSwipeProgress } from '../hooks/useSwipeProgress';
import { useTutorial } from '../hooks/useTutorial';
import { TUTORIAL_COMPLETED_KEY, TUTORIAL_SEEN_KEY } from '../context/TutorialContext';
import { SWIPE } from '../utils/constants';
import { buildEntriesByCollectionMap } from '../utils/buildEntriesByCollectionMap';

export function CollectionIndexView() {
  const { collectionProjection, entryProjection, createCollectionHandler, reorderCollectionHandler } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userPreferences = useUserPreferences();
  const tutorial = useTutorial();
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entriesByCollection, setEntriesByCollection] = useState<Map<string | null, Entry[]>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Touch gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeProgress = useSwipeProgress();

  // Load collections and entries
  const loadData = useCallback(async () => {
    // Load real collections
    const loadedCollections = await collectionProjection.getCollections();
    
    // Get active task counts for all collections in a single query (avoids N+1 pattern)
    const allCounts = await entryProjection.getActiveTaskCountsByCollection();
    
    // Get all entries grouped by collection for stats
    const allEntries = await entryProjection.getEntries('all');
    setEntriesByCollection(buildEntriesByCollectionMap(allEntries));
    
    // Check if uncategorized entries exist
    const uncategorizedCount = allCounts.get(null) ?? 0;
    
    // Build collections array with virtual "Uncategorized" if needed
    const collectionsWithVirtual: Collection[] = [];
    
    // If there are orphaned entries, add virtual "Uncategorized" collection first
    if (uncategorizedCount > 0) {
      collectionsWithVirtual.push({
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        type: 'custom',
        order: '!', // Sorts first (! comes before alphanumerics)
        createdAt: new Date().toISOString(),
      });
    }
    
    // Add real collections
    collectionsWithVirtual.push(...loadedCollections);
    
    setCollections(collectionsWithVirtual);
  }, [collectionProjection, entryProjection]);

  // Subscribe to projection changes (reactive updates)
  useEffect(() => {
    // Initial load
    loadData();

    // Subscribe to changes
    const unsubscribeCollection = collectionProjection.subscribe(() => {
      loadData();
    });

    const unsubscribeEntry = entryProjection.subscribe(() => {
      loadData();
    });

    return () => {
      unsubscribeCollection();
      unsubscribeEntry();
    };
  }, [loadData, collectionProjection, entryProjection]);

  // Auto-trigger tutorial for new users with zero real collections
  const { startTutorial } = tutorial;
  useEffect(() => {
    const realCollections = collections.filter(
      (c) => c.id !== UNCATEGORIZED_COLLECTION_ID,
    );
    const hasSeenThisSession =
      sessionStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
    const hasCompletedTutorial =
      localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';

    if (
      realCollections.length === 0 &&
      !hasSeenThisSession &&
      !hasCompletedTutorial
    ) {
      startTutorial();
    }
  }, [collections, startTutorial]);

  // Calculate next collection (first in sorted order) for navigation
  const nextCollection = useMemo(() => {
    // Sort collections hierarchically to match sidebar order
    const sortedCollections = sortCollectionsHierarchically(collections, userPreferences);
    return sortedCollections.length > 0 ? sortedCollections[0] : null;
  }, [collections, userPreferences]);

  // Navigate to next collection (first collection in the list)
  const navigateToNext = useCallback(() => {
    if (nextCollection) {
      navigate(`/collection/${nextCollection.id}`);
    }
  }, [nextCollection, navigate]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle arrow right to navigate to first collection
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToNext();
      }
      // ArrowLeft does nothing on index page (can't go before index)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateToNext]);

  // Touch gestures for navigation
  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        touchStartY.current = event.touches[0]?.clientY ?? null;
        swipeProgress.handleTouchStart(event);
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      swipeProgress.handleTouchMove(event);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null || event.changedTouches.length === 0) {
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

      // Only navigate if horizontal movement exceeds threshold and dominates vertical
      const isHorizontalSwipe = absDeltaX > SWIPE.THRESHOLD && absDeltaX > absDeltaY * SWIPE.VERTICAL_PRIORITY_RATIO;

      if (isHorizontalSwipe) {
        // Swipe left (deltaX < 0) = navigate to first collection
        // Swipe right (deltaX > 0) = do nothing (can't go before index)
        if (deltaX < 0) {
          navigateToNext();
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
      swipeProgress.handleTouchEnd(event);
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigateToNext, swipeProgress]);

  const handleCreateCollection = async (name: string, type?: import('@squickr/domain').CollectionType, date?: string) => {
    const collectionId = await createCollectionHandler.handle({ name, type, date });
    // When the tutorial is paused (waiting for the user to enter a collection),
    // auto-navigate so Steps 4–7 can appear without the user having to find the collection manually.
    if (tutorial.isPaused) {
      navigate(`/collection/${collectionId}`);
    }
  };

  const handleReorderCollection = async (
    collectionId: string, 
    previousCollectionId: string | null, 
    nextCollectionId: string | null
  ) => {
    if (!reorderCollectionHandler) {
      logger.warn('[CollectionIndexView] Reorder handler not available');
      return;
    }
    
    await reorderCollectionHandler.handle({
      collectionId,
      previousCollectionId,
      nextCollectionId,
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Auth state change will be handled by AuthContext
      // User will automatically be redirected to SignInView
    } catch (error) {
      logger.error('[CollectionIndexView] Sign out failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Top-right controls */}
          <div className="flex justify-end items-center gap-3 mb-4">
            <DarkModeToggle />
            {user && (
              <UserProfileMenu 
                user={user} 
                onSignOut={handleSignOut}
                onSettingsClick={() => setIsSettingsModalOpen(true)}
              />
            )}
          </div>
          
          {/* Title and Navigation */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1" /> {/* Spacer for centering */}
            <div className="text-center flex-shrink-0">
              <h1 className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent" data-tutorial-id="tutorial-welcome">
                Squickr Life
              </h1>
            </div>
            <div className="flex-1 flex justify-end">
              {/* Navigation Controls - only right arrow */}
              <CollectionNavigationControls
                previousCollection={null}
                nextCollection={nextCollection || null}
                onNavigatePrevious={() => {}}
                onNavigateNext={navigateToNext}
              />
            </div>
          </div>

          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 text-center">
            Get your shit together quicker with Squickr!
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 text-center">
            v{__APP_VERSION__}
          </p>
        </div>

        {/* Collection List */}
        <HierarchicalCollectionList 
          collections={collections}
          onReorder={handleReorderCollection}
          entriesByCollection={entriesByCollection}
        />
      </div>

      {/* FAB for creating collections */}
      <FAB onClick={() => setIsModalOpen(true)} />

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCollection}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}
