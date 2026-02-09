import { renderWithAppProvider } from "./../test/test-utils";
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { HierarchicalCollectionList } from './HierarchicalCollectionList';
import type { Collection, UserPreferences } from '@squickr/domain';

// Helper to render with Router and App context
const renderWithRouter = (ui: React.ReactElement, options?: { userPreferences?: UserPreferences }) => {
  return renderWithAppProvider(<BrowserRouter>{ui}</BrowserRouter>, options);
};

describe('HierarchicalCollectionList', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render empty state when no collections exist', () => {
    renderWithRouter(
      <HierarchicalCollectionList collections={[]} />
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
      <HierarchicalCollectionList collections={collections} />
    );

    // Should show year node
    expect(screen.getByText('2026 Logs')).toBeInTheDocument();
    
    // Should show month node
    expect(screen.getByText('February')).toBeInTheDocument();
    
    // Should show day node (with year now included)
    expect(screen.getByText('Sunday, February 1, 2026')).toBeInTheDocument();
  });

  it('should show note icon for all custom collections (no star icons in sidebar)', () => {
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

    // Both should have note icon (no star icons in sidebar)
    const favoriteLink = screen.getByText('Favorite Ideas').closest('a');
    expect(favoriteLink?.textContent).toContain('📝');

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
      <HierarchicalCollectionList collections={collections} />
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
      <HierarchicalCollectionList collections={collections} />
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
      <HierarchicalCollectionList collections={collections} />
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

  it('should sort collections correctly: pinned first, then unpinned, then years', () => {
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

    // Verify order: pinned < unpinned < year
    expect(pinnedIndex).toBeLessThan(unpinnedIndex);
    expect(unpinnedIndex).toBeLessThan(yearIndex);
  });

  it('should show auto-favorited daily logs in favorites section even when year/month are collapsed', async () => {
    const user = userEvent.setup();
    
    // Create a daily log for today (which will be auto-favorited)
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const collections: Collection[] = [
      {
        id: 'today-log',
        name: 'Today',
        type: 'daily',
        date: todayDate,
        order: 'a',
        createdAt: new Date().toISOString(),
      },
    ];

    const autoFavoritePreferences: UserPreferences = {
      autoFavoriteRecentDailyLogs: true,
    };

    // Start with year/month COLLAPSED
    localStorage.setItem('collection-hierarchy-expanded', JSON.stringify([]));

    renderWithAppProvider(
      <BrowserRouter>
        <HierarchicalCollectionList collections={collections} />
      </BrowserRouter>,
      { userPreferences: autoFavoritePreferences }
    );

    // Today should appear in favorites section (at depth 0, no indentation)
    const todayLinks = screen.getAllByText(/Today/);
    expect(todayLinks.length).toBeGreaterThanOrEqual(1);
    
    // Verify today is showing in the favorites section
    // (it should appear BEFORE the year node)
    const allElements = document.querySelectorAll('a, button');
    const texts = Array.from(allElements).map(el => el.textContent);
    
    const todayIndex = texts.findIndex(t => t?.includes('Today'));
    const yearIndex = texts.findIndex(t => t?.includes(`${today.getFullYear()} Logs`));
    
    // Today should appear before the year node (in favorites section)
    expect(todayIndex).toBeGreaterThan(-1);
    expect(todayIndex).toBeLessThan(yearIndex);

    // Now expand the year
    const yearButton = screen.getByText(new RegExp(`${today.getFullYear()} Logs`));
    await user.click(yearButton);

    // Today should still appear in favorites section AND in the hierarchy
    const todayLinksAfterExpand = screen.getAllByText(/Today/);
    expect(todayLinksAfterExpand.length).toBeGreaterThanOrEqual(1);
  });

  describe('Visual Dividers', () => {
    it('should render divider between favorites and other custom collections', () => {
      const collections: Collection[] = [
        {
          id: 'fav-1',
          name: 'Favorite Collection',
          type: 'custom',
          isFavorite: true,
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'custom-1',
          name: 'Regular Collection',
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

      // Find dividers (horizontal separators)
      const dividers = container.querySelectorAll('.border-t');
      
      // Should have exactly 1 divider (between favorites and other customs)
      expect(dividers.length).toBe(1);
      
      // Divider should have proper ARIA role
      const separator = container.querySelector('[role="separator"]');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('should render divider between other custom collections and date hierarchy', () => {
      const collections: Collection[] = [
        {
          id: 'custom-1',
          name: 'Regular Collection',
          type: 'custom',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      const { container } = renderWithRouter(
        <HierarchicalCollectionList 
          collections={collections}
          
        />
      );

      // Find dividers
      const dividers = container.querySelectorAll('.border-t');
      
      // Should have exactly 1 divider (between customs and date hierarchy)
      expect(dividers.length).toBe(1);
    });

    it('should render divider between favorites and date hierarchy when no other customs exist', () => {
      const collections: Collection[] = [
        {
          id: 'fav-1',
          name: 'Favorite Collection',
          type: 'custom',
          isFavorite: true,
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      const { container } = renderWithRouter(
        <HierarchicalCollectionList 
          collections={collections}
          
        />
      );

      // Find dividers
      const dividers = container.querySelectorAll('.border-t');
      
      // Should have exactly 1 divider (between favorites and date hierarchy, skipping other customs)
      expect(dividers.length).toBe(1);
    });

    it('should render two dividers when all three sections exist', () => {
      const collections: Collection[] = [
        {
          id: 'fav-1',
          name: 'Favorite Collection',
          type: 'custom',
          isFavorite: true,
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'custom-1',
          name: 'Regular Collection',
          type: 'custom',
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

      const { container } = renderWithRouter(
        <HierarchicalCollectionList 
          collections={collections}
          
        />
      );

      // Find dividers
      const dividers = container.querySelectorAll('.border-t');
      
      // Should have exactly 2 dividers (favorites -> other customs -> date hierarchy)
      expect(dividers.length).toBe(2);
    });

    it('should not render any dividers when only one section exists', () => {
      const collections: Collection[] = [
        {
          id: 'custom-1',
          name: 'Only Collection',
          type: 'custom',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { container } = renderWithRouter(
        <HierarchicalCollectionList 
          collections={collections}
          
        />
      );

      // Find dividers
      const dividers = container.querySelectorAll('.border-t');
      
      // Should have no dividers when only one section exists
      expect(dividers.length).toBe(0);
    });
  });

  describe('ARIA Accessibility', () => {
    it('should render ARIA live region for screen reader announcements', () => {
      const collections: Collection[] = [
        {
          id: 'custom-1',
          name: 'Test Collection',
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

      // Check for ARIA live region
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('should have screen-reader-only class on ARIA live region', () => {
      const collections: Collection[] = [
        {
          id: 'custom-1',
          name: 'Test Collection',
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

      // Check for sr-only class (screen reader only)
      const liveRegion = screen.getByRole('status');
      expect(liveRegion.className).toContain('sr-only');
    });

    it('should announce divider state to screen readers', () => {
      const collections: Collection[] = [
        {
          id: 'custom-1',
          name: 'Test Collection',
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

      // Check the announcement text
      const liveRegion = screen.getByRole('status');
      expect(liveRegion.textContent).toBe('Dividers shown between groups');
    });

    it('should render dividers with proper ARIA separator role', () => {
      const collections: Collection[] = [
        {
          id: 'fav-1',
          name: 'Favorite Collection',
          type: 'custom',
          isFavorite: true,
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'custom-1',
          name: 'Regular Collection',
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

      // Check for ARIA separator role
      const separators = container.querySelectorAll('[role="separator"]');
      expect(separators.length).toBeGreaterThan(0);
      
      // All separators should have horizontal orientation
      separators.forEach(separator => {
        expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
      });
    });
  });
});
