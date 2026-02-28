import type { Entry } from './task.types';

/**
 * Schema version for projection snapshots.
 *
 * Increment this constant whenever the shape of {@link ProjectionSnapshot}
 * changes in a backward-incompatible way (e.g. fields added/removed, the
 * meaning of `state` changes).  Implementations that load a snapshot whose
 * `version` differs from the current `SNAPSHOT_SCHEMA_VERSION` should discard
 * the stale snapshot and rebuild the projection from scratch.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * A point-in-time snapshot of a projection's read-model state.
 *
 * Snapshots allow a projection to skip replaying every event from the
 * beginning of the event log.  Instead the projection can:
 *
 * 1. Load the most recent snapshot.
 * 2. Fetch only the events that arrived **after** `lastEventId`.
 * 3. Apply those incremental events on top of `state`.
 *
 * Snapshots are an optimisation — the projection must remain correct even
 * when no snapshot is present.
 */
export interface ProjectionSnapshot {
  /**
   * Schema version of this snapshot.
   * Must equal {@link SNAPSHOT_SCHEMA_VERSION} for the snapshot to be usable.
   * Any other value means the snapshot was created by a different version of
   * the code and should be discarded.
   */
  readonly version: number;

  /**
   * The `id` of the last {@link DomainEvent} that was folded into `state`.
   * Used to fetch only the events that occurred after this point so that the
   * projection can resume without a full replay.
   */
  readonly lastEventId: string;

  /**
   * The fully-materialised projection state at the time the snapshot was
   * taken — an array of all active {@link Entry} objects.
   */
  readonly state: Entry[];

  /**
   * ISO 8601 timestamp recording when this snapshot was persisted.
   * Useful for diagnostics and for evicting snapshots that are too old.
   */
  readonly savedAt: string;
}

/**
 * Persistence contract for projection snapshots.
 *
 * Implementations are responsible for durable storage (e.g. IndexedDB,
 * localStorage, an in-memory map for tests).  The interface is intentionally
 * minimal: save, load, and clear.
 *
 * Clean Architecture note: this interface belongs in the **domain** layer.
 * Concrete implementations belong in the **infrastructure** layer and depend
 * on this interface — not the other way around.
 */
export interface ISnapshotStore {
  /**
   * Persist a snapshot under the given key, replacing any previously stored
   * snapshot for that key.
   *
   * @param key      - Stable identifier for the projection (e.g. `"entry-list"`).
   * @param snapshot - The snapshot to persist.
   */
  save(key: string, snapshot: ProjectionSnapshot): Promise<void>;

  /**
   * Retrieve the most recently saved snapshot for the given key.
   *
   * @param key - The same key that was used when calling {@link save}.
   * @returns The snapshot, or `null` if no snapshot has been saved for this key.
   */
  load(key: string): Promise<ProjectionSnapshot | null>;

  /**
   * Delete the snapshot stored under the given key.
   *
   * This is a no-op when no snapshot exists for the key (i.e. it is safe to
   * call `clear` on a key that has never been saved).
   *
   * @param key - The same key that was used when calling {@link save}.
   */
  clear(key: string): Promise<void>;
}
