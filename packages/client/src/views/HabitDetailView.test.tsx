/**
 * HabitDetailView Tests
 *
 * Tests for the /habits/:habitId route showing habit detail + history grid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HabitDetailView } from './HabitDetailView';
import { AppProvider } from '../context/AppContext';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';
import type { HabitReadModel } from '@squickr/domain';

// ─── Mock useNavigate ─────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHabit(overrides: Partial<HabitReadModel> = {}): HabitReadModel {
  return {
    id: 'habit-1',
    title: 'Morning Run',
    frequency: { type: 'daily' },
    currentStreak: 5,
    longestStreak: 10,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildMockAppContext(habit: HabitReadModel | null = makeHabit()) {
  const mockEntryProjection = {
    getHabitById: vi.fn().mockResolvedValue(habit ?? undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };

  return {
    eventStore: { append: vi.fn(), getAll: vi.fn().mockResolvedValue([]), subscribe: vi.fn().mockReturnValue(() => {}) } as any,
    entryProjection: mockEntryProjection as any,
    taskProjection: {} as any,
    collectionProjection: {} as any,
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
    createHabitHandler: { handle: vi.fn() } as any,
    updateHabitTitleHandler: { handle: vi.fn() } as any,
    updateHabitFrequencyHandler: { handle: vi.fn() } as any,
    completeHabitHandler: { handle: vi.fn() } as any,
    revertHabitCompletionHandler: { handle: vi.fn() } as any,
    archiveHabitHandler: { handle: vi.fn() } as any,
    restoreHabitHandler: { handle: vi.fn() } as any,
    reorderHabitHandler: { handle: vi.fn() } as any,
  };
}

function renderView(habitId = 'habit-1', appContext = buildMockAppContext()) {
  return render(
    <MemoryRouter initialEntries={[`/habits/${habitId}`]}>
      <Routes>
        <Route
          path="/habits/:habitId"
          element={
            <AppProvider value={appContext}>
              <HabitDetailView />
            </AppProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HabitDetailView', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should display the habit title', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
  });

  it('should render back button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  it('should navigate to /habits when back button is clicked', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/habits');
  });

  it('should display current streak', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });
  });

  it('should render the HabitHistoryGrid column headers', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });
  });

  it('should show not-found message when habit does not exist', async () => {
    const appContext = buildMockAppContext(null);
    renderView('nonexistent', appContext);

    await waitFor(() => {
      expect(screen.getByText(/habit not found/i)).toBeInTheDocument();
    });
  });

  it('should display frequency type', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText(/daily/i)).toBeInTheDocument();
    });
  });
});
