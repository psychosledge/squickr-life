/**
 * Collection Index View
 * 
 * Displays all collections with ability to create and navigate.
 * 
 * Phase 2B: Full implementation with collection list
 */

import { useState, useEffect } from 'react';
import type { Collection, Entry } from '@squickr/shared';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../firebase/auth';
import { HierarchicalCollectionList } from '../components/HierarchicalCollectionList';
import { CreateCollectionModal } from '../components/CreateCollectionModal';
import { FAB } from '../components/FAB';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { UserProfileMenu } from '../components/UserProfileMenu';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import { logger } from '../utils/logger';

export function CollectionIndexView() {
  const { collectionProjection, entryProjection, createCollectionHandler, reorderCollectionHandler } = useApp();
  const { user } = useAuth();
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entriesByCollection, setEntriesByCollection] = useState<Map<string | null, Entry[]>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load collections and entries
  const loadData = async () => {
    // Load real collections
    const loadedCollections = await collectionProjection.getCollections();
    
    // Get active task counts for all collections in a single query (avoids N+1 pattern)
    const allCounts = await entryProjection.getActiveTaskCountsByCollection();
    
    // Get all entries grouped by collection for stats
    const allEntries = await entryProjection.getEntries('all');
    const entriesMap = new Map<string | null, Entry[]>();
    for (const entry of allEntries) {
      const collectionId = entry.collectionId ?? null;
      if (!entriesMap.has(collectionId)) {
        entriesMap.set(collectionId, []);
      }
      entriesMap.get(collectionId)!.push(entry);
    }
    setEntriesByCollection(entriesMap);
    
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
  };

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
  }, [collectionProjection, entryProjection]);

  const handleCreateCollection = async (name: string, type?: import('@squickr/shared').CollectionType, date?: string) => {
    await createCollectionHandler.handle({ name, type, date });
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
            {user && <UserProfileMenu user={user} onSignOut={handleSignOut} />}
          </div>
          
          {/* Title */}
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Squickr Life
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
              Get shit done quicker with Squickr!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              v{__APP_VERSION__}
            </p>
          </div>
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
    </div>
  );
}
