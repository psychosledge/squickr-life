/**
 * FirestoreEventStore Tests
 * 
 * Tests for Firestore-backed event store implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirestoreEventStore } from '../firestore-event-store';
import type { DomainEvent } from '@squickr/domain';

// Mock Firestore SDK
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

describe('FirestoreEventStore', () => {
  let firestore: any;
  let eventStore: FirestoreEventStore;
  const userId = 'user123';

  beforeEach(() => {
    // Reset all mocks
    mockSetDoc.mockClear();
    mockGetDocs.mockClear();
    mockOnSnapshot.mockClear();
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockQuery.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();

    // Mock Firestore instance
    firestore = {};
    
    // Setup default mock implementations
    mockCollection.mockReturnValue('collection-ref');
    mockDoc.mockReturnValue('doc-ref');
    mockQuery.mockReturnValue('query-ref');
    mockWhere.mockReturnValue('where-ref');
    mockOrderBy.mockReturnValue('orderby-ref');
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockOnSnapshot.mockReturnValue(() => {});

    eventStore = new FirestoreEventStore(firestore, userId);
  });

  describe('constructor', () => {
    it('should create a FirestoreEventStore instance', () => {
      expect(eventStore).toBeDefined();
    });

    it('should store firestore and userId', () => {
      const store = new FirestoreEventStore(firestore, userId);
      expect(store).toBeDefined();
    });
  });

  describe('append()', () => {
    it('should append an event to Firestore', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { taskId: 'task-1', title: 'Test task' },
      };

      await eventStore.append(event);

      expect(mockCollection).toHaveBeenCalledWith(firestore, `users/${userId}/events`);
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), event.id);
      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), event);
    });

    it('should remove undefined values before writing', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1', 
          title: 'Test task',
          description: undefined, // This should be removed
        },
      };

      await eventStore.append(event);

      const cleanedEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1', 
          title: 'Test task',
          // description removed
        },
      };

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), cleanedEvent);
    });

    it('should notify subscribers after appending', async () => {
      const callback = vi.fn();
      eventStore.subscribe(callback);

      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { taskId: 'task-1', title: 'Test task' },
      };

      await eventStore.append(event);

      expect(callback).toHaveBeenCalledWith(event);
    });
  });

  describe('getAll()', () => {
    it('should get all events from Firestore', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          type: 'task-created',
          aggregateId: 'task-1',
          timestamp: '2026-02-07T10:00:00Z',
          data: { taskId: 'task-1', title: 'Task 1' },
        },
        {
          id: 'event-2',
          type: 'task-created',
          aggregateId: 'task-2',
          timestamp: '2026-02-07T11:00:00Z',
          data: { taskId: 'task-2', title: 'Task 2' },
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockEvents.map(data => ({ data: () => data })),
      });

      const events = await eventStore.getAll();

      expect(mockCollection).toHaveBeenCalledWith(firestore, `users/${userId}/events`);
      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(events).toEqual(mockEvents);
    });

    it('should return empty array when no events exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const events = await eventStore.getAll();

      expect(events).toEqual([]);
    });

    it('should sort events by timestamp ascending', async () => {
      const mockEvents = [
        {
          id: 'event-2',
          type: 'task-created',
          aggregateId: 'task-2',
          timestamp: '2026-02-07T11:00:00Z',
          data: { taskId: 'task-2', title: 'Task 2' },
        },
        {
          id: 'event-1',
          type: 'task-created',
          aggregateId: 'task-1',
          timestamp: '2026-02-07T10:00:00Z',
          data: { taskId: 'task-1', title: 'Task 1' },
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockEvents.map(data => ({ data: () => data })),
      });

      await eventStore.getAll();

      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
    });
  });

  describe('getById()', () => {
    it('should get events for a specific aggregate', async () => {
      const aggregateId = 'task-1';
      const mockEvents = [
        {
          id: 'event-1',
          type: 'task-created',
          aggregateId: 'task-1',
          timestamp: '2026-02-07T10:00:00Z',
          data: { taskId: 'task-1', title: 'Task 1' },
        },
        {
          id: 'event-2',
          type: 'task-completed',
          aggregateId: 'task-1',
          timestamp: '2026-02-07T11:00:00Z',
          data: { taskId: 'task-1' },
        },
      ];

      mockGetDocs.mockResolvedValue({
        docs: mockEvents.map(data => ({ data: () => data })),
      });

      const events = await eventStore.getById(aggregateId);

      expect(mockWhere).toHaveBeenCalledWith('aggregateId', '==', aggregateId);
      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(events).toEqual(mockEvents);
    });

    it('should return empty array when no events for aggregate', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const events = await eventStore.getById('nonexistent');

      expect(events).toEqual([]);
    });
  });

  describe('subscribe()', () => {
    it('should subscribe to event store changes', () => {
      const callback = vi.fn();
      const unsubscribe = eventStore.subscribe(callback);

      expect(unsubscribe).toBeTypeOf('function');
    });

    it('should unsubscribe from changes', async () => {
      const callback = vi.fn();
      const unsubscribe = eventStore.subscribe(callback);

      unsubscribe();

      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { taskId: 'task-1', title: 'Test task' },
      };

      await eventStore.append(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventStore.subscribe(callback1);
      eventStore.subscribe(callback2);

      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { taskId: 'task-1', title: 'Test task' },
      };

      await eventStore.append(event);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
    });
  });

  describe('removeUndefined helper', () => {
    it('should remove undefined values from objects', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1',
          title: 'Test',
          description: undefined,
          tags: ['tag1', undefined, 'tag2'],
        },
      };

      await eventStore.append(event);

      const expectedClean = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1',
          title: 'Test',
          tags: ['tag1', null, 'tag2'], // undefined in arrays becomes null
        },
      };

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expectedClean);
    });

    it('should handle nested objects', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1',
          metadata: {
            created: '2026-02-07',
            updated: undefined,
            nested: {
              value: 'test',
              empty: undefined,
            },
          },
        },
      };

      await eventStore.append(event);

      const expectedClean = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1',
          metadata: {
            created: '2026-02-07',
            nested: {
              value: 'test',
            },
          },
        },
      };

      expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expectedClean);
    });

    it('should convert undefined to null', async () => {
      const event: DomainEvent = {
        id: 'event-123',
        type: 'task-created',
        aggregateId: 'task-1',
        timestamp: '2026-02-07T12:00:00Z',
        data: { 
          taskId: 'task-1',
          title: undefined as any,
        },
      };

      await eventStore.append(event);

      // undefined values should be removed, not converted to null
      const call = mockSetDoc.mock.calls[0][1];
      expect(call.data).not.toHaveProperty('title');
    });
  });
});
