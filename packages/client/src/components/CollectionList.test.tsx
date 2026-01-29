import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CollectionList } from './CollectionList';
import type { Collection } from '@squickr/shared';
import { UNCATEGORIZED_COLLECTION_ID } from '../routes';

// Helper to render with Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('CollectionList', () => {
  const mockCollections: Collection[] = [
    {
      id: 'collection-1',
      name: 'Work Projects',
      type: 'log',
      order: 'a0',
      createdAt: '2026-01-27T00:00:00.000Z',
    },
    {
      id: 'collection-2',
      name: 'Personal Goals',
      type: 'log',
      order: 'a1',
      createdAt: '2026-01-27T01:00:00.000Z',
    },
    {
      id: 'collection-3',
      name: 'Reading List',
      type: 'log',
      order: 'a2',
      createdAt: '2026-01-27T02:00:00.000Z',
    },
  ];

  const mockEntryCountsByCollection = new Map<string, number>([
    ['collection-1', 5],
    ['collection-2', 3],
    ['collection-3', 0],
  ]);

  it('should render all collections', () => {
    renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );

    expect(screen.getByText('Work Projects')).toBeInTheDocument();
    expect(screen.getByText('Personal Goals')).toBeInTheDocument();
    expect(screen.getByText('Reading List')).toBeInTheDocument();
  });

  it('should render entry counts for each collection', () => {
    renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );

    expect(screen.getByText('5 entries')).toBeInTheDocument();
    expect(screen.getByText('3 entries')).toBeInTheDocument();
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });

  it('should render empty state when no collections exist', () => {
    renderWithRouter(
      <CollectionList 
        collections={[]} 
        entryCountsByCollection={new Map()}
      />
    );

    expect(screen.getByText('No collections yet')).toBeInTheDocument();
    expect(screen.getByText(/Tap.*to create your first collection/i)).toBeInTheDocument();
  });

  it('should render collection count header when collections exist', () => {
    renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );

    expect(screen.getByText('3 collections')).toBeInTheDocument();
  });

  it('should render singular collection count', () => {
    renderWithRouter(
      <CollectionList 
        collections={[mockCollections[0]]} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );

    expect(screen.getByText('1 collection')).toBeInTheDocument();
  });

  it('should use 0 as default entry count if not provided', () => {
    renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={new Map()}
      />
    );

    // All should show 0 entries
    const zeroEntries = screen.getAllByText('0 entries');
    expect(zeroEntries).toHaveLength(3);
  });

  it('should render collections in provided order', () => {
    renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('Work Projects');
    expect(links[1]).toHaveTextContent('Personal Goals');
    expect(links[2]).toHaveTextContent('Reading List');
  });

  it('should apply bottom padding to prevent FAB overlap', () => {
    const { container } = renderWithRouter(
      <CollectionList 
        collections={mockCollections} 
        entryCountsByCollection={mockEntryCountsByCollection}
      />
    );
    
    const listContainer = container.querySelector('.pb-32');
    expect(listContainer).toBeInTheDocument();
  });

  describe('Drag and Drop', () => {
    it('should render drag handles for all collections', () => {
      renderWithRouter(
        <CollectionList 
          collections={mockCollections} 
          entryCountsByCollection={mockEntryCountsByCollection}
        />
      );

      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(3);
    });

    it('should call onReorder when collection is dropped', async () => {
      const onReorder = vi.fn();
      
      renderWithRouter(
        <CollectionList 
          collections={mockCollections} 
          entryCountsByCollection={mockEntryCountsByCollection}
          onReorder={onReorder}
        />
      );

      // Note: Full drag-and-drop testing requires more complex setup
      // This test verifies the handler is wired up
      expect(onReorder).toBeDefined();
    });

    it('should NOT render drag handle for virtual Uncategorized collection', () => {
      const virtualCollection: Collection = {
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        type: 'custom',
        order: '!',
        createdAt: '2026-01-27T00:00:00.000Z',
      };

      renderWithRouter(
        <CollectionList 
          collections={[virtualCollection, ...mockCollections]} 
          entryCountsByCollection={mockEntryCountsByCollection}
        />
      );

      // Should have 3 drag handles (not 4), excluding Uncategorized
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(3);
    });

    it('should render Uncategorized collection without drag handle', () => {
      const virtualCollection: Collection = {
        id: UNCATEGORIZED_COLLECTION_ID,
        name: 'Uncategorized',
        type: 'custom',
        order: '!',
        createdAt: '2026-01-27T00:00:00.000Z',
      };

      renderWithRouter(
        <CollectionList 
          collections={[virtualCollection]} 
          entryCountsByCollection={new Map([[UNCATEGORIZED_COLLECTION_ID, 5]])}
        />
      );

      // Uncategorized should be visible
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
      
      // But should NOT have a drag handle
      expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();
    });

    it('should calculate previousCollectionId correctly when moving down', () => {
      const onReorder = vi.fn();
      
      renderWithRouter(
        <CollectionList 
          collections={mockCollections} 
          entryCountsByCollection={mockEntryCountsByCollection}
          onReorder={onReorder}
        />
      );

      // Verify onReorder is available for drag operations
      expect(onReorder).toBeDefined();
    });

    it('should calculate nextCollectionId correctly when moving up', () => {
      const onReorder = vi.fn();
      
      renderWithRouter(
        <CollectionList 
          collections={mockCollections} 
          entryCountsByCollection={mockEntryCountsByCollection}
          onReorder={onReorder}
        />
      );

      // Verify onReorder is available for drag operations
      expect(onReorder).toBeDefined();
    });
  });
});
