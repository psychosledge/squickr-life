import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntryList } from './EntryList';
import type { Entry } from '@squickr/domain';

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
    expect(screen.getByText('☐')).toBeInTheDocument(); // Task
    expect(screen.getByText('📝')).toBeInTheDocument(); // Note
    expect(screen.getByText('📅')).toBeInTheDocument(); // Event
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

  it('should render entry list container without bottom padding', () => {
    // Bottom padding is now the responsibility of the parent view
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
    
    const listContainer = container.querySelector('.max-w-2xl.mx-auto');
    expect(listContainer).toBeInTheDocument();
    expect(listContainer).not.toHaveClass('pb-32');
    expect(listContainer).not.toHaveClass('pb-20');
  });

  // ============================================================================
  // Phase 2: Visual Hierarchy & Filtering Tests
  // ============================================================================

  describe('Phase 2: Top-Level Entry Filtering', () => {
    it('should filter out sub-tasks from top-level list', () => {
      // Arrange: Mix of top-level and sub-tasks
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Parent task',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Sub-task 1',
          status: 'open',
          createdAt: '2026-02-07T10:01:00Z',
          parentTaskId: 'parent-1', // This is a sub-task
        },
        {
          id: 'subtask-2',
          type: 'task',
          title: 'Sub-task 2',
          status: 'open',
          createdAt: '2026-02-07T10:02:00Z',
          parentTaskId: 'parent-1', // This is a sub-task
        },
        {
          id: 'task-2',
          type: 'task',
          title: 'Another top-level task',
          status: 'open',
          createdAt: '2026-02-07T11:00:00Z',
        },
      ];

      // Act
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

      // Assert: Only top-level entries should be rendered
      expect(screen.getByText('Parent task')).toBeInTheDocument();
      expect(screen.getByText('Another top-level task')).toBeInTheDocument();
      
      // Sub-tasks should NOT appear in main list
      expect(screen.queryByText('Sub-task 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Sub-task 2')).not.toBeInTheDocument();
      
      // Count should only show top-level entries
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });

    it('should show empty state when all entries are sub-tasks', () => {
      // Arrange: Only sub-tasks
      const entries: Entry[] = [
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Sub-task 1',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
          parentTaskId: 'parent-1',
        },
        {
          id: 'subtask-2',
          type: 'task',
          title: 'Sub-task 2',
          status: 'open',
          createdAt: '2026-02-07T11:00:00Z',
          parentTaskId: 'parent-1',
        },
      ];

      // Act
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

      // Assert: Empty state should be shown
      expect(screen.getByText(/No entries yet/i)).toBeInTheDocument();
      expect(screen.queryByText('Sub-task 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Sub-task 2')).not.toBeInTheDocument();
    });

    it('should handle mixed entry types with sub-tasks filtered out', () => {
      // Arrange: Tasks, notes, events, and sub-tasks
      const entries: Entry[] = [
        {
          id: 'task-1',
          type: 'task',
          title: 'Top-level task',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Sub-task',
          status: 'open',
          createdAt: '2026-02-07T10:01:00Z',
          parentTaskId: 'task-1',
        },
        {
          id: 'note-1',
          type: 'note',
          content: 'A note',
          createdAt: '2026-02-07T11:00:00Z',
        },
        {
          id: 'event-1',
          type: 'event',
          content: 'An event',
          createdAt: '2026-02-07T12:00:00Z',
        },
      ];

      // Act
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

      // Assert: Only top-level entries (task, note, event) should render
      expect(screen.getByText('Top-level task')).toBeInTheDocument();
      expect(screen.getByText('A note')).toBeInTheDocument();
      expect(screen.getByText('An event')).toBeInTheDocument();
      expect(screen.queryByText('Sub-task')).not.toBeInTheDocument();
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    it('should allow drag-and-drop only for top-level entries', () => {
      // Arrange: Parent and sub-tasks
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Parent task',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Sub-task',
          status: 'open',
          createdAt: '2026-02-07T10:01:00Z',
          parentTaskId: 'parent-1',
        },
      ];

      // Act
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

      // Assert: Only 1 drag handle (for parent, not sub-task)
      const dragHandles = screen.getAllByLabelText('Drag to reorder');
      expect(dragHandles).toHaveLength(1);
      expect(screen.getByText('Parent task')).toBeInTheDocument();
    });
  });

  // Phase 3: Sub-Task Visual Rendering Tests
  describe('Phase 3: Sub-Task Visual Rendering', () => {
    it('should render sub-tasks indented under their parent task', async () => {
      // Arrange
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Plan Vacation',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Book flights',
          status: 'open',
          createdAt: '2026-02-07T10:01:00Z',
          parentTaskId: 'parent-1',
        },
        {
          id: 'subtask-2',
          type: 'task',
          title: 'Book hotel',
          status: 'open',
          createdAt: '2026-02-07T10:02:00Z',
          parentTaskId: 'parent-1',
        },
      ];

      const mockGetSubTasks = vi.fn().mockResolvedValue([
        {
          id: 'subtask-1',
          type: 'task',
          title: 'Book flights',
          status: 'open',
          createdAt: '2026-02-07T10:01:00Z',
          parentTaskId: 'parent-1',
        },
        {
          id: 'subtask-2',
          type: 'task',
          title: 'Book hotel',
          status: 'open',
          createdAt: '2026-02-07T10:02:00Z',
          parentTaskId: 'parent-1',
        },
      ]);

      // Act
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
          getSubTasks={mockGetSubTasks}
        />
      );

      // Wait for async sub-task loading
      await screen.findByText('Book flights');

      // Assert: Sub-tasks appear in UI
      expect(screen.getByText('Plan Vacation')).toBeInTheDocument();
      expect(screen.getByText('Book flights')).toBeInTheDocument();
      expect(screen.getByText('Book hotel')).toBeInTheDocument();
      
      // Verify getSubTasks was called with parent ID
      expect(mockGetSubTasks).toHaveBeenCalledWith('parent-1');
    });

    it('should render multiple parents with their own sub-tasks', async () => {
      // Arrange
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Plan Vacation',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'parent-2',
          type: 'task',
          title: 'Plan Party',
          status: 'open',
          createdAt: '2026-02-07T11:00:00Z',
        },
      ];

      const mockGetSubTasks = vi.fn((parentId: string) => {
        if (parentId === 'parent-1') {
          return Promise.resolve([
            {
              id: 'subtask-1',
              type: 'task',
              title: 'Book flights',
              status: 'open',
              createdAt: '2026-02-07T10:01:00Z',
              parentTaskId: 'parent-1',
            },
          ]);
        }
        if (parentId === 'parent-2') {
          return Promise.resolve([
            {
              id: 'subtask-2',
              type: 'task',
              title: 'Buy decorations',
              status: 'open',
              createdAt: '2026-02-07T11:01:00Z',
              parentTaskId: 'parent-2',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      // Act
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
          getSubTasks={mockGetSubTasks}
        />
      );

      // Wait for async loading
      await screen.findByText('Book flights');
      await screen.findByText('Buy decorations');

      // Assert: Each parent shows its own sub-tasks
      expect(screen.getByText('Plan Vacation')).toBeInTheDocument();
      expect(screen.getByText('Book flights')).toBeInTheDocument();
      expect(screen.getByText('Plan Party')).toBeInTheDocument();
      expect(screen.getByText('Buy decorations')).toBeInTheDocument();
    });

    it('should handle parent with no sub-tasks', async () => {
      // Arrange
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Standalone Task',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
      ];

      const mockGetSubTasks = vi.fn().mockResolvedValue([]);

      // Act
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
          getSubTasks={mockGetSubTasks}
        />
      );

      // Assert: Parent renders, no sub-tasks
      expect(screen.getByText('Standalone Task')).toBeInTheDocument();
      expect(mockGetSubTasks).toHaveBeenCalledWith('parent-1');
    });

    it('should not call getSubTasks for notes and events', () => {
      // Arrange
      const entries: Entry[] = [
        {
          id: 'note-1',
          type: 'note',
          content: 'A note',
          createdAt: '2026-02-07T11:00:00Z',
        },
        {
          id: 'event-1',
          type: 'event',
          content: 'An event',
          createdAt: '2026-02-07T12:00:00Z',
        },
      ];

      const mockGetSubTasks = vi.fn().mockResolvedValue([]);

      // Act
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
          getSubTasks={mockGetSubTasks}
        />
      );

      // Assert: getSubTasks not called for non-tasks
      expect(mockGetSubTasks).not.toHaveBeenCalled();
    });

    it('should gracefully handle when getSubTasks is not provided', () => {
      // Arrange
      const entries: Entry[] = [
        {
          id: 'parent-1',
          type: 'task',
          title: 'Plan Vacation',
          status: 'open',
          createdAt: '2026-02-07T10:00:00Z',
        },
      ];

      // Act - no getSubTasks prop
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

      // Assert: Still renders parent, no errors
      expect(screen.getByText('Plan Vacation')).toBeInTheDocument();
    });
  });
});
