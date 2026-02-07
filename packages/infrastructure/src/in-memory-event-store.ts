import type { IEventStore, DomainEvent } from '@squickr/domain';

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
