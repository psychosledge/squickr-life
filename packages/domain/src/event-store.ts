import type { DomainEvent } from './domain-event';

/**
 * EventStore interface
 * The core of event sourcing - append-only log of domain events
 * 
 * Principles:
 * - Events are immutable (never updated or deleted)
 * - Events are append-only (insert order preserved)
 * - Events can be replayed to rebuild state
 * - Reactive: Subscribers are notified when events are appended
 * 
 * Clean Architecture:
 * - This interface belongs in the domain layer (innermost circle)
 * - Implementations (IndexedDB, InMemory) belong in infrastructure layer (outermost circle)
 * - Domain depends on nothing; infrastructure depends on domain
 */
export interface IEventStore {
  /**
   * Append a new event to the store
   * @param event - The domain event to append
   */
  append(event: DomainEvent): Promise<void>;

  /**
   * Append multiple events to the store atomically
   * All events are appended in a single transaction/batch.
   * If any event fails, the entire batch is rolled back.
   * 
   * Notifies subscribers ONCE after all events are appended (not N times).
   * This prevents multiple projection rebuilds and UI flashing during bulk operations.
   * 
   * @param events - Array of domain events to append
   * @throws Error if batch append fails
   */
  appendBatch(events: DomainEvent[]): Promise<void>;

  /**
   * Get all events for a specific aggregate
   * @param aggregateId - The aggregate identifier
   * @returns Events in the order they were appended
   */
  getById(aggregateId: string): Promise<DomainEvent[]>;

  /**
   * Get all events in the store
   * @returns All events in the order they were appended
   */
  getAll(): Promise<DomainEvent[]>;

  /**
   * Subscribe to event store changes
   * @param callback - Function to call when events are appended
   * @returns Unsubscribe function
   */
  subscribe(callback: (event: DomainEvent) => void): () => void;
}
