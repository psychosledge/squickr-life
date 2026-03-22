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
    updateHabitTitleHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    updateHabitFrequencyHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    completeHabitHandler: { handle: vi.fn() } as any,
    revertHabitCompletionHandler: { handle: vi.fn() } as any,
    archiveHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreHabitHandler: { handle: vi.fn() } as any,
    reorderHabitHandler: { handle: vi.fn() } as any,
    setHabitNotificationTimeHandler: { handle: vi.fn() } as any,
    clearHabitNotificationTimeHandler: { handle: vi.fn() } as any,
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

  // ─── Title Editing ──────────────────────────────────────────────────────────

  describe('Title editing', () => {
    it('shows an edit button in the header', async () => {
      renderView();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit habit title/i })).toBeInTheDocument();
      });
    });

    it('clicking edit button shows title input pre-populated with habit title', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      const input = screen.getByRole('textbox', { name: /edit habit title/i });
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('Morning Run');
    });

    it('title input has aria-label "Edit habit title"', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      expect(screen.getByRole('textbox', { name: 'Edit habit title' })).toBeInTheDocument();
    });

    it('confirming calls updateHabitTitleHandler.handle with correct args', async () => {
      const user = userEvent.setup({ delay: null });
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      const input = screen.getByRole('textbox', { name: /edit habit title/i });
      await user.clear(input);
      await user.type(input, 'New Name');
      await user.click(screen.getByRole('button', { name: /save title/i }));

      await waitFor(() => {
        expect(appContext.updateHabitTitleHandler.handle).toHaveBeenCalledWith({
          habitId: 'habit-1',
          title: 'New Name',
        });
      });
    });

    it('pressing Escape cancels edit — no handler call, input disappears', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      const input = screen.getByRole('textbox', { name: /edit habit title/i });
      await user.type(input, ' Extra');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('textbox', { name: /edit habit title/i })).not.toBeInTheDocument();
      expect(appContext.updateHabitTitleHandler.handle).not.toHaveBeenCalled();
    });

    it('pressing Enter in title input saves the title', async () => {
      const user = userEvent.setup({ delay: null });
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      const input = screen.getByRole('textbox', { name: /edit habit title/i });
      await user.clear(input);
      await user.type(input, 'New Name{Enter}');

      await waitFor(() => {
        expect(appContext.updateHabitTitleHandler.handle).toHaveBeenCalledWith({
          habitId: 'habit-1',
          title: 'New Name',
        });
      });
    });

    it('save button is disabled when input is empty', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      const input = screen.getByRole('textbox', { name: /edit habit title/i });
      await user.clear(input);

      expect(screen.getByRole('button', { name: /save title/i })).toBeDisabled();
    });

    it('shows error when updateHabitTitleHandler rejects', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      (appContext.updateHabitTitleHandler.handle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Title update failed'),
      );
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /edit habit title/i }));
      await user.click(screen.getByRole('button', { name: /edit habit title/i }));

      await user.click(screen.getByRole('button', { name: /save title/i }));

      await waitFor(() => {
        expect(screen.getByText(/title update failed/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Settings Section ───────────────────────────────────────────────────────

  describe('Settings section', () => {
    it('settings section is collapsed by default — toggle button visible, content hidden', async () => {
      renderView();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /settings/i });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('clicking Settings button opens the section', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /settings/i }));

      expect(screen.getByRole('button', { name: /settings/i })).toHaveAttribute('aria-expanded', 'true');
    });

    it('open section contains frequency controls', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /settings/i }));

      // Frequency dropdown should be present
      expect(screen.getByLabelText('Frequency')).toBeInTheDocument();
    });

    it('Save Changes button is present when settings open', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /settings/i }));

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('Save Changes is disabled when frequency has not changed', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /settings/i }));

      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });

    it('clicking Save Changes calls updateHabitFrequencyHandler.handle', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext(
        makeHabit({ frequency: { type: 'daily' } }),
      );
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /settings/i }));

      // Change frequency to weekly — now Save Changes should be enabled
      await user.selectOptions(screen.getByLabelText('Frequency'), 'weekly');

      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      expect(saveBtn).not.toBeDisabled();
      await user.click(saveBtn);

      await waitFor(() => {
        expect(appContext.updateHabitFrequencyHandler.handle).toHaveBeenCalledWith(
          expect.objectContaining({ habitId: 'habit-1' }),
        );
      });
    });

    // ─── Notification time field ────────────────────────────────────────────────

    describe('Notification time field', () => {
      it('notification time input is present when settings section is open', async () => {
        const user = userEvent.setup();
        renderView();

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        expect(screen.getByLabelText(/notification time/i)).toBeInTheDocument();
      });

      it('input is pre-populated with habit.notificationTime when it exists', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: '08:30' }));
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i) as HTMLInputElement;
        expect(input.value).toBe('08:30');
      });

      it('input is empty when habit.notificationTime is undefined', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i) as HTMLInputElement;
        expect(input.value).toBe('');
      });

      it('Save Changes button is enabled when notification time changes (frequency unchanged)', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        // Frequency is unchanged — only change notification time
        const input = screen.getByLabelText(/notification time/i);
        await user.type(input, '09:00');

        expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
      });

      it('Save Changes calls setHabitNotificationTimeHandler.handle with correct args when time is entered', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        (appContext.setHabitNotificationTimeHandler.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i);
        await user.type(input, '07:00');

        await user.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
          expect(appContext.setHabitNotificationTimeHandler.handle).toHaveBeenCalledWith({
            habitId: 'habit-1',
            notificationTime: '07:00',
          });
        });
      });

      it('Save Changes calls clearHabitNotificationTimeHandler.handle when time is cleared', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: '08:30' }));
        (appContext.clearHabitNotificationTimeHandler.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i) as HTMLInputElement;
        await user.clear(input);

        await user.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
          expect(appContext.clearHabitNotificationTimeHandler.handle).toHaveBeenCalledWith({
            habitId: 'habit-1',
          });
        });
      });

      it('Save Changes is disabled when nothing has changed (notification time at initial value)', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: '08:30' }));
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        // Neither frequency nor notification time changed
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
      });

      it('does NOT call updateHabitFrequencyHandler.handle when only notification time changed', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        (appContext.setHabitNotificationTimeHandler.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        // Only change notification time, leave frequency as daily (unchanged)
        const input = screen.getByLabelText(/notification time/i);
        await user.type(input, '07:00');

        await user.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
          expect(appContext.setHabitNotificationTimeHandler.handle).toHaveBeenCalled();
        });
        expect(appContext.updateHabitFrequencyHandler.handle).not.toHaveBeenCalled();
      });

      it('closes settings section after successful notification-only save', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        (appContext.setHabitNotificationTimeHandler.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i);
        await user.type(input, '09:00');
        await user.click(screen.getByRole('button', { name: /save changes/i }));

        // After successful save the settings panel should be collapsed
        await waitFor(() => {
          expect(screen.queryByLabelText(/notification time/i)).not.toBeInTheDocument();
        });
      });

      it('shows error message when setHabitNotificationTimeHandler rejects', async () => {
        const user = userEvent.setup();
        const appContext = buildMockAppContext(makeHabit({ notificationTime: undefined }));
        (appContext.setHabitNotificationTimeHandler.handle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('Notification save failed'),
        );
        renderView('habit-1', appContext);

        await waitFor(() => screen.getByRole('button', { name: /settings/i }));
        await user.click(screen.getByRole('button', { name: /settings/i }));

        const input = screen.getByLabelText(/notification time/i);
        await user.type(input, '09:00');
        await user.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => {
          expect(screen.getByRole('alert')).toHaveTextContent('Notification save failed');
        });
      });
    });
  });

  // ─── Archive ────────────────────────────────────────────────────────────────

  describe('Archive', () => {
    it('shows "Archive Habit" button', async () => {
      renderView();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /archive habit/i })).toBeInTheDocument();
      });
    });

    it('clicking Archive Habit shows confirmation UI — does NOT call handler', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));

      expect(screen.getByText(/archive this habit\? this cannot be undone/i)).toBeInTheDocument();
      expect(appContext.archiveHabitHandler.handle).not.toHaveBeenCalled();
    });

    it('confirmation shows Cancel and Archive buttons', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));

      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^archive$/i })).toBeInTheDocument();
    });

    it('Cancel returns to normal — no handler call', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByText(/archive this habit\? this cannot be undone/i)).not.toBeInTheDocument();
      expect(appContext.archiveHabitHandler.handle).not.toHaveBeenCalled();
    });

    it('confirming Archive calls archiveHabitHandler.handle with correct habitId', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /^archive$/i }));

      await waitFor(() => {
        expect(appContext.archiveHabitHandler.handle).toHaveBeenCalledWith({ habitId: 'habit-1' });
      });
    });

    it('after archive, navigates to /habits', async () => {
      const user = userEvent.setup();
      renderView();

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /^archive$/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/habits');
      });
    });

    it('shows error when archive handler rejects', async () => {
      const user = userEvent.setup();
      const appContext = buildMockAppContext();
      (appContext.archiveHabitHandler.handle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Archive failed'),
      );
      renderView('habit-1', appContext);

      await waitFor(() => screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /archive habit/i }));
      await user.click(screen.getByRole('button', { name: /^archive$/i }));

      await waitFor(() => {
        expect(screen.getByText(/archive failed/i)).toBeInTheDocument();
      });
    });
  });
});
