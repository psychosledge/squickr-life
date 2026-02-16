import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { DomainEvent } from './domain-event';
import type { 
  NoteMigrated, 
  EventMigrated,
  TaskAddedToCollection,
  TaskRemovedFromCollection
} from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * BulkMigrateEntries Command
 * Represents the user's intent to migrate multiple entries to a different collection
 * 
 * This is a generic handler that works for all entry types (tasks, notes, events)
 * and uses appendBatch() to prevent UI flashing during bulk operations.
 * 
 * Tasks: Use multi-collection pattern (preserves task ID, full collection history)
 * Notes/Events: Use legacy migration pattern (creates new ID with migratedTo pointer)
 * 
 * Supports two modes (tasks only):
 * - 'move': Remove from current collection + add to new collection
 * - 'add': Add to new collection without removing from current (multi-collection)
 */
export interface BulkMigrateEntriesCommand {
  /** Array of entry IDs to migrate (can be tasks, notes, or events) */
  readonly entryIds: string[];
  
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
 * - For tasks: Use multi-collection events (TaskAddedToCollection + TaskRemovedFromCollection)
 * - For notes/events: Use legacy migration events (NoteMigrated, EventMigrated)
 * - Support 'move' and 'add' modes for multi-collection
 * - Use appendBatch() for atomic writes and single UI update
 * 
 * This implements ADR-013 Phase 3: Bulk migration UX improvements
 * Tasks use the new multi-collection pattern (preserves task ID and full history)
 * Notes/Events still use legacy migration pattern (creates new IDs)
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
    const events: DomainEvent[] = [];
    
    for (const entryId of command.entryIds) {
      // Get entry to determine type
      const entry = await this.entryProjection.getEntryById(entryId);
      
      // Skip if doesn't exist or already migrated
      if (!entry || entry.migratedTo) {
        continue;
      }
      
      // Generate timestamp once for all events in this iteration (for notes/events)
      const migratedAt = new Date().toISOString();
      
      // Create type-specific migration event
      switch (entry.type) {
        case 'task': {
          // Phase 3: Multi-collection support - use TaskAddedToCollection + TaskRemovedFromCollection
          // This preserves the task ID and collection history (no new task created)
          
          // Remove from current collection (if mode='move' and task has a collection)
          if (command.mode === 'move' && entry.collectionId) {
            // Idempotency: Only remove if task is actually in this collection
            if (entry.collections?.includes(entry.collectionId)) {
              const removeMetadata = generateEventMetadata();
              const taskRemovedEvent: TaskRemovedFromCollection = {
                ...removeMetadata,
                type: 'TaskRemovedFromCollection',
                aggregateId: entryId, // Use ORIGINAL task ID
                payload: {
                  taskId: entryId,
                  collectionId: entry.collectionId,
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
          // Notes still use legacy migration pattern (creates new ID)
          // TODO: Update to multi-collection pattern in future
          const migratedToId = crypto.randomUUID();
          
          const noteMigratedEvent: NoteMigrated = {
            id: crypto.randomUUID(),
            type: 'NoteMigrated',
            timestamp: migratedAt,
            version: 1,
            aggregateId: entryId,
            payload: {
              originalNoteId: entryId,
              migratedToId,
              targetCollectionId: command.targetCollectionId,
              migratedAt,
            },
          };
          events.push(noteMigratedEvent);
          // Notes currently don't support multi-collection, so only 'move' mode
          break;
        }
          
        case 'event': {
          // Events still use legacy migration pattern (creates new ID)
          // TODO: Update to multi-collection pattern in future
          const migratedToId = crypto.randomUUID();
          
          const eventMigratedEvent: EventMigrated = {
            id: crypto.randomUUID(),
            type: 'EventMigrated',
            timestamp: migratedAt,
            version: 1,
            aggregateId: entryId,
            payload: {
              originalEventId: entryId,
              migratedToId,
              targetCollectionId: command.targetCollectionId,
              migratedAt,
            },
          };
          events.push(eventMigratedEvent);
          // Events currently don't support multi-collection, so only 'move' mode
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
