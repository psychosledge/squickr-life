import type { IEventStore, DomainEvent } from '@squickr/domain';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
  type Firestore
} from 'firebase/firestore';
import { removeUndefinedDeep } from './firestore-utils';
import { assertValidDomainEvent, FirestoreValidationError } from './firestore-event-validator';

/**
 * Firestore-backed EventStore
 * 
 * Persists events to Firestore for cloud sync and multi-device support.
 * Implements the same IEventStore interface as IndexedDBEventStore.
 * 
 * Architecture benefits:
 * - Liskov Substitution: Can swap in place of any IEventStore implementation
 * - Cloud-first: Data syncs across devices
 * - Real-time: Can subscribe to remote changes (future enhancement)
 * 
 * Firestore Structure:
 * - Collection: users/{userId}/events
 * - Document ID: event.id (prevents duplicates)
 * - Indexes: aggregateId, timestamp (for efficient querying)
 */
export class FirestoreEventStore implements IEventStore {
  private subscribers = new Set<(event: DomainEvent) => void>();

  constructor(
    private firestore: Firestore,
    private userId: string
  ) {}

  /**
   * Append an event to Firestore
   * Uses event.id as document ID to prevent duplicates
   * Notifies all subscribers after successful append
   */
  async append(event: DomainEvent): Promise<void> {
    const eventsRef = collection(this.firestore, `users/${this.userId}/events`);
    const docRef = doc(eventsRef, event.id);
    
    // Remove undefined values (Firestore doesn't allow them)
    const cleanedEvent = removeUndefinedDeep(event);
    
    await setDoc(docRef, cleanedEvent);
    
    // Notify subscribers after successful append
    this.notifySubscribers(event);
  }

  /**
   * Append multiple events to Firestore atomically
   * Uses Firestore batch writes for atomic all-or-nothing semantics.
   * Firestore batch writes are limited to 500 operations, so we chunk if needed.
   * Notifies subscribers once per event after all batch commits succeed.
   * 
   * @param events - Array of domain events to append
   * @throws Error if batch append fails
   */
  async appendBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const eventsRef = collection(this.firestore, `users/${this.userId}/events`);
    
    // Firestore batch writes are limited to 500 operations
    const BATCH_SIZE = 500;
    
    // Process events in chunks of 500
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batchEvents = events.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(this.firestore);
      
      for (const event of batchEvents) {
        const docRef = doc(eventsRef, event.id);
        const cleanedEvent = removeUndefinedDeep(event);
        batch.set(docRef, cleanedEvent);
      }
      
      // Commit batch atomically
      await batch.commit();
    }
    
    // Notify subscribers once per event so the incremental projection
    // cache update can apply each event individually, matching the
    // behaviour of InMemoryEventStore and IndexedDBEventStore.
    // All events are already persisted before any notification fires.
    for (const event of events) {
      this.notifySubscribers(event);
    }
  }

  /**
   * Get all events for a specific aggregate
   */
  async getById(aggregateId: string): Promise<DomainEvent[]> {
    const eventsRef = collection(this.firestore, `users/${this.userId}/events`);
    const q = query(
      eventsRef,
      where('aggregateId', '==', aggregateId),
      orderBy('timestamp', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => assertValidDomainEvent(d.data(), d.id));
  }

  /**
   * Get all events from the store
   */
  async getAll(): Promise<DomainEvent[]> {
    const eventsRef = collection(this.firestore, `users/${this.userId}/events`);
    const q = query(eventsRef, orderBy('timestamp', 'asc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => assertValidDomainEvent(d.data(), d.id));
  }

  /**
   * Get all events appended after the event with the given ID.
   * Uses a two-phase timestamp cursor against Firestore.
   * Falls back to getAll() when lastEventId is null, the anchor doc is not found,
   * or any error occurs.
   */
  async getAllAfter(lastEventId: string | null): Promise<DomainEvent[]> {
    if (lastEventId === null) return this.getAll();
    try {
      const eventsRef = collection(this.firestore, `users/${this.userId}/events`);
      const anchorRef = doc(eventsRef, lastEventId);
      const anchorSnap = await getDoc(anchorRef);
      if (!anchorSnap.exists()) return this.getAll();
      const anchorRaw = anchorSnap.data();
      const anchorTimestamp = anchorRaw['timestamp'];
      if (typeof anchorTimestamp !== 'string') {
        throw new FirestoreValidationError(
          `Firestore anchor document "${lastEventId}" has a non-string "timestamp" field`,
          lastEventId,
          anchorRaw
        );
      }
      const q = query(
        eventsRef,
        where('timestamp', '>', anchorTimestamp),
        orderBy('timestamp', 'asc'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => assertValidDomainEvent(d.data(), d.id));
    } catch (err) {
      // Validation errors are programmer-visible bugs — re-throw so they are not silently swallowed.
      if (err instanceof FirestoreValidationError) throw err;
      return this.getAll();
    }
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
