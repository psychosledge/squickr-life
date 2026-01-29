import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { SortableCollectionItem } from './SortableCollectionItem';
import type { Collection } from '@squickr/shared';

// Helper to render with Router and DnD context
const renderWithContext = (ui: React.ReactElement, collectionIds: string[] = []) => {
  return render(
    <BrowserRouter>
      <DndContext>
        <SortableContext items={collectionIds}>
          {ui}
        </SortableContext>
      </DndContext>
    </BrowserRouter>
  );
};

describe('SortableCollectionItem', () => {
  const mockCollection: Collection = {
    id: 'collection-1',
    name: 'Work Projects',
    type: 'log',
    order: 'a0',
    createdAt: '2026-01-27T00:00:00.000Z',
  };

  it('should render collection name', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    expect(screen.getByText('Work Projects')).toBeInTheDocument();
  });

  it('should render entry count', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    expect(screen.getByText('5 entries')).toBeInTheDocument();
  });

  it('should render drag handle', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toBeInTheDocument();
  });

  it('should have drag handle with proper ARIA attributes', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toHaveAttribute('aria-label', 'Drag to reorder');
    expect(dragHandle).toHaveAttribute('title', 'Drag to reorder');
  });

  it('should have drag handle with cursor-grab class', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toHaveClass('cursor-grab');
  });

  it('should have drag handle with touch-action none for mobile', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    // Check inline style attribute directly
    expect(dragHandle.style.touchAction).toBe('none');
  });

  it('should render drag handle icon', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    const svg = dragHandle.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
  });

  it('should link to collection detail page', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/collection/collection-1');
  });

  it('should render with proper spacing for drag handle', () => {
    const { container } = renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    // Check for relative positioning and group class
    const wrapper = container.querySelector('.relative.group');
    expect(wrapper).toBeInTheDocument();
  });

  it('should have proper hover states on drag handle', () => {
    renderWithContext(
      <SortableCollectionItem collection={mockCollection} entryCount={5} />,
      [mockCollection.id]
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    // Check for hover opacity classes (desktop)
    expect(dragHandle.className).toContain('md:opacity-30');
    expect(dragHandle.className).toContain('md:group-hover:opacity-100');
  });
});
