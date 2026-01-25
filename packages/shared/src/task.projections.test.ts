import { describe, it, expect, beforeEach } from 'vitest';
import { TaskListProjection } from './task.projections';
import { EventStore } from './event-store';
import type { TaskCreated, TaskCompleted, TaskReopened, Task } from './task.types';

describe('TaskListProjection', () => {
  let eventStore: EventStore;
  let projection: TaskListProjection;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new TaskListProjection(eventStore);
  });

  describe('getTasks', () => {
    it('should return empty array when no events exist', async () => {
      const tasks = await projection.getTasks();
      expect(tasks).toEqual([]);
    });

    it('should return task from TaskCreated event', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event);

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual({
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      });
    });

    it('should return multiple tasks in chronological order', async () => {
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

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('First task');
      expect(tasks[1].title).toBe('Second task');
    });

    it('should include userId if present in event', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Test task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
          userId: 'user-123',
        },
      };

      await eventStore.append(event);

      const tasks = await projection.getTasks();
      expect(tasks[0].userId).toBe('user-123');
    });
  });

  describe('getTaskById', () => {
    it('should return undefined for non-existent task', async () => {
      const task = await projection.getTaskById('non-existent');
      expect(task).toBeUndefined();
    });

    it('should return task by ID', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event);

      const task = await projection.getTaskById('task-1');
      expect(task).toEqual({
        id: 'task-1',
        title: 'Buy milk',
        createdAt: '2026-01-24T10:00:00.000Z',
        status: 'open',
      });
    });
  });

  describe('rebuild', () => {
    it('should rebuild projection from events', async () => {
      const event1: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Task 1',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event1);

      // Rebuild projection
      await projection.rebuild();

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Task 1');
    });

    it('should clear and rebuild projection state', async () => {
      const event1: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Task 1',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event1);
      await projection.rebuild();

      // Add another event
      const event2: TaskCreated = {
        id: 'event-2',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:01:00.000Z',
        version: 1,
        aggregateId: 'task-2',
        payload: {
          id: 'task-2',
          title: 'Task 2',
          createdAt: '2026-01-24T10:01:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event2);
      await projection.rebuild();

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(2);
    });
  });

  describe('TaskCompleted events', () => {
    it('should mark task as completed', async () => {
      const createdEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completedEvent: TaskCompleted = {
        id: 'event-2',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:05:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:05:00.000Z',
        },
      };

      await eventStore.append(createdEvent);
      await eventStore.append(completedEvent);

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('completed');
      expect(tasks[0].completedAt).toBe('2026-01-24T10:05:00.000Z');
    });

    it('should preserve original createdAt when completing task', async () => {
      const createdEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completedEvent: TaskCompleted = {
        id: 'event-2',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:05:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:05:00.000Z',
        },
      };

      await eventStore.append(createdEvent);
      await eventStore.append(completedEvent);

      const tasks = await projection.getTasks();
      expect(tasks[0].createdAt).toBe('2026-01-24T10:00:00.000Z');
    });
  });

  describe('TaskReopened events', () => {
    it('should reopen completed task', async () => {
      const createdEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completedEvent: TaskCompleted = {
        id: 'event-2',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:05:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:05:00.000Z',
        },
      };

      const reopenedEvent: TaskReopened = {
        id: 'event-3',
        type: 'TaskReopened',
        timestamp: '2026-01-24T10:10:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          reopenedAt: '2026-01-24T10:10:00.000Z',
        },
      };

      await eventStore.append(createdEvent);
      await eventStore.append(completedEvent);
      await eventStore.append(reopenedEvent);

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('open');
      expect(tasks[0].completedAt).toBeUndefined();
    });

    it('should preserve original createdAt when reopening task', async () => {
      const createdEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completedEvent: TaskCompleted = {
        id: 'event-2',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:05:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:05:00.000Z',
        },
      };

      const reopenedEvent: TaskReopened = {
        id: 'event-3',
        type: 'TaskReopened',
        timestamp: '2026-01-24T10:10:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          reopenedAt: '2026-01-24T10:10:00.000Z',
        },
      };

      await eventStore.append(createdEvent);
      await eventStore.append(completedEvent);
      await eventStore.append(reopenedEvent);

      const tasks = await projection.getTasks();
      expect(tasks[0].createdAt).toBe('2026-01-24T10:00:00.000Z');
    });

    it('should handle multiple complete/reopen cycles', async () => {
      const createdEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Buy milk',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completedEvent1: TaskCompleted = {
        id: 'event-2',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:05:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:05:00.000Z',
        },
      };

      const reopenedEvent1: TaskReopened = {
        id: 'event-3',
        type: 'TaskReopened',
        timestamp: '2026-01-24T10:10:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          reopenedAt: '2026-01-24T10:10:00.000Z',
        },
      };

      const completedEvent2: TaskCompleted = {
        id: 'event-4',
        type: 'TaskCompleted',
        timestamp: '2026-01-24T10:15:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          taskId: 'task-1',
          completedAt: '2026-01-24T10:15:00.000Z',
        },
      };

      await eventStore.append(createdEvent);
      await eventStore.append(completedEvent1);
      await eventStore.append(reopenedEvent1);
      await eventStore.append(completedEvent2);

      const tasks = await projection.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('completed');
      expect(tasks[0].completedAt).toBe('2026-01-24T10:15:00.000Z'); // Latest completion time
      expect(tasks[0].createdAt).toBe('2026-01-24T10:00:00.000Z'); // Original creation time
    });
  });
});
