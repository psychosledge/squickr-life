interface MigrationBannerProps {
  count: number;
  collectionName: string;
  onDismiss: () => void;
}

/**
 * MigrationBanner Component
 *
 * An inline info banner shown at the top of a collection when the user has
 * just migrated tasks here from another collection. Appears between the
 * CollectionHeader and the entry list, and persists until dismissed.
 *
 * Styled with blue/info tones to distinguish it from the red ErrorToast.
 */
export function MigrationBanner({ count, collectionName, onDismiss }: MigrationBannerProps) {
  const taskWord = count === 1 ? 'task' : 'tasks';
  const message = `${count} ${taskWord} migrated here from ${collectionName}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        flex items-center gap-3
        px-4 py-3 mx-4 mt-2
        rounded-lg
        bg-blue-50 dark:bg-blue-900/30
        border border-blue-200 dark:border-blue-700
        text-blue-800 dark:text-blue-200
        text-sm
        max-w-2xl
      "
    >
      {/* Info icon */}
      <svg
        className="w-5 h-5 shrink-0 text-blue-500 dark:text-blue-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z"
        />
      </svg>

      {/* Message */}
      <span className="flex-1">{message}</span>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss migration notice"
        className="
          shrink-0
          p-1 -mr-1
          rounded
          hover:bg-blue-100 dark:hover:bg-blue-800
          focus:outline-none focus:ring-2 focus:ring-blue-400
          transition-colors
        "
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
