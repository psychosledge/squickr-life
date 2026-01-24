import { describe, it, expect } from 'vitest';
import type { 
  TaskCreated, 
  CreateTaskCommand,
  Task,
  TaskStatus,
  TaskEvent,
} from './task.types';

describe('TaskCreated Event', () => {
  it('should match the event model schema (EM-001)', () => {
    const taskId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const event: TaskCreated = {
      id: 'event-123',
      type: 'TaskCreated',
      timestamp: '2026-01-24T10:30:00.000Z',
      version: 1,
      aggregateId: taskId,
      payload: {
        id: taskId,
        title: 'Buy milk',
        createdAt: '2026-01-24T10:30:00.000Z',
        status: 'open',
      },
    };

    expect(event.type).toBe('TaskCreated');
    expect(event.aggregateId).toBe(taskId);
    expect(event.payload.id).toBe(taskId);
    expect(event.payload.title).toBe('Buy milk');
    expect(event.payload.status).toBe('open');
    expect(event.payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
  });

  it('should support optional userId field', () => {
    const event: TaskCreated = {
      id: 'event-123',
      type: 'TaskCreated',
      timestamp: new Date().toISOString(),
      version: 1,
      aggregateId: 'task-123',
      payload: {
        id: 'task-123',
        title: 'Test task',
        createdAt: new Date().toISOString(),
        status: 'open',
        userId: 'user-456',
      },
    };

    expect(event.payload.userId).toBe('user-456');
  });

  it('should be assignable to TaskEvent union type', () => {
    const event: TaskCreated = {
      id: 'event-123',
      type: 'TaskCreated',
      timestamp: new Date().toISOString(),
      version: 1,
      aggregateId: 'task-123',
      payload: {
        id: 'task-123',
        title: 'Test',
        createdAt: new Date().toISOString(),
        status: 'open',
      },
    };

    const taskEvent: TaskEvent = event;
    expect(taskEvent.type).toBe('TaskCreated');
  });
});

describe('CreateTaskCommand', () => {
  it('should have title property', () => {
    const command: CreateTaskCommand = {
      title: 'Buy milk',
    };

    expect(command.title).toBe('Buy milk');
  });

  it('should support optional userId', () => {
    const command: CreateTaskCommand = {
      title: 'Test task',
      userId: 'user-123',
    };

    expect(command.userId).toBe('user-123');
  });
});

describe('Task Entity', () => {
  it('should represent a task entity', () => {
    const task: Task = {
      id: 'task-123',
      title: 'Buy milk',
      createdAt: '2026-01-24T10:30:00.000Z',
      status: 'open',
    };

    expect(task.id).toBe('task-123');
    expect(task.title).toBe('Buy milk');
    expect(task.status).toBe('open');
  });

  it('should support optional userId', () => {
    const task: Task = {
      id: 'task-123',
      title: 'Test',
      createdAt: new Date().toISOString(),
      status: 'open',
      userId: 'user-456',
    };

    expect(task.userId).toBe('user-456');
  });
});

describe('TaskStatus', () => {
  it('should only allow "open" status for now', () => {
    const status: TaskStatus = 'open';
    expect(status).toBe('open');
  });
});
