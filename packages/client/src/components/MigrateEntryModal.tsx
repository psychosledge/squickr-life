import { useState, useEffect } from 'react';
import type { Entry, Collection } from '@squickr/shared';
import { CreateCollectionModal } from './CreateCollectionModal';

interface MigrateEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: Entry | null;
  currentCollectionId?: string;
  collections: Collection[];
  onMigrate: (entryId: string, targetCollectionId: string | null) => Promise<void>;
  onCreateCollection?: (name: string) => Promise<void>;
  selectedCollectionId?: string;
  onOpenCreateCollection?: () => void;
}

const CREATE_NEW_OPTION = '__CREATE_NEW__';

/**
 * MigrateEntryModal Component
 * 
 * Allows user to migrate an entry to a different collection or create a new collection.
 * 
 * Features:
 * - Shows "+ Create New Collection" option at the top
 * - Shows all collections except current
 * - Includes "Uncategorized" option (null collection)
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
      const targetCollectionId = selectedOption === 'uncategorized' ? null : selectedOption;
      await onMigrate(entry.id, targetCollectionId);
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
    if (onCreateCollection) {
      try {
        await onCreateCollection(name);
        setShowCreateModal(false);
        // The parent component should update the collections list and set selectedCollectionId
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

            {/* Uncategorized option */}
            {currentCollectionId !== undefined && (
              <label
                className="flex items-center w-full text-left px-4 py-3 rounded border border-gray-200 dark:border-gray-700
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <input
                  type="radio"
                  name="collection-option"
                  value="uncategorized"
                  checked={selectedOption === 'uncategorized'}
                  onChange={() => setSelectedOption('uncategorized')}
                  disabled={isSubmitting || isAlreadyMigrated}
                  className="mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300">Uncategorized</span>
              </label>
            )}

            {/* Available collections */}
            {availableCollections.map(collection => (
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
                <span className="text-gray-900 dark:text-white">{collection.name}</span>
              </label>
            ))}

            {availableCollections.length === 0 && currentCollectionId === undefined && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No other collections available
              </p>
            )}
          </div>

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
