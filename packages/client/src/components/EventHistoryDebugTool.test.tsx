import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventHistoryDebugTool } from './EventHistoryDebugTool';
import type { Entry, DomainEvent } from '@squickr/domain';
import * as DebugContext from '../context/DebugContext';

// Mock import.meta.env
const mockEnv = {
  DEV: true,
};

vi.stubGlobal('import', {
  meta: {
    env: mockEnv,
  },
});

// Mock useDebug hook
const mockUseDebug = vi.fn();
vi.spyOn(DebugContext, 'useDebug').mockImplementation(mockUseDebug);

describe('EventHistoryDebugTool', () => {
  const mockEntry: Entry = {
    id: 'task-123',
    type: 'task',
    title: 'Test Task',
    status: 'open',
    createdAt: '2026-02-14T10:00:00Z',
    collectionId: 'col-1',
    collections: [],
  };

  const mockEvents: DomainEvent[] = [
    {
      id: 'evt-1',
      type: 'TaskCreated',
      aggregateId: 'task-123',
      version: 1,
      payload: {
        id: 'task-123',
        title: 'Test Task',
        status: 'open' as const,
        createdAt: '2026-02-14T10:00:00Z',
      },
      timestamp: '2026-02-14T10:00:00Z',
    },
    {
      id: 'evt-2',
      type: 'TaskTitleUpdated',
      aggregateId: 'task-123',
      version: 1,
      payload: {
        taskId: 'task-123',
        title: 'Updated Task',
      },
      timestamp: '2026-02-14T10:05:00Z',
    },
    {
      id: 'evt-3',
      type: 'TaskCompleted',
      aggregateId: 'task-123',
      version: 1,
      payload: {
        taskId: 'task-123',
      },
      timestamp: '2026-02-14T10:10:00Z',
    },
  ];

  beforeEach(() => {
    mockEnv.DEV = true;
    mockUseDebug.mockReturnValue({
      events: mockEvents,
      isEnabled: true,
    });
  });

  describe('Production Mode Exclusion', () => {
    it('should return null in production mode', () => {
      mockUseDebug.mockReturnValue({
        events: [],
        isEnabled: false,
      });

      const { container } = render(
        <EventHistoryDebugTool entry={mockEntry} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render in development mode', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      expect(screen.getByText('🐛 3')).toBeInTheDocument();
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by aggregateId matching entry.id', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      expect(button).toBeInTheDocument();
    });

    it('should filter events by payload.taskId', () => {
      const eventsWithPayloadId: DomainEvent[] = [
        {
          id: 'evt-migration',
          type: 'TaskMigrated',
          aggregateId: 'migration-1',
          version: 1,
          payload: {
            taskId: 'task-123',
            targetCollectionId: 'col-2',
          },
          timestamp: '2026-02-14T11:00:00Z',
        },
      ];

      mockUseDebug.mockReturnValue({
        events: eventsWithPayloadId,
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={mockEntry} />);

      // Should show 1 event (migration event with payload.taskId)
      const button = screen.getByText('🐛 1');
      expect(button).toBeInTheDocument();
    });

    it('should filter events by payload.noteId for note entries', () => {
      const noteEntry: Entry = {
        id: 'note-456',
        type: 'note',
        content: 'Test Note Content',
        createdAt: '2026-02-14T10:00:00Z',
        collectionId: 'col-1',
      };

      const noteEvents: DomainEvent[] = [
        {
          id: 'evt-note',
          type: 'NoteCreated',
          aggregateId: 'note-456',
          version: 1,
          payload: {
            noteId: 'note-456',
            content: 'Test Note Content',
          },
          timestamp: '2026-02-14T10:00:00Z',
        },
      ];

      mockUseDebug.mockReturnValue({
        events: noteEvents,
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={noteEntry} />);

      const button = screen.getByText('🐛 1');
      expect(button).toBeInTheDocument();
    });

    it('should filter events by payload.eventId for event entries', () => {
      const eventEntry: Entry = {
        id: 'event-789',
        type: 'event',
        content: 'Test Event Content',
        createdAt: '2026-02-14T10:00:00Z',
        collectionId: 'col-1',
      };

      const eventEvents: DomainEvent[] = [
        {
          id: 'evt-event',
          type: 'EventCreated',
          aggregateId: 'event-789',
          version: 1,
          payload: {
            eventId: 'event-789',
            content: 'Test Event Content',
          },
          timestamp: '2026-02-14T10:00:00Z',
        },
      ];

      mockUseDebug.mockReturnValue({
        events: eventEvents,
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={eventEntry} />);

      const button = screen.getByText('🐛 1');
      expect(button).toBeInTheDocument();
    });

    it('should handle entries with no matching events', () => {
      const orphanEntry: Entry = {
        id: 'orphan-999',
        type: 'task',
        title: 'Orphan Task',
        status: 'open',
        createdAt: '2026-02-14T10:00:00Z',
        collectionId: 'col-1',
        collections: [],
      };

      mockUseDebug.mockReturnValue({
        events: mockEvents, // mockEvents don't match orphan-999
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={orphanEntry} />);

      const button = screen.getByText('🐛 0');
      expect(button).toBeInTheDocument();
    });
  });

  describe('UI Interactions', () => {
    it('should show button in collapsed state by default', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-purple-600');
    });

    it('should expand when button is clicked', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      expect(screen.getByText('Event History')).toBeInTheDocument();
      expect(screen.getByText(/Entry ID:/i)).toBeInTheDocument();
      expect(screen.getByText('task-123')).toBeInTheDocument();
    });

    it('should collapse when close button is clicked', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      // Expand
      const expandButton = screen.getByText('🐛 3');
      fireEvent.click(expandButton);

      // Collapse
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      // Should show button again
      expect(screen.getByText('🐛 3')).toBeInTheDocument();
      expect(screen.queryByText('Event History')).not.toBeInTheDocument();
    });

    it('should display entry metadata when expanded', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      expect(screen.getByText('task-123')).toBeInTheDocument();
      expect(screen.getByText('task')).toBeInTheDocument();
      expect(screen.getByText('col-1')).toBeInTheDocument();
    });

    it('should display "None" for entries without collection', () => {
      const entryWithoutCollection: Entry = {
        ...mockEntry,
        collectionId: undefined,
      };

      render(<EventHistoryDebugTool entry={entryWithoutCollection} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('should display event count in expanded view', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      expect(screen.getByText('3 Events')).toBeInTheDocument();
    });

    it('should display singular "Event" for single event', () => {
      const singleEventEntry: Entry = {
        id: 'single-123',
        type: 'task',
        title: 'Single Event Task',
        status: 'open',
        createdAt: '2026-02-14T10:00:00Z',
        collectionId: 'col-1',
        collections: [],
      };

      const singleEvent: DomainEvent[] = [
        {
          id: 'evt-single',
          type: 'TaskCreated',
          aggregateId: 'single-123',
          version: 1,
          payload: {
            id: 'single-123',
            title: 'Single Event Task',
            status: 'open' as const,
            createdAt: '2026-02-14T10:00:00Z',
          },
          timestamp: '2026-02-14T10:00:00Z',
        },
      ];

      mockUseDebug.mockReturnValue({
        events: singleEvent,
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={singleEventEntry} />);

      const button = screen.getByText('🐛 1');
      fireEvent.click(button);

      expect(screen.getByText('1 Event')).toBeInTheDocument();
    });
  });

  describe('Event Display', () => {
    it('should display event type and timestamp', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      expect(screen.getByText('TaskCreated')).toBeInTheDocument();
      expect(screen.getByText('TaskTitleUpdated')).toBeInTheDocument();
      expect(screen.getByText('TaskCompleted')).toBeInTheDocument();
    });

    it('should display formatted event data as JSON', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      // Should show JSON representation of events
      const preElements = screen.getAllByText(/"type":\s*"Task/);
      expect(preElements.length).toBeGreaterThan(0);
    });

    it('should show "No events found" message when no events match', () => {
      const orphanEntry: Entry = {
        id: 'orphan-999',
        type: 'task',
        title: 'Orphan Task',
        status: 'open',
        createdAt: '2026-02-14T10:00:00Z',
        collectionId: 'col-1',
        collections: [],
      };

      mockUseDebug.mockReturnValue({
        events: mockEvents, // mockEvents don't match orphan-999
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={orphanEntry} />);

      const button = screen.getByText('🐛 0');
      fireEvent.click(button);

      expect(screen.getByText('No events found for this entry')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed events without crashing', () => {
      const malformedEvents: DomainEvent[] = [
        {
          id: 'evt-malformed',
          type: 'MalformedEvent',
          aggregateId: 'task-123',
          version: 1,
          payload: null as any,
          timestamp: '2026-02-14T10:00:00Z',
        },
        {
          id: 'evt-missing',
          type: 'MissingTimestamp',
          aggregateId: 'task-123',
          version: 1,
          payload: {},
          timestamp: undefined as any,
        },
      ];

      mockUseDebug.mockReturnValue({
        events: malformedEvents,
        isEnabled: true,
      });

      expect(() => {
        render(<EventHistoryDebugTool entry={mockEntry} />);
      }).not.toThrow();
    });

    it('should handle entries with undefined collectionId', () => {
      const entryWithoutCollection: Entry = {
        ...mockEntry,
        collectionId: undefined,
      };

      expect(() => {
        render(<EventHistoryDebugTool entry={entryWithoutCollection} />);
      }).not.toThrow();
    });

    it('should handle empty events array', () => {
      mockUseDebug.mockReturnValue({
        events: [],
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 0');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    it('should properly type guard event payload fields', () => {
      const mixedEvents: DomainEvent[] = [
        {
          id: 'evt-task',
          type: 'TaskCreated',
          aggregateId: 'task-123',
          version: 1,
          payload: {
            id: 'task-123',
            title: 'Test',
            status: 'open' as const,
            createdAt: '2026-02-14T10:00:00Z',
          },
          timestamp: '2026-02-14T10:00:00Z',
        },
        {
          id: 'evt-other',
          type: 'UnrelatedEvent',
          aggregateId: 'other-999',
          version: 1,
          payload: {
            someOtherId: 'other-999',
          },
          timestamp: '2026-02-14T10:05:00Z',
        },
      ];

      mockUseDebug.mockReturnValue({
        events: mixedEvents,
        isEnabled: true,
      });

      render(<EventHistoryDebugTool entry={mockEntry} />);

      // Should only show the task-created event (1 event)
      const button = screen.getByText('🐛 1');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Position and Layout', () => {
    it('should be positioned in top-right corner to avoid FAB overlap', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      const container = button.parentElement;
      
      // Should be positioned absolute in top-right
      expect(container).toHaveClass('absolute');
      expect(container).toHaveClass('top-4');
      expect(container).toHaveClass('right-12');
    });

    it('should display expanded panel in fixed position', () => {
      render(<EventHistoryDebugTool entry={mockEntry} />);

      const button = screen.getByText('🐛 3');
      fireEvent.click(button);

      const panel = screen.getByText('Event History').parentElement?.parentElement;
      expect(panel).toHaveClass('fixed');
      expect(panel).toHaveClass('top-4');
      expect(panel).toHaveClass('right-4');
    });
  });
});
