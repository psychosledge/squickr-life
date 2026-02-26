import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { DomainEvent } from './domain-event';
import type { 
  TaskAddedToCollection,
  TaskRemovedFromCollection,
  NoteAddedToCollection,
  NoteRemovedFromCollection,
  EventAddedToCollection,
  EventRemovedFromCollection,
} from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * BulkMigrateEntries Command
 * Represents the user's intent to migrate multiple entries to a different collection
 * 
 * This is a generic handler that works for all entry types (tasks, notes, events)
 * and uses appendBatch() to prevent UI flashing during bulk operations.
 * 
 * All entry types use the multi-collection pattern (preserves ID, full collection history).
 * 
 * Supports two modes:
 * - 'move': Remove from current collection + add to new collection
 * - 'add': Add to new collection without removing from current (multi-collection)
 */
export interface BulkMigrateEntriesCommand {
  /** Array of entry IDs to migrate (can be tasks, notes, or events) */
  readonly entryIds: string[];
  
  /**
   * Source collection ID - the collection to remove from (required for 'move' mode)
   * 
   * IMPORTANT: For tasks, this should be the ACTUAL collection the task is in
   * (from task.collections array), NOT the display collection (task.collectionId).
   * For migrated sub-tasks, these may differ.
   */
  readonly sourceCollectionId?: string | null;
  
  /** Target collection ID (null = uncategorized) */
  readonly targetCollectionId: string | null;
  
  /** Migration mode - 'move' removes from old collection, 'add' preserves */
  readonly mode: 'move' | 'add';
}

/**
 * Command Handler for BulkMigrateEntries
 * 
 * Responsibilities:
 * - Validate entries exist
 * - Skip ghost entries (already migrated)
 * - For all entry types: Use multi-collection events (Added/RemovedFromCollection)
 * - Support 'move' and 'add' modes for multi-collection
 * - Use appendBatch() for atomic writes and single UI update
 * 
 * This implements ADR-013 Phase 3: Bulk migration UX improvements.
 * All entry types (tasks, notes, events) use the multi-collection pattern
 * (preserves entry ID and full collection history — no new entries created).
 */
export class BulkMigrateEntriesHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle BulkMigrateEntries command
   * 
   * Validation rules:
   * - Skip non-existent entries (instead of throwing)
   * - Skip ghost entries (entries with migratedTo pointer)
   * 
   * Mode behavior:
   * - Tasks:
   *   - 'move': Remove from current collection + add to new collection
   *   - 'add': Add to new collection, preserve in current collection
   *   - Uses TaskAddedToCollection + TaskRemovedFromCollection (preserves task ID)
   * - Notes/Events:
   *   - Always 'move' (no multi-collection support yet)
   *   - Uses NoteMigrated/EventMigrated (creates new ID with migratedTo pointer)
   * 
   * @param command - The BulkMigrateEntries command
   * @throws Error if validation fails
   */
  async handle(command: BulkMigrateEntriesCommand): Promise<void> {
    // Validation: sourceCollectionId is required when using mode='move'
    if (command.mode === 'move' && command.sourceCollectionId === undefined) {
      throw new Error(
        'sourceCollectionId is required when using mode="move". Pass the actual collection ID to remove tasks from.'
      );
    }
    
    const events: DomainEvent[] = [];
    
    for (const entryId of command.entryIds) {
      // Get entry to determine type
      const entry = await this.entryProjection.getEntryById(entryId);
      
      // Skip if doesn't exist or already migrated
      if (!entry || entry.migratedTo) {
        continue;
      }
      
      // Create type-specific migration event
      switch (entry.type) {
        case 'task': {
          // Phase 3: Multi-collection support - use TaskAddedToCollection + TaskRemovedFromCollection
          // This preserves the task ID and collection history (no new task created)
          
          // Idempotency: Skip if source and target are the same (no-op)
          if (command.mode === 'move' && 
              command.sourceCollectionId === command.targetCollectionId) {
            continue;
          }
          
          // Remove from source collection (if mode='move' and source collection provided)
          if (command.mode === 'move' && command.sourceCollectionId) {
            // Idempotency: Only remove if task is actually in the source collection
            if (entry.collections?.includes(command.sourceCollectionId)) {
              const removeMetadata = generateEventMetadata();
              const taskRemovedEvent: TaskRemovedFromCollection = {
                ...removeMetadata,
                type: 'TaskRemovedFromCollection',
                aggregateId: entryId, // Use ORIGINAL task ID
                payload: {
                  taskId: entryId,
                  collectionId: command.sourceCollectionId, // Remove from SOURCE collection
                  removedAt: removeMetadata.timestamp,
                },
              };
              events.push(taskRemovedEvent);
            }
          }
          
          // Add to target collection (both 'move' and 'add' modes)
          if (command.targetCollectionId) {
            // Idempotency: Only add if task is NOT already in target collection
            if (!entry.collections?.includes(command.targetCollectionId)) {
              const addMetadata = generateEventMetadata();
              const taskAddedEvent: TaskAddedToCollection = {
                ...addMetadata,
                type: 'TaskAddedToCollection',
                aggregateId: entryId, // Use ORIGINAL task ID (not a new ID)
                payload: {
                  taskId: entryId,
                  collectionId: command.targetCollectionId,
                  addedAt: addMetadata.timestamp,
                },
              };
              events.push(taskAddedEvent);
            }
          }
          break;
        }
          
        case 'note': {
          // Notes use multi-collection pattern (preserves note ID and collection history)
          
          // Idempotency: Skip if source and target are the same (no-op)
          if (command.mode === 'move' && 
              command.sourceCollectionId === command.targetCollectionId) {
            continue;
          }
          
          // Remove from source collection (if mode='move' and source collection provided)
          if (command.mode === 'move' && command.sourceCollectionId) {
            // Idempotency: Only remove if note is actually in the source collection
            if (entry.collections?.includes(command.sourceCollectionId)) {
              const removeMetadata = generateEventMetadata();
              const noteRemovedEvent: NoteRemovedFromCollection = {
                ...removeMetadata,
                type: 'NoteRemovedFromCollection',
                aggregateId: entryId,
                payload: {
                  noteId: entryId,
                  collectionId: command.sourceCollectionId,
                  removedAt: removeMetadata.timestamp,
                },
              };
              events.push(noteRemovedEvent);
            }
          }
          
          // Add to target collection (both 'move' and 'add' modes)
          if (command.targetCollectionId) {
            // Idempotency: Only add if note is NOT already in target collection
            if (!entry.collections?.includes(command.targetCollectionId)) {
              const addMetadata = generateEventMetadata();
              const noteAddedEvent: NoteAddedToCollection = {
                ...addMetadata,
                type: 'NoteAddedToCollection',
                aggregateId: entryId,
                payload: {
                  noteId: entryId,
                  collectionId: command.targetCollectionId,
                  addedAt: addMetadata.timestamp,
                },
              };
              events.push(noteAddedEvent);
            }
          }
          break;
        }
          
        case 'event': {
          // Events use multi-collection pattern (preserves event ID and collection history)
          
          // Idempotency: Skip if source and target are the same (no-op)
          if (command.mode === 'move' && 
              command.sourceCollectionId === command.targetCollectionId) {
            continue;
          }
          
          // Remove from source collection (if mode='move' and source collection provided)
          if (command.mode === 'move' && command.sourceCollectionId) {
            // Idempotency: Only remove if event is actually in the source collection
            if (entry.collections?.includes(command.sourceCollectionId)) {
              const removeMetadata = generateEventMetadata();
              const eventRemovedEvent: EventRemovedFromCollection = {
                ...removeMetadata,
                type: 'EventRemovedFromCollection',
                aggregateId: entryId,
                payload: {
                  eventId: entryId,
                  collectionId: command.sourceCollectionId,
                  removedAt: removeMetadata.timestamp,
                },
              };
              events.push(eventRemovedEvent);
            }
          }
          
          // Add to target collection (both 'move' and 'add' modes)
          if (command.targetCollectionId) {
            // Idempotency: Only add if event is NOT already in target collection
            if (!entry.collections?.includes(command.targetCollectionId)) {
              const addMetadata = generateEventMetadata();
              const eventAddedEvent: EventAddedToCollection = {
                ...addMetadata,
                type: 'EventAddedToCollection',
                aggregateId: entryId,
                payload: {
                  eventId: entryId,
                  collectionId: command.targetCollectionId,
                  addedAt: addMetadata.timestamp,
                },
              };
              events.push(eventAddedEvent);
            }
          }
          break;
        }
      }
    }
    
    // Append all migration events in single batch (prevents UI flashing)
    if (events.length > 0) {
      await this.eventStore.appendBatch(events);
    }
  }
}
