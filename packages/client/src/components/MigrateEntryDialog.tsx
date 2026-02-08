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
 */

import { useState, useEffect, useRef } from 'react';
import type { Entry, Collection } from '@squickr/domain';
import { getCollectionDisplayName } from '../utils/formatters';

interface MigrateEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: Entry | null;
  entries?: Entry[];
  currentCollectionId?: string;
  collections: Collection[];
  onMigrate: (entryId: string, targetCollectionId: string, mode: 'move' | 'add') => Promise<void>;
  onBulkMigrate?: (entryIds: string[], targetCollectionId: string, mode: 'move' | 'add') => Promise<void>;
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
}: MigrateEntryDialogProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [mode, setMode] = useState<'move' | 'add'>('move');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);

  // Determine if we're in bulk mode
  const isBulkMode = !!entries && entries.length > 0;
  const singleEntry = isBulkMode ? entries[0] : entry;
  const entryCount = isBulkMode ? entries.length : 1;

  // Filter out current collection and sort by order field
  const availableCollections = collections
    .filter(c => c.id !== currentCollectionId)
    .sort((a, b) => {
      // Sort by order field (lexicographic comparison for fractional indexing)
      return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
    });

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
      return;
    }

    // Set smart default for mode based on entry type
    const defaultMode = getDefaultMode(singleEntry);
    setMode(defaultMode);

    // DO NOT pre-select collection - user must choose explicitly
    // Note: We intentionally omit selectedCollectionId from deps to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, singleEntry, availableCollections.length]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

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
    if (!selectedCollectionId) {
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

        {availableCollections.length === 0 ? (
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
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                disabled={isSubmitting}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a collection...</option>
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
            disabled={isSubmitting || availableCollections.length === 0 || !selectedCollectionId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
                       focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Migrating...' : 'Migrate'}
          </button>
        </div>
      </div>
    </div>
  );
}
