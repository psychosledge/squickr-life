import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskHandler } from './task.handlers';
import { EventStore } from './event-store';
import type { CreateTaskCommand, TaskCreated } from './task.types';

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
