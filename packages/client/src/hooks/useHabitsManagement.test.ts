/**
 * useHabitsManagement Hook Tests
 *
 * Verifies that each of the 8 habit wrapper functions delegates to the
 * correct AppContext handler's `.handle()` method with the expected command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHabitsManagement } from './useHabitsManagement';

// ── Mock useApp ──────────────────────────────────────────────────────────────

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}));

import { useApp } from '../context/AppContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks() {
  const createHabitHandler = { handle: vi.fn().mockResolvedValue('habit-1') };
  const updateHabitTitleHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const updateHabitFrequencyHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const completeHabitHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const revertHabitCompletionHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const archiveHabitHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const restoreHabitHandler = { handle: vi.fn().mockResolvedValue(undefined) };
  const reorderHabitHandler = { handle: vi.fn().mockResolvedValue(undefined) };

  vi.mocked(useApp).mockReturnValue({
    eventStore: {} as any,
    entryProjection: {} as any,
    collectionProjection: {} as any,
    createCollectionHandler: {} as any,
    reorderCollectionHandler: undefined,
    restoreCollectionHandler: {} as any,
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
    createHabitHandler: createHabitHandler as any,
    updateHabitTitleHandler: updateHabitTitleHandler as any,
    updateHabitFrequencyHandler: updateHabitFrequencyHandler as any,
    completeHabitHandler: completeHabitHandler as any,
    revertHabitCompletionHandler: revertHabitCompletionHandler as any,
    archiveHabitHandler: archiveHabitHandler as any,
    restoreHabitHandler: restoreHabitHandler as any,
    reorderHabitHandler: reorderHabitHandler as any,
  });

  return {
    createHabitHandler,
    updateHabitTitleHandler,
    updateHabitFrequencyHandler,
    completeHabitHandler,
    revertHabitCompletionHandler,
    archiveHabitHandler,
    restoreHabitHandler,
    reorderHabitHandler,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useHabitsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createHabit calls createHabitHandler.handle with correct command', async () => {
    // Arrange
    const { createHabitHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { title: 'Exercise', frequency: { type: 'daily' as const }, order: 'a0' };

    // Act
    await result.current.createHabit(cmd);

    // Assert
    expect(createHabitHandler.handle).toHaveBeenCalledTimes(1);
    expect(createHabitHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('updateHabitTitle calls updateHabitTitleHandler.handle with correct command', async () => {
    // Arrange
    const { updateHabitTitleHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1', title: 'Morning Run' };

    // Act
    await result.current.updateHabitTitle(cmd);

    // Assert
    expect(updateHabitTitleHandler.handle).toHaveBeenCalledTimes(1);
    expect(updateHabitTitleHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('updateHabitFrequency calls updateHabitFrequencyHandler.handle with correct command', async () => {
    // Arrange
    const { updateHabitFrequencyHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1', frequency: { type: 'weekly' as const, targetDays: [1, 3, 5] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> } };

    // Act
    await result.current.updateHabitFrequency(cmd);

    // Assert
    expect(updateHabitFrequencyHandler.handle).toHaveBeenCalledTimes(1);
    expect(updateHabitFrequencyHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('completeHabit calls completeHabitHandler.handle with correct command', async () => {
    // Arrange
    const { completeHabitHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1', date: '2026-03-20', collectionId: 'col-1' };

    // Act
    await result.current.completeHabit(cmd);

    // Assert
    expect(completeHabitHandler.handle).toHaveBeenCalledTimes(1);
    expect(completeHabitHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('revertHabitCompletion calls revertHabitCompletionHandler.handle with correct command', async () => {
    // Arrange
    const { revertHabitCompletionHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1', date: '2026-03-20' };

    // Act
    await result.current.revertHabitCompletion(cmd);

    // Assert
    expect(revertHabitCompletionHandler.handle).toHaveBeenCalledTimes(1);
    expect(revertHabitCompletionHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('archiveHabit calls archiveHabitHandler.handle with correct command', async () => {
    // Arrange
    const { archiveHabitHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1' };

    // Act
    await result.current.archiveHabit(cmd);

    // Assert
    expect(archiveHabitHandler.handle).toHaveBeenCalledTimes(1);
    expect(archiveHabitHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('restoreHabit calls restoreHabitHandler.handle with correct command', async () => {
    // Arrange
    const { restoreHabitHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1' };

    // Act
    await result.current.restoreHabit(cmd);

    // Assert
    expect(restoreHabitHandler.handle).toHaveBeenCalledTimes(1);
    expect(restoreHabitHandler.handle).toHaveBeenCalledWith(cmd);
  });

  it('reorderHabit calls reorderHabitHandler.handle with correct command', async () => {
    // Arrange
    const { reorderHabitHandler } = setupMocks();
    const { result } = renderHook(() => useHabitsManagement());
    const cmd = { habitId: 'habit-1', order: 'b0' };

    // Act
    await result.current.reorderHabit(cmd);

    // Assert
    expect(reorderHabitHandler.handle).toHaveBeenCalledTimes(1);
    expect(reorderHabitHandler.handle).toHaveBeenCalledWith(cmd);
  });
});
