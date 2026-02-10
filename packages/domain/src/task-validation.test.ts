import { describe, it, expect, beforeEach } from 'vitest';
import { validateTaskExists, validateTaskStatus } from './task-validation';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { TaskListProjection } from './task.projections';
import type { TaskCreated, TaskCompleted } from './task.types';

describe('task-validation', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
  });

  describe('validateTaskExists', () => {
    it('should return task when it exists', async () => {
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
        },
      };

      await eventStore.append(event);

      const task = await validateTaskExists(projection, 'task-1');
      
      expect(task).toBeDefined();
      expect(task.id).toBe('task-1');
      expect(task.title).toBe('Test task');
    });

    it('should throw error when task does not exist', async () => {
      await expect(
        validateTaskExists(projection, 'non-existent-id')
      ).rejects.toThrow('Task non-existent-id not found');
    });
  });

  describe('validateTaskStatus', () => {
    it('should return task when status matches', async () => {
      const event: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Open task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      await eventStore.append(event);

      const task = await validateTaskStatus(projection, 'task-1', 'open');
      
      expect(task).toBeDefined();
      expect(task.id).toBe('task-1');
      expect(task.status).toBe('open');
    });

    it('should throw error when status does not match', async () => {
      const createEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Completed task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completeEvent: TaskCompleted = {
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

      await eventStore.append(createEvent);
      await eventStore.append(completeEvent);

      await expect(
        validateTaskStatus(projection, 'task-1', 'open')
      ).rejects.toThrow('Task task-1 is not open (status: completed)');
    });

    it('should throw error when task does not exist', async () => {
      await expect(
        validateTaskStatus(projection, 'non-existent-id', 'open')
      ).rejects.toThrow('Task non-existent-id not found');
    });

    it('should validate completed status', async () => {
      const createEvent: TaskCreated = {
        id: 'event-1',
        type: 'TaskCreated',
        timestamp: '2026-01-24T10:00:00.000Z',
        version: 1,
        aggregateId: 'task-1',
        payload: {
          id: 'task-1',
          title: 'Completed task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        },
      };

      const completeEvent: TaskCompleted = {
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

      await eventStore.append(createEvent);
      await eventStore.append(completeEvent);

      const task = await validateTaskStatus(projection, 'task-1', 'completed');
      
      expect(task).toBeDefined();
      expect(task.status).toBe('completed');
    });
  });
});
