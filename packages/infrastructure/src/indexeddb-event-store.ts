import type { IEventStore, DomainEvent } from '@squickr/domain';

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
  private readonly idbFactory: IDBFactory;
  private readonly IDBKeyRange: typeof IDBKeyRange;
  private subscribers = new Set<(event: DomainEvent) => void>();

  /**
   * @param dbName - Database name. Defaults to 'squickr-events'.
   *                 Pass a unique name in tests to achieve isolation.
   * @param idbFactory - Optional IDBFactory to inject. Defaults to the global
   *                     `indexedDB`. Pass `new IDBFactory()` from fake-indexeddb
   *                     in unit tests.
   * @param idbKeyRange - Optional IDBKeyRange constructor to inject. Defaults to
   *                      the global `IDBKeyRange`. Pass the named export from
   *                      fake-indexeddb in unit tests.
   */
  constructor(
    dbName: string = 'squickr-events',
    idbFactory?: IDBFactory,
    idbKeyRange?: typeof IDBKeyRange,
  ) {
    this.dbName = dbName;
    // Fall back to the global indexedDB when running in the real browser
    this.idbFactory = idbFactory ?? indexedDB;
    this.IDBKeyRange = idbKeyRange ?? IDBKeyRange;
  }

  /**
   * Initialize IndexedDB connection
   * Must be called before using the store
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.idbFactory.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        // Handle external database deletion (e.g. "Clear site data" in DevTools).
        // When another context requests a version change or deletion while we hold
        // an open connection, the browser fires onversionchange. Without a handler
        // the connection is force-closed and every subsequent transaction throws
        // InvalidStateError. Reloading gives us a clean, re-initialised connection.
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          window.location.reload();
        };
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
   * Notifies all subscribers after successful append
   */
  async append(event: DomainEvent): Promise<void> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readwrite');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.add(event);

      // Wait for transaction to complete, not just the request
      transaction.oncomplete = () => {
        // Notify subscribers after successful append
        this.notifySubscribers(event);
        resolve();
      };
      transaction.onerror = () => reject(new Error(`Failed to append event: ${transaction.error}`));
      request.onerror = () => reject(new Error(`Failed to append event: ${request.error}`));
    });
  }

  /**
   * Append multiple events to IndexedDB atomically
   * Uses a single transaction to ensure all-or-nothing semantics.
   * If any event fails, the entire batch is rolled back.
   * Notifies subscribers ONCE after successful transaction.
   * 
   * @param events - Array of domain events to append
   * @throws Error if batch append fails
   */
  async appendBatch(events: DomainEvent[]): Promise<void> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    if (events.length === 0) return;

    return new Promise((resolve, reject) => {
      // Create a single transaction for all events (atomic!)
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readwrite');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }
      const objectStore = transaction.objectStore(this.storeName);

      // Add all events to the transaction
      for (const event of events) {
        objectStore.add(event);
      }

      // Wait for transaction to complete
      transaction.oncomplete = () => {
        // Notify subscribers once per event so that the incremental projection
        // cache update (Phase 6 / P0-D) can apply each event individually.
        // All events are already persisted before any notification fires,
        // so subscribers that call getAll() will see the full committed set.
        for (const event of events) {
          this.notifySubscribers(event);
        }
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to append batch: ${transaction.error}`));
      };
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
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readonly');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }
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
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readonly');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }
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
   * Get all events appended after the event with the given ID.
   *
   * Two-phase, single-transaction approach (O(log n) index seek vs O(n) full scan):
   *   Phase 1 — O(1) primary-key lookup to find the anchor event's timestamp.
   *   Phase 2 — Inclusive lower-bound range scan on the 'timestamp' index from
   *              that timestamp onward, then filter out the anchor by id.
   *
   * Falls back to getAll() when lastEventId is null or the anchor is not found.
   *
   * Inclusive (not exclusive) lower bound ensures same-millisecond siblings are
   * included; the anchor itself is then excluded by id filter.
   */
  async getAllAfter(lastEventId: string | null): Promise<DomainEvent[]> {
    if (!this.db) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }

    // Null path — return everything, same as getAll()
    if (lastEventId === null) {
      return this.getAll();
    }

    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readonly');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }

      const objectStore = transaction.objectStore(this.storeName);

      // Phase 1: O(1) primary-key lookup for the anchor event
      const anchorRequest = objectStore.get(lastEventId);

      anchorRequest.onsuccess = () => {
        const anchor = anchorRequest.result as DomainEvent | undefined;

        // Anchor not found — fall back to returning all events
        if (anchor === undefined) {
          const allRequest = objectStore.index('timestamp').getAll();
          allRequest.onsuccess = () => {
            const events = allRequest.result as DomainEvent[];
            events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            resolve(events);
          };
          allRequest.onerror = () =>
            reject(new Error(`Failed to get all events (fallback): ${allRequest.error}`));
          return;
        }

        // Phase 2: Inclusive lower-bound range scan starting at anchor's timestamp
        const range = this.IDBKeyRange.lowerBound(anchor.timestamp, false); // inclusive
        const rangeRequest = objectStore.index('timestamp').getAll(range);

        rangeRequest.onsuccess = () => {
          const events = (rangeRequest.result as DomainEvent[])
            // Exclude the anchor itself; keep same-ms siblings and all newer events
            .filter(e => e.id !== lastEventId);
          // Sort by timestamp for stable ordering of same-ms siblings
          events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          resolve(events);
        };

        rangeRequest.onerror = () =>
          reject(new Error(`Failed to get events after anchor: ${rangeRequest.error}`));
      };

      anchorRequest.onerror = () =>
        reject(new Error(`Failed to look up anchor event: ${anchorRequest.error}`));
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
      let transaction: IDBTransaction;
      try {
        transaction = this.db!.transaction([this.storeName], 'readwrite');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'InvalidStateError') {
          this.db = null;
          window.location.reload();
        }
        reject(error);
        return;
      }
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear events: ${request.error}`));
    });
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
