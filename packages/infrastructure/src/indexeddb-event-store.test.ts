import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { IndexedDBEventStore } from './indexeddb-event-store';
import type { DomainEvent, TaskCreated } from '@squickr/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTaskCreated(id: string, timestamp: string, aggregateId?: string): DomainEvent {
  return {
    id,
    type: 'TaskCreated',
    timestamp,
    version: 1,
    aggregateId: aggregateId ?? id,
    payload: {
      id: aggregateId ?? id,
      title: `Task ${id}`,
      createdAt: timestamp,
      status: 'open',
    },
  } as TaskCreated;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndexedDBEventStore', () => {
  let eventStore: IndexedDBEventStore;
  let dbIndex = 0;

  /**
   * Each test gets a fresh IDBFactory instance plus a unique DB name,
   * guaranteeing full isolation without needing deleteDatabase().
   */
  beforeEach(async () => {
    const fakeIDB = new IDBFactory();
    const dbName = `test-squickr-events-${++dbIndex}`;
    eventStore = new IndexedDBEventStore(dbName, fakeIDB, IDBKeyRange);
    await eventStore.initialize();
  });

  // -------------------------------------------------------------------------
  // append / getAll
  // -------------------------------------------------------------------------

  describe('append', () => {
    it('should persist event to IndexedDB', async () => {
      const event = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z', 'task-1');

      await eventStore.append(event);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should persist multiple events in order', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z', 'task-1');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z', 'task-2');

      await eventStore.append(event1);
      await eventStore.append(event2);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------

  describe('getById', () => {
    it('should retrieve events for specific aggregate', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z', 'task-1');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z', 'task-2');

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

  // -------------------------------------------------------------------------
  // getAll
  // -------------------------------------------------------------------------

  describe('getAll', () => {
    it('should return empty array when no events exist', async () => {
      const events = await eventStore.getAll();
      expect(events).toEqual([]);
    });

    it('should return all events sorted by timestamp', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z', 'task-1');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z', 'task-2');

      await eventStore.append(event1);
      await eventStore.append(event2);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });
  });

  // -------------------------------------------------------------------------
  // getAllAfter
  // -------------------------------------------------------------------------

  describe('getAllAfter', () => {
    it('getAllAfter(null) returns all events', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z');
      const event3 = makeTaskCreated('event-3', '2026-01-24T10:02:00.000Z');

      await eventStore.append(event1);
      await eventStore.append(event2);
      await eventStore.append(event3);

      const result = await eventStore.getAllAfter(null);
      expect(result).toHaveLength(3);
    });

    it('getAllAfter(lastEventId) returns empty array when anchor is the last event', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z');

      await eventStore.append(event1);
      await eventStore.append(event2);

      const result = await eventStore.getAllAfter('event-2');
      expect(result).toEqual([]);
    });

    it('getAllAfter(middleId) returns only events after that position', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z');
      const event3 = makeTaskCreated('event-3', '2026-01-24T10:02:00.000Z');

      await eventStore.append(event1);
      await eventStore.append(event2);
      await eventStore.append(event3);

      const result = await eventStore.getAllAfter('event-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('event-2');
      expect(result[1].id).toBe('event-3');
    });

    it('getAllAfter(nonexistent) returns all events (fallback)', async () => {
      const event1 = makeTaskCreated('event-1', '2026-01-24T10:00:00.000Z');
      const event2 = makeTaskCreated('event-2', '2026-01-24T10:01:00.000Z');

      await eventStore.append(event1);
      await eventStore.append(event2);

      const result = await eventStore.getAllAfter('does-not-exist');
      expect(result).toHaveLength(2);
    });

    it('getAllAfter(null) on empty store returns []', async () => {
      const result = await eventStore.getAllAfter(null);
      expect(result).toEqual([]);
    });

    it('getAllAfter(id) on empty store returns [] (fallback)', async () => {
      const result = await eventStore.getAllAfter('event-99');
      expect(result).toEqual([]);
    });

    it('same-millisecond sibling: sibling IS returned, anchor is NOT', async () => {
      // Arrange — anchor and sibling share the same timestamp; newer has a later one
      const SAME_TS = '2026-01-24T10:00:00.000Z';
      const LATER_TS = '2026-01-24T10:01:00.000Z';

      const anchor  = makeTaskCreated('anchor',  SAME_TS);
      const sibling = makeTaskCreated('sibling', SAME_TS);   // same ms, different id
      const newer   = makeTaskCreated('newer',   LATER_TS);

      await eventStore.append(anchor);
      await eventStore.append(sibling);
      await eventStore.append(newer);

      // Act
      const result = await eventStore.getAllAfter('anchor');

      // Assert — sibling (same ms) and newer both returned; anchor excluded
      expect(result.map(e => e.id)).toContain('sibling');
      expect(result.map(e => e.id)).toContain('newer');
      expect(result.map(e => e.id)).not.toContain('anchor');
    });
  });

  // -------------------------------------------------------------------------
  // persistence across instances
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('should persist events across EventStore instances sharing the same DB', async () => {
      // Capture the fakeIDB and dbName from the current store to create a second
      // instance against the same in-memory database.
      const sharedFakeIDB = new IDBFactory();
      const sharedDbName = `shared-db-${++dbIndex}`;

      const store1 = new IndexedDBEventStore(sharedDbName, sharedFakeIDB, IDBKeyRange);
      await store1.initialize();

      const event = makeTaskCreated('event-1', new Date().toISOString(), 'task-1');
      await store1.append(event);

      const store2 = new IndexedDBEventStore(sharedDbName, sharedFakeIDB, IDBKeyRange);
      await store2.initialize();

      const events = await store2.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });
  });

  // -------------------------------------------------------------------------
  // initialize guard
  // -------------------------------------------------------------------------

  describe('initialize guard', () => {
    it('throws if append() is called before initialize()', async () => {
      const uninit = new IndexedDBEventStore('uninit-db', new IDBFactory(), IDBKeyRange);
      const event = makeTaskCreated('event-1', new Date().toISOString());
      await expect(uninit.append(event)).rejects.toThrow('EventStore not initialized');
    });

    it('throws if getAll() is called before initialize()', async () => {
      const uninit = new IndexedDBEventStore('uninit-db-2', new IDBFactory(), IDBKeyRange);
      await expect(uninit.getAll()).rejects.toThrow('EventStore not initialized');
    });
  });
});
