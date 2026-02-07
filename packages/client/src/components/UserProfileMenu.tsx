/**
 * UserProfileMenu Component
 * 
 * Displays user profile avatar with dropdown menu for user info and sign out.
 * 
 * Features:
 * - Google profile picture or initials fallback
 * - Dropdown menu with user info and sign out
 * - Click outside to close
 * - Escape key to close
 * - Full keyboard navigation
 * - Proper ARIA attributes
 * - Dark mode support
 * - Mobile responsive
 */

import { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { getInitials } from '../utils/userUtils';

interface UserProfileMenuProps {
  user: User;
  onSignOut: () => Promise<void>;
  onSettingsClick: () => void;
}

export function UserProfileMenu({ user, onSignOut, onSettingsClick }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    onSettingsClick();
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await onSignOut();
  };

  const displayName = user.displayName || user.email || 'User';
  const initials = getInitials(user.displayName);

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={handleToggle}
        className="
          w-10 h-10 sm:w-11 sm:h-11
          rounded-full
          border-2 border-gray-300 dark:border-gray-600
          overflow-hidden
          focus:outline-none focus:ring-2 focus:ring-blue-500
          hover:border-gray-400 dark:hover:border-gray-500
          transition-colors
        "
        aria-label="User menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="
            w-full h-full
            bg-gradient-to-br from-blue-500 to-purple-600
            flex items-center justify-center
            text-white font-semibold
            text-sm
          ">
            {initials}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="
            absolute right-0 mt-2
            w-64
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-lg
            shadow-lg
            py-2
            z-50
          "
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            {user.email && user.displayName && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                {user.email}
              </p>
            )}
          </div>

          {/* Menu Options */}
          <div className="px-2 py-1">
            <button
              role="menuitem"
              onClick={handleSettingsClick}
              className="
                w-full text-left
                px-3 py-2
                text-sm text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-700
                rounded-md
                transition-colors
                focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                flex items-center gap-2
              "
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <button
              role="menuitem"
              onClick={handleSignOut}
              className="
                w-full text-left
                px-3 py-2
                text-sm text-red-600 dark:text-red-400
                hover:bg-gray-100 dark:hover:bg-gray-700
                rounded-md
                transition-colors
                focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
                flex items-center gap-2
              "
            >
              <span>🚪</span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
