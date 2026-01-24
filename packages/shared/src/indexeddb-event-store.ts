import type { IEventStore } from './event-store';
import type { DomainEvent } from './domain-event';

/**
 * IndexedDB-backed EventStore
 * 
 * Persists events to browser's IndexedDB for offline-first functionality.
 * Implements the same IEventStore interface as in-memory EventStore.
 * 
 * Architecture benefits:
 * - Liskov Substitution: Can swap in place of EventStore with no code changes
 * - Offline-first: Data persists across page refreshes
 * - PWA-ready: Works offline, syncs when online (future enhancement)
 * 
 * IndexedDB Structure:
 * - Database: squickr-events
 * - Object Store: events
 * - Key: auto-increment ID
 * - Indexes: aggregateId (for efficient filtering)
 */
export class IndexedDBEventStore implements IEventStore {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName = 'events';
  private readonly version = 1;

  constructor(dbName: string = 'squickr-events') {
    this.dbName = dbName;
  }

  /**
   * Initialize IndexedDB connection
   * Must be called before using the store
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: false,
          });

          // Create index on aggregateId for efficient queries
          objectStore.createIndex('aggregateId', 'aggregateId', { unique: false });
          
          // Create index on timestamp for ordering
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Append an event to IndexedDB
   */
  async append(event: DomainEvent): Promise<void> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.add(event);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to append event: ${request.error}`));
    });
  }

  /**
   * Get all events for a specific aggregate
   */
  async getById(aggregateId: string): Promise<DomainEvent[]> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index('aggregateId');
      const request = index.getAll(aggregateId);

      request.onsuccess = () => {
        const events = request.result as DomainEvent[];
        // Sort by timestamp to ensure chronological order
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        resolve(events);
      };

      request.onerror = () => reject(new Error(`Failed to get events: ${request.error}`));
    });
  }

  /**
   * Get all events from the store
   */
  async getAll(): Promise<DomainEvent[]> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const events = request.result as DomainEvent[];
        // Sort by timestamp to ensure chronological order
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        resolve(events);
      };

      request.onerror = () => reject(new Error(`Failed to get all events: ${request.error}`));
    });
  }

  /**
   * Clear all events (useful for testing)
   */
  async clear(): Promise<void> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear events: ${request.error}`));
    });
  }
}
