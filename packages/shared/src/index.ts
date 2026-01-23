// Shared types and interfaces for Squickr Life
// This file will export all event types, commands, and domain models

/**
 * Base interface for all domain events in the system
 * Following event sourcing principles - events are immutable facts
 */
export interface DomainEvent {
  /** Unique identifier for this event */
  readonly id: string;
  
  /** Type discriminator for event types */
  readonly type: string;
  
  /** ISO 8601 timestamp when event occurred */
  readonly timestamp: string;
  
  /** Version of the event schema (for future migrations) */
  readonly version: number;
  
  /** ID of the aggregate this event belongs to */
  readonly aggregateId: string;
}

/**
 * Placeholder - actual event types will be defined by Morgan during event modeling
 */
export type SquickrEvent = DomainEvent;

// More types will be added as we model events
