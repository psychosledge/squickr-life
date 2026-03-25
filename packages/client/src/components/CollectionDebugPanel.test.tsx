/**
 * CollectionDebugPanel Tests
 * ADR-022: Collection-scoped debug panel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionDebugPanel } from './CollectionDebugPanel';
import type { DomainEvent } from '@squickr/domain';
import * as DebugContext from '../context/DebugContext';

// Mock useDebug hook
const mockUseDebug = vi.fn();
vi.spyOn(DebugContext, 'useDebug').mockImplementation(mockUseDebug);

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
});

describe('CollectionDebugPanel', () => {
  const collectionId = 'col-abc';

  const collectionCreatedEvent: DomainEvent = {
    id: 'evt-1',
    type: 'CollectionCreated',
    aggregateId: 'col-abc',
    version: 1,
    payload: { id: 'col-abc', name: 'My Collection', type: 'custom', order: 'a0', createdAt: '2026-01-01T00:00:00Z' },
    timestamp: '2026-01-01T00:00:00Z',
  };

  const taskCreatedInCollection: DomainEvent = {
    id: 'evt-2',
    type: 'TaskCreated',
    aggregateId: 'task-001',
    version: 1,
    payload: { id: 'task-001', content: 'Task in collection', createdAt: '2026-01-02T00:00:00Z', status: 'open', collectionId: 'col-abc' },
    timestamp: '2026-01-02T00:00:00Z',
  };

  const taskAddedToCollection: DomainEvent = {
    id: 'evt-3',
    type: 'TaskAddedToCollection',
    aggregateId: 'task-002',
    version: 1,
    payload: { taskId: 'task-002', collectionId: 'col-abc', addedAt: '2026-01-03T00:00:00Z' },
    timestamp: '2026-01-03T00:00:00Z',
  };

  const taskForDifferentCollection: DomainEvent = {
    id: 'evt-4',
    type: 'TaskCreated',
    aggregateId: 'task-999',
    version: 1,
    payload: { id: 'task-999', content: 'Other task', createdAt: '2026-01-02T00:00:00Z', status: 'open', collectionId: 'col-other' },
    timestamp: '2026-01-02T00:00:00Z',
  };

  const collectionAddedToDifferent: DomainEvent = {
    id: 'evt-5',
    type: 'TaskAddedToCollection',
    aggregateId: 'task-003',
    version: 1,
    payload: { taskId: 'task-003', collectionId: 'col-other', addedAt: '2026-01-03T00:00:00Z' },
    timestamp: '2026-01-03T00:00:00Z',
  };

  // An event for an entry that was historically in our collection (Pass 2 test)
  const taskAddedHistorically: DomainEvent = {
    id: 'evt-6',
    type: 'TaskAddedToCollection',
    aggregateId: 'task-hist',
    version: 1,
    payload: { taskId: 'task-hist', collectionId: 'col-abc', addedAt: '2026-01-04T00:00:00Z' },
    timestamp: '2026-01-04T00:00:00Z',
  };

  const taskCompletedForHistoricalEntry: DomainEvent = {
    id: 'evt-7',
    type: 'TaskCompleted',
    aggregateId: 'task-hist',
    version: 1,
    payload: { taskId: 'task-hist', completedAt: '2026-01-05T00:00:00Z' },
    timestamp: '2026-01-05T00:00:00Z',
  };

  const allMockEvents: DomainEvent[] = [
    collectionCreatedEvent,
    taskCreatedInCollection,
    taskAddedToCollection,
    taskForDifferentCollection,
    collectionAddedToDifferent,
    taskAddedHistorically,
    taskCompletedForHistoricalEntry,
  ];

  beforeEach(() => {
    mockUseDebug.mockReturnValue({
      events: allMockEvents,
      isEnabled: true,
    });
    vi.mocked(navigator.clipboard.writeText).mockClear();
  });

  describe('Dev Guard', () => {
    it('returns null when isEnabled is false', () => {
      mockUseDebug.mockReturnValue({ events: [], isEnabled: false });

      const { container } = render(<CollectionDebugPanel collectionId={collectionId} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders the debug button when isEnabled is true', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      // Should show a purple bug button in collapsed state
      const button = screen.getByTitle(/view collection events/i);
      expect(button).toBeInTheDocument();
    });
  });

  describe('Event Count', () => {
    it('shows the correct event count on the collapsed button', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      // collectionCreatedEvent (lifecycle for col-abc)                      ✓ included
      // taskCreatedInCollection  (MEMBERSHIP_EVENT_TYPE, payload.collectionId === col-abc) ✓ included
      // taskAddedToCollection    (MEMBERSHIP_EVENT_TYPE, payload.collectionId === col-abc) ✓ included
      // taskAddedHistorically    (MEMBERSHIP_EVENT_TYPE, payload.collectionId === col-abc) ✓ included
      // taskCompletedForHistoricalEntry (task-hist in entryIds via Pass 2)  ✓ included
      // taskForDifferentCollection  (payload.collectionId === col-other)    ✗ excluded
      // collectionAddedToDifferent  (payload.collectionId === col-other)    ✗ excluded
      // Total: 5
      const button = screen.getByTitle(/view collection events/i);
      expect(button).toHaveTextContent('🐛 5');
    });
  });

  describe('Event Filtering', () => {
    it('includes CollectionCreated lifecycle event for matching collectionId', () => {
      mockUseDebug.mockReturnValue({
        events: [collectionCreatedEvent],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByText('CollectionCreated')).toBeInTheDocument();
    });

    it('includes TaskAddedToCollection where payload.collectionId matches', () => {
      mockUseDebug.mockReturnValue({
        events: [taskAddedToCollection],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByText('TaskAddedToCollection')).toBeInTheDocument();
    });

    it('includes all events for entries historically attributed to this collection (Pass 2)', () => {
      mockUseDebug.mockReturnValue({
        events: [taskAddedHistorically, taskCompletedForHistoricalEntry],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      // Both the membership event AND the subsequent task event should appear
      expect(screen.getByText('TaskAddedToCollection')).toBeInTheDocument();
      expect(screen.getByText('TaskCompleted')).toBeInTheDocument();
    });

    it('excludes events for a different collection', () => {
      mockUseDebug.mockReturnValue({
        events: [taskForDifferentCollection, collectionAddedToDifferent],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.queryByText('TaskCreated')).not.toBeInTheDocument();
      expect(screen.queryByText('TaskAddedToCollection')).not.toBeInTheDocument();
    });
  });

  describe('UI Interactions', () => {
    it('clicking the button expands the panel', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByText('Collection Events')).toBeInTheDocument();
    });

    it('clicking ✕ collapses the panel', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      fireEvent.click(screen.getByTitle(/view collection events/i));
      expect(screen.getByText('Collection Events')).toBeInTheDocument();

      fireEvent.click(screen.getByText('✕'));

      expect(screen.queryByText('Collection Events')).not.toBeInTheDocument();
      expect(screen.getByTitle(/view collection events/i)).toBeInTheDocument();
    });

    it('shows collection ID metadata row in expanded panel', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByText(collectionId)).toBeInTheDocument();
    });

    it('shows empty state message when no events match', () => {
      mockUseDebug.mockReturnValue({
        events: [taskForDifferentCollection],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByText('No collection events found')).toBeInTheDocument();
    });
  });

  describe('Clipboard Copy', () => {
    it('copy button renders in expanded panel header', () => {
      render(<CollectionDebugPanel collectionId={collectionId} />);

      fireEvent.click(screen.getByTitle(/view collection events/i));

      expect(screen.getByTitle(/copy all events as json/i)).toBeInTheDocument();
    });

    it('clicking copy calls clipboard.writeText with JSON-stringified collection events', async () => {
      mockUseDebug.mockReturnValue({
        events: [collectionCreatedEvent],
        isEnabled: true,
      });

      render(<CollectionDebugPanel collectionId={collectionId} />);
      fireEvent.click(screen.getByTitle(/view collection events/i));

      const copyButton = screen.getByTitle(/copy all events as json/i);
      fireEvent.click(copyButton);

      // Wait for async clipboard operation
      await vi.waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
      });

      const calledWith = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
      const parsed = JSON.parse(calledWith);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].type).toBe('CollectionCreated');
    });
  });
});
