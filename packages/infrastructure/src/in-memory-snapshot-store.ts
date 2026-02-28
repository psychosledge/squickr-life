import type { ISnapshotStore, ProjectionSnapshot } from '@squickr/domain';

/**
 * In-memory SnapshotStore for testing and lightweight usage.
 * NOT FOR PRODUCTION — data is lost when the instance is garbage-collected.
 */
export class InMemorySnapshotStore implements ISnapshotStore {
  private readonly store = new Map<string, ProjectionSnapshot>();

  async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
    this.store.set(key, snapshot);
  }

  async load(key: string): Promise<ProjectionSnapshot | null> {
    return this.store.get(key) ?? null;
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }
}
