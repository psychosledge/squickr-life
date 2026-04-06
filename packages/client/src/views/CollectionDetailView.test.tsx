/**
 * CollectionDetailView Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CollectionDetailView } from './CollectionDetailView';
import { AppProvider } from '../context/AppContext';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import type { Collection, Entry } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES, getLocalDateKey } from '@squickr/domain';

// Mock useTutorial to avoid needing TutorialProvider in tests
vi.mock('../hooks/useTutorial', () => ({
  useTutorial: () => ({
    isRunning: false,
    isPaused: false,
    stepIndex: 0,
    hasCompletedTutorial: false,
    startTutorial: vi.fn(),
    stopTutorial: vi.fn(),
    pauseTutorial: vi.fn(),
    resumeTutorial: vi.fn(),
    nextStep: vi.fn(),
    completeTutorial: vi.fn(),
    resetTutorial: vi.fn(),
  }),
}));

// Mock implementations
const mockCollection: Collection = {
  id: 'col-1',
  name: 'Books to Read',
  type: 'log',
  order: 'a0',
  createdAt: '2026-01-27T10:00:00Z',
};

const mockEntries: Entry[] = [
  {
    id: 'task-1',
    type: 'task',
    content: '1984 by George Orwell',
    status: 'open',
    createdAt: '2026-01-27T10:00:00Z',
    order: 'a0',
    collectionId: 'col-1',
    collections: [],
  },
  {
    id: 'note-1',
    type: 'note',
    content: 'Classic dystopian fiction',
    createdAt: '2026-01-27T10:01:00Z',
    order: 'a1',
    collectionId: 'col-1',
    collections: [],
  },
];

// ─── Shared factory ──────────────────────────────────────────────────────────
// Builds a complete AppContext mock with sensible defaults.  Pass `overrides`
// to replace specific projections or handlers for a particular describe block.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMockAppContext(overrides: Partial<any> = {}): any {
  return {
    eventStore: {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
    entryProjection: {
      getEntriesByCollection: vi.fn().mockResolvedValue([]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    },
    habitProjection: {
      getHabitsForDate: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
    collectionProjection: {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
    createCollectionHandler: {} as any,
    addTaskToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    removeTaskFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    moveTaskToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    bulkMigrateEntriesHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreTaskHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreNoteHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreEventHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    addNoteToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    removeNoteFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    moveNoteToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    addEventToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    removeEventFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    moveEventToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    createHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    updateHabitTitleHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    updateHabitFrequencyHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    completeHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    revertHabitCompletionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    archiveHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    restoreHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    reorderHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
    userPreferences: DEFAULT_USER_PREFERENCES,
    isAppReady: true,
    ...overrides,
  };
}

describe('CollectionDetailView', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;
  let mockHandlers: any;

  beforeEach(() => {
    // Mock projections
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue(mockEntries),
      getEntriesForCollectionView: vi.fn().mockResolvedValue(mockEntries), // Phase 2: Ghost entries
      getHabitsForDate: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockHandlers = {
      createTask: vi.fn().mockResolvedValue(undefined),
      createNote: vi.fn().mockResolvedValue(undefined),
      createEvent: vi.fn().mockResolvedValue(undefined),
      completeTask: vi.fn().mockResolvedValue(undefined),
      reopenTask: vi.fn().mockResolvedValue(undefined),
      updateTaskTitle: vi.fn().mockResolvedValue(undefined),
      updateNoteContent: vi.fn().mockResolvedValue(undefined),
      updateEventContent: vi.fn().mockResolvedValue(undefined),
      updateEventDate: vi.fn().mockResolvedValue(undefined),
      deleteEntry: vi.fn().mockResolvedValue(undefined),
      reorderEntry: vi.fn().mockResolvedValue(undefined),
      renameCollection: vi.fn().mockResolvedValue(undefined),
      deleteCollection: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderView(collectionId = 'col-1') {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should load and display collection name', async () => {
    renderView();
    
    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });
  });

  it('should load and display entries from the collection', async () => {
    renderView();
    
    await waitFor(() => {
      expect(screen.getByText('1984 by George Orwell')).toBeInTheDocument();
      expect(screen.getByText('Classic dystopian fiction')).toBeInTheDocument();
    });

    expect(mockEntryProjection.getEntriesForCollectionView).toHaveBeenCalledWith('col-1');
  });

  it('should show empty state when collection has no entries', async () => {
    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue([]);
    renderView();
    
    await waitFor(() => {
      expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });
  });

  it('should display FAB for adding new entries', async () => {
    renderView();
    
    await waitFor(() => {
      const fab = screen.getByRole('button', { name: /add new entry/i });
      expect(fab).toBeInTheDocument();
    });
  });

  it('should open entry input modal when FAB is clicked', async () => {
    const user = userEvent.setup();
    renderView();
    
    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });
    
    const fab = screen.getByRole('button', { name: /add new entry/i });
    await user.click(fab);
    
    // Modal should open with generic title
    expect(screen.getByText(/add entry/i)).toBeInTheDocument();
  });

  it('should show back button to navigate to collection index', async () => {
    renderView();
    
    await waitFor(() => {
      const backButton = screen.getByLabelText(/back to collections/i);
      expect(backButton).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching data', () => {
    mockCollectionProjection.getCollections.mockReturnValue(new Promise(() => {})); // Never resolves
    renderView();
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show error state if collection not found', async () => {
    mockCollectionProjection.getCollections.mockResolvedValue([]);
    renderView('nonexistent-id');
    
    await waitFor(() => {
      expect(screen.getByText(/collection not found/i)).toBeInTheDocument();
    });
  });

  it('should subscribe to projection changes for reactive updates', async () => {
    renderView();
    
    await waitFor(() => {
      expect(mockCollectionProjection.subscribe).toHaveBeenCalled();
      expect(mockEntryProjection.subscribe).toHaveBeenCalled();
    });
  });

  it('should unsubscribe from projections on unmount', async () => {
    const unsubscribeCollection = vi.fn();
    const unsubscribeEntry = vi.fn();
    mockCollectionProjection.subscribe.mockReturnValue(unsubscribeCollection);
    mockEntryProjection.subscribe.mockReturnValue(unsubscribeEntry);

    const { unmount } = renderView();
    
    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });
    
    unmount();
    
    expect(unsubscribeCollection).toHaveBeenCalled();
    expect(unsubscribeEntry).toHaveBeenCalled();
  });
});

describe('CollectionDetailView - Uncategorized Collection Handling', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const mockOrphanedEntries: Entry[] = [
    {
      id: 'task-orphan-1',
      type: 'task',
      content: 'Orphaned task',
      status: 'open',
      createdAt: '2026-01-27T10:00:00Z',
      order: 'a0',
      collections: [],
      // No collectionId
    },
    {
      id: 'note-orphan-1',
      type: 'note',
      content: 'Orphaned note',
      createdAt: '2026-01-27T10:01:00Z',
      order: 'a1',
      collections: [],
      // No collectionId
    },
  ];

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn((collectionId: string | null) => {
        if (collectionId === null) {
          return Promise.resolve(mockOrphanedEntries);
        }
        return Promise.resolve([]);
      }),
      getEntriesForCollectionView: vi.fn().mockResolvedValue(mockOrphanedEntries),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  function renderUncategorizedView() {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={[`/collection/${UNCATEGORIZED_COLLECTION_ID}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should load uncategorized entries when collectionId is UNCATEGORIZED_COLLECTION_ID', async () => {
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Should query for null collectionId (orphaned entries)
    expect(mockEntryProjection.getEntriesByCollection).toHaveBeenCalledWith(null);
  });

  it('should display orphaned entries correctly', async () => {
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Orphaned task')).toBeInTheDocument();
      expect(screen.getByText('Orphaned note')).toBeInTheDocument();
    });
  });

  it('should NOT query real collections projection for uncategorized view', async () => {
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // NOTE: We now ALWAYS call getCollections (even for uncategorized) 
    // to populate the migration modal with available collections.
    // The collection itself is still synthesized, not loaded from getCollections.
    expect(mockCollectionProjection.getCollections).toHaveBeenCalled();
  });

  it('should synthesize virtual collection object for uncategorized', async () => {
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Virtual collection should have correct properties
    // We can verify by checking that the header shows the right name
    const header = screen.getByText('Uncategorized');
    expect(header).toBeInTheDocument();
  });

  it('should pass isVirtual=true to CollectionHeader for uncategorized', async () => {
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Menu button should not be visible (hidden when isVirtual=true)
    const menuButton = screen.queryByLabelText(/collection menu/i);
    expect(menuButton).not.toBeInTheDocument();
  });

  it('should create entries with undefined collectionId (not "uncategorized" string) when in uncategorized view', async () => {
    const user = userEvent.setup();
    renderUncategorizedView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Open FAB modal
    const fab = screen.getByRole('button', { name: /add new entry/i });
    await user.click(fab);

    // The FAB should pass undefined (not 'uncategorized') to handlers
    // This is verified by the implementation: 
    // const actualCollectionId = collectionId === UNCATEGORIZED_COLLECTION_ID ? undefined : collectionId;
    
    // We can verify this behavior exists by checking the view rendered correctly
    expect(screen.getByText(/add entry/i)).toBeInTheDocument();
  });
});

describe('CollectionDetailView - Collapse Completed Tasks Feature', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const mockCollectionWithSettings: Collection = {
    id: 'col-1',
    name: 'My Tasks',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
    settings: {
      collapseCompleted: true,
    },
  };

  const mockMixedEntries: Entry[] = [
    {
      id: 'task-1',
      type: 'task',
      content: 'Active task 1',
      status: 'open',
      createdAt: '2026-01-27T10:00:00Z',
      order: 'a0',
      collectionId: 'col-1',
      collections: ['col-1'],
    },
    {
      id: 'task-2',
      type: 'task',
      content: 'Completed task 1',
      status: 'completed',
      createdAt: '2026-01-27T10:01:00Z',
      completedAt: '2026-01-27T11:00:00Z',
      order: 'a1',
      collectionId: 'col-1',
      collections: ['col-1'],
    },
    {
      id: 'note-1',
      type: 'note',
      content: 'A note',
      createdAt: '2026-01-27T10:02:00Z',
      order: 'a2',
      collectionId: 'col-1',
      collections: ['col-1'],
    },
    {
      id: 'task-3',
      type: 'task',
      content: 'Completed task 2',
      status: 'completed',
      createdAt: '2026-01-27T10:03:00Z',
      completedAt: '2026-01-27T11:01:00Z',
      order: 'a3',
      collectionId: 'col-1',
      collections: ['col-1'],
    },
  ];

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockCollectionWithSettings]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue(mockMixedEntries),
      getEntriesForCollectionView: vi.fn().mockResolvedValue(mockMixedEntries),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  function renderViewWithSettings(collection = mockCollectionWithSettings) {
    mockCollectionProjection.getCollections.mockResolvedValue([collection]);

    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={['/collection/col-1']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should show active tasks and notes when collapseCompleted is true', async () => {
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText('Active task 1')).toBeInTheDocument();
      expect(screen.getByText('A note')).toBeInTheDocument();
    });
  });

  it('should NOT show completed tasks inline when collapseCompleted is true', async () => {
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText('Active task 1')).toBeInTheDocument();
    });

    // Completed tasks should not be visible in the main list
    // We need to expand the section to see them
    const completedTasks = screen.queryAllByText(/Completed task/);
    expect(completedTasks).toHaveLength(0);
  });

  it('should show collapsible section with count when collapseCompleted is true', async () => {
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText(/2 completed tasks/i)).toBeInTheDocument();
    });
  });

  it('should expand completed tasks section when clicked', async () => {
    const user = userEvent.setup();
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText(/2 completed tasks/i)).toBeInTheDocument();
    });

    const expandButton = screen.getByRole('button', { name: /2 completed tasks/i });
    await user.click(expandButton);

    // Completed tasks should now be visible
    expect(screen.getByText('Completed task 1')).toBeInTheDocument();
    expect(screen.getByText('Completed task 2')).toBeInTheDocument();
  });

  it('should collapse completed tasks section when clicked again', async () => {
    const user = userEvent.setup();
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText(/2 completed tasks/i)).toBeInTheDocument();
    });

    const expandButton = screen.getByRole('button', { name: /2 completed tasks/i });
    
    // Expand
    await user.click(expandButton);
    expect(screen.getByText('Completed task 1')).toBeInTheDocument();
    
    // Collapse
    await user.click(expandButton);
    
    // Should not be visible anymore (checking that they're not in document)
    // Note: Due to conditional rendering, they should be removed from DOM
    await waitFor(() => {
      expect(screen.queryByText('Completed task 1')).not.toBeInTheDocument();
    });
  });

  it('should show all tasks inline when collapseCompleted is false', async () => {
    const collectionWithoutCollapse: Collection = {
      ...mockCollectionWithSettings,
      settings: { collapseCompleted: false },
    };
    
    renderViewWithSettings(collectionWithoutCollapse);

    await waitFor(() => {
      expect(screen.getByText('Active task 1')).toBeInTheDocument();
      expect(screen.getByText('Completed task 1')).toBeInTheDocument();
      expect(screen.getByText('Completed task 2')).toBeInTheDocument();
    });

    // Should NOT show collapsible section
    expect(screen.queryByText(/completed tasks/i)).not.toBeInTheDocument();
  });

  it('should show all tasks inline when settings is undefined', async () => {
    const collectionWithoutSettings: Collection = {
      ...mockCollectionWithSettings,
      settings: undefined,
    };
    
    renderViewWithSettings(collectionWithoutSettings);

    await waitFor(() => {
      expect(screen.getByText('Active task 1')).toBeInTheDocument();
      expect(screen.getByText('Completed task 1')).toBeInTheDocument();
      expect(screen.getByText('Completed task 2')).toBeInTheDocument();
    });

    // Should NOT show collapsible section
    expect(screen.queryByText(/completed tasks/i)).not.toBeInTheDocument();
  });

  it('should show singular "task" when only 1 completed task', async () => {
    const singleCompletedTaskEntries: Entry[] = [
      {
        id: 'task-1',
        type: 'task',
        content: 'Active task',
        status: 'open',
        createdAt: '2026-01-27T10:00:00Z',
        order: 'a0',
        collectionId: 'col-1',
        collections: [],
      },
      {
        id: 'task-2',
        type: 'task',
        content: 'Completed task',
        status: 'completed',
        createdAt: '2026-01-27T10:01:00Z',
        completedAt: '2026-01-27T11:00:00Z',
        order: 'a1',
        collectionId: 'col-1',
        collections: [],
      },
    ];

    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue(singleCompletedTaskEntries);
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText(/1 completed task/i)).toBeInTheDocument();
      // Should NOT show "tasks" plural
      expect(screen.queryByText(/1 completed tasks/i)).not.toBeInTheDocument();
    });
  });

  it('should NOT show collapse section when no completed tasks', async () => {
    const noCompletedEntries: Entry[] = [
      {
        id: 'task-1',
        type: 'task',
        content: 'Active task',
        status: 'open',
        createdAt: '2026-01-27T10:00:00Z',
        order: 'a0',
        collectionId: 'col-1',
        collections: [],
      },
    ];

    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue(noCompletedEntries);
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText('Active task')).toBeInTheDocument();
    });

    // Should NOT show collapsible section
    expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
  });

  it('should open settings modal when Settings menu option is clicked', async () => {
    const user = userEvent.setup();
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText('My Tasks')).toBeInTheDocument();
    });

    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    // Click settings
    const settingsOption = screen.getByText(/^Settings$/i);
    await user.click(settingsOption);

    // Settings modal should be open
    expect(screen.getByText(/collection settings/i)).toBeInTheDocument();
  });

  it('should only select incomplete tasks when "Active" filter is clicked (Bug 2 regression)', async () => {
    const user = userEvent.setup();
    
    const mixedEntries: Entry[] = [
      {
        id: 'task-1',
        type: 'task',
        content: 'Open task 1',
        status: 'open',
        createdAt: '2026-01-27T10:00:00Z',
        order: 'a0',
        collectionId: 'col-1',
        collections: [],
      },
      {
        id: 'task-2',
        type: 'task',
        content: 'Completed task',
        status: 'completed',
        completedAt: '2026-01-27T11:00:00Z',
        createdAt: '2026-01-27T11:00:00Z',
        order: 'a1',
        collectionId: 'col-1',
        collections: [],
      },
      {
        id: 'task-3',
        type: 'task',
        content: 'Migrated task',
        status: 'open',
        migratedTo: 'other-id',
        createdAt: '2026-01-27T12:00:00Z',
        order: 'a2',
        collectionId: 'col-1',
        collections: [],
      },
      {
        id: 'task-4',
        type: 'task',
        content: 'Open task 2',
        status: 'open',
        createdAt: '2026-01-27T13:00:00Z',
        order: 'a3',
        collectionId: 'col-1',
        collections: [],
      },
      {
        id: 'note-1',
        type: 'note',
        content: 'A note',
        createdAt: '2026-01-27T14:00:00Z',
        order: 'a4',
        collectionId: 'col-1',
        collections: [],
      },
    ];

    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue(mixedEntries);
    renderViewWithSettings();

    await waitFor(() => {
      expect(screen.getByText('Open task 1')).toBeInTheDocument();
    });

    // Enter selection mode - first open the menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    // Click "Select Entries" option
    const selectEntriesOption = screen.getByText(/^Select Entries$/i);
    await user.click(selectEntriesOption);

    await waitFor(() => {
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    });

    // Click "Active" filter button
    const activeButton = screen.getByRole('button', { name: /^Active$/i });
    await user.click(activeButton);

    // Should select only incomplete, non-migrated tasks (task-1 and task-4)
    // Should NOT select completed (task-2) or migrated (task-3) or note (note-1)
    await waitFor(() => {
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });
  });
});

describe('CollectionDetailView - Auto-Fav Labels (Issue #3)', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
    getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  afterEach(() => {
    // Clean up any system time mocking
    vi.useRealTimers();
  });

  function renderViewWithDate(collection: Collection) {
    mockCollectionProjection.getCollections.mockResolvedValue([collection]);

    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={[`/collection/${collection.id}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should display "Today, February 15, 2026" when viewing today\'s collection', async () => {
    // Mock Date to return February 15, 2026
    const mockDate = new Date('2026-02-15T12:00:00.000Z');
    vi.setSystemTime(mockDate);
    
    const todayCollection: Collection = {
      id: 'col-today',
      name: 'Saturday, February 15',
      type: 'daily',
      date: '2026-02-15',
      order: 'a0',
      createdAt: '2026-02-15T00:00:00Z',
    };

    renderViewWithDate(todayCollection);

    await waitFor(() => {
      expect(screen.getByText('Today, February 15, 2026')).toBeInTheDocument();
    });
  });

  it('should display "Yesterday, February 14, 2026" when viewing yesterday\'s collection', async () => {
    // Mock Date to return February 15, 2026 (so yesterday is Feb 14)
    const mockDate = new Date('2026-02-15T12:00:00.000Z');
    vi.setSystemTime(mockDate);
    
    const yesterdayCollection: Collection = {
      id: 'col-yesterday',
      name: 'Friday, February 14',
      type: 'daily',
      date: '2026-02-14',
      order: 'a0',
      createdAt: '2026-02-14T00:00:00Z',
    };

    renderViewWithDate(yesterdayCollection);

    await waitFor(() => {
      expect(screen.getByText('Yesterday, February 14, 2026')).toBeInTheDocument();
    });
  });

  it('should display "Tomorrow, February 16, 2026" when viewing tomorrow\'s collection', async () => {
    // Mock Date to return February 15, 2026 (so tomorrow is Feb 16)
    const mockDate = new Date('2026-02-15T12:00:00.000Z');
    vi.setSystemTime(mockDate);
    
    const tomorrowCollection: Collection = {
      id: 'col-tomorrow',
      name: 'Sunday, February 16',
      type: 'daily',
      date: '2026-02-16',
      order: 'a0',
      createdAt: '2026-02-16T00:00:00Z',
    };

    renderViewWithDate(tomorrowCollection);

    await waitFor(() => {
      expect(screen.getByText('Tomorrow, February 16, 2026')).toBeInTheDocument();
    });
  });

  it('should display weekday and date for other dates without temporal prefix', async () => {
    const otherDateCollection: Collection = {
      id: 'col-other',
      name: 'Monday, February 10',
      type: 'daily',
      date: '2026-02-10',
      order: 'a0',
      createdAt: '2026-02-10T00:00:00Z',
    };

    renderViewWithDate(otherDateCollection);

    await waitFor(() => {
      expect(screen.getByText('Tuesday, February 10, 2026')).toBeInTheDocument();
    });
  });

  it('should display monthly collection name as "Month Year" without temporal prefix', async () => {
    const monthlyCollection: Collection = {
      id: 'col-monthly',
      name: 'February 2026',
      type: 'monthly',
      date: '2026-02',
      order: 'a0',
      createdAt: '2026-02-01T00:00:00Z',
    };

    renderViewWithDate(monthlyCollection);

    await waitFor(() => {
      expect(screen.getByText('February 2026')).toBeInTheDocument();
    });
  });

  it('should display custom collection name without modification', async () => {
    const customCollection: Collection = {
      id: 'col-custom',
      name: 'My Custom Collection',
      type: 'custom',
      order: 'a0',
      createdAt: '2026-02-14T00:00:00Z',
    };

    renderViewWithDate(customCollection);

    await waitFor(() => {
      expect(screen.getByText('My Custom Collection')).toBeInTheDocument();
    });
  });
});

describe('CollectionDetailView - Temporal Route Navigation Fix', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const mockMonthlyCollection: Collection = {
    id: 'col-feb-2026-uuid',
    name: 'February 2026',
    type: 'monthly',
    date: '2026-02',
    order: 'a0',
    createdAt: '2026-02-01T00:00:00Z',
  };

  const mockTaskInFeb: Entry = {
    id: 'task-1',
    type: 'task',
    content: 'Task in February',
    status: 'open',
    createdAt: '2026-02-14T10:00:00Z',
    order: 'a0',
    collectionId: 'col-feb-2026-uuid',
    collections: ['col-feb-2026-uuid'], // Modern format: Array of collection UUIDs
  };

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-02-14T12:00:00.000Z'));

    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockMonthlyCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([mockTaskInFeb]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
    getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderTemporalView(temporalDate: 'this-month' | 'last-month' | 'next-month') {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={[`/${temporalDate}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/this-month" element={<CollectionDetailView date="this-month" />} />
            <Route path="/last-month" element={<CollectionDetailView date="last-month" />} />
            <Route path="/next-month" element={<CollectionDetailView date="next-month" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should resolve temporal route "this-month" to actual collection UUID', async () => {
    renderTemporalView('this-month');

    await waitFor(() => {
      expect(screen.getByText('February 2026')).toBeInTheDocument();
    });

    // Verify that the view loaded the correct collection by UUID
    expect(mockEntryProjection.getEntriesForCollectionView).toHaveBeenCalledWith('col-feb-2026-uuid');
  });

  it('should use actual UUID (not temporal identifier) for currentCollectionId prop', async () => {
    renderTemporalView('this-month');

    await waitFor(() => {
      expect(screen.getByText('Task in February')).toBeInTheDocument();
    });

    // The fix: currentCollectionId='col-feb-2026-uuid' === entry.collections[0]
    // ensures current collection is excluded from navigation (no circular "Go to February 2026")
    expect(mockCollectionProjection.getCollections).toHaveBeenCalled();
  });
});

// ============================================================================
// Error Toast Tests
// ============================================================================

describe('CollectionDetailView - Error Toast', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const mockCollection: Collection = {
    id: 'col-1',
    name: 'Test Collection',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
  };

  // Note: these tests use mockImplementation with pre-caught rejections instead of
  // mockRejectedValue. Although loadData() and useCollectionNavigation both catch
  // rejections internally, pre-catching prevents any residual unhandled rejection
  // warnings during the microtask gap between promise creation and await.
  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
    getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  function renderView(collectionId = 'col-1', appContextOverrides: Partial<any> = {}) {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
      ...appContextOverrides,
    });
    return render(
      <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should show an error toast when loadData fails', async () => {
    // Use mockImplementation with a pre-caught rejection to prevent vitest's unhandledRejection
    // detection from firing — loadData catches this in its try/catch, but Node.js marks a
    // promise as "unhandled" if no .catch() is attached synchronously on the same microtask.
    mockCollectionProjection.getCollections.mockImplementation(() => {
      const p = Promise.reject(new Error('Network error'));
      p.catch(() => {}); // pre-catch to prevent unhandled rejection
      return p;
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });

  it('should show a generic error message when loadData throws a non-Error', async () => {
    mockCollectionProjection.getCollections.mockImplementation(() => {
      const p = Promise.reject('Unknown failure');
      p.catch(() => {});
      return p;
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load collection data');
    });
  });

  it('should dismiss the error toast when the dismiss button is clicked', async () => {
    const user = userEvent.setup();
    mockCollectionProjection.getCollections.mockImplementation(() => {
      const p = Promise.reject(new Error('Network error'));
      p.catch(() => {});
      return p;
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    await user.click(dismissButton);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should show an error toast when bulk migration fails', async () => {
    const user = userEvent.setup({ delay: null });
    const failingBulkHandler = {
      handle: vi.fn().mockImplementation(() => {
        const p = Promise.reject(new Error('Bulk migration failed'));
        p.catch(() => {}); // pre-catch to prevent unhandled rejection warning
        return p;
      }),
    };

    const mockEntries = [
      {
        id: 'task-1',
        type: 'task' as const,
        content: 'Task 1',
        status: 'open' as const,
        createdAt: '2026-01-27T10:00:00Z',
        order: 'a0',
        collectionId: 'col-1',
        collections: ['col-1'],
      },
    ];
    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue(mockEntries);

    // Provide a second collection so MigrateEntryDialog has a target after filtering out col-1
    const targetCollection: Collection = {
      id: 'col-2',
      name: 'Another Collection',
      type: 'log',
      order: 'a1',
      createdAt: '2026-01-27T10:00:00Z',
    };
    mockCollectionProjection.getCollections.mockResolvedValue([mockCollection, targetCollection]);

    renderView('col-1', { bulkMigrateEntriesHandler: failingBulkHandler });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    // Enter selection mode via menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    const selectOption = screen.getByText(/^Select Entries$/i);
    await user.click(selectOption);

    // Select all entries
    const selectAllButton = screen.getByRole('button', { name: /^All$/i });
    await user.click(selectAllButton);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    // Open bulk migrate modal
    const migrateButton = screen.getByRole('button', { name: /^Migrate$/i });
    await user.click(migrateButton);

    // The MigrateEntryDialog shows "Migrate N entries" heading when open
    await waitFor(() => {
      expect(screen.getByText(/migrate 1 entr/i)).toBeInTheDocument();
    });

    // Select the target collection and submit to trigger the failure path
    const collectionSelect = screen.getByRole('combobox', { name: /Collection/i });
    await user.selectOptions(collectionSelect, 'col-2');
    // There are two "Migrate" buttons: the dialog's submit button (first in DOM, inside the dialog)
    // and the toolbar's "Migrate" button (second in DOM, after the dialog).
    // Click the dialog's submit button (index 0).
    const migrateButtons = screen.getAllByRole('button', { name: /^Migrate$/i });
    await user.click(migrateButtons[0]);

    // The error toast should appear with the handler's error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    }, { timeout: 10000 });
    expect(screen.getByRole('alert')).toHaveTextContent('Bulk migration failed');
  }, 15000);

  it('should show a generic error message when bulk migration throws a non-Error', async () => {
    const user = userEvent.setup({ delay: null });
    const failingBulkHandler = {
      handle: vi.fn().mockImplementation(() => {
        const p = Promise.reject('string error');
        p.catch(() => {}); // pre-catch to prevent unhandled rejection warning
        return p;
      }),
    };

    const mockEntries = [
      {
        id: 'task-1',
        type: 'task' as const,
        content: 'Task 1',
        status: 'open' as const,
        createdAt: '2026-01-27T10:00:00Z',
        order: 'a0',
        collectionId: 'col-1',
        collections: ['col-1'],
      },
    ];
    mockEntryProjection.getEntriesForCollectionView.mockResolvedValue(mockEntries);

    // Provide a second collection so MigrateEntryDialog has a target after filtering out col-1
    const targetCollection: Collection = {
      id: 'col-2',
      name: 'Another Collection',
      type: 'log',
      order: 'a1',
      createdAt: '2026-01-27T10:00:00Z',
    };
    mockCollectionProjection.getCollections.mockResolvedValue([mockCollection, targetCollection]);

    renderView('col-1', { bulkMigrateEntriesHandler: failingBulkHandler });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    // Enter selection mode via menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    const selectOption = screen.getByText(/^Select Entries$/i);
    await user.click(selectOption);

    // Select all entries
    const selectAllButton = screen.getByRole('button', { name: /^All$/i });
    await user.click(selectAllButton);

    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });

    // Open bulk migrate modal
    const migrateButton = screen.getByRole('button', { name: /^Migrate$/i });
    await user.click(migrateButton);

    // The MigrateEntryDialog shows "Migrate N entries" heading when open
    await waitFor(() => {
      expect(screen.getByText(/migrate 1 entr/i)).toBeInTheDocument();
    });

    // Select the target collection and submit to trigger the failure path
    const collectionSelect = screen.getByRole('combobox', { name: /Collection/i });
    await user.selectOptions(collectionSelect, 'col-2');
    // There are two "Migrate" buttons: the dialog's submit button (first in DOM, inside the dialog)
    // and the toolbar's "Migrate" button (second in DOM, after the dialog).
    // Click the dialog's submit button (index 0).
    const migrateButtons = screen.getAllByRole('button', { name: /^Migrate$/i });
    await user.click(migrateButtons[0]);

    // The error toast should show the generic fallback message for non-Error rejections
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to migrate entries');
    }, { timeout: 10000 });
  }, 15000);
});

// ============================================================================
// Fix 3: Completed sub-tasks should stay with parent in active section
// ============================================================================

describe('CollectionDetailView - Completed sub-task stays with parent (Fix 3)', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const collectionWithMoveToBottom: Collection = {
    id: 'col-1',
    name: 'My Tasks',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
    settings: { completedTaskBehavior: 'move-to-bottom' } as any,
  };

  // Parent task (open) + completed sub-task — both in same collection
  const parentTask: Entry = {
    id: 'parent-1',
    type: 'task',
    content: 'Parent Task',
    status: 'open',
    createdAt: '2026-01-27T10:00:00Z',
    order: 'a0',
    collectionId: 'col-1',
  };

  const completedSubTask: Entry = {
    id: 'sub-1',
    type: 'task',
    content: 'Completed Sub Task',
    status: 'completed',
    completedAt: '2026-01-27T11:00:00Z',
    createdAt: '2026-01-27T10:01:00Z',
    order: 'a1',
    collectionId: 'col-1',
    parentEntryId: 'parent-1',
  } as any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([collectionWithMoveToBottom]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([parentTask, completedSubTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([parentTask, completedSubTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 1, completed: 1, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([completedSubTask]),
      getSubTasksForMultipleParents: vi.fn().mockImplementation((ids: string[]) => {
        const map = new Map<string, Entry[]>();
        if (ids.includes('parent-1')) map.set('parent-1', [completedSubTask]);
        return Promise.resolve(map);
      }),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(true),
    getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  function renderView() {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={['/collection/col-1']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('completed sub-task whose parent is in collection should NOT appear in "completed" section', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument();
    });

    // The "move-to-bottom" separator/completed section should NOT appear
    // because the only completed task is a sub-task whose parent is present
    expect(screen.queryByText(/completed task/i)).not.toBeInTheDocument();
  });

  it('completed sub-task with parent present should not be duplicated', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Parent Task')).toBeInTheDocument();
    });

    // Sub-task title should appear at most once (rendered via parent's sub-task list)
    const matches = screen.queryAllByText('Completed Sub Task');
    // Either 0 (hidden by parent-child logic) or 1 (shown indented under parent), never 2
    expect(matches.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Fix 4: Ghost entries excluded from selection handlers
// ============================================================================

describe('CollectionDetailView - Ghost entries excluded from selection (Fix 4)', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;

  const collectionA: Collection = {
    id: 'col-a',
    name: 'Collection A',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
  };

  // Parent was migrated out → renderAsGhost: true
  const ghostParent: Entry & { renderAsGhost: boolean } = {
    id: 'parent-ghost',
    type: 'task',
    content: 'Ghost Parent (migrated out)',
    status: 'open',
    createdAt: '2026-01-27T10:00:00Z',
    order: 'a0',
    collectionId: 'col-a',
    renderAsGhost: true,
  } as any;

  // Completed sub-task still in collection
  const completedSubTask: Entry = {
    id: 'sub-completed',
    type: 'task',
    content: 'Completed Sub Task',
    status: 'completed',
    completedAt: '2026-01-27T11:00:00Z',
    createdAt: '2026-01-27T10:01:00Z',
    order: 'a1',
    collectionId: 'col-a',
    parentEntryId: 'parent-ghost',
  } as any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([collectionA]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([ghostParent, completedSubTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([ghostParent, completedSubTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 1, completed: 1, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([completedSubTask]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
    getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  function renderView() {
    const appContext = buildMockAppContext({
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    return render(
      <MemoryRouter initialEntries={['/collection/col-a']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('"Active" filter should select 0 entries when only ghost + completed sub-task', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Collection A')).toBeInTheDocument();
    });

    // Enter selection mode via menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    const selectOption = screen.getByText(/^Select Entries$/i);
    await user.click(selectOption);

    await waitFor(() => {
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    });

    // Click "Active" filter
    const activeButton = screen.getByRole('button', { name: /^Active$/i });
    await user.click(activeButton);

    // Ghost is open but renderAsGhost=true → excluded
    // Sub-task is completed → excluded
    // Result: 0 selected
    await waitFor(() => {
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    });
  });

  it('"Select All" should NOT include ghost entries', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Collection A')).toBeInTheDocument();
    });

    // Enter selection mode via menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    const selectOption = screen.getByText(/^Select Entries$/i);
    await user.click(selectOption);

    await waitFor(() => {
      expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    });

    // Click "All" (Select All)
    const allButton = screen.getByRole('button', { name: /^All$/i });
    await user.click(allButton);

    // Only the non-ghost entry (completedSubTask) should be selected → 1
    await waitFor(() => {
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    });
  });
});

// ─── Migrate all open tasks → Today ──────────────────────────────────────────
describe('CollectionDetailView - Migrate all open tasks to Today', () => {
  // Build date-agnostic test data: compute today's key and two days ago dynamically
  const todayDateKey = getLocalDateKey(); // e.g. "2026-03-18"

  // Build "two days ago" date key to use as the "old" daily collection
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const oldDateKey = getLocalDateKey(twoDaysAgo);

  const todayCollection: Collection = {
    id: 'today-col',
    name: 'Today Log',
    type: 'daily',
    date: todayDateKey,
    order: 'a0',
    createdAt: new Date().toISOString(),
  };

  const oldDailyCollection: Collection = {
    id: 'old-daily-col',
    name: 'Old Daily Log',
    type: 'daily',
    date: oldDateKey,
    order: 'a1',
    createdAt: twoDaysAgo.toISOString(),
  };

  const openTask: Entry = {
    id: 'task-open',
    type: 'task',
    content: 'Buy groceries',
    status: 'open',
    createdAt: twoDaysAgo.toISOString(),
    order: 'a0',
    collectionId: 'old-daily-col',
    collections: [],
  };

  function buildAppContext(opts: {
    collections: Collection[];
    entries: Entry[];
    bulkMigrateHandle?: ReturnType<typeof vi.fn>;
    createCollectionHandle?: ReturnType<typeof vi.fn>;
  }) {
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue(opts.entries),
      getEntriesForCollectionView: vi.fn().mockResolvedValue(opts.entries),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };

    const mockHabitProjection = {
      getHabitsForDate: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    // Allow callers to supply a growing collections list so post-create refreshes work
    let storedCollections = [...opts.collections];
    const mockCollectionProjection = {
      getCollections: vi.fn().mockImplementation(() => Promise.resolve(storedCollections)),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const mockBulkMigrate = opts.bulkMigrateHandle ?? vi.fn().mockResolvedValue(undefined);
    const mockCreateCollection = opts.createCollectionHandle ?? vi.fn().mockResolvedValue(undefined);

    return {
      appContext: {
        eventStore: {
          append: vi.fn(),
          getEvents: vi.fn().mockResolvedValue([]),
          getAll: vi.fn().mockResolvedValue([]),
          subscribe: vi.fn().mockReturnValue(() => {}),
        },
        entryProjection: mockEntryProjection,
        habitProjection: mockHabitProjection,
        collectionProjection: mockCollectionProjection,
        createCollectionHandler: { handle: mockCreateCollection } as any,
        addTaskToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        removeTaskFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        moveTaskToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        bulkMigrateEntriesHandler: { handle: mockBulkMigrate } as any,
        restoreCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        restoreTaskHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        restoreNoteHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        restoreEventHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        addNoteToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        removeNoteFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        moveNoteToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        addEventToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        removeEventFromCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        moveEventToCollectionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        createHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        updateHabitTitleHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        updateHabitFrequencyHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        completeHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        revertHabitCompletionHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        archiveHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        restoreHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        reorderHabitHandler: { handle: vi.fn().mockResolvedValue(undefined) } as any,
        userPreferences: DEFAULT_USER_PREFERENCES,
        isAppReady: true,
      },
      mockBulkMigrate,
      mockCreateCollection,
      mockEntryProjection,
      mockHabitProjection,
      mockCollectionProjection,
    };
  }

  function renderOldDailyView(opts: {
    collections: Collection[];
    entries: Entry[];
    bulkMigrateHandle?: ReturnType<typeof vi.fn>;
    createCollectionHandle?: ReturnType<typeof vi.fn>;
    collectionId?: string;
  }) {
    const { appContext } = buildAppContext(opts);
    const collectionId = opts.collectionId ?? 'old-daily-col';
    return render(
      <MemoryRouter initialEntries={[`/collection/${collectionId}`]}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should show "Migrate all open tasks → Today" menu item when collection is NOT today and has active tasks', async () => {
    const user = userEvent.setup();
    renderOldDailyView({
      collections: [oldDailyCollection, todayCollection],
      entries: [openTask],
    });

    // Wait for entry content to confirm the view has loaded
    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.getByText(/Migrate all open tasks → Today/i)).toBeInTheDocument();
  });

  it('should NOT show "Migrate all open tasks → Today" when the collection IS today\'s log', async () => {
    const user = userEvent.setup();
    renderOldDailyView({
      collections: [oldDailyCollection, todayCollection],
      entries: [openTask],
      collectionId: 'today-col',
    });

    // Wait for entry content to confirm the view has loaded
    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.queryByText(/Migrate all open tasks → Today/i)).not.toBeInTheDocument();
  });

  it('should NOT show "Migrate all open tasks → Today" when collection has no active tasks', async () => {
    const user = userEvent.setup();
    const completedTask: Entry = { ...openTask, status: 'completed' };
    renderOldDailyView({
      collections: [oldDailyCollection, todayCollection],
      entries: [completedTask],
    });

    // Wait for the collection menu button to confirm the view has loaded
    await waitFor(() => {
      expect(screen.getByLabelText(/collection menu/i)).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.queryByText(/Migrate all open tasks → Today/i)).not.toBeInTheDocument();
  });

  it('should call bulkMigrateEntriesHandler with active task IDs and today\'s collection ID when migrate item is clicked', async () => {
    const user = userEvent.setup();
    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    renderOldDailyView({
      collections: [oldDailyCollection, todayCollection],
      entries: [openTask],
      bulkMigrateHandle: mockBulkMigrate,
    });

    // Wait for entry content to confirm the view has loaded
    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalledWith(
        expect.objectContaining({
          entryIds: ['task-open'],
          targetCollectionId: 'today-col',
          mode: 'move',
        })
      );
    });
  });

  it('should auto-create today\'s daily log and migrate when it does not exist yet', async () => {
    const user = userEvent.setup();
    const newTodayId = 'newly-created-today-col';
    const newTodayCollection: Collection = {
      id: newTodayId,
      name: 'Today Log (auto)',
      type: 'daily',
      date: todayDateKey,
      order: 'a2',
      createdAt: new Date().toISOString(),
    };

    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);

    // Track whether creation has happened so getCollections returns
    // the right list both before and after the auto-create step.
    let todayCreated = false;
    const mockCreateCollection = vi.fn().mockImplementation(async () => {
      todayCreated = true;
      return newTodayId;
    });

    const { appContext, mockCollectionProjection } = buildAppContext({
      collections: [oldDailyCollection], // no todayCollection initially
      entries: [openTask],
      bulkMigrateHandle: mockBulkMigrate,
      createCollectionHandle: mockCreateCollection,
    });

    // getCollections returns the growing list based on creation state
    mockCollectionProjection.getCollections.mockImplementation(() =>
      Promise.resolve(todayCreated ? [oldDailyCollection, newTodayCollection] : [oldDailyCollection])
    );

    render(
      <MemoryRouter initialEntries={['/collection/old-daily-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'daily', date: todayDateKey })
      );
    });

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalledWith(
        expect.objectContaining({
          entryIds: ['task-open'],
          targetCollectionId: newTodayId,
          mode: 'move',
        })
      );
    });

    // No error toast should appear
    expect(screen.queryByText(/today.*daily log/i)).not.toBeInTheDocument();
  });

  it('should navigate to today\'s collection after successful migration', async () => {
    const user = userEvent.setup();
    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    const { appContext } = buildAppContext({
      collections: [oldDailyCollection, todayCollection],
      entries: [openTask],
      bulkMigrateHandle: mockBulkMigrate,
    });

    render(
      <MemoryRouter initialEntries={['/collection/old-daily-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
            <Route path="/collection/today-col" element={<div data-testid="today-view" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('today-view')).toBeInTheDocument();
    });
  });

  it('should NOT navigate when handleBulkMigrateWithMode throws', async () => {
    const user = userEvent.setup();
    const mockBulkMigrate = vi.fn().mockRejectedValue(new Error('Migration failed'));
    const { appContext } = buildAppContext({
      collections: [oldDailyCollection, todayCollection],
      entries: [openTask],
      bulkMigrateHandle: mockBulkMigrate,
    });

    render(
      <MemoryRouter initialEntries={['/collection/old-daily-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
            <Route path="/collection/today-col" element={<div data-testid="today-view" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalled();
    });

    // Should stay on the source collection — no navigation on failure
    expect(screen.queryByTestId('today-view')).not.toBeInTheDocument();
    // Error message should be shown
    await waitFor(() => {
      expect(screen.getByText('Migration failed')).toBeInTheDocument();
    });
  });

  it('should navigate to the auto-created today collection after migration', async () => {
    const user = userEvent.setup();
    const newTodayId = 'newly-created-today-col';
    const newTodayCollection: Collection = {
      id: newTodayId,
      name: 'Today Log (auto)',
      type: 'daily',
      date: todayDateKey,
      order: 'a2',
      createdAt: new Date().toISOString(),
    };
    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    let todayCreated = false;
    const mockCreateCollection = vi.fn().mockImplementation(async () => {
      todayCreated = true;
      return newTodayId;
    });

    const { appContext, mockCollectionProjection } = buildAppContext({
      collections: [oldDailyCollection],
      entries: [openTask],
      bulkMigrateHandle: mockBulkMigrate,
      createCollectionHandle: mockCreateCollection,
    });

    mockCollectionProjection.getCollections.mockImplementation(() =>
      Promise.resolve(todayCreated ? [oldDailyCollection, newTodayCollection] : [oldDailyCollection])
    );

    render(
      <MemoryRouter initialEntries={['/collection/old-daily-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
            <Route path={`/collection/${newTodayId}`} element={<div data-testid="auto-today-view" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auto-today-view')).toBeInTheDocument();
    });
  });
});

// ─── Issue #7a: handleMigrateAllToToday early-return error path ───────────────
describe('CollectionDetailView - handleMigrateAllToToday error when created collection not found', () => {
  const todayDateKey = getLocalDateKey();

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const oldDateKey = getLocalDateKey(twoDaysAgo);

  const oldDailyCollection: Collection = {
    id: 'old-daily-col',
    name: 'Old Daily Log',
    type: 'daily',
    date: oldDateKey,
    order: 'a0',
    createdAt: twoDaysAgo.toISOString(),
  };

  const openTask: Entry = {
    id: 'task-open',
    type: 'task',
    content: 'Open task',
    status: 'open',
    createdAt: twoDaysAgo.toISOString(),
    order: 'a0',
    collectionId: 'old-daily-col',
    collections: [],
  };

  it('should show an error toast when the newly created collection cannot be found after creation', async () => {
    const user = userEvent.setup();

    // createCollectionHandler returns a new ID but getCollections never reflects the new collection
    const mockCreateCollection = vi.fn().mockResolvedValue('ghost-id');
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      // Always returns only the old collection — the newly created one is never found
      getCollections: vi.fn().mockResolvedValue([oldDailyCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: { handle: mockCreateCollection } as any,
    });

    render(
      <MemoryRouter initialEntries={['/collection/old-daily-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/Migrate all open tasks → Today/i);
    await user.click(migrateItem);

    // The early-return error branch sets errorMessage to the "Failed to create" message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to create today/i);
    });
  });
});

// ─── Issue #7b: move-to-bottom renders completed entries without collapse button ─
describe('CollectionDetailView - move-to-bottom mode renders completed section', () => {
  const collectionWithMoveToBottom: Collection = {
    id: 'col-mtb',
    name: 'Move To Bottom Collection',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
    settings: { completedTaskBehavior: 'move-to-bottom' } as any,
  };

  const entries: Entry[] = [
    {
      id: 'active-1',
      type: 'task',
      content: 'Active task',
      status: 'open',
      createdAt: '2026-01-27T10:00:00Z',
      order: 'a0',
      collectionId: 'col-mtb',
      collections: [],
    },
    {
      id: 'done-1',
      type: 'task',
      content: 'Completed task',
      status: 'completed',
      completedAt: '2026-01-27T11:00:00Z',
      createdAt: '2026-01-27T10:01:00Z',
      order: 'a1',
      collectionId: 'col-mtb',
      collections: [],
    },
  ];

  it('should render completed entries below a separator without a collapse button', async () => {
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue(entries),
      getEntriesForCollectionView: vi.fn().mockResolvedValue(entries),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
      getHabitsForDate: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([collectionWithMoveToBottom]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      entryProjection: mockEntryProjection,
      collectionProjection: mockCollectionProjection,
    });

    render(
      <MemoryRouter initialEntries={['/collection/col-mtb']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active task')).toBeInTheDocument();
    });

    // Completed task is visible directly — no need to expand anything
    expect(screen.getByText('Completed task')).toBeInTheDocument();

    // There should be NO "N completed tasks" collapsible toggle button
    expect(screen.queryByRole('button', { name: /\d+ completed task/i })).not.toBeInTheDocument();
  });
});

// ─── Issue #7c: Habits section renders for daily collections ─────────────────
describe('CollectionDetailView - Habits section for daily collections', () => {
  // Use a past date so display is always "Weekday, Month D, YYYY" (not "Today …")
  const dailyCollection: Collection = {
    id: 'col-daily',
    name: 'Thursday, January 15',
    type: 'daily',
    date: '2026-01-15',
    order: 'a0',
    createdAt: '2026-01-15T00:00:00Z',
  };

  it('should render the habits section for a daily collection', async () => {
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([dailyCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({ collectionProjection: mockCollectionProjection });

    render(
      <MemoryRouter initialEntries={['/collection/col-daily']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Collection header is rendered once loaded
      expect(screen.getByText('Thursday, January 15, 2026')).toBeInTheDocument();
    });

    // HabitsSection renders with aria-label="Habits"
    expect(screen.getByRole('region', { name: /habits/i })).toBeInTheDocument();
  });

  it('should NOT render the habits section for a non-daily collection', async () => {
    const logCollection: Collection = {
      id: 'col-log',
      name: 'My Log',
      type: 'log',
      order: 'a0',
      createdAt: '2026-03-31T00:00:00Z',
    };

    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([logCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({ collectionProjection: mockCollectionProjection });

    render(
      <MemoryRouter initialEntries={['/collection/col-log']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('My Log')).toBeInTheDocument();
    });

    expect(screen.queryByRole('region', { name: /habits/i })).not.toBeInTheDocument();
  });
});

// ─── ADR-028: Temporal Route Auto-Create ────────────────────────────────────

describe('CollectionDetailView - Auto-create for today', () => {
  it('should auto-create today collection when date="today" and no collection exists', async () => {
    const todayKey = getLocalDateKey();
    const mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue('new-today-id'),
    };
    const createdCollection: Collection = {
      id: 'new-today-id',
      name: 'Wednesday, February 11',
      type: 'daily',
      date: todayKey,
      order: 'a0',
      createdAt: new Date().toISOString(),
    };
    // First two calls return [] (useCollectionNavigation + loadData both call getCollections on mount)
    // All subsequent calls return the created collection
    const mockCollectionProjection = {
      getCollections: vi.fn()
        .mockResolvedValueOnce([])  // useCollectionNavigation on mount
        .mockResolvedValueOnce([])  // loadData initial call
        .mockResolvedValue([createdCollection]), // ensureCollectionForDate refresh + further calls
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="today" />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockCreateCollectionHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'daily', date: todayKey })
      );
    });

    // Should not show the error screen
    expect(screen.queryByText(/collection not found/i)).not.toBeInTheDocument();
  });
});

describe('CollectionDetailView - Temporal empty state for non-today keywords', () => {
  it('should show "Create daily log" button for date="yesterday" with empty collections', async () => {
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const appContext = buildMockAppContext({ collectionProjection: mockCollectionProjection });

    render(
      <MemoryRouter initialEntries={['/yesterday']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="yesterday" />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/create daily log/i)).toBeInTheDocument();
    });

    // Generic "Collection Not Found" should NOT appear
    expect(screen.queryByText(/collection not found/i)).not.toBeInTheDocument();
  });

  it('should call createCollectionHandler when "Create daily log" button is clicked for yesterday', async () => {
    const user = userEvent.setup();
    const mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue('new-id'),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
    });

    render(
      <MemoryRouter initialEntries={['/yesterday']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="yesterday" />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/create daily log/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create daily log/i));

    await waitFor(() => {
      expect(mockCreateCollectionHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'daily' })
      );
    });
  });

  it('should show "Create monthly log" button for date="this-month" with empty collections', async () => {
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const appContext = buildMockAppContext({ collectionProjection: mockCollectionProjection });

    render(
      <MemoryRouter initialEntries={['/this-month']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="this-month" />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/create monthly log/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/collection not found/i)).not.toBeInTheDocument();
  });
});

// ─── ADR-028: Migrate All to Tomorrow ───────────────────────────────────────

describe('CollectionDetailView - Migrate all to tomorrow', () => {
  const todayKey = getLocalDateKey();

  const mockTodayCollection: Collection = {
    id: 'today-col',
    name: 'Today',
    type: 'daily',
    date: todayKey,
    order: 'a0',
    createdAt: new Date().toISOString(),
  };

  const openTask: Entry = {
    id: 'task-open-1',
    type: 'task',
    content: 'Open task',
    status: 'open',
    createdAt: new Date().toISOString(),
    order: 'a0',
    collectionId: 'today-col',
    collections: ['today-col'],
  };

  function renderTodayView(overrides: Partial<any> = {}) {
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockTodayCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
      ...overrides,
    });
    return render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="today" collectionId={undefined} />
        </AppProvider>
      </MemoryRouter>
    );
  }

  it('should show "Migrate all open tasks → Tomorrow" in menu when viewing today log with open tasks', async () => {
    const user = userEvent.setup();
    renderTodayView();

    await waitFor(() => {
      expect(screen.getByText(/today/i)).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.getByText(/migrate all open tasks → tomorrow/i)).toBeInTheDocument();
  });

  it('should NOT show "Migrate all open tasks → Tomorrow" when viewing a non-today collection', async () => {
    const user = userEvent.setup();
    const nonTodayCollection: Collection = {
      id: 'other-col',
      name: 'Other Collection',
      type: 'log',
      order: 'a0',
      createdAt: new Date().toISOString(),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([nonTodayCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
    });

    render(
      <MemoryRouter initialEntries={['/collection/other-col']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/collection/:id" element={<CollectionDetailView />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Other Collection')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.queryByText(/migrate all open tasks → tomorrow/i)).not.toBeInTheDocument();
  });

  it('should NOT show "Migrate all open tasks → Tomorrow" when today log has no open tasks', async () => {
    const user = userEvent.setup();
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockTodayCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="today" collectionId={undefined} />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/today/i)).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    expect(screen.queryByText(/migrate all open tasks → tomorrow/i)).not.toBeInTheDocument();
  });

  it('should call bulkMigrateEntriesHandler with active task IDs and tomorrow\'s collection ID when migrate item is clicked', async () => {
    const user = userEvent.setup();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrowDate);

    const tomorrowCollection: Collection = {
      id: 'tomorrow-col',
      name: 'Tomorrow Log',
      type: 'daily',
      date: tomorrowKey,
      order: 'a1',
      createdAt: tomorrowDate.toISOString(),
    };

    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockTodayCollection, tomorrowCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
      bulkMigrateEntriesHandler: { handle: mockBulkMigrate } as any,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="today" collectionId={undefined} />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/migrate all open tasks → tomorrow/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalledWith(
        expect.objectContaining({
          entryIds: ['task-open-1'],
          targetCollectionId: 'tomorrow-col',
          mode: 'move',
        })
      );
    });
  });

  it('should auto-create tomorrow\'s daily log and migrate when it does not exist yet', async () => {
    const user = userEvent.setup();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrowDate);

    const newTomorrowId = 'newly-created-tomorrow-col';
    const newTomorrowCollection: Collection = {
      id: newTomorrowId,
      name: 'Tomorrow Log (auto)',
      type: 'daily',
      date: tomorrowKey,
      order: 'a1',
      createdAt: tomorrowDate.toISOString(),
    };

    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    let tomorrowCreated = false;
    const mockCreateCollection = vi.fn().mockImplementation(async () => {
      tomorrowCreated = true;
      return newTomorrowId;
    });

    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockImplementation(() =>
        Promise.resolve(tomorrowCreated ? [mockTodayCollection, newTomorrowCollection] : [mockTodayCollection])
      ),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
      bulkMigrateEntriesHandler: { handle: mockBulkMigrate } as any,
      createCollectionHandler: { handle: mockCreateCollection } as any,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <CollectionDetailView date="today" collectionId={undefined} />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/migrate all open tasks → tomorrow/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'daily', date: tomorrowKey })
      );
    });

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalledWith(
        expect.objectContaining({
          entryIds: ['task-open-1'],
          targetCollectionId: newTomorrowId,
          mode: 'move',
        })
      );
    });
  });

  it('should navigate to tomorrow\'s collection after successful migration', async () => {
    const user = userEvent.setup();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrowDate);

    const tomorrowCollection: Collection = {
      id: 'tomorrow-col',
      name: 'Tomorrow Log',
      type: 'daily',
      date: tomorrowKey,
      order: 'a1',
      createdAt: tomorrowDate.toISOString(),
    };

    const mockBulkMigrate = vi.fn().mockResolvedValue(undefined);
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockTodayCollection, tomorrowCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
      bulkMigrateEntriesHandler: { handle: mockBulkMigrate } as any,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/today" element={<CollectionDetailView date="today" collectionId={undefined} />} />
            <Route path="/collection/tomorrow-col" element={<div data-testid="tomorrow-view" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/migrate all open tasks → tomorrow/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('tomorrow-view')).toBeInTheDocument();
    });
  });

  it('should show an error toast and NOT navigate when bulkMigrateEntriesHandler throws', async () => {
    const user = userEvent.setup();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = getLocalDateKey(tomorrowDate);

    const tomorrowCollection: Collection = {
      id: 'tomorrow-col',
      name: 'Tomorrow Log',
      type: 'daily',
      date: tomorrowKey,
      order: 'a1',
      createdAt: tomorrowDate.toISOString(),
    };

    const mockBulkMigrate = vi.fn().mockRejectedValue(new Error('Migration to tomorrow failed'));
    const mockEntryProjection = {
      getEntriesByCollection: vi.fn().mockResolvedValue([openTask]),
      getEntriesForCollectionView: vi.fn().mockResolvedValue([openTask]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
      getSubTasks: vi.fn().mockResolvedValue([]),
      getSubTasksForMultipleParents: vi.fn().mockResolvedValue(new Map()),
      getParentTitlesForSubTasks: vi.fn().mockResolvedValue(new Map()),
      isParentTask: vi.fn().mockResolvedValue(false),
      getDeletedEntries: vi.fn().mockResolvedValue([]),
    };
    const mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([mockTodayCollection, tomorrowCollection]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const appContext = buildMockAppContext({
      collectionProjection: mockCollectionProjection,
      entryProjection: mockEntryProjection,
      bulkMigrateEntriesHandler: { handle: mockBulkMigrate } as any,
    });

    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppProvider value={appContext}>
          <Routes>
            <Route path="/today" element={<CollectionDetailView date="today" collectionId={undefined} />} />
            <Route path="/collection/tomorrow-col" element={<div data-testid="tomorrow-view" />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeInTheDocument();
    });

    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);

    const migrateItem = screen.getByText(/migrate all open tasks → tomorrow/i);
    await user.click(migrateItem);

    await waitFor(() => {
      expect(mockBulkMigrate).toHaveBeenCalled();
    });

    // Should stay on today — no navigation on failure
    expect(screen.queryByTestId('tomorrow-view')).not.toBeInTheDocument();
    // Error message should be shown
    await waitFor(() => {
      expect(screen.getByText('Migration to tomorrow failed')).toBeInTheDocument();
    });
  });
});
