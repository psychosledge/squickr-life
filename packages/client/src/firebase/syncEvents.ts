/**
 * Event Synchronization Module
 * 
 * Handles uploading and downloading events between IndexedDB and Firestore.
 * Implements bidirectional sync with duplicate detection.
 * 
 * Phase 4: Upload Sync
 * Phase 5: Download Sync
 */

import { collection, doc, writeBatch, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestore } from './config';
import type { DomainEvent, IEventStore } from '@squickr/shared';

/**
 * Upload local events from IndexedDB to Firestore
 * 
 * - Gets all local events from IndexedDB
 * - Checks which events already exist in Firestore (duplicate detection)
 * - Uploads only new events in batches of 500 (Firestore limit)
 * - Updates last sync timestamp
 * 
 * @param userId - The authenticated user's ID
 * @param eventStore - The local IndexedDB event store
 * @returns Number of events uploaded
 */
export async function uploadLocalEvents(
  userId: string,
  eventStore: IEventStore
): Promise<number> {
  console.log('[Sync] Starting upload...');
  
  // Get all local events
  const localEvents = await eventStore.getAll();
  
  if (localEvents.length === 0) {
    console.log('[Sync] No local events to upload');
    return 0;
  }
  
  console.log(`[Sync] Found ${localEvents.length} local events`);
  
  // Get IDs of events that already exist in Firestore (duplicate detection)
  const remoteEventIds = await getRemoteEventIds(userId);
  
  // Filter to only new events
  const eventsToUpload = localEvents.filter(
    (event) => !remoteEventIds.has(event.id)
  );
  
  if (eventsToUpload.length === 0) {
    console.log('[Sync] All events already synced');
    return 0;
  }
  
  console.log(`[Sync] Uploading ${eventsToUpload.length} new events...`);
  
  // Upload in batches (Firestore allows max 500 writes per batch)
  await batchUploadToFirestore(userId, eventsToUpload);
  
  // Update last sync timestamp
  localStorage.setItem('last_sync_timestamp', new Date().toISOString());
  
  console.log(`[Sync] Upload complete: ${eventsToUpload.length} events uploaded ✓`);
  
  return eventsToUpload.length;
}

/**
 * Get IDs of all events that exist in Firestore for this user
 * Used for duplicate detection during upload
 * 
 * @param userId - The authenticated user's ID
 * @returns Set of event IDs that exist in Firestore
 */
async function getRemoteEventIds(userId: string): Promise<Set<string>> {
  const eventsRef = collection(firestore, `users/${userId}/events`);
  const snapshot = await getDocs(eventsRef);
  
  // Document IDs are event IDs
  const eventIds = new Set(snapshot.docs.map((doc) => doc.id));
  
  console.log(`[Sync] Found ${eventIds.size} remote events`);
  
  return eventIds;
}

/**
 * Upload events to Firestore in batches
 * Firestore allows max 500 writes per batch
 * 
 * @param userId - The authenticated user's ID
 * @param events - Events to upload
 */
/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * Recursively cleans nested objects
 */
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

/**
 * Download remote events from Firestore to IndexedDB
 * 
 * - Queries Firestore for events created after last sync
 * - Filters out events that already exist in IndexedDB (duplicate detection)
 * - Appends new events to IndexedDB
 * - Updates last sync timestamp
 * 
 * @param userId - The authenticated user's ID
 * @param eventStore - The local IndexedDB event store
 * @returns Number of events downloaded
 */
export async function downloadRemoteEvents(
  userId: string,
  eventStore: IEventStore
): Promise<number> {
  console.log('[Sync] Starting download...');
  
  // Get last sync timestamp (default to epoch if never synced)
  const lastSync = localStorage.getItem('last_sync_timestamp') || '1970-01-01T00:00:00.000Z';
  
  // Query Firestore for events after last sync
  const eventsRef = collection(firestore, `users/${userId}/events`);
  const q = query(
    eventsRef,
    where('timestamp', '>', lastSync),
    orderBy('timestamp', 'asc')
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log('[Sync] No new remote events');
    return 0;
  }
  
  console.log(`[Sync] Downloaded ${snapshot.docs.length} events from Firestore`);
  
  // Get IDs of events already in IndexedDB
  const localEvents = await eventStore.getAll();
  const localEventIds = new Set(localEvents.map((e) => e.id));
  
  // Filter to only new events
  const newEvents: DomainEvent[] = [];
  for (const doc of snapshot.docs) {
    const event = doc.data() as DomainEvent;
    
    if (!localEventIds.has(event.id)) {
      newEvents.push(event);
    }
  }
  
  if (newEvents.length === 0) {
    console.log('[Sync] All remote events already in IndexedDB');
    return 0;
  }
  
  console.log(`[Sync] Appending ${newEvents.length} new events to IndexedDB...`);
  
  // Append new events to IndexedDB
  for (const event of newEvents) {
    await eventStore.append(event);
  }
  
  // Update last sync timestamp to the latest event's timestamp
  if (newEvents.length > 0) {
    const latestEvent = newEvents[newEvents.length - 1];
    if (latestEvent) {
      localStorage.setItem('last_sync_timestamp', latestEvent.timestamp);
    }
  }
  
  console.log(`[Sync] Download complete: ${newEvents.length} events downloaded ✓`);
  
  return newEvents.length;
}

async function batchUploadToFirestore(
  userId: string,
  events: DomainEvent[]
): Promise<void> {
  const BATCH_SIZE = 500;
  
  // Split into batches
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const batchEvents = events.slice(i, i + BATCH_SIZE);
    
    for (const event of batchEvents) {
      // Use event ID as document ID (prevents duplicates)
      const docRef = doc(firestore, `users/${userId}/events`, event.id);
      
      // Remove undefined values (Firestore doesn't allow them)
      const cleanedEvent = removeUndefined(event);
      
      // Store the entire event as the document
      batch.set(docRef, cleanedEvent);
    }
    
    await batch.commit();
    console.log(`[Sync] Uploaded batch ${i / BATCH_SIZE + 1}: ${batchEvents.length} events`);
  }
}
