import type { IEventStore } from '../event-store';
import type { DomainEvent } from '../domain-event';

/**
 * In-memory EventStore for testing
 * NOT FOR PRODUCTION - data lost on page refresh
 */
export class InMemoryEventStore implements IEventStore {
  private events: DomainEvent[] = [];
  private subscribers = new Set<(event: DomainEvent) => void>();

  async append(event: DomainEvent): Promise<void> {
    this.events.push(event);
    this.notifySubscribers(event);
  }

  /**
   * Append multiple events atomically
   * In-memory implementation is inherently atomic (single-threaded JavaScript)
   * Notifies subscribers once per event so incremental projection updates
   * can apply each event individually (Phase 6 — P0-D).
   */
  async appendBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    
    // Push all events to array first (atomic in single-threaded JS)
    this.events.push(...events);
    
    // Notify subscribers once per event so the incremental projection
    // cache update (Phase 6) can apply each event individually.
    for (const event of events) {
      this.notifySubscribers(event);
    }
  }

  async getById(aggregateId: string): Promise<DomainEvent[]> {
    return this.events.filter(e => e.aggregateId === aggregateId);
  }

  async getAll(): Promise<DomainEvent[]> {
    return [...this.events];
  }

  subscribe(callback: (event: DomainEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(event: DomainEvent): void {
    this.subscribers.forEach(cb => cb(event));
  }
}
