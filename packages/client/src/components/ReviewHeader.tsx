/**
 * ReviewHeader Component
 *
 * Phase 1 (Proactive Squickr — Review Screen): Header for the Review view.
 * Shows a back button, "Review" title, formatted date range, and
 * a Weekly / Monthly period toggle.
 */

interface ReviewHeaderProps {
  period: 'weekly' | 'monthly';
  dateRange: { from: Date; to: Date };
  onPeriodChange: (period: 'weekly' | 'monthly') => void;
  onBack: () => void;
}

// ─── Date formatting helpers ──────────────────────────────────────────────────

/**
 * Format a date range for the given period.
 *
 * - weekly  →  "Mar 17 – Mar 23"
 * - monthly →  "March 2026"
 */
function formatDateRange(
  period: 'weekly' | 'monthly',
  from: Date,
  to: Date
): string {
  if (period === 'monthly') {
    return from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const fmtShort = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return `${fmtShort(from)} \u2013 ${fmtShort(to)}`; // en-dash
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewHeader({
  period,
  dateRange,
  onPeriodChange,
  onBack,
}: ReviewHeaderProps) {
  const formattedRange = formatDateRange(period, dateRange.from, dateRange.to);

  const handlePeriodClick = (next: 'weekly' | 'monthly') => {
    if (next !== period) {
      onPeriodChange(next);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">

        {/* Left: Back button */}
        <button
          onClick={onBack}
          type="button"
          aria-label="Back"
          className="
            p-2 -ml-2
            text-gray-600 dark:text-gray-400
            hover:text-gray-900 dark:hover:text-white
            hover:bg-gray-100 dark:hover:bg-gray-700
            rounded-lg
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500
            flex-shrink-0
          "
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Centre: Title + date range */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
            Review
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {formattedRange}
          </span>
        </div>

        {/* Right: Period toggle */}
        <div
          className="
            flex
            bg-gray-100 dark:bg-gray-700
            rounded-lg
            p-0.5
            flex-shrink-0
          "
          role="group"
          aria-label="Period"
        >
          {(['weekly', 'monthly'] as const).map((p) => {
            const isActive = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodClick(p)}
                aria-pressed={isActive}
                className={`
                  px-3 py-1
                  text-sm font-medium
                  rounded-md
                  transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                {p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
