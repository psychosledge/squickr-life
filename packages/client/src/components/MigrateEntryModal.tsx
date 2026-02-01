import { useState, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/shared';
import { CreateCollectionModal } from './CreateCollectionModal';
import { getCollectionDisplayName } from '../utils/formatters';

interface MigrateEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: Entry | null;
  currentCollectionId?: string;
  collections: Collection[];
  onMigrate: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  onCreateCollection?: (name: string) => Promise<string>;
  selectedCollectionId?: string;
  onOpenCreateCollection?: () => void;
}

const CREATE_NEW_OPTION = '__CREATE_NEW__';

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get default collections to show: Today + Pinned + Yesterday
 * Ensures no duplicates (e.g., if today's log is pinned)
 * 
 * For backwards compatibility: If no type field exists, treat as custom collection.
 * If smart filtering returns empty, fall back to showing all collections.
 */
function getDefaultCollections(collections: Collection[]): Collection[] {
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  
  const todayLog = collections.find(c => c.type === 'daily' && c.date === today);
  const yesterdayLog = collections.find(c => c.type === 'daily' && c.date === yesterday);
  const pinned = collections.filter(c => c.isFavorite === true);
  
  // Build list: Today (if exists), Pinned, Yesterday (if exists)
  // Use a Set to avoid duplicates (e.g., if today's log is pinned)
  const seen = new Set<string>();
  const defaultList: Collection[] = [];
  
  if (todayLog && !seen.has(todayLog.id)) {
    defaultList.push(todayLog);
    seen.add(todayLog.id);
  }
  
  for (const p of pinned) {
    if (!seen.has(p.id)) {
      defaultList.push(p);
      seen.add(p.id);
    }
  }
  
  if (yesterdayLog && !seen.has(yesterdayLog.id)) {
    defaultList.push(yesterdayLog);
    seen.add(yesterdayLog.id);
  }
  
  // If smart filtering returns empty, fall back to showing all collections
  // This handles legacy collections without type/date fields
  if (defaultList.length === 0 && collections.length > 0) {
    return collections;
  }
  
  return defaultList;
}

/**
 * MigrateEntryModal Component
 * 
 * Allows user to migrate an entry to a different collection or create a new collection.
 * 
 * Features:
 * - Shows "+ Create New Collection" option at the top
 * - Smart filtering: Shows Today + Pinned + Yesterday by default
 * - "Show all collections" button expands to full list
 * - Nested modal flow: Can open CreateCollectionModal from this modal
 * - Auto-selects newly created collection
 * - Prevents migration if entry already migrated
 */
export function MigrateEntryModal({
  isOpen,
  onClose,
  entry,
  currentCollectionId,
  collections,
  onMigrate,
  onCreateCollection,
  selectedCollectionId,
  onOpenCreateCollection,
}: MigrateEntryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Update selected option when selectedCollectionId prop changes
  useEffect(() => {
    if (selectedCollectionId !== undefined) {
      setSelectedOption(selectedCollectionId);
    }
  }, [selectedCollectionId]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setError('');
      setSelectedOption(null);
      setShowCreateModal(false);
      setShowAll(false);
    }
  }, [isOpen]);

  // Close on Escape key (only close this modal, not nested modals)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showCreateModal) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Lock body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, showCreateModal, onClose]);

  if (!isOpen || !entry) {
    return null;
  }

  // Check if entry is already migrated
  const isAlreadyMigrated = !!(entry.migratedTo);

  const handleMigrate = async () => {
    if (isAlreadyMigrated) {
      setError('This entry has already been migrated');
      return;
    }

    if (!selectedOption || selectedOption === CREATE_NEW_OPTION) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onMigrate(entry.id, selectedOption);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to migrate entry');
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (selectedOption === CREATE_NEW_OPTION) {
      if (onOpenCreateCollection) {
        onOpenCreateCollection();
      } else {
        setShowCreateModal(true);
      }
    }
  };

  const handleCreateCollection = async (name: string) => {
    if (onCreateCollection && entry) {
      try {
        // Create the collection and get the new collection ID
        const newCollectionId = await onCreateCollection(name);
        setShowCreateModal(false);
        
        // Auto-migrate the entry to the newly created collection
        await onMigrate(entry.id, newCollectionId);
        
        // Close the migrate modal
        onClose();
      } catch (err) {
        // Error handling is done in CreateCollectionModal
        throw err;
      }
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  // Filter out current collection
  const availableCollections = collections.filter(
    c => c.id !== currentCollectionId
  );

  // Determine which collections to display: smart filtered list or all
  const displayedCollections = showAll 
    ? availableCollections 
    : getDefaultCollections(availableCollections);

  // Get entry type label
  const getEntryTypeLabel = () => {
    switch (entry.type) {
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

  // Determine button state
  const isCreateNewSelected = selectedOption === CREATE_NEW_OPTION;
  const showNextButton = isCreateNewSelected;
  const showMigrateButton = selectedOption && !isCreateNewSelected;

  return (
    <>
      <div 
        className={`fixed inset-0 flex items-center justify-center bg-black transition-opacity ${
          showCreateModal ? 'bg-opacity-30 z-40' : 'bg-opacity-50 z-50'
        }`}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Migrate {getEntryTypeLabel()} to collection
          </h2>

          {isAlreadyMigrated && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This entry has already been migrated and cannot be moved again.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded" role="alert">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="space-y-2 mb-6" role="radiogroup" aria-labelledby="modal-title">
            {/* Create New Collection option */}
            <label
              className="flex items-center w-full text-left px-4 py-3 rounded border border-gray-200 dark:border-gray-700
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <input
                type="radio"
                name="collection-option"
                value={CREATE_NEW_OPTION}
                checked={selectedOption === CREATE_NEW_OPTION}
                onChange={() => setSelectedOption(CREATE_NEW_OPTION)}
                disabled={isSubmitting || isAlreadyMigrated}
                className="mr-3"
              />
              <span className="text-blue-600 dark:text-blue-400 font-medium">+ Create New Collection</span>
            </label>

            {/* Available collections */}
            {displayedCollections.map(collection => (
              <label
                key={collection.id}
                className="flex items-center w-full text-left px-4 py-3 rounded border border-gray-200 dark:border-gray-700
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <input
                  type="radio"
                  name="collection-option"
                  value={collection.id}
                  checked={selectedOption === collection.id}
                  onChange={() => setSelectedOption(collection.id)}
                  disabled={isSubmitting || isAlreadyMigrated}
                  className="mr-3"
                />
                <span className="text-gray-900 dark:text-white">{getCollectionDisplayName(collection)}</span>
              </label>
            ))}

            {displayedCollections.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No other collections available
              </p>
            )}
          </div>

          {/* Show all / Show less toggle */}
          {availableCollections.length > displayedCollections.length && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Show all collections
            </button>
          )}

          {showAll && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mb-4 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Show less
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>

            {showNextButton && (
              <button
                onClick={handleNext}
                disabled={isSubmitting || isAlreadyMigrated}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            )}

            {showMigrateButton && (
              <button
                onClick={handleMigrate}
                disabled={isSubmitting || isAlreadyMigrated}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Migrate
              </button>
            )}
          </div>
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
    </>
  );
}
