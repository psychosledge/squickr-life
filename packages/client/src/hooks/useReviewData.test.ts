/**
 * useReviewData Hook Tests
 *
 * Tests for the review data hook that fetches completed entries and stalled tasks
 * for the Review screen (Proactive Squickr).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReviewData } from './useReviewData';
import { getDateRange } from '../utils/reviewDateRange';

// ── Mock useApp ──────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}));

import { useApp } from '../context/AppContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntryProjection(overrides: Partial<{
  getCompletedInRange: ReturnType<typeof vi.fn>;
  getStalledMonthlyTasks: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getCompletedInRange: vi.fn().mockResolvedValue([]),
    getStalledMonthlyTasks: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function makeHabitProjection(overrides: Partial<{
  getActiveHabits: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getActiveHabits: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function makeCollectionProjection(overrides: Partial<{
  getCollections: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getCollections: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function setupMocks(
  entryProjectionOverrides: Parameters<typeof makeEntryProjection>[0] = {},
  collectionProjectionOverrides: Parameters<typeof makeCollectionProjection>[0] = {},
  habitProjectionOverrides: Parameters<typeof makeHabitProjection>[0] = {},
) {
  const entryProjection = makeEntryProjection(entryProjectionOverrides);
  const habitProjection = makeHabitProjection(habitProjectionOverrides);
  const collectionProjection = makeCollectionProjection(collectionProjectionOverrides);

  vi.mocked(useApp).mockReturnValue({
    entryProjection: entryProjection as any,
    habitProjection: habitProjection as any,
    collectionProjection: collectionProjection as any,
    eventStore: {} as any,
    createCollectionHandler: {} as any,
    restoreCollectionHandler: {} as any,
    reorderCollectionHandler: undefined,
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
    userPreferences: {} as any,
    isAppReady: true,
    createHabitHandler: {} as any,
    updateHabitTitleHandler: {} as any,
    updateHabitFrequencyHandler: {} as any,
    completeHabitHandler: {} as any,
    revertHabitCompletionHandler: {} as any,
    archiveHabitHandler: {} as any,
    restoreHabitHandler: {} as any,
    reorderHabitHandler: {} as any,
  });

  return { entryProjection, habitProjection, collectionProjection };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useReviewData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isLoading: true initially', () => {
    // Arrange: projection never resolves (pending Promise)
    setupMocks({
      getCompletedInRange: vi.fn().mockReturnValue(new Promise(() => {})),
      getStalledMonthlyTasks: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));

    // Assert — synchronous, before any microtasks settle
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isLoading: false after load completes', async () => {
    // Arrange
    setupMocks();

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns completed entries from entryProjection', async () => {
    // Arrange
    const completedEntries = [
      { id: 'task-1', type: 'task', content: 'Done task', status: 'completed', completedAt: '2026-03-15T10:00:00Z', order: 'a0', createdAt: '2026-03-14T10:00:00Z', collections: [] },
    ];
    setupMocks({
      getCompletedInRange: vi.fn().mockResolvedValue(completedEntries),
    });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.completedEntries).toEqual(completedEntries);
  });

  it('returns stalled tasks from entryProjection', async () => {
    // Arrange
    const stalledTasks = [
      {
        entry: { id: 'task-2', type: 'task', content: 'Stalled task', status: 'active', order: 'a0', createdAt: '2026-01-01T00:00:00Z', collections: ['col-1'] },
        collectionId: 'col-1',
        collectionName: 'January 2026',
        lastEventAt: '2026-01-05T00:00:00Z',
        staleDays: 74,
      },
    ];
    setupMocks({
      getStalledMonthlyTasks: vi.fn().mockResolvedValue(stalledTasks),
    });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.stalledTasks).toEqual(stalledTasks);
  });

  it('returns collectionMap built from collectionProjection', async () => {
    // Arrange
    const collections = [
      { id: 'col-1', name: 'January 2026', type: 'monthly' as const, order: 'a0', createdAt: '' },
      { id: 'col-2', name: 'February 2026', type: 'monthly' as const, order: 'a1', createdAt: '' },
    ];
    setupMocks({}, { getCollections: vi.fn().mockResolvedValue(collections) });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(result.current.collectionMap).toBeInstanceOf(Map);
    expect(result.current.collectionMap.get('col-1')?.name).toBe('January 2026');
    expect(result.current.collectionMap.get('col-2')?.name).toBe('February 2026');
  });

  it('passes correct weekly date range to getCompletedInRange', async () => {
    // Arrange
    const { entryProjection } = setupMocks();
    const weekRange = getDateRange('weekly');

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert — check that getCompletedInRange was called with dates matching the weekly range
    expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(1);
    const [calledFrom, calledTo] = entryProjection.getCompletedInRange.mock.calls[0] as [Date, Date];
    // Compare day-level precision (date strings) — dateRange is computed via useMemo
    expect(calledFrom.toDateString()).toBe(weekRange.from.toDateString());
    expect(calledTo.toDateString()).toBe(weekRange.to.toDateString());
  });

  it('passes correct monthly date range to getCompletedInRange', async () => {
    // Arrange
    const { entryProjection } = setupMocks();
    const monthRange = getDateRange('monthly');

    // Act
    const { result } = renderHook(() => useReviewData('monthly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(1);
    const [calledFrom, calledTo] = entryProjection.getCompletedInRange.mock.calls[0] as [Date, Date];
    expect(calledFrom.toDateString()).toBe(monthRange.from.toDateString());
    expect(calledTo.toDateString()).toBe(monthRange.to.toDateString());
  });

  it('passes olderThanDays=14 to getStalledMonthlyTasks', async () => {
    // Arrange
    const { entryProjection } = setupMocks();

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(entryProjection.getStalledMonthlyTasks).toHaveBeenCalledTimes(1);
    const [olderThanDays] = entryProjection.getStalledMonthlyTasks.mock.calls[0] as [number, unknown];
    expect(olderThanDays).toBe(14);
  });

  it('re-fetches when period changes from weekly to monthly', async () => {
    // Arrange
    const { entryProjection } = setupMocks();
    const { result, rerender } = renderHook(
      ({ period }: { period: 'weekly' | 'monthly' }) => useReviewData(period),
      { initialProps: { period: 'weekly' } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(1);

    // Act — change period
    rerender({ period: 'monthly' });

    // Assert — fetched again
    await waitFor(() => {
      expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(2);
    });
    // Verify the second call used monthly range
    const monthRange = getDateRange('monthly');
    const [calledFrom, calledTo] = entryProjection.getCompletedInRange.mock.calls[1] as [Date, Date];
    expect(calledFrom.toDateString()).toBe(monthRange.from.toDateString());
    expect(calledTo.toDateString()).toBe(monthRange.to.toDateString());
  });

  it('re-fetches when entryProjection notifies subscribers', async () => {
    // Arrange: capture the subscriber callback so we can invoke it
    let subscriberCallback: (() => void) | null = null;
    const { entryProjection } = setupMocks({
      subscribe: vi.fn().mockImplementation((cb: () => void) => {
        subscriberCallback = cb;
        return () => { subscriberCallback = null; };
      }),
    });

    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(1);

    // Act — projection notifies subscribers
    act(() => {
      subscriberCallback!();
    });

    // Assert — fetched again
    await waitFor(() => {
      expect(entryProjection.getCompletedInRange).toHaveBeenCalledTimes(2);
    });
  });

  it('unsubscribes from both entryProjection and habitProjection on unmount', async () => {
    // Arrange
    const mockEntryUnsubscribe = vi.fn();
    const mockHabitUnsubscribe = vi.fn();
    setupMocks(
      { subscribe: vi.fn().mockReturnValue(mockEntryUnsubscribe) },
      {},
      { subscribe: vi.fn().mockReturnValue(mockHabitUnsubscribe) },
    );

    // Act
    const { result, unmount } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    // Assert — both subscriptions cleaned up
    expect(mockEntryUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockHabitUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns active habits from habitProjection', async () => {
    // Arrange
    const habits = [
      {
        id: 'habit-1',
        title: 'Morning Run',
        frequency: { type: 'daily' as const },
        currentStreak: 3,
        longestStreak: 7,
        history: [],
        isScheduledToday: true,
        isCompletedToday: false,
        order: '2026-01-01T00:00:00.000Z',
      },
    ];
    setupMocks({}, {}, { getActiveHabits: vi.fn().mockResolvedValue(habits) });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(result.current.habits).toEqual(habits);
  });

  it('returns empty habits array when no active habits', async () => {
    // Arrange
    setupMocks({}, {}, { getActiveHabits: vi.fn().mockResolvedValue([]) });

    // Act
    const { result } = renderHook(() => useReviewData('weekly'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(result.current.habits).toEqual([]);
  });
});
