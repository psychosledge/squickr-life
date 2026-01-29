/**
 * Collection Index View
 * 
 * Displays all collections with ability to create and navigate.
 * 
 * Phase 2B: Full implementation with collection list
 */

import { useState, useEffect } from 'react';
import type { Collection } from '@squickr/shared';
import { useApp } from '../context/AppContext';
import { CollectionList } from '../components/CollectionList';
import { CreateCollectionModal } from '../components/CreateCollectionModal';
import { FAB } from '../components/FAB';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';

export function CollectionIndexView() {
  const { collectionProjection, entryProjection, createCollectionHandler, reorderCollectionHandler } = useApp();
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entryCountsByCollection, setEntryCountsByCollection] = useState<Map<string, number>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load collections and entry counts
  const loadData = async () => {
    // Load real collections
    const loadedCollections = await collectionProjection.getCollections();
    
    // Get entry counts for all collections in a single query (avoids N+1 pattern)
    const allCounts = await entryProjection.getEntryCountsByCollection();
    
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

    // Build count map for display
    const counts = new Map<string, number>();
    
    // Add count for virtual uncategorized collection if it exists
    if (uncategorizedCount > 0) {
      counts.set(UNCATEGORIZED_COLLECTION_ID, uncategorizedCount);
    }
    
    // Add counts for real collections
    for (const collection of loadedCollections) {
      const count = allCounts.get(collection.id) ?? 0;
      counts.set(collection.id, count);
    }
    
    setEntryCountsByCollection(counts);
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

  const handleCreateCollection = async (name: string) => {
    await createCollectionHandler.handle({ name });
  };

  const handleReorder = async (
    collectionId: string,
    previousCollectionId: string | null,
    nextCollectionId: string | null
  ) => {
    if (!reorderCollectionHandler) {
      return;
    }

    await reorderCollectionHandler.handle({
      collectionId,
      previousCollectionId,
      nextCollectionId,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 relative">
          {/* Dark mode toggle - positioned top-right */}
          <div className="absolute top-0 right-0">
            <DarkModeToggle />
          </div>
          
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Squickr Life
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Get shit done quicker with Squickr!
          </p>
        </div>

        {/* Collection List */}
        <CollectionList 
          collections={collections} 
          entryCountsByCollection={entryCountsByCollection}
          onReorder={handleReorder}
        />

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Event-Sourced • CQRS • TDD • Offline-First PWA</p>
          <p className="mt-1">✓ Data persists with IndexedDB</p>
          <p className="mt-1">Built by the AI Agent Team</p>
        </div>
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
