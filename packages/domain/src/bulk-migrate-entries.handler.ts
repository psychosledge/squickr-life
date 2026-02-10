import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { DomainEvent } from './domain-event';
import type { 
  TaskMigrated, 
  NoteMigrated, 
  EventMigrated,
  TaskAddedToCollection,
  TaskRemovedFromCollection
} from './task.types';

/**
 * BulkMigrateEntries Command
 * Represents the user's intent to migrate multiple entries to a different collection
 * 
 * This is a generic handler that works for all entry types (tasks, notes, events)
 * and uses appendBatch() to prevent UI flashing during bulk operations.
 * 
 * Supports two modes:
 * - 'move': Remove from old collection + add to new collection (tasks only)
 * - 'add': Add to new collection without removing from old (multi-collection)
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
 * - Create type-specific migration events (TaskMigrated, NoteMigrated, EventMigrated)
 * - Support 'move' and 'add' modes for multi-collection
 * - Use appendBatch() for atomic writes and single UI update
 * 
 * This implements ADR-013 Phase 3: Bulk migration UX improvements
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
   * - 'move': Remove from old collection + add to new (tasks only)
   * - 'add': Add to new collection, preserve in old (tasks only)
   * - Notes/events: Always 'move' (no multi-collection support yet)
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
      
      // Generate new ID for migrated version
      const migratedToId = crypto.randomUUID();
      const migratedAt = new Date().toISOString();
      
      // Create type-specific migration event
      switch (entry.type) {
        case 'task': {
          // TaskMigrated event
          const taskMigratedEvent: TaskMigrated = {
            id: crypto.randomUUID(),
            type: 'TaskMigrated',
            timestamp: migratedAt,
            version: 1,
            aggregateId: entryId,
            payload: {
              originalTaskId: entryId,
              migratedToId,
              targetCollectionId: command.targetCollectionId, // Keep null as-is
              migratedAt,
            },
          };
          events.push(taskMigratedEvent);
          
          // Phase 3: If mode is 'move' and task has a collection, remove from old collection
          if (command.mode === 'move' && entry.collectionId) {
            const taskRemovedEvent: TaskRemovedFromCollection = {
              id: crypto.randomUUID(),
              type: 'TaskRemovedFromCollection',
              timestamp: migratedAt,
              version: 1,
              aggregateId: entryId,
              payload: {
                taskId: entryId,
                collectionId: entry.collectionId,
                removedAt: migratedAt,
              },
            };
            events.push(taskRemovedEvent);
          }
          
          // Add to new collection (both 'move' and 'add' modes)
          if (command.targetCollectionId) {
            const taskAddedEvent: TaskAddedToCollection = {
              id: crypto.randomUUID(),
              type: 'TaskAddedToCollection',
              timestamp: migratedAt,
              version: 1,
              aggregateId: migratedToId, // New task ID
              payload: {
                taskId: migratedToId,
                collectionId: command.targetCollectionId,
                addedAt: migratedAt,
              },
            };
            events.push(taskAddedEvent);
          }
          break;
        }
          
        case 'note': {
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
