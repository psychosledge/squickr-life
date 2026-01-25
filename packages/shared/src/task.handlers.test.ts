import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler, DeleteTaskHandler } from './task.handlers';
import { EventStore } from './event-store';
import { TaskListProjection } from './task.projections';
import type { CreateTaskCommand, TaskCreated, TaskCompleted, TaskReopened, TaskDeleted, CompleteTaskCommand, ReopenTaskCommand, DeleteTaskCommand } from './task.types';

describe('CreateTaskHandler', () => {
  let eventStore: EventStore;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    handler = new CreateTaskHandler(eventStore);
  });

  describe('handle', () => {
    it('should create a TaskCreated event for valid command', async () => {
      const command: CreateTaskCommand = {
        title: 'Buy milk',
      };

      const taskId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);

      const event = events[0] as TaskCreated;
      expect(event.type).toBe('TaskCreated');
      expect(event.payload.title).toBe('Buy milk');
      expect(event.payload.status).toBe('open');
      expect(event.payload.id).toBe(taskId);
      expect(event.aggregateId).toBe(taskId);
    });

    it('should generate unique UUID for task ID', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      const taskId1 = await handler.handle(command);
      const taskId2 = await handler.handle(command);

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should trim whitespace from title', async () => {
      const command: CreateTaskCommand = {
        title: '  Buy milk  ',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.title).toBe('Buy milk');
    });

    it('should include userId if provided', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
        userId: 'user-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.userId).toBe('user-123');
    });

    it('should set createdAt timestamp', async () => {
      const beforeTime = new Date().toISOString();
      
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      await handler.handle(command);

      const afterTime = new Date().toISOString();
      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;

      expect(event.payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.payload.createdAt >= beforeTime).toBe(true);
      expect(event.payload.createdAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;

      expect(event.id).toMatch(/^[0-9a-f-]+$/i); // UUID format
      expect(event.version).toBe(1);
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if title is empty after trim', async () => {
      const command: CreateTaskCommand = {
        title: '   ',
      };

      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should throw error if title is too long', async () => {
      const command: CreateTaskCommand = {
        title: 'a'.repeat(501),
      };

      await expect(handler.handle(command)).rejects.toThrow('Title must be between 1 and 500 characters');
    });

    it('should throw error if title is missing', async () => {
      const command: CreateTaskCommand = {
        title: '',
      };

      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should accept title exactly 500 characters', async () => {
      const command: CreateTaskCommand = {
        title: 'a'.repeat(500),
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      const event = events[0] as TaskCreated;
      expect(event.payload.title).toHaveLength(500);
    });
  });
});

describe('CompleteTaskHandler', () => {
  let eventStore: EventStore;
  let projection: TaskListProjection;
  let createHandler: CreateTaskHandler;
  let completeHandler: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new TaskListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore);
    completeHandler = new CompleteTaskHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a TaskCompleted event for valid command', async () => {
      // Create a task first
      const taskId = await createHandler.handle({ title: 'Buy milk' });

      // Complete the task
      const command: CompleteTaskCommand = { taskId };
      await completeHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const completedEvent = events[1] as TaskCompleted;
      expect(completedEvent.type).toBe('TaskCompleted');
      expect(completedEvent.payload.taskId).toBe(taskId);
      expect(completedEvent.aggregateId).toBe(taskId);
      expect(completedEvent.payload.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set completedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      const beforeTime = new Date().toISOString();
      await completeHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const completedEvent = events[1] as TaskCompleted;

      expect(completedEvent.payload.completedAt >= beforeTime).toBe(true);
      expect(completedEvent.payload.completedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const completedEvent = events[1] as TaskCompleted;

      expect(completedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(completedEvent.version).toBe(1);
      expect(completedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: CompleteTaskCommand = { taskId: 'non-existent-id' };

      await expect(completeHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should throw error if task is already completed', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });

      await expect(completeHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' is not open');
    });
  });
});

describe('ReopenTaskHandler', () => {
  let eventStore: EventStore;
  let projection: TaskListProjection;
  let createHandler: CreateTaskHandler;
  let completeHandler: CompleteTaskHandler;
  let reopenHandler: ReopenTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new TaskListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore);
    completeHandler = new CompleteTaskHandler(eventStore, projection);
    reopenHandler = new ReopenTaskHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a TaskReopened event for valid command', async () => {
      // Create and complete a task
      const taskId = await createHandler.handle({ title: 'Buy milk' });
      await completeHandler.handle({ taskId });

      // Reopen the task
      const command: ReopenTaskCommand = { taskId };
      await reopenHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3);

      const reopenedEvent = events[2] as TaskReopened;
      expect(reopenedEvent.type).toBe('TaskReopened');
      expect(reopenedEvent.payload.taskId).toBe(taskId);
      expect(reopenedEvent.aggregateId).toBe(taskId);
      expect(reopenedEvent.payload.reopenedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set reopenedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });
      
      const beforeTime = new Date().toISOString();
      await reopenHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const reopenedEvent = events[2] as TaskReopened;

      expect(reopenedEvent.payload.reopenedAt >= beforeTime).toBe(true);
      expect(reopenedEvent.payload.reopenedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const reopenedEvent = events[2] as TaskReopened;

      expect(reopenedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(reopenedEvent.version).toBe(1);
      expect(reopenedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: ReopenTaskCommand = { taskId: 'non-existent-id' };

      await expect(reopenHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should throw error if task is not completed', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });

      await expect(reopenHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' is not completed');
    });

    it('should allow reopening and completing multiple times', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      // Complete -> Reopen -> Complete -> Reopen
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(5); // Created, Completed, Reopened, Completed, Reopened
    });
  });
});

describe('DeleteTaskHandler', () => {
  let eventStore: EventStore;
  let projection: TaskListProjection;
  let createHandler: CreateTaskHandler;
  let deleteHandler: DeleteTaskHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new TaskListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore);
    deleteHandler = new DeleteTaskHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a TaskDeleted event for valid command', async () => {
      // Create a task first
      const taskId = await createHandler.handle({ title: 'Buy milk' });

      // Delete the task
      const command: DeleteTaskCommand = { taskId };
      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const deletedEvent = events[1] as TaskDeleted;
      expect(deletedEvent.type).toBe('TaskDeleted');
      expect(deletedEvent.payload.taskId).toBe(taskId);
      expect(deletedEvent.aggregateId).toBe(taskId);
      expect(deletedEvent.payload.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set deletedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      const beforeTime = new Date().toISOString();
      await deleteHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const deletedEvent = events[1] as TaskDeleted;

      expect(deletedEvent.payload.deletedAt >= beforeTime).toBe(true);
      expect(deletedEvent.payload.deletedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const deletedEvent = events[1] as TaskDeleted;

      expect(deletedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(deletedEvent.version).toBe(1);
      expect(deletedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: DeleteTaskCommand = { taskId: 'non-existent-id' };

      await expect(deleteHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should allow deleting open tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Open task' });

      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('TaskDeleted');
    });

    it('should allow deleting completed tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Completed task' });
      const completeHandler = new CompleteTaskHandler(eventStore, projection);
      await completeHandler.handle({ taskId });

      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3); // Created, Completed, Deleted
      expect(events[2].type).toBe('TaskDeleted');
    });

    it('should not allow deleting already deleted tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await deleteHandler.handle({ taskId });

      // Try to delete again
      await expect(deleteHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' not found');
    });
  });
});
