import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBEventStore } from './indexeddb-event-store';
import type { TaskCreated } from './task.types';

// Skip these tests in Node environment since IndexedDB is browser-only
// These will work when run in the client package with jsdom environment
describe.skip('IndexedDBEventStore', () => {
  let eventStore: IndexedDBEventStore;
  const dbName = 'test-squickr-events';

  beforeEach(async () => {
    eventStore = new IndexedDBEventStore(dbName);
    await eventStore.initialize();
  });

  afterEach(async () => {
    // Clean up: delete the test database
    try {
      await eventStore.clear();
      indexedDB.deleteDatabase(dbName);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('append', () => {
    it('should persist event to IndexedDB', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      };

      await eventStore.append(event);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should persist multiple events in order', async () => {
      const event1: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'First task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const event2: TaskCreated = {
        id: 'event-2',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:01:00.000Z',
        version: 1,
        aggregateId: 'task-2',
        payload: {
          id: 'task-2',
          title: 'Second task',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });
  });

  describe('getById', () => {
    it('should retrieve events for specific aggregate', async () => {
      const event1: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Task 1',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      };

      const event2: TaskCreated = {
        id: 'event-2',
        type: 'TaskCreated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: 'task-2',
        payload: {
          id: 'task-2',
          title: 'Task 2',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const task1Events = await eventStore.getById('task-1');
      expect(task1Events).toHaveLength(1);
      expect(task1Events[0]).toEqual(event1);
    });

    it('should return empty array for non-existent aggregate', async () => {
      const events = await eventStore.getById('non-existent');
      expect(events).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no events exist', async () => {
      const events = await eventStore.getAll();
      expect(events).toEqual([]);
    });

    it('should return all events in order', async () => {
      const event1: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'First',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const event2: TaskCreated = {
        id: 'event-2',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:01:00.000Z',
        version: 1,
        aggregateId: 'task-2',
        payload: {
          id: 'task-2',
          title: 'Second',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });
  });

  describe('persistence', () => {
    it('should persist events across EventStore instances', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Persisted task',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      };

      await eventStore.append(event);

      // Create a new instance (simulates page refresh)
      const newEventStore = new IndexedDBEventStore(dbName);
      await newEventStore.initialize();

      const events = await newEventStore.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });
  });

  describe('initialize', () => {
    it('should create database and object store', async () => {
      const newStore = new IndexedDBEventStore('test-new-db');
      await newStore.initialize();

      // Should be able to append without errors
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: new Date().toISOString(),
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Test',
          createdAt: new Date().toISOString(),
          status: 'open',
        },
      };

      await newStore.append(event);
      const events = await newStore.getAll();
      expect(events).toHaveLength(1);

      // Cleanup
      await newStore.clear();
      indexedDB.deleteDatabase('test-new-db');
    });
  });
});
