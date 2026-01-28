import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableEntryItem } from './SortableEntryItem';
import type { Entry } from '@squickr/shared';

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

describe('SortableEntryItem', () => {
  const mockOnCompleteTask = vi.fn();
  const mockOnReopenTask = vi.fn();
  const mockOnUpdateTaskTitle = vi.fn();
  const mockOnUpdateNoteContent = vi.fn();
  const mockOnUpdateEventContent = vi.fn();
  const mockOnUpdateEventDate = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTask: Entry = {
    type: 'task',
    id: 'task-1',
    title: 'Test task',
    createdAt: '2026-01-24T10:00:00.000Z',
    status: 'open',
  };

  const mockNote: Entry = {
    type: 'note',
    id: 'note-1',
    content: 'Test note',
    createdAt: '2026-01-24T10:00:00.000Z',
  };

  const mockEvent: Entry = {
    type: 'event',
    id: 'event-1',
    content: 'Test event',
    createdAt: '2026-01-24T10:00:00.000Z',
    eventDate: '2026-02-15',
  };

  it('should render EntryItem with drag-and-drop wrapper', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    // Should render the entry content
    expect(screen.getByText('Test task')).toBeInTheDocument();
    
    // Should render the drag handle SVG
    const dragHandle = screen.getByLabelText('Drag to reorder');
    expect(dragHandle).toBeInTheDocument();
  });

  it('should show drag handle on hover', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    
    // Drag handle should have md:opacity-30 by default and md:group-hover:opacity-100
    expect(dragHandle).toHaveClass('md:opacity-30');
    expect(dragHandle).toHaveClass('md:group-hover:opacity-100');
    expect(dragHandle).toHaveClass('md:group-focus-within:opacity-100');
  });

  it('should have proper cursor styles for drag handle', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    
    expect(dragHandle).toHaveClass('cursor-grab');
    expect(dragHandle).toHaveClass('active:cursor-grabbing');
  });

  it('should pass through task props to EntryItem', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onDelete={mockOnDelete}
      />
    );

    // Should render task content (verifying props passed through)
    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.getByText('☐')).toBeInTheDocument(); // Task bullet
    
    // Should have Complete button (verifying handler passed through)
    expect(screen.getByRole('button', { name: /complete task/i })).toBeInTheDocument();
  });

  it('should pass through note props to EntryItem', () => {
    render(
      <SortableEntryItem
        entry={mockNote}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onDelete={mockOnDelete}
      />
    );

    // Should render note content
    expect(screen.getByText('Test note')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument(); // Note bullet
  });

  it('should pass through event props to EntryItem', () => {
    render(
      <SortableEntryItem
        entry={mockEvent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
      />
    );

    // Should render event content
    expect(screen.getByText('Test event')).toBeInTheDocument();
    expect(screen.getByText('○')).toBeInTheDocument(); // Event bullet
    expect(screen.getByText(/February 15, 2026/i)).toBeInTheDocument(); // Event date
  });

  it('should apply dragging opacity when isDragging is true', () => {
    // Mock useSortable to return isDragging: true
    vi.doMock('@dnd-kit/sortable', () => ({
      useSortable: () => ({
        attributes: { role: 'button', tabIndex: 0 },
        listeners: { onPointerDown: vi.fn() },
        setNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: true,
      }),
    }));

    const { container } = render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    // The wrapper div should have opacity: 0.5 when dragging
    const wrapper = container.querySelector('.relative.group');
    expect(wrapper).toBeInTheDocument();
  });

  it('should have relative and group classes on wrapper', () => {
    const { container } = render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    const wrapper = container.querySelector('.relative.group');
    expect(wrapper).toBeInTheDocument();
    // Should have responsive padding for mobile drag handle
    expect(wrapper).toHaveClass('pr-14');
    expect(wrapper).toHaveClass('md:pr-0');
    expect(wrapper).toHaveClass('md:pl-0');
  });

  it('should render SVG icon in drag handle', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    const svg = dragHandle.querySelector('svg');
    
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
  });

  it('should position drag handle responsively', () => {
    render(
      <SortableEntryItem
        entry={mockTask}
        onDelete={mockOnDelete}
      />
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    
    expect(dragHandle).toHaveClass('absolute');
    // Mobile: inside container at right-2
    expect(dragHandle).toHaveClass('right-2');
    // Desktop: outside container at left-0 with offset
    expect(dragHandle).toHaveClass('md:left-0');
    expect(dragHandle).toHaveClass('md:-translate-x-8');
  });
});
