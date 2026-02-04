import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { HierarchicalCollectionList } from './HierarchicalCollectionList';
import type { Collection } from '@squickr/shared';

// Helper to render with Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('HierarchicalCollectionList', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render empty state when no collections exist', () => {
    renderWithRouter(
      <HierarchicalCollectionList 
        collections={[]} 
      />
    );

    expect(screen.getByText('No collections yet')).toBeInTheDocument();
    expect(screen.getByText(/Tap.*to create your first collection/i)).toBeInTheDocument();
  });

  it('should render year/month/day nodes correctly', () => {
    const collections: Collection[] = [
      {
        id: '1',
        name: 'Sunday, February 1',
        type: 'daily',
        date: '2026-02-01',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    // Auto-expand current year/month
    localStorage.setItem('collection-hierarchy-expanded', JSON.stringify(['year-2026', 'month-2026-02']));

    renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    // Should show year node
    expect(screen.getByText('2026 Logs')).toBeInTheDocument();
    
    // Should show month node
    expect(screen.getByText('February')).toBeInTheDocument();
    
    // Should show day node (with year now included)
    expect(screen.getByText('Sunday, February 1, 2026')).toBeInTheDocument();
  });

  it('should show star icon for favorited collections', () => {
    const collections: Collection[] = [
      {
        id: '1',
        name: 'Favorite Ideas',
        type: 'custom',
        isFavorite: true,
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Regular Ideas',
        type: 'custom',
        order: 'b',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const { container } = renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    // Check that favorite has star icon
    const favoriteLink = screen.getByText('Favorite Ideas').closest('a');
    expect(favoriteLink?.textContent).toContain('⭐');

    // Check that regular has document icon
    const regularLink = screen.getByText('Regular Ideas').closest('a');
    expect(regularLink?.textContent).toContain('📝');
  });

  it('should toggle expand/collapse on year/month click', async () => {
    const user = userEvent.setup();
    
    const collections: Collection[] = [
      {
        id: '1',
        name: 'Sunday, February 1',
        type: 'daily',
        date: '2026-02-01',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    // Start collapsed
    localStorage.setItem('collection-hierarchy-expanded', JSON.stringify([]));

    renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    // Year should be collapsed, showing count
    expect(screen.getByText(/2026 Logs \(1 log\)/)).toBeInTheDocument();
    
    // Month should not be visible
    expect(screen.queryByText('February')).not.toBeInTheDocument();

    // Click year to expand
    await user.click(screen.getByText(/2026 Logs/));

    // Month should now be visible
    expect(screen.getByText(/February/)).toBeInTheDocument();
  });

  it('should navigate to detail on day/custom click', () => {
    const collections: Collection[] = [
      {
        id: 'custom-1',
        name: 'Ideas',
        type: 'custom',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    const link = screen.getByText('Ideas').closest('a');
    expect(link).toHaveAttribute('href', '/collection/custom-1');
  });

  it('should not navigate on year/month click', () => {
    const collections: Collection[] = [
      {
        id: '1',
        name: 'Sunday, February 1',
        type: 'daily',
        date: '2026-02-01',
        order: 'a',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    // Expand to show year
    localStorage.setItem('collection-hierarchy-expanded', JSON.stringify(['year-2026']));

    renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    // Year should be a button, not a link
    const yearButton = screen.getByText(/2026 Logs/).closest('button');
    expect(yearButton).toBeInTheDocument();

    // Month should be a button, not a link
    const monthButton = screen.getByText(/February/).closest('button');
    expect(monthButton).toBeInTheDocument();
  });

  it('should highlight selected collection', () => {
    const collections: Collection[] = [
      {
        id: 'selected-1',
        name: 'Selected',
        type: 'custom',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'not-selected',
        name: 'Not Selected',
        type: 'custom',
        order: 'b',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
        selectedCollectionId="selected-1"
      />
    );

    const selectedLink = screen.getByText('Selected').closest('a');
    const notSelectedLink = screen.getByText('Not Selected').closest('a');

    // Check classes for highlighting
    expect(selectedLink?.className).toContain('bg-blue');
    expect(notSelectedLink?.className).not.toContain('bg-blue');
  });

  it('should sort collections correctly: pinned first, then years, then unpinned', () => {
    const collections: Collection[] = [
      {
        id: 'unpinned',
        name: 'Unpinned Custom',
        type: 'custom',
        order: 'a',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'pinned',
        name: 'Pinned Custom',
        type: 'custom',
        isFavorite: true,
        order: 'b',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'daily-1',
        name: 'Sunday, February 1',
        type: 'daily',
        date: '2026-02-01',
        order: 'c',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    localStorage.setItem('collection-hierarchy-expanded', JSON.stringify([]));

    const { container } = renderWithRouter(
      <HierarchicalCollectionList 
        collections={collections}
      />
    );

    // Get all links and buttons in order
    const allElements = container.querySelectorAll('a, button');
    const texts = Array.from(allElements).map(el => el.textContent);

    // Find indices
    const pinnedIndex = texts.findIndex(t => t?.includes('Pinned Custom'));
    const yearIndex = texts.findIndex(t => t?.includes('2026 Logs'));
    const unpinnedIndex = texts.findIndex(t => t?.includes('Unpinned Custom'));

    // Verify order: pinned < year < unpinned
    expect(pinnedIndex).toBeLessThan(yearIndex);
    expect(yearIndex).toBeLessThan(unpinnedIndex);
  });
});
