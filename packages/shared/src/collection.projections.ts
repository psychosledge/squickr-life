import type { IEventStore } from './event-store';
import type { DomainEvent } from './domain-event';
import type { 
  Collection,
  CollectionCreated,
  CollectionRenamed,
  CollectionReordered,
  CollectionDeleted,
  CollectionSettingsUpdated
} from './collection.types';

/**
 * CollectionListProjection - Read Model for Collections
 * 
 * This projection creates a view of all collections by replaying events
 * from the EventStore and building collection state.
 * 
 * This demonstrates:
 * - Event sourcing projection pattern
 * - Reactive updates via event store subscription
 * - Filtering out soft-deleted collections
 * - Ordering by fractional index
 */
export class CollectionListProjection {
  private subscribers = new Set<() => void>();

  constructor(private readonly eventStore: IEventStore) {
    // Subscribe to event store changes to enable reactive projections
    this.eventStore.subscribe(() => {
      this.notifySubscribers();
    });
  }

  /**
   * Subscribe to projection changes
   * Callback is invoked whenever the projection data changes
   * Returns an unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers that the projection has changed
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  /**
   * Get all collections (excluding soft-deleted ones)
   * 
   * @returns Array of collections sorted by order field
   */
  async getCollections(): Promise<Collection[]> {
    const events = await this.eventStore.getAll();
    return this.applyEvents(events);
  }

  /**
   * Get a specific collection by ID
   * 
   * @param collectionId - The collection ID to find
   * @returns The collection, or undefined if not found or deleted
   */
  async getCollectionById(collectionId: string): Promise<Collection | undefined> {
    const events = await this.eventStore.getById(collectionId);
    const collections = this.applyEvents(events);
    return collections[0];
  }

  /**
   * Get a daily log collection by date
   * 
   * @param date - The date to find (YYYY-MM-DD format)
   * @returns The collection, or undefined if not found
   */
  async getDailyLogByDate(date: string): Promise<Collection | undefined> {
    const collections = await this.getCollections();
    return collections.find(c => c.type === 'daily' && c.date === date);
  }

  /**
   * Apply events to build collection state
   * This handles CollectionCreated, Renamed, Reordered, and Deleted events
   */
  private applyEvents(events: readonly DomainEvent[]): Collection[] {
    const collections: Map<string, Collection> = new Map();

    for (const event of events) {
      if (this.isCollectionEvent(event)) {
        this.applyCollectionEvent(collections, event);
      }
    }

    // Convert to array and filter out deleted collections
    const allCollections = Array.from(collections.values())
      .filter(collection => !collection.deletedAt);

    // Sort by order field (lexicographic comparison for fractional indexing)
    return allCollections.sort((a, b) => {
      return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
    });
  }

  /**
   * Apply a single collection event to the collections map
   */
  private applyCollectionEvent(
    collections: Map<string, Collection>,
    event: CollectionCreated | CollectionRenamed | CollectionReordered | CollectionDeleted | CollectionSettingsUpdated
  ): void {
    switch (event.type) {
      case 'CollectionCreated': {
        const collection: Collection = {
          id: event.payload.id,
          name: event.payload.name,
          type: event.payload.type,
          order: event.payload.order,
          date: event.payload.date,
          createdAt: event.payload.createdAt,
          userId: event.payload.userId,
        };
        collections.set(collection.id, collection);
        break;
      }
      case 'CollectionRenamed': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            name: event.payload.newName,
          });
        }
        break;
      }
      case 'CollectionReordered': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            order: event.payload.order,
          });
        }
        break;
      }
      case 'CollectionDeleted': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            deletedAt: event.payload.deletedAt,
          });
        }
        break;
      }
      case 'CollectionSettingsUpdated': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            settings: event.payload.settings,
          });
        }
        break;
      }
    }
  }

  /**
   * Type guard to check if an event is a collection event
   */
  private isCollectionEvent(
    event: DomainEvent
  ): event is CollectionCreated | CollectionRenamed | CollectionReordered | CollectionDeleted | CollectionSettingsUpdated {
    return (
      event.type === 'CollectionCreated' ||
      event.type === 'CollectionRenamed' ||
      event.type === 'CollectionReordered' ||
      event.type === 'CollectionDeleted' ||
      event.type === 'CollectionSettingsUpdated'
    );
  }
}
