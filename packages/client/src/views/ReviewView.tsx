/**
 * ReviewView
 *
 * Phase 1 (Proactive Squickr — Review Screen): Assembles the full review
 * screen from its sub-components. Reads the period from the `?period` query
 * parameter (defaults to "weekly"), delegates data fetching to `useReviewData`,
 * and uses the collection map returned by the hook for ReviewCompletedSection.
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewData } from '../hooks/useReviewData';
import { ReviewHeader } from '../components/ReviewHeader';
import { ReviewCompletedSection } from '../components/ReviewCompletedSection';
import { ReviewStalledSection } from '../components/ReviewStalledSection';
import { ReviewHabitSection } from '../components/ReviewHabitSection';
import { ROUTES } from '../routes';
import type { ReviewPeriod } from '../utils/reviewDateRange';

export function ReviewView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = (searchParams.get('period') as ReviewPeriod) ?? 'weekly';

  const { completedEntries, stalledTasks, collectionMap, habits, dateRange, isLoading } = useReviewData(period);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="review-view">
      <ReviewHeader
        period={period}
        dateRange={dateRange}
        onPeriodChange={p => setSearchParams({ period: p })}
        onBack={() => navigate(ROUTES.index)}
      />
      {isLoading ? (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-gray-600 dark:text-gray-400 text-lg">
            Loading...
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          <ReviewCompletedSection
            entries={completedEntries}
            collectionMap={collectionMap}
            period={period}
          />
          <ReviewStalledSection stalledTasks={stalledTasks} />
          <ReviewHabitSection habits={habits} />
        </div>
      )}
    </div>
  );
}
