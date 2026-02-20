/**
 * KeyboardShortcutsModal
 *
 * A modal displaying a table of keyboard shortcuts for Squickr Life.
 * Part of the v1.0.0 Intro Guide feature (Commit 2).
 */

import { useEffect, useRef } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { action: 'Navigate to next collection', shortcut: 'Arrow Right' },
  { action: 'Navigate to previous collection', shortcut: 'Arrow Left' },
  { action: 'Close modal / Go back', shortcut: 'Escape' },
  { action: 'Submit entry', shortcut: 'Enter' },
] as const;

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus the close button when modal opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-heading"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="keyboard-shortcuts-heading"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="
              text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
              rounded-md p-1
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-colors
            "
          >
            ×
          </button>
        </div>

        {/* Shortcuts table */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">
                  Action
                </th>
                <th className="text-left py-2 font-semibold text-gray-900 dark:text-white">
                  Shortcut
                </th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map(({ action, shortcut }) => (
                <tr
                  key={action}
                  className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{action}</td>
                  <td className="py-2">
                    <kbd className="
                      px-2 py-0.5
                      bg-gray-100 dark:bg-gray-700
                      border border-gray-300 dark:border-gray-600
                      rounded text-xs font-mono
                      text-gray-700 dark:text-gray-300
                    ">
                      {shortcut}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
