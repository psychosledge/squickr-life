import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CollectionList } from './CollectionList';
import type { Collection } from '@squickr/shared';

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
});
