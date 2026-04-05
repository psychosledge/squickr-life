/**
 * HabitsView Tests
 *
 * Tests for the /habits management route.
 * Shows active habits, archived habits, and a FAB that opens CreateHabitModal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { HabitsView } from './HabitsView';
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
    currentStreak: 3,
    longestStreak: 7,
    history: [],
    isScheduledToday: true,
    isCompletedToday: false,
    order: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildMockAppContext(overrides: {
  activeHabits?: HabitReadModel[];
  allHabits?: HabitReadModel[];
  createHabitHandle?: ReturnType<typeof vi.fn>;
} = {}) {
  const {
    activeHabits = [],
    allHabits = [],
    createHabitHandle = vi.fn().mockResolvedValue(undefined),
  } = overrides;

  const mockHabitProjection = {
    getActiveHabits: vi.fn().mockResolvedValue(activeHabits),
    getAllHabits: vi.fn().mockResolvedValue(allHabits),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };

  return {
    eventStore: { append: vi.fn(), getAll: vi.fn().mockResolvedValue([]), subscribe: vi.fn().mockReturnValue(() => {}) } as any,
    entryProjection: {} as any,
    habitProjection: mockHabitProjection as any,
    collectionProjection: {} as any,
    createCollectionHandler: {} as any,
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
    userPreferences: DEFAULT_USER_PREFERENCES,
    isAppReady: true,
    createHabitHandler: { handle: createHabitHandle } as any,
    updateHabitTitleHandler: { handle: vi.fn() } as any,
    updateHabitFrequencyHandler: { handle: vi.fn() } as any,
    completeHabitHandler: { handle: vi.fn() } as any,
    revertHabitCompletionHandler: { handle: vi.fn() } as any,
    archiveHabitHandler: { handle: vi.fn() } as any,
    restoreHabitHandler: { handle: vi.fn() } as any,
    reorderHabitHandler: { handle: vi.fn() } as any,
  };
}

function renderView(appContext = buildMockAppContext()) {
  return render(
    <BrowserRouter>
      <AppProvider value={appContext}>
        <HabitsView />
      </AppProvider>
    </BrowserRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HabitsView', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should render the page heading', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /habits/i })).toBeInTheDocument();
    });
  });

  it('should render back button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  it('should navigate back to index when back button is clicked', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should show empty state when no habits exist', async () => {
    renderView(buildMockAppContext({ activeHabits: [], allHabits: [] }));

    await waitFor(() => {
      expect(screen.getByText(/no habits yet/i)).toBeInTheDocument();
    });
  });

  it('should display active habits', async () => {
    const habit = makeHabit({ id: 'h1', title: 'Morning Run' });
    renderView(buildMockAppContext({ activeHabits: [habit], allHabits: [habit] }));

    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });
  });

  it('should show "Active" section heading when active habits exist', async () => {
    const habit = makeHabit({ id: 'h1', title: 'Read' });
    renderView(buildMockAppContext({ activeHabits: [habit], allHabits: [habit] }));

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });
  });

  it('should display archived habits in "Archived" section', async () => {
    const archived = makeHabit({ id: 'h2', title: 'Old Habit', archivedAt: '2026-01-01T00:00:00.000Z' });
    renderView(buildMockAppContext({ activeHabits: [], allHabits: [archived] }));

    await waitFor(() => {
      expect(screen.getByText('Old Habit')).toBeInTheDocument();
      expect(screen.getByText(/archived/i)).toBeInTheDocument();
    });
  });

  it('should render FAB button', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });
  });

  it('should open CreateHabitModal when FAB is clicked', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => screen.getByRole('button', { name: /add/i }));
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new habit/i })).toBeInTheDocument();
    });
  });

  it('should close CreateHabitModal when onClose is called', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => screen.getByRole('button', { name: /add/i }));
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => screen.getByRole('heading', { name: /new habit/i }));

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(screen.queryByRole('heading', { name: /new habit/i })).not.toBeInTheDocument();
  });

  it('should call createHabit and close modal on submit', async () => {
    const user = userEvent.setup();
    const createHabitHandle = vi.fn().mockResolvedValue(undefined);
    renderView(buildMockAppContext({ createHabitHandle }));

    await waitFor(() => screen.getByRole('button', { name: /add/i }));
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => screen.getByRole('heading', { name: /new habit/i }));

    const titleInput = screen.getByPlaceholderText(/meditate, exercise, read/i);
    await user.type(titleInput, 'Evening Walk');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(createHabitHandle).toHaveBeenCalledOnce();
      expect(screen.queryByRole('heading', { name: /new habit/i })).not.toBeInTheDocument();
    });
  });

  it('should navigate to habit detail when habit row is clicked', async () => {
    const user = userEvent.setup();
    const habit = makeHabit({ id: 'habit-abc', title: 'Meditate' });
    renderView(buildMockAppContext({ activeHabits: [habit], allHabits: [habit] }));

    await waitFor(() => screen.getByText('Meditate'));
    await user.click(screen.getByText('Meditate'));

    expect(mockNavigate).toHaveBeenCalledWith('/habits/habit-abc');
  });
});
