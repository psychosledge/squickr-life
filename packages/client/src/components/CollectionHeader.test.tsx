/**
 * CollectionHeader Tests
 * 
 * Phase 2C: Collection Detail View - Header component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CollectionHeader } from './CollectionHeader';
import { AppProvider } from '../context/AppContext';

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CollectionHeader', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;

  beforeEach(() => {
    mockNavigate.mockClear();
    
    mockCollectionProjection = {
      getCollections: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };
  });

  const defaultProps = {
    collectionName: 'Books to Read',
    collectionId: 'collection-1',
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSettings: vi.fn(),
  };

  function renderHeader(props = {}) {
    return render(
      <BrowserRouter>
        <AppProvider 
          value={{
            eventStore: { 
              getAll: vi.fn().mockResolvedValue([]),
              subscribe: vi.fn().mockReturnValue(() => {})
            } as any,
            collectionProjection: mockCollectionProjection,
            entryProjection: mockEntryProjection,
            taskProjection: {} as any,
            createCollectionHandler: {} as any,
            migrateTaskHandler: {} as any,
            migrateNoteHandler: {} as any,
            migrateEventHandler: {} as any,
          }}
        >
          <CollectionHeader {...defaultProps} {...props} />
        </AppProvider>
      </BrowserRouter>
    );
  }

  it('should display collection name', () => {
    renderHeader();
    expect(screen.getByText('Books to Read')).toBeInTheDocument();
  });

  it('should render back button that navigates to index', () => {
    renderHeader();
    const backButton = screen.getByLabelText(/back to collections/i);
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '/');
  });

  it('should render menu button', () => {
    renderHeader();
    const menuButton = screen.getByLabelText(/collection menu/i);
    expect(menuButton).toBeInTheDocument();
  });

  it('should open menu when menu button is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByText(/rename/i)).toBeInTheDocument();
    expect(screen.getByText(/delete/i)).toBeInTheDocument();
  });

  it('should call onSettings when settings option is clicked', async () => {
    const user = userEvent.setup();
    const onSettings = vi.fn();
    renderHeader({ onSettings });
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    // Click settings
    const settingsOption = screen.getByText(/^Settings$/i);
    await user.click(settingsOption);
    
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('should call onRename when rename option is clicked', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderHeader({ onRename });
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    // Click rename
    const renameOption = screen.getByText(/rename/i);
    await user.click(renameOption);
    
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('should call onDelete when delete option is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderHeader({ onDelete });
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    
    // Click delete
    const deleteOption = screen.getByText(/delete/i);
    await user.click(deleteOption);
    
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('should close menu when clicking outside', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    // Open menu
    const menuButton = screen.getByLabelText(/collection menu/i);
    await user.click(menuButton);
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    
    // Click outside (on the header title)
    const title = screen.getByText('Books to Read');
    await user.click(title);
    
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument();
  });
});

describe('CollectionHeader - Virtual Collection Behavior', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;

  beforeEach(() => {
    mockNavigate.mockClear();
    
    mockCollectionProjection = {
      getCollections: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };
  });

  const defaultProps = {
    collectionName: 'Uncategorized',
    collectionId: 'uncategorized',
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSettings: vi.fn(),
  };

  function renderHeader(props = {}) {
    return render(
      <BrowserRouter>
        <AppProvider 
          value={{
            eventStore: { 
              getAll: vi.fn().mockResolvedValue([]),
              subscribe: vi.fn().mockReturnValue(() => {})
            } as any,
            collectionProjection: mockCollectionProjection,
            entryProjection: mockEntryProjection,
            taskProjection: {} as any,
            createCollectionHandler: {} as any,
            migrateTaskHandler: {} as any,
            migrateNoteHandler: {} as any,
            migrateEventHandler: {} as any,
          }}
        >
          <CollectionHeader {...defaultProps} {...props} />
        </AppProvider>
      </BrowserRouter>
    );
  }

  it('should hide menu button when isVirtual=true', () => {
    renderHeader({ isVirtual: true });
    
    const menuButton = screen.queryByLabelText(/collection menu/i);
    expect(menuButton).not.toBeInTheDocument();
  });

  it('should show menu button when isVirtual=false', () => {
    renderHeader({ isVirtual: false });
    
    const menuButton = screen.getByLabelText(/collection menu/i);
    expect(menuButton).toBeInTheDocument();
  });

  it('should show menu button by default (when isVirtual not provided)', () => {
    renderHeader();
    
    const menuButton = screen.getByLabelText(/collection menu/i);
    expect(menuButton).toBeInTheDocument();
  });

  it('should show spacer div for layout balance when isVirtual=true', () => {
    const { container } = renderHeader({ isVirtual: true });
    
    // Should have a spacer div with w-10 class for balance
    const spacer = container.querySelector('.w-10');
    expect(spacer).toBeInTheDocument();
  });

  it('should make title clickable and navigate to index', () => {
    renderHeader({ isVirtual: true });
    
    const titleLink = screen.getByText('Uncategorized').closest('a');
    expect(titleLink).toHaveAttribute('href', '/');
  });

  it('should make back arrow navigate to index', () => {
    renderHeader({ isVirtual: true });
    
    const backButton = screen.getByLabelText(/back to collections/i);
    expect(backButton).toHaveAttribute('href', '/');
  });
});

// ─── Tutorial DOM anchor ─────────────────────────────────────────────────────
describe('CollectionHeader - data-tutorial-id anchor', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;

  beforeEach(() => {
    mockCollectionProjection = {
      getCollections: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };
    mockEntryProjection = {
      getEntriesByCollection: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };
  });

  function renderHeader(props = {}) {
    return render(
      <BrowserRouter>
        <AppProvider
          value={{
            eventStore: {
              getAll: vi.fn().mockResolvedValue([]),
              subscribe: vi.fn().mockReturnValue(() => {}),
            } as any,
            collectionProjection: mockCollectionProjection,
            entryProjection: mockEntryProjection,
            taskProjection: {} as any,
            createCollectionHandler: {} as any,
            migrateTaskHandler: {} as any,
            migrateNoteHandler: {} as any,
            migrateEventHandler: {} as any,
          }}
        >
          <CollectionHeader
            collectionName="Test Collection"
            collectionId="test-collection"
            onRename={vi.fn()}
            onDelete={vi.fn()}
            onSettings={vi.fn()}
            {...props}
          />
        </AppProvider>
      </BrowserRouter>
    );
  }

  it('should render three-dot menu button with data-tutorial-id="tutorial-collection-menu"', () => {
    const { container } = renderHeader();
    const anchor = container.querySelector('[data-tutorial-id="tutorial-collection-menu"]');
    expect(anchor).toBeInTheDocument();
  });

  it('should NOT render data-tutorial-id on three-dot menu when isVirtual=true', () => {
    const { container } = renderHeader({ isVirtual: true });
    const anchor = container.querySelector('[data-tutorial-id="tutorial-collection-menu"]');
    expect(anchor).not.toBeInTheDocument();
  });
});
