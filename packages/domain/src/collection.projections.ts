import type { IEventStore } from './event-store';
import type { DomainEvent } from './domain-event';
import type { 
  Collection,
  CollectionCreated,
  CollectionRenamed,
  CollectionReordered,
  CollectionDeleted,
  CollectionRestored,
  CollectionSettingsUpdated,
  CollectionFavorited,
  CollectionUnfavorited,
  CollectionAccessed,
  CollectionSettings,
  CompletedTaskBehavior
} from './collection.types';

/**
 * Migrate legacy collapseCompleted boolean to completedTaskBehavior enum
 * This is called on-read to transform old settings to the new format
 * 
 * Migration rules (from design spec):
 * - collapseCompleted: true  → 'collapse'
 * - collapseCompleted: false → 'keep-in-place'
 * - undefined → undefined (use global default when implemented)
 * 
 * @param settings - The settings from an event (may have legacy format)
 * @returns Migrated settings with completedTaskBehavior
 */
function migrateCollectionSettings(settings?: CollectionSettings): CollectionSettings | undefined {
  if (!settings) {
    return undefined;
  }

  // If already using new format, return as-is
  if ('completedTaskBehavior' in settings && settings.completedTaskBehavior !== undefined) {
    return settings;
  }

  // Migrate from old boolean format
  if ('collapseCompleted' in settings) {
    const behavior: CompletedTaskBehavior | undefined = 
      settings.collapseCompleted === true ? 'collapse' :
      settings.collapseCompleted === false ? 'keep-in-place' :
      undefined;

    return {
      ...settings,
      completedTaskBehavior: behavior,
    };
  }

  return settings;
}

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
   * Get all soft-deleted collections, sorted by deletedAt descending (most recently deleted first)
   */
  async getDeletedCollections(): Promise<Collection[]> {
    const events = await this.eventStore.getAll();
    const allCollections = Array.from(this.buildCollectionMap(events).values());
    return allCollections
      .filter(c => c.deletedAt !== undefined)
      .sort((a, b) => {
        // Most recently deleted first (descending)
        if (a.deletedAt! > b.deletedAt!) return -1;
        if (a.deletedAt! < b.deletedAt!) return 1;
        return 0;
      });
  }

  /**
   * Get a collection by ID, including soft-deleted ones
   * 
   * @param collectionId - The collection ID to find
   * @returns The collection (active or deleted), or undefined if not found
   */
  async getCollectionByIdIncludingDeleted(collectionId: string): Promise<Collection | undefined> {
    const events = await this.eventStore.getById(collectionId);
    const map = this.buildCollectionMap(events);
    return map.get(collectionId);
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
   * Get a monthly log collection by date
   * 
   * @param date - The date to find (YYYY-MM format)
   * @returns The collection, or undefined if not found
   */
  async getMonthlyLogByDate(date: string): Promise<Collection | undefined> {
    const collections = await this.getCollections();
    return collections.find(c => c.type === 'monthly' && c.date === date);
  }

  /**
   * Build a map of all collections (including deleted) by replaying events.
   * Shared by applyEvents, getDeletedCollections, and getCollectionByIdIncludingDeleted.
   */
  private buildCollectionMap(events: readonly DomainEvent[]): Map<string, Collection> {
    const collections: Map<string, Collection> = new Map();
    for (const event of events) {
      if (this.isCollectionEvent(event)) {
        this.applyCollectionEvent(collections, event);
      }
    }
    return collections;
  }

  /**
   * Apply events to build collection state
   * This handles CollectionCreated, Renamed, Reordered, Deleted, Restored, and other events
   */
  private applyEvents(events: readonly DomainEvent[]): Collection[] {
    const collections = this.buildCollectionMap(events);

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
    event: CollectionCreated | CollectionRenamed | CollectionReordered | CollectionDeleted | CollectionRestored | CollectionSettingsUpdated | CollectionFavorited | CollectionUnfavorited | CollectionAccessed
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
      case 'CollectionRestored': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          const { deletedAt, ...restoredCollection } = collection;
          collections.set(collection.id, restoredCollection as Collection);
        }
        break;
      }
      case 'CollectionSettingsUpdated': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          // Apply migration from collapseCompleted to completedTaskBehavior on read
          const migratedSettings = migrateCollectionSettings(event.payload.settings);
          collections.set(collection.id, {
            ...collection,
            settings: migratedSettings,
          });
        }
        break;
      }
      case 'CollectionFavorited': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            isFavorite: true,
          });
        }
        break;
      }
      case 'CollectionUnfavorited': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            isFavorite: false,
          });
        }
        break;
      }
      case 'CollectionAccessed': {
        const collection = collections.get(event.payload.collectionId);
        if (collection) {
          collections.set(collection.id, {
            ...collection,
            lastAccessedAt: event.payload.accessedAt,
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
  ): event is CollectionCreated | CollectionRenamed | CollectionReordered | CollectionDeleted | CollectionRestored | CollectionSettingsUpdated | CollectionFavorited | CollectionUnfavorited | CollectionAccessed {
    return (
      event.type === 'CollectionCreated' ||
      event.type === 'CollectionRenamed' ||
      event.type === 'CollectionReordered' ||
      event.type === 'CollectionDeleted' ||
      event.type === 'CollectionRestored' ||
      event.type === 'CollectionSettingsUpdated' ||
      event.type === 'CollectionFavorited' ||
      event.type === 'CollectionUnfavorited' ||
      event.type === 'CollectionAccessed'
    );
  }
}
