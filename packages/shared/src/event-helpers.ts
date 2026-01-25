import type { DomainEvent } from './domain-event';

/**
 * Event Metadata
 * Common fields for all domain events
 */
export interface EventMetadata {
  readonly id: string;
  readonly timestamp: string;
  readonly version: number;
}

/**
 * Generate event metadata with unique ID and timestamp
 * 
 * This helper centralizes the event metadata generation logic
 * that was duplicated across all command handlers.
 * 
 * @returns EventMetadata with unique UUID and ISO timestamp
 */
export function generateEventMetadata(): EventMetadata {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Create a domain event with standard metadata
 * 
 * Helper to reduce boilerplate when creating events.
 * Combines event metadata generation with event construction.
 * 
 * @param type - The event type (e.g., 'TaskCreated')
 * @param aggregateId - The ID of the aggregate this event belongs to
 * @param payload - The event payload (type-specific data)
 * @returns Complete domain event with metadata
 */
export function createDomainEvent<T extends DomainEvent>(
  type: T['type'],
  aggregateId: string,
  payload: T['payload']
): T {
  const metadata = generateEventMetadata();
  
  return {
    ...metadata,
    type,
    aggregateId,
    payload,
  } as T;
}
