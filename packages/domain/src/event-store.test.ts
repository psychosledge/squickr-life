import { describe, it, expect, beforeEach } from 'vitest';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from '@squickr/infrastructure';
import type { DomainEvent } from './domain-event';
import type { TaskCreated } from './task.types';

describe('EventStore', () => {
  let eventStore: IEventStore;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
  });

  describe('append', () => {
    it('should append an event to the store', async () => {
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

    it('should append multiple events in order', async () => {
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
    it('should return events for a specific aggregate', async () => {
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

    it('should return multiple events for the same aggregate in order', async () => {
      const event1: DomainEvent = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
      };

      const event2: DomainEvent = {
        id: 'event-2',
        type: 'TaskUpdated',
        timestamp: '2026-01-24T10:01:00.000Z',
        version: 1,
        aggregateId: 'task-1',
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const events = await eventStore.getById('task-1');
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
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

  describe('appendBatch', () => {
    it('should append all events to store', async () => {
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

      const event3: TaskCreated = {
        id: 'event-3',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:02:00.000Z',
        version: 1,
        aggregateId: 'task-3',
        payload: {
          id: 'task-3',
          title: 'Third',
          createdAt: '2026-01-24T10:02:00.000Z',
          status: 'open',
        },
      };

      await eventStore.appendBatch([event1, event2, event3]);

      const allEvents = await eventStore.getAll();
      expect(allEvents).toHaveLength(3);
      expect(allEvents[0]).toEqual(event1);
      expect(allEvents[1]).toEqual(event2);
      expect(allEvents[2]).toEqual(event3);
    });

    it('should notify subscribers once (not N times)', async () => {
      const event1: DomainEvent = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
      };

      const event2: DomainEvent = {
        id: 'event-2',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:01:00.000Z',
        version: 1,
        aggregateId: 'task-2',
      };

      const event3: DomainEvent = {
        id: 'event-3',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:02:00.000Z',
        version: 1,
        aggregateId: 'task-3',
      };

      let notifyCount = 0;
      eventStore.subscribe(() => notifyCount++);

      await eventStore.appendBatch([event1, event2, event3]);

      // CRITICAL: Should notify once, not 3 times
      expect(notifyCount).toBe(1);
    });

    it('should handle empty batch without error', async () => {
      await eventStore.appendBatch([]);

      const allEvents = await eventStore.getAll();
      expect(allEvents).toHaveLength(0);
    });

    it('should preserve event order', async () => {
      const events: DomainEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          id: `event-${i}`,
          type: 'TaskCreated',
          timestamp: `2026-01-24T10:${String(i).padStart(2, '0')}:00.000Z`,
          version: 1,
          aggregateId: `task-${i}`,
        });
      }

      await eventStore.appendBatch(events);

      const allEvents = await eventStore.getAll();
      expect(allEvents).toHaveLength(20);
      allEvents.forEach((event, i) => {
        expect(event.id).toBe(`event-${i}`);
      });
    });
  });
});
