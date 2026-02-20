import { useEffect } from 'react';

const AUTO_DISMISS_MS = 5000;

interface ErrorToastProps {
  message: string;
  onDismiss: () => void;
}

/**
 * ErrorToast Component
 *
 * A fixed-position banner that displays an error message and auto-dismisses
 * after a few seconds. The user can also dismiss it manually.
 *
 * Styling matches the existing dark-mode Tailwind conventions used elsewhere
 * in the app (e.g. red-600/red-400 for errors, gray-800 backgrounds in dark mode).
 */
export function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="
        fixed bottom-24 left-1/2 -translate-x-1/2
        z-50
        flex items-center gap-3
        px-4 py-3
        rounded-lg shadow-lg
        bg-red-600 dark:bg-red-700
        text-white
        text-sm
        max-w-sm w-full mx-4
      "
    >
      {/* Error icon */}
      <svg
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>

      {/* Message */}
      <span className="flex-1">{message}</span>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="
          shrink-0
          p-1 -mr-1
          rounded
          hover:bg-red-500 dark:hover:bg-red-600
          focus:outline-none focus:ring-2 focus:ring-white
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
