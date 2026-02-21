/**
 * BulletJournalGuideModal
 *
 * A static-content modal explaining bullet journaling concepts.
 * Part of the v1.0.0 Intro Guide feature (Commit 2).
 */

import { useEffect, useRef } from 'react';
import { ENTRY_ICONS } from '../utils/constants';

interface BulletJournalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulletJournalGuideModal({ isOpen, onClose }: BulletJournalGuideModalProps) {
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
        aria-labelledby="bujo-guide-heading"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="bujo-guide-heading"
            className="text-xl font-bold text-gray-900 dark:text-white"
          >
            Bullet Journal Guide
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

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 text-sm text-gray-700 dark:text-gray-300">
          {/* What is Bullet Journaling? */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              What is Bullet Journaling?
            </h3>
            <p>
              A system invented by Ryder Carroll for capturing and organizing thoughts.
            </p>
          </section>

          {/* The Three Entry Types */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              The Three Entry Types
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400">
                  <th className="pr-3 font-normal text-left w-12">App</th>
                  <th className="pr-3 font-normal text-left w-12">BuJo</th>
                  <th className="pr-3 font-normal text-left w-16">Type</th>
                  <th className="font-normal text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-3 font-mono w-12" data-testid="entry-type-task-icon">{ENTRY_ICONS.TASK_OPEN}</td>
                  <td className="pr-3 font-mono w-12 text-gray-400">•</td>
                  <td className="pr-3 font-semibold w-16">Task</td>
                  <td>Something to do</td>
                </tr>
                <tr>
                  <td className="pr-3 font-mono">{ENTRY_ICONS.NOTE}</td>
                  <td className="pr-3 font-mono text-gray-400">–</td>
                  <td className="pr-3 font-semibold">Note</td>
                  <td>Something to record</td>
                </tr>
                <tr>
                  <td className="pr-3 font-mono">{ENTRY_ICONS.EVENT}</td>
                  <td className="pr-3 font-mono text-gray-400">○</td>
                  <td className="pr-3 font-semibold">Event</td>
                  <td>Something happening</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* The Bullet States */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              The Bullet States
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400">
                  <th className="pr-3 font-normal text-left w-12">App</th>
                  <th className="font-normal text-left">Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-3 font-mono w-12" data-testid="bullet-state-open-icon">{ENTRY_ICONS.TASK_OPEN}</td>
                  <td>Open task</td>
                </tr>
                <tr>
                  <td className="pr-3 font-mono" data-testid="bullet-state-completed-icon">{ENTRY_ICONS.TASK_COMPLETED}</td>
                  <td>Completed task</td>
                </tr>
                <tr data-testid="bullet-state-migrated-row">
                  <td className="pr-3 font-mono">{ENTRY_ICONS.MIGRATED}</td>
                  <td>Migrated task — use the migrate action to move to another collection</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Collections (Pages) */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Collections (Pages)
            </h3>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="pr-3 font-semibold w-32">Daily Logs</td>
                  <td>Day-by-day entries</td>
                </tr>
                <tr>
                  <td className="pr-3 font-semibold">Monthly Logs</td>
                  <td>Month-level planning</td>
                </tr>
                <tr>
                  <td className="pr-3 font-semibold">Custom</td>
                  <td>Projects, habits, anything</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* The Migration Practice */}
          <section>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              The Migration Practice
            </h3>
            <p>
              At the end of each day/week, review unfinished tasks.
              Migrate them forward to keep your journal active.
            </p>
          </section>

          {/* Learn More */}
          <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p>
              Learn More:{' '}
              <a
                href="https://bulletjournal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                bulletjournal.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
