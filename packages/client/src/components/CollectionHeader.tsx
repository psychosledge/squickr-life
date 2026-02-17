/**
 * Collection Header Component
 * 
 * Displays collection name with back button and menu for rename/delete actions.
 * Phase 2C: Collection Detail View
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import { useCollectionNavigation } from '../hooks/useCollectionNavigation';
import { CollectionNavigationControls } from './CollectionNavigationControls';
import { ENTRY_ICONS } from '../utils/constants';

interface CollectionHeaderProps {
  collectionName: string;
  collectionId: string;
  onRename: () => void;
  onDelete: () => void;
  onSettings: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  isVirtual?: boolean;
  onEnterSelectionMode?: () => void;
}

export function CollectionHeader({
  collectionName,
  collectionId,
  onRename,
  onDelete,
  onSettings,
  onToggleFavorite,
  isFavorite = false,
  isVirtual = false,
  onEnterSelectionMode,
}: CollectionHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Collection navigation
  const {
    previousCollection,
    nextCollection,
    navigateToPrevious,
    navigateToNext,
  } = useCollectionNavigation(collectionId);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isMenuOpen]);

  const handleRename = () => {
    setIsMenuOpen(false);
    onRename();
  };

  const handleSettings = () => {
    setIsMenuOpen(false);
    onSettings();
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    onDelete();
  };

  const handleToggleFavorite = () => {
    setIsMenuOpen(false);
    onToggleFavorite?.();
  };

  const handleEnterSelectionMode = () => {
    setIsMenuOpen(false);
    onEnterSelectionMode?.();
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Back button + Navigation controls */}
        <div className="flex items-center gap-2">
          <Link
            to={ROUTES.index}
            className="
              p-2 -ml-2
              text-gray-600 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white
              hover:bg-gray-100 dark:hover:bg-gray-700
              rounded-lg
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            aria-label="Back to collections"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          
          {/* Navigation controls */}
          <CollectionNavigationControls
            previousCollection={previousCollection}
            nextCollection={nextCollection}
            onNavigatePrevious={navigateToPrevious}
            onNavigateNext={navigateToNext}
          />
        </div>

        {/* Center: Collection name (clickable, navigates to index) */}
        <Link
          to={ROUTES.index}
          className="
            text-xl font-semibold 
            text-gray-900 dark:text-white 
            hover:text-blue-600 dark:hover:text-blue-400
            mx-4 flex-1 text-center
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 rounded
            flex items-center justify-center gap-2
          "
        >
          {isFavorite && <span className="text-yellow-500">{ENTRY_ICONS.FAVORITE}</span>}
          {collectionName}
        </Link>

        {/* Right: Menu button (or spacer for virtual collections) */}
        {isVirtual ? (
          // Spacer for layout balance (same width as menu button)
          <div className="w-10" />
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="
                p-2 -mr-2
                text-gray-600 dark:text-gray-400
                hover:text-gray-900 dark:hover:text-white
                hover:bg-gray-100 dark:hover:bg-gray-700
                rounded-lg
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500
              "
              aria-label="Collection menu"
              type="button"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v.01M12 12v.01M12 18v.01M12 7a1 1 0 110-2 1 1 0 010 2zm0 6a1 1 0 110-2 1 1 0 010 2zm0 6a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {/* Dropdown menu */}
            {isMenuOpen && (
              <div
                className="
                  absolute right-0 mt-2
                  w-48
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  rounded-lg
                  shadow-lg
                  py-1
                  z-[200]
                "
              >
                {onEnterSelectionMode && (
                  <button
                    onClick={handleEnterSelectionMode}
                    className="
                      w-full px-4 py-2
                      text-left text-gray-700 dark:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors
                      focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                    "
                    type="button"
                  >
                    Select Entries
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    onClick={handleToggleFavorite}
                    className="
                      w-full px-4 py-2
                      text-left text-gray-700 dark:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      transition-colors
                      focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                    "
                    type="button"
                  >
                    {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  </button>
                )}
                <button
                  onClick={handleSettings}
                  className="
                    w-full px-4 py-2
                    text-left text-gray-700 dark:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors
                    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                  "
                  type="button"
                >
                  Settings
                </button>
                <button
                  onClick={handleRename}
                  className="
                    w-full px-4 py-2
                    text-left text-gray-700 dark:text-gray-300
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors
                    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                  "
                  type="button"
                >
                  Rename
                </button>
                <button
                  onClick={handleDelete}
                  className="
                    w-full px-4 py-2
                    text-left text-red-600 dark:text-red-400
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors
                    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                  "
                  type="button"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
