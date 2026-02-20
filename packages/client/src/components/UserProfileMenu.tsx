/**
 * UserProfileMenu Component
 *
 * Displays user profile avatar with dropdown menu for user info and sign out.
 *
 * Features:
 * - Google profile picture or initials fallback
 * - Dropdown menu with user info, help items, and sign out
 * - Help section: Restart Tutorial, Bullet Journal Guide, Keyboard Shortcuts,
 *   Report a Bug, Request a Feature, GitHub Discussions, About Squickr Life
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
import { useTutorialContext } from '../context/TutorialContext';
import { GITHUB_URLS, getBugReportUrl } from '../constants/github';
import { BulletJournalGuideModal } from './BulletJournalGuideModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { AboutModal } from './AboutModal';

interface UserProfileMenuProps {
  user: User;
  onSignOut: () => Promise<void>;
  onSettingsClick: () => void;
}

export function UserProfileMenu({ user, onSignOut, onSettingsClick }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal open states
  const [isBujoGuideOpen, setIsBujoGuideOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const tutorial = useTutorialContext();

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

  const handleRestartTutorial = () => {
    tutorial.resetTutorial();
    setIsOpen(false);
  };

  const displayName = user.displayName || user.email || 'User';
  const initials = getInitials(user.displayName);

  /** Shared Tailwind classes for menu item buttons */
  const menuItemButtonClass = `
    w-full text-left
    px-3 py-2
    text-sm text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-gray-700
    rounded-md
    transition-colors
    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
    flex items-center gap-2
  `;

  /** Shared Tailwind classes for menu item links */
  const menuItemLinkClass = `
    block
    px-3 py-2
    text-sm text-gray-700 dark:text-gray-300
    hover:bg-gray-100 dark:hover:bg-gray-700
    rounded-md
    transition-colors
    focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700
    flex items-center gap-2
  `;

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

          {/* Settings */}
          <div className="px-2 py-1">
            <button
              role="menuitem"
              onClick={handleSettingsClick}
              className={menuItemButtonClass}
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          </div>

          {/* Help Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 px-2 pb-1">
            <button
              role="menuitem"
              onClick={handleRestartTutorial}
              className={menuItemButtonClass}
            >
              <span>🎓</span>
              <span>Restart Tutorial</span>
            </button>

            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); setIsBujoGuideOpen(true); }}
              className={menuItemButtonClass}
            >
              <span>📓</span>
              <span>Bullet Journal Guide</span>
            </button>

            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); setIsKeyboardShortcutsOpen(true); }}
              className={menuItemButtonClass}
            >
              <span>⌨️</span>
              <span>Keyboard Shortcuts</span>
            </button>

            <a
              href={getBugReportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={menuItemLinkClass}
            >
              <span>🐛</span>
              <span>Report a Bug</span>
            </a>

            <a
              href={GITHUB_URLS.featureRequest}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={menuItemLinkClass}
            >
              <span>💡</span>
              <span>Request a Feature</span>
            </a>

            <a
              href={GITHUB_URLS.discussions}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={menuItemLinkClass}
            >
              <span>💬</span>
              <span>GitHub Discussions</span>
            </a>

            <button
              role="menuitem"
              onClick={() => { setIsOpen(false); setIsAboutOpen(true); }}
              className={menuItemButtonClass}
            >
              <span>ℹ️</span>
              <span>About Squickr Life</span>
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 px-2 pb-1">
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

      {/* Modals rendered outside dropdown to avoid clipping */}
      <BulletJournalGuideModal
        isOpen={isBujoGuideOpen}
        onClose={() => setIsBujoGuideOpen(false)}
      />
      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsOpen}
        onClose={() => setIsKeyboardShortcutsOpen(false)}
      />
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}
