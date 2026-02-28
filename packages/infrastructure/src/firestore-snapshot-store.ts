import type { ISnapshotStore, ProjectionSnapshot } from '@squickr/domain';
import { SNAPSHOT_SCHEMA_VERSION } from '@squickr/domain';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  type Firestore,
} from 'firebase/firestore';
import { removeUndefinedDeep } from './firestore-utils';

/**
 * Firestore-backed SnapshotStore
 *
 * Persists projection snapshots to Firestore for cross-device cold-start
 * acceleration.  On a new device or incognito session, the app can load a
 * recent snapshot from Firestore instead of replaying all events.
 *
 * Firestore Structure:
 * - Collection: users/{userId}/snapshots
 * - Document ID: snapshot key (e.g. "entry-list-projection")
 * - Fields: version, lastEventId, state, savedAt
 *
 * Architecture notes:
 * - Remote save is fire-and-forget (callers should not await — local
 *   IndexedDB is the reliability path, Firestore is the optimisation).
 * - load() validates the schema version and returns null for stale snapshots.
 * - removeUndefinedDeep() strips undefined values before writing to Firestore
 *   (Firestore rejects documents containing undefined).
 */
export class FirestoreSnapshotStore implements ISnapshotStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly userId: string
  ) {}

  /**
   * Persist a snapshot to Firestore under `users/{userId}/snapshots/{key}`.
   * Replaces any previously stored snapshot for that key.
   */
  async save(key: string, snapshot: ProjectionSnapshot): Promise<void> {
    const docRef = doc(
      collection(this.firestore, `users/${this.userId}/snapshots`),
      key
    );
    await setDoc(docRef, removeUndefinedDeep(snapshot));
  }

  /**
   * Retrieve the snapshot stored at `users/{userId}/snapshots/{key}`.
   * Returns null when:
   * - The document does not exist
   * - The stored snapshot's version does not match SNAPSHOT_SCHEMA_VERSION
   */
  async load(key: string): Promise<ProjectionSnapshot | null> {
    const docRef = doc(
      collection(this.firestore, `users/${this.userId}/snapshots`),
      key
    );
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data() as ProjectionSnapshot;

    if (data.version !== SNAPSHOT_SCHEMA_VERSION) {
      return null;
    }

    return data;
  }

  /**
   * Delete the snapshot stored at `users/{userId}/snapshots/{key}`.
   * No-op when the document does not exist.
   */
  async clear(key: string): Promise<void> {
    const docRef = doc(
      collection(this.firestore, `users/${this.userId}/snapshots`),
      key
    );
    await deleteDoc(docRef);
  }
}
