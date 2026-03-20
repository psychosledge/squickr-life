/**
 * ReviewView Tests
 *
 * Phase 1 (Proactive Squickr — Review Screen): Tests for the assembled
 * ReviewView component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReviewView } from './ReviewView';
import { AppProvider } from '../context/AppContext';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

// ─── Mock useReviewData ────────────────────────────────────────────────────────

const mockUseReviewData = vi.fn();

vi.mock('../hooks/useReviewData', () => ({
  useReviewData: (...args: any[]) => mockUseReviewData(...args),
}));

// ─── Mock useApp (collectionProjection) ───────────────────────────────────────

const mockGetCollections = vi.fn();

vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual('../context/AppContext');
  return {
    ...actual,
    useApp: () => ({
      collectionProjection: {
        getCollections: mockGetCollections,
        subscribe: vi.fn().mockReturnValue(() => {}),
      },
      // Remaining context values (unused by ReviewView but required by AppContextValue)
      eventStore: {} as any,
      entryProjection: { subscribe: vi.fn().mockReturnValue(() => {}) } as any,
      taskProjection: {} as any,
      createCollectionHandler: {} as any,
      reorderCollectionHandler: {} as any,
      restoreCollectionHandler: {} as any,
      migrateTaskHandler: {} as any,
      addTaskToCollectionHandler: {} as any,
      removeTaskFromCollectionHandler: {} as any,
      moveTaskToCollectionHandler: {} as any,
      addNoteToCollectionHandler: {} as any,
      removeNoteFromCollectionHandler: {} as any,
      moveNoteToCollectionHandler: {} as any,
      addEventToCollectionHandler: {} as any,
      removeEventFromCollectionHandler: {} as any,
      moveEventToCollectionHandler: {} as any,
      bulkMigrateEntriesHandler: {} as any,
      restoreTaskHandler: {} as any,
      restoreNoteHandler: {} as any,
      restoreEventHandler: {} as any,
      userPreferences: DEFAULT_USER_PREFERENCES,
      isAppReady: true,
    }),
  };
});

// ─── Mock child components (so tests are isolated to ReviewView logic) ─────────

vi.mock('../components/ReviewHeader', () => ({
  ReviewHeader: ({
    period,
    onPeriodChange,
    onBack,
  }: {
    period: string;
    dateRange: { from: Date; to: Date };
    onPeriodChange: (p: 'weekly' | 'monthly') => void;
    onBack: () => void;
  }) => (
    <div data-testid="review-header" data-period={period}>
      <button onClick={onBack} data-testid="back-button">Back</button>
      <button onClick={() => onPeriodChange('weekly')} data-testid="toggle-weekly">Weekly</button>
      <button onClick={() => onPeriodChange('monthly')} data-testid="toggle-monthly">Monthly</button>
    </div>
  ),
}));

vi.mock('../components/ReviewCompletedSection', () => ({
  ReviewCompletedSection: ({ period }: { period: string; entries: any[]; collectionMap: Map<string, any> }) => (
    <div data-testid="review-completed-section" data-period={period} />
  ),
}));

vi.mock('../components/ReviewStalledSection', () => ({
  ReviewStalledSection: () => <div data-testid="review-stalled-section" />,
}));

vi.mock('../components/ReviewHabitSection', () => ({
  ReviewHabitSection: () => <div data-testid="review-habit-section" />,
}));

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const defaultDateRange = {
  from: new Date('2026-03-14T00:00:00Z'),
  to: new Date('2026-03-20T23:59:59Z'),
};

const defaultReviewData = {
  completedEntries: [],
  stalledTasks: [],
  period: 'weekly' as const,
  dateRange: defaultDateRange,
  isLoading: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderReviewView(initialPath = '/review') {
  const mockAppContext = {
    eventStore: {} as any,
    entryProjection: { subscribe: vi.fn().mockReturnValue(() => {}) } as any,
    taskProjection: {} as any,
    collectionProjection: {
      getCollections: mockGetCollections,
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as any,
    createCollectionHandler: {} as any,
    restoreCollectionHandler: {} as any,
    migrateTaskHandler: {} as any,
    addTaskToCollectionHandler: {} as any,
    removeTaskFromCollectionHandler: {} as any,
    moveTaskToCollectionHandler: {} as any,
    addNoteToCollectionHandler: {} as any,
    removeNoteFromCollectionHandler: {} as any,
    moveNoteToCollectionHandler: {} as any,
    addEventToCollectionHandler: {} as any,
    removeEventFromCollectionHandler: {} as any,
    moveEventToCollectionHandler: {} as any,
    bulkMigrateEntriesHandler: {} as any,
    restoreTaskHandler: {} as any,
    restoreNoteHandler: {} as any,
    restoreEventHandler: {} as any,
    userPreferences: DEFAULT_USER_PREFERENCES,
    isAppReady: true,
  };

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppProvider value={mockAppContext}>
        <Routes>
          <Route path="/review" element={<ReviewView />} />
          <Route path="/" element={<div data-testid="index-page">Home</div>} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewView', () => {
  beforeEach(() => {
    mockGetCollections.mockResolvedValue([]);
    mockUseReviewData.mockReturnValue(defaultReviewData);
  });

  it('renders with data-testid="review-view"', () => {
    renderReviewView();
    expect(screen.getByTestId('review-view')).toBeInTheDocument();
  });

  it('renders ReviewHeader', () => {
    renderReviewView();
    expect(screen.getByTestId('review-header')).toBeInTheDocument();
  });

  it('renders loading state while data is loading', () => {
    mockUseReviewData.mockReturnValue({ ...defaultReviewData, isLoading: true });
    renderReviewView();

    expect(screen.getByTestId('review-view')).toBeInTheDocument();
    // Sections should NOT be rendered during loading
    expect(screen.queryByTestId('review-completed-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-stalled-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-habit-section')).not.toBeInTheDocument();
  });

  it('renders ReviewCompletedSection when not loading', () => {
    renderReviewView();
    expect(screen.getByTestId('review-completed-section')).toBeInTheDocument();
  });

  it('renders ReviewStalledSection when not loading', () => {
    renderReviewView();
    expect(screen.getByTestId('review-stalled-section')).toBeInTheDocument();
  });

  it('renders ReviewHabitSection when not loading', () => {
    renderReviewView();
    expect(screen.getByTestId('review-habit-section')).toBeInTheDocument();
  });

  it('defaults to "weekly" period when no query param', () => {
    renderReviewView('/review');
    expect(mockUseReviewData).toHaveBeenCalledWith('weekly');
  });

  it('reads "monthly" period from ?period=monthly query param', () => {
    renderReviewView('/review?period=monthly');
    expect(mockUseReviewData).toHaveBeenCalledWith('monthly');
  });

  it('navigates to / when back button is pressed', async () => {
    const user = userEvent.setup();
    renderReviewView();

    const backButton = screen.getByTestId('back-button');
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByTestId('index-page')).toBeInTheDocument();
    });
  });

  it('calls setSearchParams when period toggle is changed', async () => {
    const user = userEvent.setup();
    renderReviewView('/review');

    const monthlyButton = screen.getByTestId('toggle-monthly');
    await user.click(monthlyButton);

    // After toggling to monthly, useReviewData should be called with 'monthly'
    await waitFor(() => {
      expect(mockUseReviewData).toHaveBeenCalledWith('monthly');
    });
  });

  it('passes the correct period to ReviewCompletedSection', () => {
    mockUseReviewData.mockReturnValue({ ...defaultReviewData, period: 'weekly' });
    renderReviewView('/review');

    const section = screen.getByTestId('review-completed-section');
    expect(section).toHaveAttribute('data-period', 'weekly');
  });

  it('passes the correct period to ReviewHeader', () => {
    renderReviewView('/review');

    const header = screen.getByTestId('review-header');
    expect(header).toHaveAttribute('data-period', 'weekly');
  });

  it('passes "monthly" period to ReviewHeader when ?period=monthly', () => {
    mockUseReviewData.mockReturnValue({ ...defaultReviewData, period: 'monthly' });
    renderReviewView('/review?period=monthly');

    const header = screen.getByTestId('review-header');
    expect(header).toHaveAttribute('data-period', 'monthly');
  });

  it('calls getCollections from collectionProjection on mount', async () => {
    renderReviewView();

    await waitFor(() => {
      expect(mockGetCollections).toHaveBeenCalled();
    });
  });

  it('shows loading indicator (not the sections) while isLoading is true', () => {
    mockUseReviewData.mockReturnValue({ ...defaultReviewData, isLoading: true });
    renderReviewView();

    // The header should still be visible during loading
    expect(screen.getByTestId('review-header')).toBeInTheDocument();
    // Sections should be hidden
    expect(screen.queryByTestId('review-completed-section')).not.toBeInTheDocument();
  });

  it('shows all three sections once loading is complete', () => {
    mockUseReviewData.mockReturnValue({ ...defaultReviewData, isLoading: false });
    renderReviewView();

    expect(screen.getByTestId('review-completed-section')).toBeInTheDocument();
    expect(screen.getByTestId('review-stalled-section')).toBeInTheDocument();
    expect(screen.getByTestId('review-habit-section')).toBeInTheDocument();
  });
});
