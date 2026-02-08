/**
 * MigrateEntryDialog Component (Phase 3: Multi-Collection Refactor)
 * 
 * Allows user to add or move tasks to different collections.
 * 
 * Features:
 * - Collection selector dropdown
 * - Radio buttons for "Move" vs "Also show in" modes
 * - Smart defaults: top-level tasks → move, sub-tasks → add
 * - Helper text explaining behavior
 * - Supports both single and bulk migration
 * - Create new collection option (restored from old modal)
 * - Smart collection sorting (hierarchical: Favorites → Daily Logs → Collections)
 */

import { useState, useEffect, useRef } from 'react';
import type { Entry, Collection, CollectionType, UserPreferences } from '@squickr/domain';
import { getCollectionDisplayName } from '../utils/formatters';
import { isEffectivelyFavorited } from '../utils/collectionUtils';
import { CreateCollectionModal } from './CreateCollectionModal';

interface MigrateEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: Entry | null;
  entries?: Entry[];
  currentCollectionId?: string;
  collections: Collection[];
  onMigrate: (entryId: string, targetCollectionId: string, mode: 'move' | 'add') => Promise<void>;
  onBulkMigrate?: (entryIds: string[], targetCollectionId: string, mode: 'move' | 'add') => Promise<void>;
  onCreateCollection?: (name: string, type?: CollectionType, date?: string) => Promise<string>;
  userPreferences?: UserPreferences;
}

/**
 * Check if an entry is a sub-task (has a parent)
 */
function isSubTask(entry: Entry): boolean {
  if (entry.type !== 'task') return false;
  return !!(entry.parentEntryId || entry.parentTaskId);
}

/**
 * Get smart default mode based on entry type
 * - Top-level tasks/notes/events: 'move' (default behavior)
 * - Sub-tasks: 'add' (stay with parent)
 */
function getDefaultMode(entry: Entry | undefined | null): 'move' | 'add' {
  if (!entry) return 'move';
  return isSubTask(entry) ? 'add' : 'move';
}

/**
 * Sort collections in hierarchical order for migration dialog:
 * 1. Favorites (both custom and daily/monthly logs)
 * 2. Recent daily logs (Today, Tomorrow, Yesterday)
 * 3. Recent monthly logs (Current Month)
 * 4. Other custom collections (by order field)
 * 5. Older daily/monthly logs (by date descending)
 */
function getSortedCollections(
  collections: Collection[], 
  userPreferences?: UserPreferences
): Collection[] {
  const now = new Date();
  const today = now.toISOString().split('T')[0]!;
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0]!;
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]!;
  const currentMonth = today.substring(0, 7); // YYYY-MM
  
  const favorites: Collection[] = [];
  const recentDailies: Collection[] = [];
  const recentMonthlies: Collection[] = [];
  const otherCustoms: Collection[] = [];
  const olderDailies: Collection[] = [];
  const olderMonthlies: Collection[] = [];
  
  for (const c of collections) {
    // Check if favorited
    const isFav = userPreferences ? isEffectivelyFavorited(c, userPreferences) : c.isFavorite;
    
    if (isFav) {
      favorites.push(c);
    } else if (c.type === 'daily') {
      // Split dailies into recent (today/tomorrow/yesterday) vs older
      if (c.date === today || c.date === tomorrow || c.date === yesterday) {
        recentDailies.push(c);
      } else {
        olderDailies.push(c);
      }
    } else if (c.type === 'monthly') {
      // Split monthlies into current month vs older
      if (c.date === currentMonth) {
        recentMonthlies.push(c);
      } else {
        olderMonthlies.push(c);
      }
    } else {
      // Custom collections
      otherCustoms.push(c);
    }
  }
  
  // Sort each group
  favorites.sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
  
  // Recent dailies: Today, Tomorrow, Yesterday order
  recentDailies.sort((a, b) => {
    const aDate = a.date || '';
    const bDate = b.date || '';
    if (aDate === today) return -1;
    if (bDate === today) return 1;
    if (aDate === tomorrow) return -1;
    if (bDate === tomorrow) return 1;
    return 0; // both yesterday
  });
  
  otherCustoms.sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : 0);
  
  // Older logs by date descending (most recent first)
  olderDailies.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  olderMonthlies.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  
  // Combine in order
  return [
    ...favorites,
    ...recentDailies,
    ...recentMonthlies,
    ...otherCustoms,
    ...olderDailies,
    ...olderMonthlies,
  ];
}

/**
 * MigrateEntryDialog Component
 * 
 * Modal for migrating tasks to collections with multi-collection support.
 * 
 * UI Design:
 * ```
 * ┌─────────────────────────────────┐
 * │  Migrate Task                   │
 * ├─────────────────────────────────┤
 * │ Collection: [Daily Log ▼]      │
 * │                                 │
 * │ ● Move to Daily Log             │
 * │   └─ Crosses out original in    │
 * │      Monthly Log                │
 * │ ○ Also show in Daily Log        │
 * │   └─ Keep in Monthly Log        │
 * │                                 │
 * │ [Migrate]  [Cancel]             │
 * └─────────────────────────────────┘
 * ```
 */
export function MigrateEntryDialog({
  isOpen,
  onClose,
  entry,
  entries,
  currentCollectionId,
  collections,
  onMigrate,
  onBulkMigrate,
  onCreateCollection,
  userPreferences,
}: MigrateEntryDialogProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [mode, setMode] = useState<'move' | 'add'>('move');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const CREATE_NEW_OPTION = '__CREATE_NEW__';

  // Determine if we're in bulk mode
  const isBulkMode = !!entries && entries.length > 0;
  const singleEntry = isBulkMode ? entries[0] : entry;
  const entryCount = isBulkMode ? entries.length : 1;

  // Filter out current collection and sort hierarchically
  const availableCollections = getSortedCollections(
    collections.filter(c => c.id !== currentCollectionId),
    userPreferences
  );

  // Get collection name for display in helper text
  const selectedCollection = availableCollections.find(c => c.id === selectedCollectionId);
  const currentCollection = collections.find(c => c.id === currentCollectionId);
  
  const selectedCollectionName = selectedCollection 
    ? getCollectionDisplayName(selectedCollection, new Date())
    : '';
  const currentCollectionName = currentCollection
    ? getCollectionDisplayName(currentCollection, new Date())
    : 'current collection';

  // Auto-focus select when modal opens
  useEffect(() => {
    if (isOpen) {
      selectRef.current?.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes or entry changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCollectionId('');
      setMode('move');
      setIsSubmitting(false);
      setError('');
      setShowCreateModal(false);
      return;
    }

    // Set smart default for mode based on entry type
    const defaultMode = getDefaultMode(singleEntry);
    setMode(defaultMode);

    // DO NOT pre-select collection - user must choose explicitly
    // Note: We intentionally omit selectedCollectionId from deps to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, singleEntry, availableCollections.length]);

  // Handle Escape key to close modal (only when no nested modal is open)
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showCreateModal) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, showCreateModal, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  // Handle back button to close modal
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    // Push state when modal opens
    window.history.pushState({ modal: true }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Clean up state if still there
      if (window.history.state?.modal) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  const handleMigrate = async () => {
    if (!selectedCollectionId || selectedCollectionId === CREATE_NEW_OPTION) {
      setError('Please select a collection');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (isBulkMode && onBulkMigrate && entries) {
        // Bulk migration
        const entryIds = entries.map(e => e.id);
        await onBulkMigrate(entryIds, selectedCollectionId, mode);
      } else if (!isBulkMode && singleEntry) {
        // Single migration
        await onMigrate(singleEntry.id, selectedCollectionId, mode);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to migrate entry');
      setIsSubmitting(false);
    }
  };

  const handleSelectChange = (value: string) => {
    if (value === CREATE_NEW_OPTION) {
      // Open create collection modal
      setShowCreateModal(true);
      setSelectedCollectionId(''); // Reset selection
    } else {
      setSelectedCollectionId(value);
    }
  };

  const handleCreateCollection = async (name: string, type?: CollectionType, date?: string) => {
    if (!onCreateCollection) return;

    try {
      // Create the collection and get the new collection ID
      const newCollectionId = await onCreateCollection(name, type, date);
      setShowCreateModal(false);
      
      // Auto-migrate the entry/entries to the newly created collection
      if (isBulkMode && onBulkMigrate && entries) {
        const entryIds = entries.map(e => e.id);
        await onBulkMigrate(entryIds, newCollectionId, mode);
      } else if (!isBulkMode && singleEntry) {
        await onMigrate(singleEntry.id, newCollectionId, mode);
      }
      
      // Close the migrate dialog
      onClose();
    } catch (err) {
      // Error handling is done in CreateCollectionModal
      throw err;
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  if (!isOpen || (!entry && (!entries || entries.length === 0))) {
    return null;
  }

  // Get entry type label
  const getEntryTypeLabel = () => {
    if (isBulkMode) {
      return entryCount === 1 ? 'entry' : 'entries';
    }
    if (!singleEntry) return 'entry';
    switch (singleEntry.type) {
      case 'task':
        return 'task';
      case 'note':
        return 'note';
      case 'event':
        return 'event';
      default:
        return 'entry';
    }
  };

  // Get modal title
  const getModalTitle = () => {
    if (isBulkMode) {
      return `Migrate ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;
    }
    return `Migrate ${getEntryTypeLabel()}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-70 p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {getModalTitle()}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded" role="alert">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {availableCollections.length === 0 && !onCreateCollection ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            No other collections available. Create a collection first.
          </p>
        ) : (
          <>
            {/* Collection Selector */}
            <div className="mb-6">
              <label 
                htmlFor="target-collection" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Collection
              </label>
              <select
                ref={selectRef}
                id="target-collection"
                value={selectedCollectionId}
                onChange={(e) => handleSelectChange(e.target.value)}
                disabled={isSubmitting}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a collection...</option>
                {onCreateCollection && (
                  <option value={CREATE_NEW_OPTION} className="text-blue-600 font-medium">
                    + Create New Collection
                  </option>
                )}
                {availableCollections.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {getCollectionDisplayName(collection, new Date())}
                  </option>
                ))}
              </select>
            </div>

            {/* Migration Mode Radio Buttons */}
            <div className="mb-6">
              <div className="space-y-3">
                {/* Move Mode */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="migration-mode"
                    value="move"
                    checked={mode === 'move'}
                    onChange={(e) => setMode(e.target.value as 'move' | 'add')}
                    disabled={isSubmitting}
                    className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-white font-medium">
                      Move to {selectedCollectionName || 'selected collection'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Crosses out original in {currentCollectionName}
                    </div>
                  </div>
                </label>

                {/* Add Mode */}
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="migration-mode"
                    value="add"
                    checked={mode === 'add'}
                    onChange={(e) => setMode(e.target.value as 'move' | 'add')}
                    disabled={isSubmitting}
                    className="mt-1 mr-3 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-gray-900 dark:text-white font-medium">
                      Also show in {selectedCollectionName || 'selected collection'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Keep in {currentCollectionName}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                       hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMigrate}
            disabled={isSubmitting || (availableCollections.length === 0 && !onCreateCollection) || !selectedCollectionId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
                       focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Migrating...' : 'Migrate'}
          </button>
        </div>
      </div>

      {/* Nested Create Collection Modal */}
      {onCreateCollection && (
        <CreateCollectionModal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateCollection}
        />
      )}
    </div>
  );
}
