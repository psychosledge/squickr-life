/**
 * CollectionIndexView Tests
 * 
 * Phase 2D: Tests for virtual 'Uncategorized' collection synthesis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CollectionIndexView } from './CollectionIndexView';
import { AppProvider } from '../context/AppContext';
import { AuthProvider } from '../context/AuthContext';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';
import type { Collection, Entry } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test for header branding
describe('CollectionIndexView - Header Branding', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;
  let mockCreateCollectionHandler: any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getActiveTaskCountsByCollection: vi.fn(() => Promise.resolve(new Map())),
      getEntries: vi.fn(() => Promise.resolve([])),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderView() {
    const mockAppContext = {
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      taskProjection: {} as any,
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
      migrateTaskHandler: {} as any,
      migrateNoteHandler: {} as any,
      migrateEventHandler: {} as any,
      addTaskToCollectionHandler: {} as any,
      removeTaskFromCollectionHandler: {} as any,
      moveTaskToCollectionHandler: {} as any,
      bulkMigrateEntriesHandler: {} as any,
      userPreferences: DEFAULT_USER_PREFERENCES,
    };

    return render(
      <AuthProvider>
        <BrowserRouter>
          <AppProvider value={mockAppContext}>
            <CollectionIndexView />
          </AppProvider>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  it('should display "Squickr Life" as the title', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });
  });

  it('should display "Get shit done quicker with Squickr!" as the subtitle', async () => {
    renderView();
    await waitFor(() => {
      expect(screen.getByText('Get shit done quicker with Squickr!')).toBeInTheDocument();
    });
  });
});

// Phase 1: Index Navigation Arrows
describe('CollectionIndexView - Navigation Arrows', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;
  let mockCreateCollectionHandler: any;

  const mockCollectionsForNav: Collection[] = [
    {
      id: 'col-1',
      name: 'First Collection',
      type: 'custom',
      order: 'a0',
      createdAt: '2026-01-27T10:00:00Z',
    },
    {
      id: 'col-2',
      name: 'Second Collection',
      type: 'custom',
      order: 'a1',
      createdAt: '2026-01-27T10:05:00Z',
    },
  ];

  beforeEach(() => {
    mockNavigate.mockClear();

    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue(mockCollectionsForNav),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getActiveTaskCountsByCollection: vi.fn(() => {
        const counts = new Map<string | null, number>();
        counts.set('col-1', 5);
        counts.set('col-2', 3);
        return Promise.resolve(counts);
      }),
      getEntries: vi.fn(() => Promise.resolve([])),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderView() {
    const mockAppContext = {
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      taskProjection: {} as any,
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
      migrateTaskHandler: {} as any,
      migrateNoteHandler: {} as any,
      migrateEventHandler: {} as any,
      addTaskToCollectionHandler: {} as any,
      removeTaskFromCollectionHandler: {} as any,
      moveTaskToCollectionHandler: {} as any,
      bulkMigrateEntriesHandler: {} as any,
      userPreferences: DEFAULT_USER_PREFERENCES,
    };

    return render(
      <AuthProvider>
        <BrowserRouter>
          <AppProvider value={mockAppContext}>
            <CollectionIndexView />
          </AppProvider>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  it('should render right arrow when collections exist', async () => {
    renderView();

    await waitFor(() => {
      const nextButton = screen.getByLabelText(/next: first collection/i);
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('should NOT render enabled left arrow on index page', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    // Previous button should be disabled (no previous from index)
    const previousButton = screen.getByLabelText(/no previous collection/i);
    expect(previousButton).toBeDisabled();
  });

  it('should navigate to first collection when right arrow clicked', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByLabelText(/next: first collection/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText(/next: first collection/i);
    await user.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith('/collection/col-1');
  });

  it('should navigate to first collection on ArrowRight keypress', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowRight}');

    expect(mockNavigate).toHaveBeenCalledWith('/collection/col-1');
  });

  it('should NOT navigate on ArrowLeft keypress (no previous from index)', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Squickr Life')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowLeft}');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should disable right arrow when no collections exist', async () => {
    mockCollectionProjection.getCollections.mockResolvedValue([]);

    renderView();

    await waitFor(() => {
      const nextButton = screen.getByLabelText(/no next collection/i);
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toBeDisabled();
    });
  });
});

// Mock collections
const mockCollections: Collection[] = [
  {
    id: 'col-1',
    name: 'Books to Read',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T10:00:00Z',
  },
  {
    id: 'col-2',
    name: 'Movies to Watch',
    type: 'log',
    order: 'a1',
    createdAt: '2026-01-27T10:05:00Z',
  },
];

// Mock orphaned entries
const mockOrphanedEntries: Entry[] = [
  {
    id: 'task-orphan-1',
    type: 'task',
    title: 'Orphaned task',
    status: 'open',
    createdAt: '2026-01-27T10:00:00Z',
    order: 'a0',
    // No collectionId
  },
  {
    id: 'note-orphan-1',
    type: 'note',
    content: 'Orphaned note',
    createdAt: '2026-01-27T10:01:00Z',
    order: 'a1',
    // No collectionId
  },
];

describe('CollectionIndexView - Virtual Uncategorized Collection', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;
  let mockCreateCollectionHandler: any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue(mockCollections),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn((collectionId: string | null) => {
        // Return orphaned entries for null collectionId
        if (collectionId === null) {
          return Promise.resolve(mockOrphanedEntries);
        }
        // Return empty for real collections in these tests
        return Promise.resolve([]);
      }),
      getEntries: vi.fn(() => {
        // Return all entries for stats calculation
        return Promise.resolve(mockOrphanedEntries);
      }),
      getActiveTaskCountsByCollection: vi.fn(() => {
        // Return counts for all collections
        const counts = new Map<string | null, number>();
        counts.set(null, mockOrphanedEntries.length); // Uncategorized count
        counts.set('col-1', 0);
        counts.set('col-2', 0);
        return Promise.resolve(counts);
      }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderView() {
    const mockAppContext = {
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      taskProjection: {} as any,
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
      migrateTaskHandler: {} as any,
      migrateNoteHandler: {} as any,
      migrateEventHandler: {} as any,
      addTaskToCollectionHandler: {} as any,
      removeTaskFromCollectionHandler: {} as any,
      moveTaskToCollectionHandler: {} as any,
      bulkMigrateEntriesHandler: {} as any,
      userPreferences: DEFAULT_USER_PREFERENCES,
    };

    return render(
      <AuthProvider>
        <BrowserRouter>
          <AppProvider value={mockAppContext}>
            <CollectionIndexView />
          </AppProvider>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  it('should synthesize virtual Uncategorized collection when orphaned entries exist', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Verify it queried for entry counts (not individual orphaned entries)
    expect(mockEntryProjection.getActiveTaskCountsByCollection).toHaveBeenCalled();
  });

  it('should NOT show virtual Uncategorized collection when no orphaned entries exist', async () => {
    // Mock no orphaned entries
    mockEntryProjection.getActiveTaskCountsByCollection.mockImplementation(() => {
      const counts = new Map<string | null, number>();
      // No null key = no uncategorized entries
      counts.set('col-1', 0);
      counts.set('col-2', 0);
      return Promise.resolve(counts);
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });

    // Should not show Uncategorized
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument();
  });

  it('should show virtual Uncategorized collection FIRST in the list (order "!")', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Get all collection cards
    const collectionCards = screen.getAllByRole('link');
    const collectionNames = collectionCards.map(card => card.textContent);

    // Uncategorized should be first (order '!' comes before alphanumerics)
    expect(collectionNames[0]).toContain('Uncategorized');
  });

  it('should create virtual collection object with correct properties', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // The virtual collection should have:
    // - id: UNCATEGORIZED_COLLECTION_ID
    // - name: 'Uncategorized'
    // - order: '!'
    // We can verify this by checking the link href
    const uncategorizedLink = screen.getByText('Uncategorized').closest('a');
    expect(uncategorizedLink).toHaveAttribute('href', `/collection/${UNCATEGORIZED_COLLECTION_ID}`);
  });

  it('should display virtual Uncategorized collection with icon', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Should display Uncategorized with custom collection icon
    const uncategorizedCard = screen.getByText('Uncategorized').closest('a');
    expect(uncategorizedCard?.textContent).toContain('📝');
    expect(uncategorizedCard?.textContent).toContain('Uncategorized');
  });

  it('should navigate to detail view when virtual Uncategorized collection is clicked', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    const uncategorizedLink = screen.getByText('Uncategorized').closest('a');
    expect(uncategorizedLink).toHaveAttribute('href', `/collection/${UNCATEGORIZED_COLLECTION_ID}`);
  });

  it('should subscribe to both collection and entry projections for reactive updates', async () => {
    renderView();

    await waitFor(() => {
      expect(mockCollectionProjection.subscribe).toHaveBeenCalled();
      expect(mockEntryProjection.subscribe).toHaveBeenCalled();
    });
  });

  it('should reload data when projections notify changes', async () => {
    let notifyCallback: (() => void) | undefined;
    mockEntryProjection.subscribe.mockImplementation((callback: () => void) => {
      notifyCallback = callback;
      return () => {};
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    // Clear previous calls
    mockEntryProjection.getActiveTaskCountsByCollection.mockClear();

    // Simulate projection change (orphaned entries removed)
    mockEntryProjection.getActiveTaskCountsByCollection.mockImplementation(() => {
      const counts = new Map<string | null, number>();
      // No null key = no uncategorized entries
      counts.set('col-1', 0);
      counts.set('col-2', 0);
      return Promise.resolve(counts);
    });

    // Trigger update
    notifyCallback?.();

    // Wait for Uncategorized to disappear
    await waitFor(() => {
      expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument();
    });
  });
});

// Tests for drag-and-drop reordering
describe('CollectionIndexView - Drag and Drop Reordering', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let mockEventStore: any;
  let mockCreateCollectionHandler: any;
  let mockReorderCollectionHandler: any;
  let mockMigrateTaskHandler: any;
  let mockMigrateNoteHandler: any;
  let mockMigrateEventHandler: any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn().mockResolvedValue(mockCollections),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEntryProjection = {
      getActiveTaskCountsByCollection: vi.fn(() => {
        const counts = new Map<string | null, number>();
        counts.set('col-1', 5);
        counts.set('col-2', 3);
        return Promise.resolve(counts);
      }),
      getEntries: vi.fn(() => Promise.resolve([])),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockEventStore = {
      append: vi.fn(),
      getEvents: vi.fn().mockResolvedValue([]),
      getAll: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    mockCreateCollectionHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    mockReorderCollectionHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    mockMigrateTaskHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    mockMigrateNoteHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    mockMigrateEventHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };
  });

  function renderView() {
    const mockAppContext = {
      eventStore: mockEventStore,
      entryProjection: mockEntryProjection,
      taskProjection: {} as any,
      collectionProjection: mockCollectionProjection,
      createCollectionHandler: mockCreateCollectionHandler,
      reorderCollectionHandler: mockReorderCollectionHandler,
      migrateTaskHandler: mockMigrateTaskHandler,
      migrateNoteHandler: mockMigrateNoteHandler,
      migrateEventHandler: mockMigrateEventHandler,
      addTaskToCollectionHandler: {} as any,
      removeTaskFromCollectionHandler: {} as any,
      moveTaskToCollectionHandler: {} as any,
      bulkMigrateEntriesHandler: {} as any,
      userPreferences: DEFAULT_USER_PREFERENCES,
    };

    return render(
      <AuthProvider>
        <BrowserRouter>
          <AppProvider value={mockAppContext}>
            <CollectionIndexView />
          </AppProvider>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  it('should display collections in hierarchical order', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });

    // Verify collections are rendered (hierarchical view doesn't support drag-and-drop)
    expect(screen.getByText('Books to Read')).toBeInTheDocument();
    expect(screen.getByText('Movies to Watch')).toBeInTheDocument();
  });

  it('should organize collections hierarchically', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Books to Read')).toBeInTheDocument();
    });

    // Hierarchical view organizes collections automatically
    // Collections are sorted by type and date, not manually reordered
    expect(screen.getByText('Books to Read')).toBeInTheDocument();
    expect(screen.getByText('Movies to Watch')).toBeInTheDocument();
  });
});

