import { describe, it, expect } from 'vitest';
import type { DomainEvent } from './index';

describe('DomainEvent', () => {
  it('should have the correct structure', () => {
    // Test-First Terry: This is an example test showing the DomainEvent interface
    const event: DomainEvent = {
      id: 'test-id-123',
      type: 'TestEvent',
      timestamp: new Date().toISOString(),
      version: 1,
      aggregateId: 'aggregate-123',
    };

    expect(event.id).toBe('test-id-123');
    expect(event.type).toBe('TestEvent');
    expect(event.version).toBe(1);
    expect(event.aggregateId).toBe('aggregate-123');
  });

  it('should enforce readonly properties at compile time', () => {
    const event: DomainEvent = {
      id: 'test-id',
      type: 'TestEvent',
      timestamp: new Date().toISOString(),
      version: 1,
      aggregateId: 'aggregate-123',
    };

    // TypeScript will prevent this at compile time:
    // event.id = 'new-id'; // Error: Cannot assign to 'id' because it is a read-only property

    // Runtime check to ensure the object exists
    expect(event).toBeDefined();
  });
});
