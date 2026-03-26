/**
 * useHabitsForDate Hook Tests
 *
 * Tests for the hook that fetches habits scheduled for a specific date,
 * subscribing to entryProjection for reactive updates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useHabitsForDate } from './useHabitsForDate';

// ── Mock useApp ──────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}));

import { useApp } from '../context/AppContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntryProjection(overrides: Partial<{
  getHabitsForDate: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getHabitsForDate: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function setupMocks(
  entryProjectionOverrides: Parameters<typeof makeEntryProjection>[0] = {},
) {
  const entryProjection = makeEntryProjection(entryProjectionOverrides);

  vi.mocked(useApp).mockReturnValue({
    entryProjection: entryProjection as any,
    collectionProjection: {} as any,
    eventStore: {} as any,
    taskProjection: {} as any,
    createCollectionHandler: {} as any,
    migrateTaskHandler: {} as any,
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
    createHabitHandler: {} as any,
    updateHabitTitleHandler: {} as any,
    updateHabitFrequencyHandler: {} as any,
    completeHabitHandler: {} as any,
    revertHabitCompletionHandler: {} as any,
    archiveHabitHandler: {} as any,
    restoreHabitHandler: {} as any,
    reorderHabitHandler: {} as any,
    userPreferences: {} as any,
    isAppReady: true,
  });

  return { entryProjection };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useHabitsForDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isLoading: true initially', () => {
    // Arrange: projection never resolves (pending Promise)
    setupMocks({
      getHabitsForDate: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    // Act
    const { result } = renderHook(() => useHabitsForDate('2026-03-20'));

    // Assert — synchronous, before any microtasks settle
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isLoading: false after load completes', async () => {
    // Arrange
    setupMocks();

    // Act
    const { result } = renderHook(() => useHabitsForDate('2026-03-20'));

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns habits from entryProjection.getHabitsForDate', async () => {
    // Arrange
    const habits = [
      {
        id: 'habit-1',
        title: 'Morning run',
        frequency: { type: 'daily' as const },
        currentStreak: 3,
        longestStreak: 10,
        history: [],
        isScheduledToday: true,
        isCompletedToday: false,
        order: 'a0',
      },
    ];
    setupMocks({
      getHabitsForDate: vi.fn().mockResolvedValue(habits),
    });

    // Act
    const { result } = renderHook(() => useHabitsForDate('2026-03-20'));

    // Assert
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.habits).toEqual(habits);
  });

  it('calls getHabitsForDate with the provided date', async () => {
    // Arrange
    const { entryProjection } = setupMocks();

    // Act
    const { result } = renderHook(() => useHabitsForDate('2026-03-15'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(entryProjection.getHabitsForDate).toHaveBeenCalledWith('2026-03-15', undefined);
  });

  it('forwards asOf option to getHabitsForDate', async () => {
    // Arrange
    const { entryProjection } = setupMocks();

    // Act
    const { result } = renderHook(() =>
      useHabitsForDate('2026-03-20', { asOf: '2026-03-15' }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(entryProjection.getHabitsForDate).toHaveBeenCalledWith(
      '2026-03-20',
      { asOf: '2026-03-15' },
    );
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

    const { result } = renderHook(() => useHabitsForDate('2026-03-20'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(entryProjection.getHabitsForDate).toHaveBeenCalledTimes(1);

    // Act — projection notifies subscribers
    act(() => {
      subscriberCallback!();
    });

    // Assert — fetched again
    await waitFor(() => {
      expect(entryProjection.getHabitsForDate).toHaveBeenCalledTimes(2);
    });
  });

  it('re-fetches when date prop changes', async () => {
    // Arrange
    const { entryProjection } = setupMocks();
    const { result, rerender } = renderHook(
      ({ date }: { date: string }) => useHabitsForDate(date),
      { initialProps: { date: '2026-03-20' } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(entryProjection.getHabitsForDate).toHaveBeenCalledTimes(1);

    // Act — change date
    rerender({ date: '2026-03-19' });

    // Assert — fetched again with new date
    await waitFor(() => {
      expect(entryProjection.getHabitsForDate).toHaveBeenCalledTimes(2);
    });
    expect(entryProjection.getHabitsForDate).toHaveBeenCalledWith('2026-03-19', undefined);
  });

  it('unsubscribes from entryProjection on unmount', async () => {
    // Arrange
    const mockUnsubscribe = vi.fn();
    setupMocks({
      subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
    });

    // Act
    const { result, unmount } = renderHook(() => useHabitsForDate('2026-03-20'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    // Assert
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns empty habits and isLoading: false immediately when date is empty string', async () => {
    // Arrange
    const { entryProjection } = setupMocks();

    // Act
    const { result } = renderHook(() => useHabitsForDate(''));

    // Assert — should settle without calling getHabitsForDate
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.habits).toEqual([]);
    expect(entryProjection.getHabitsForDate).not.toHaveBeenCalled();
  });
});
