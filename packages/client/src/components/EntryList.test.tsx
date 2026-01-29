import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntryList } from './EntryList';
import type { Entry } from '@squickr/shared';

describe('EntryList', () => {
  const mockOnCompleteTask = vi.fn();
  const mockOnReopenTask = vi.fn();
  const mockOnUpdateTaskTitle = vi.fn();
  const mockOnUpdateNoteContent = vi.fn();
  const mockOnUpdateEventContent = vi.fn();
  const mockOnUpdateEventDate = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnReorder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show empty state when no entries exist', () => {
    render(
      <EntryList 
        entries={[]}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
  });

  it('should render multiple entries', () => {
    const entries: Entry[] = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
      {
        type: 'note',
        id: 'note-1',
        content: 'Important note',
        createdAt: '2026-01-24T10:00:00.000Z',
      },
      {
        type: 'event',
        id: 'event-1',
        content: 'Team meeting',
        createdAt: '2026-01-24T10:00:00.000Z',
        eventDate: '2026-02-15',
      },
    ];

    render(
      <EntryList 
        entries={entries}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Important note')).toBeInTheDocument();
    expect(screen.getByText('Team meeting')).toBeInTheDocument();
  });

  it('should display entry count', () => {
    const entries: Entry[] = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Task 1',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
      {
        type: 'task',
        id: 'task-2',
        title: 'Task 2',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
    ];

    render(
      <EntryList 
        entries={entries}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  it('should display singular "entry" for single item', () => {
    const entries: Entry[] = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Task 1',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
    ];

    render(
      <EntryList 
        entries={entries}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    expect(screen.getByText('1 entry')).toBeInTheDocument();
  });

  it('should render all three entry types together', () => {
    const entries: Entry[] = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Do something',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
      {
        type: 'note',
        id: 'note-1',
        content: 'Remember this',
        createdAt: '2026-01-24T10:01:00.000Z',
      },
      {
        type: 'event',
        id: 'event-1',
        content: 'Appointment',
        createdAt: '2026-01-24T10:02:00.000Z',
      },
    ];

    render(
      <EntryList 
        entries={entries}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    // Check for different bullets
    expect(screen.getByText('•')).toBeInTheDocument(); // Task
    expect(screen.getByText('–')).toBeInTheDocument(); // Note
    expect(screen.getByText('○')).toBeInTheDocument(); // Event
  });

  describe('Drag and drop', () => {
    it('should enable drag-and-drop for tasks', () => {
      const entries: Entry[] = [
        {
          type: 'task',
          id: 'task-1',
          title: 'First task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
        {
          type: 'task',
          id: 'task-2',
          title: 'Second task',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
        },
      ];

      render(
        <EntryList 
          entries={entries}
          onCompleteTask={mockOnCompleteTask}
          onReopenTask={mockOnReopenTask}
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
          onUpdateNoteContent={mockOnUpdateNoteContent}
          onUpdateEventContent={mockOnUpdateEventContent}
          onUpdateEventDate={mockOnUpdateEventDate}
          onDelete={mockOnDelete}
          onReorder={mockOnReorder}
        />
      );
      
      // Verify both tasks are rendered
      expect(screen.getByText('First task')).toBeInTheDocument();
      expect(screen.getByText('Second task')).toBeInTheDocument();
      
      // Verify drag handles are present
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(2);
    });

    it('should enable drag-and-drop for notes', () => {
      const entries: Entry[] = [
        {
          type: 'note',
          id: 'note-1',
          content: 'First note',
          createdAt: '2026-01-24T10:00:00.000Z',
        },
        {
          type: 'note',
          id: 'note-2',
          content: 'Second note',
          createdAt: '2026-01-24T10:01:00.000Z',
        },
      ];

      render(
        <EntryList 
          entries={entries}
          onCompleteTask={mockOnCompleteTask}
          onReopenTask={mockOnReopenTask}
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
          onUpdateNoteContent={mockOnUpdateNoteContent}
          onUpdateEventContent={mockOnUpdateEventContent}
          onUpdateEventDate={mockOnUpdateEventDate}
          onDelete={mockOnDelete}
          onReorder={mockOnReorder}
        />
      );
      
      // Verify both notes are rendered
      expect(screen.getByText('First note')).toBeInTheDocument();
      expect(screen.getByText('Second note')).toBeInTheDocument();
      
      // Verify drag handles are present for notes
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(2);
    });

    it('should enable drag-and-drop for events', () => {
      const entries: Entry[] = [
        {
          type: 'event',
          id: 'event-1',
          content: 'First event',
          createdAt: '2026-01-24T10:00:00.000Z',
        },
        {
          type: 'event',
          id: 'event-2',
          content: 'Second event',
          createdAt: '2026-01-24T10:01:00.000Z',
          eventDate: '2026-03-01',
        },
      ];

      render(
        <EntryList 
          entries={entries}
          onCompleteTask={mockOnCompleteTask}
          onReopenTask={mockOnReopenTask}
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
          onUpdateNoteContent={mockOnUpdateNoteContent}
          onUpdateEventContent={mockOnUpdateEventContent}
          onUpdateEventDate={mockOnUpdateEventDate}
          onDelete={mockOnDelete}
          onReorder={mockOnReorder}
        />
      );
      
      // Verify both events are rendered
      expect(screen.getByText('First event')).toBeInTheDocument();
      expect(screen.getByText('Second event')).toBeInTheDocument();
      
      // Verify drag handles are present for events
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(2);
    });

    it('should enable drag-and-drop for mixed entry types', () => {
      const entries: Entry[] = [
        {
          type: 'task',
          id: 'task-1',
          title: 'A task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
        {
          type: 'note',
          id: 'note-1',
          content: 'A note',
          createdAt: '2026-01-24T10:01:00.000Z',
        },
        {
          type: 'event',
          id: 'event-1',
          content: 'An event',
          createdAt: '2026-01-24T10:02:00.000Z',
        },
      ];

      render(
        <EntryList 
          entries={entries}
          onCompleteTask={mockOnCompleteTask}
          onReopenTask={mockOnReopenTask}
          onUpdateTaskTitle={mockOnUpdateTaskTitle}
          onUpdateNoteContent={mockOnUpdateNoteContent}
          onUpdateEventContent={mockOnUpdateEventContent}
          onUpdateEventDate={mockOnUpdateEventDate}
          onDelete={mockOnDelete}
          onReorder={mockOnReorder}
        />
      );
      
      // Verify all entries are rendered
      expect(screen.getByText('A task')).toBeInTheDocument();
      expect(screen.getByText('A note')).toBeInTheDocument();
      expect(screen.getByText('An event')).toBeInTheDocument();
      
      // Verify drag handles are present for all entry types
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(3);
    });
  });

  it('should apply bottom padding to prevent FAB overlap', () => {
    const entries: Entry[] = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Task 1',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      },
    ];

    const { container } = render(
      <EntryList 
        entries={entries}
        onCompleteTask={mockOnCompleteTask}
        onReopenTask={mockOnReopenTask}
        onUpdateTaskTitle={mockOnUpdateTaskTitle}
        onUpdateNoteContent={mockOnUpdateNoteContent}
        onUpdateEventContent={mockOnUpdateEventContent}
        onUpdateEventDate={mockOnUpdateEventDate}
        onDelete={mockOnDelete}
        onReorder={mockOnReorder}
      />
    );
    
    const listContainer = container.querySelector('.pb-32');
    expect(listContainer).toBeInTheDocument();
  });
});
