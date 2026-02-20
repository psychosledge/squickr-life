/**
 * AboutModal
 *
 * A modal displaying app information, version, and GitHub links.
 * Part of the v1.0.0 Intro Guide feature (Commit 2).
 */

import { useEffect, useRef } from 'react';
import { GITHUB_URLS, getBugReportUrl } from '../constants/github';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
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
        aria-labelledby="about-modal-heading"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="about-modal-heading"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            About
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

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-sm text-gray-700 dark:text-gray-300">
          {/* App name + version */}
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">Squickr Life</p>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Version: v{__APP_VERSION__}
            </p>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          <p>A bullet journal app for getting things done.</p>
          <p>Built with React, TypeScript, and Event Sourcing.</p>

          <p>
            Data is stored locally in your browser (IndexedDB) and synced to the cloud when
            you're signed in.
          </p>

          {/* Links */}
          <div className="flex gap-3 pt-1">
            <a
              href={GITHUB_URLS.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex-1 text-center
                px-4 py-2
                bg-gray-100 dark:bg-gray-700
                hover:bg-gray-200 dark:hover:bg-gray-600
                text-gray-700 dark:text-gray-300
                rounded-lg
                transition-colors
                text-sm font-medium
              "
            >
              GitHub Repository
            </a>
            <a
              href={getBugReportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex-1 text-center
                px-4 py-2
                bg-gray-100 dark:bg-gray-700
                hover:bg-gray-200 dark:hover:bg-gray-600
                text-gray-700 dark:text-gray-300
                rounded-lg
                transition-colors
                text-sm font-medium
              "
            >
              Report an Issue
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
