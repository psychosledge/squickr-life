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
 */
export interface IEventStore {
  /**
   * Append a new event to the store
   * @param event - The domain event to append
   */
  append(event: DomainEvent): Promise<void>;

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

/**
 * In-memory EventStore implementation
 * 
 * This is a simple implementation for learning and testing.
 * In production, this would be backed by IndexedDB (Item 9)
 * 
 * Architecture notes:
 * - Single Responsibility: Only stores and retrieves events
 * - Open/Closed: Can be extended with IndexedDB without modification
 * - Liskov Substitution: Any IEventStore implementation is interchangeable
 * - Interface Segregation: Minimal interface (append, getById, getAll)
 * - Dependency Inversion: Depends on DomainEvent abstraction, not concrete types
 */
export class EventStore implements IEventStore {
  private events: DomainEvent[] = [];
  private subscribers = new Set<(event: DomainEvent) => void>();

  /**
   * Append an event to the in-memory store
   * Notifies all subscribers after appending
   */
  async append(event: DomainEvent): Promise<void> {
    // In event sourcing, events are immutable facts
    // We never modify or delete events, only append
    this.events.push(event);
    
    // Notify subscribers of the new event
    this.notifySubscribers(event);
  }

  /**
   * Get all events for a specific aggregate
   * Returns events in the order they were appended (chronological)
   */
  async getById(aggregateId: string): Promise<DomainEvent[]> {
    return this.events.filter(event => event.aggregateId === aggregateId);
  }

  /**
   * Get all events from the store
   * Used by projections to rebuild state from scratch
   */
  async getAll(): Promise<DomainEvent[]> {
    // Return a copy to prevent external mutation
    return [...this.events];
  }

  /**
   * Subscribe to event store changes
   * Returns an unsubscribe function
   */
  subscribe(callback: (event: DomainEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers of a new event
   */
  private notifySubscribers(event: DomainEvent): void {
    this.subscribers.forEach(callback => callback(event));
  }
}
