import { describe, it, expect } from 'vitest';
import { generateEventMetadata, createDomainEvent } from './event-helpers';
import type { TaskCreated } from './task.types';

describe('event-helpers', () => {
  describe('generateEventMetadata', () => {
    it('should generate unique event IDs', () => {
      const metadata1 = generateEventMetadata();
      const metadata2 = generateEventMetadata();
      
      expect(metadata1.id).not.toBe(metadata2.id);
    });

    it('should generate valid UUID v4', () => {
      const metadata = generateEventMetadata();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(metadata.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate ISO 8601 timestamp', () => {
      const metadata = generateEventMetadata();
      
      // Should be valid ISO date string
      expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be parseable as Date
      const date = new Date(metadata.timestamp);
      expect(date.toISOString()).toBe(metadata.timestamp);
    });

    it('should set version to 1', () => {
      const metadata = generateEventMetadata();
      
      expect(metadata.version).toBe(1);
    });

    it('should generate recent timestamp', () => {
      const beforeTime = new Date().toISOString();
      const metadata = generateEventMetadata();
      const afterTime = new Date().toISOString();
      
      expect(metadata.timestamp >= beforeTime).toBe(true);
      expect(metadata.timestamp <= afterTime).toBe(true);
    });
  });

  describe('createDomainEvent', () => {
    it('should create event with correct structure', () => {
      const event = createDomainEvent<TaskCreated>(
        'TaskCreated',
        'task-123',
        {
          id: 'task-123',
          title: 'Test task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        }
      );

      expect(event.type).toBe('TaskCreated');
      expect(event.aggregateId).toBe('task-123');
      expect(event.payload.id).toBe('task-123');
      expect(event.payload.title).toBe('Test task');
      expect(event.payload.status).toBe('open');
    });

    it('should include event metadata', () => {
      const event = createDomainEvent<TaskCreated>(
        'TaskCreated',
        'task-123',
        {
          id: 'task-123',
          title: 'Test task',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        }
      );

      expect(event.id).toMatch(/^[0-9a-f-]+$/i);
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.version).toBe(1);
    });

    it('should generate unique event IDs for multiple events', () => {
      const event1 = createDomainEvent<TaskCreated>(
        'TaskCreated',
        'task-1',
        {
          id: 'task-1',
          title: 'Task 1',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        }
      );

      const event2 = createDomainEvent<TaskCreated>(
        'TaskCreated',
        'task-2',
        {
          id: 'task-2',
          title: 'Task 2',
          createdAt: '2026-01-24T10:00:00.000Z',
          status: 'open',
        }
      );

      expect(event1.id).not.toBe(event2.id);
    });
  });
});
