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
  const { collectionProjection, entryProjection, createCollectionHandler } = useApp();
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entryCountsByCollection, setEntryCountsByCollection] = useState<Map<string, number>>(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load collections and entry counts
  const loadData = async () => {
    // Load real collections
    const loadedCollections = await collectionProjection.getCollections();
    
    // Load orphaned entries (entries with no collection)
    const orphanedEntries = await entryProjection.getEntriesByCollection(null);
    
    // Build collections array with virtual "Uncategorized" if needed
    const collectionsWithVirtual: Collection[] = [];
    
    // If there are orphaned entries, add virtual "Uncategorized" collection first
    if (orphanedEntries.length > 0) {
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

    // Calculate entry counts for all collections (including virtual)
    const counts = new Map<string, number>();
    
    // Count for uncategorized (if it exists in our list)
    if (orphanedEntries.length > 0) {
      counts.set(UNCATEGORIZED_COLLECTION_ID, orphanedEntries.length);
    }
    
    // Count for real collections
    for (const collection of loadedCollections) {
      const entries = await entryProjection.getEntriesByCollection(collection.id);
      counts.set(collection.id, entries.length);
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
            Collections
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Organize your life into collections
          </p>
        </div>

        {/* Collection List */}
        <CollectionList 
          collections={collections} 
          entryCountsByCollection={entryCountsByCollection}
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
