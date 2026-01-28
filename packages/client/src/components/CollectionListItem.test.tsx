import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { CollectionListItem } from './CollectionListItem';
import type { Collection } from '@squickr/shared';

// Helper to render with Router context
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('CollectionListItem', () => {
  const mockCollection: Collection = {
    id: 'collection-1',
    name: 'My Projects',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T00:00:00.000Z',
  };

  it('should render collection name', () => {
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={0} />);
    
    expect(screen.getByText('My Projects')).toBeInTheDocument();
  });

  it('should render entry count with singular text', () => {
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={1} />);
    
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('should render entry count with plural text', () => {
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={5} />);
    
    expect(screen.getByText('5 entries')).toBeInTheDocument();
  });

  it('should render zero entries', () => {
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={0} />);
    
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });

  it('should navigate to collection detail page on click', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={3} />);
    
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/collection/collection-1');
    
    // Verify it's clickable
    await user.click(link);
  });

  it('should have accessible name', () => {
    renderWithRouter(<CollectionListItem collection={mockCollection} entryCount={3} />);
    
    const link = screen.getByRole('link', { name: /My Projects/i });
    expect(link).toBeInTheDocument();
  });

  it('should display collection with special characters in name', () => {
    const specialCollection: Collection = {
      ...mockCollection,
      name: 'Books & Movies (2026)',
    };
    
    renderWithRouter(<CollectionListItem collection={specialCollection} entryCount={0} />);
    
    expect(screen.getByText('Books & Movies (2026)')).toBeInTheDocument();
  });

  it('should display collection with long name', () => {
    const longCollection: Collection = {
      ...mockCollection,
      name: 'This is a very long collection name that might need to wrap or truncate depending on the design',
    };
    
    renderWithRouter(<CollectionListItem collection={longCollection} entryCount={0} />);
    
    expect(screen.getByText(/This is a very long collection name/)).toBeInTheDocument();
  });
});
