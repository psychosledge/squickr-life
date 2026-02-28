import type { ISnapshotStore, ProjectionSnapshot } from '@squickr/domain';

/**
 * IndexedDB-backed SnapshotStore
 *
 * Persists projection snapshots to the browser's IndexedDB for offline-first
 * functionality. Implements the same ISnapshotStore interface as InMemorySnapshotStore.
 *
 * Architecture benefits:
 * - Liskov Substitution: Can swap in place of InMemorySnapshotStore with no code changes
 * - Offline-first: Data persists across page refreshes
 * - PWA-ready: Works offline, syncs when online (future enhancement)
 *
 * IndexedDB Structure:
 * - Database: squickr-snapshots  (separate from squickr-events)
 * - Object Store: snapshots
 * - Key: 'key' (the projection name, e.g. 'entry-list')
 */
export class IndexedDBSnapshotStore implements ISnapshotStore {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName = 'snapshots';
  private readonly version = 1;
  private readonly idbFactory: IDBFactory;

  /**
   * @param dbName - Database name. Defaults to 'squickr-snapshots'.
   *                 Pass a unique name in tests to achieve isolation.
   * @param idbFactory - Optional IDBFactory to inject. Defaults to the global
   *                     `indexedDB`. Pass `new IDBFactory()` from fake-indexeddb
   *                     in unit tests.
   */
  constructor(dbName: string = 'squickr-snapshots', idbFactory?: IDBFactory) {
    this.dbName = dbName;
    // Fall back to the global indexedDB when running in the real browser
    this.idbFactory = idbFactory ?? indexedDB;
  }

  /**
   * Initialize IndexedDB connection.
   * Must be called before using the store.
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.idbFactory.open(this.dbName, this.version);

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
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Persist a snapshot under the given key (upsert — replaces any existing value).
   */
  async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      // put() is an upsert: it inserts or replaces the record with this key
      objectStore.put({ key, ...snapshot });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error(`Failed to save snapshot: ${transaction.error}`));
    });
  }

  /**
   * Load a snapshot by key.
   * Returns null if no snapshot has been saved under that key.
   */
  async load(key: string): Promise<ProjectionSnapshot | null> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const record = request.result as ({ key: string } & ProjectionSnapshot) | undefined;

        if (record === undefined) {
          resolve(null);
          return;
        }

        // Strip the keyPath field before returning the ProjectionSnapshot
        const { key: _key, ...snapshot } = record;
        resolve(snapshot as ProjectionSnapshot);
      };

      request.onerror = () =>
        reject(new Error(`Failed to load snapshot: ${request.error}`));
    });
  }

  /**
   * Delete the snapshot stored under the given key.
   * Resolves silently if no snapshot exists (no-op).
   */
  async clear(key: string): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      objectStore.delete(key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(new Error(`Failed to clear snapshot: ${transaction.error}`));
    });
  }

  /**
   * Guard: throws a synchronous error if initialize() has not been called yet.
   */
  private ensureInitialized(): void {
    if (this.db === null) {
      throw new Error('SnapshotStore not initialized. Call initialize() first.');
    }
  }
}
