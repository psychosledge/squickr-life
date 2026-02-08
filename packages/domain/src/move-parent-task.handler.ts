/**
 * Move Parent Task Handler (Phase 3: Parent Migration Cascade)
 * 
 * When migrating a parent task:
 * 1. Parent always migrates to target collection
 * 2. Unmigrated children (in SAME collection) → migrate too (cascade)
 * 3. Migrated children (in DIFFERENT collection) → stay put (preserve symlinks)
 * 
 * This handler enables bulk migration: moving a parent brings along all
 * children that haven't been individually migrated yet.
 */

import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { MoveEntryToCollectionCommand, EntryMovedToCollection } from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * MoveParentTaskHandler - Handles parent task migration with cascade logic
 * 
 * Responsibilities:
 * - Validate entry exists
 * - Move parent task (EntryMovedToCollection event)
 * - Cascade move unmigrated children (children in same collection)
 * - Preserve migrated children (children in different collections)
 * - Use batch event appending for performance
 * - Idempotent: no events if already in target collection
 */
export class MoveParentTaskHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: EntryListProjection
  ) {}

  /**
   * Handle MoveEntryToCollection command with cascade logic
   * 
   * Algorithm:
   * 1. Validate entry exists
   * 2. Check idempotency (already in target collection?)
   * 3. Create EntryMovedToCollection event for parent
   * 4. Get all sub-tasks (children)
   * 5. For each child in SAME collection as parent → create move event
   * 6. Batch append all events
   * 
   * @param command - The MoveEntryToCollection command
   * @throws Error if validation fails
   */
  async handle(command: MoveEntryToCollectionCommand): Promise<void> {
    // 1. Validate entry exists (could be task, note, or event)
    const entry = await this.projection.getEntryById(command.entryId);
    if (!entry) {
      throw new Error(`Entry ${command.entryId} not found`);
    }

    // 2. Idempotency check: Don't create event if already in target collection
    const currentCollectionId = entry.collectionId ?? null;
    const targetCollectionId = command.collectionId;
    
    if (currentCollectionId === targetCollectionId) {
      // Already in target collection - no events needed (idempotent)
      return;
    }

    // 3. Create EntryMovedToCollection event for parent
    const events: EntryMovedToCollection[] = [];
    const metadata = generateEventMetadata();
    
    const parentMoveEvent: EntryMovedToCollection = {
      ...metadata,
      type: 'EntryMovedToCollection',
      aggregateId: entry.id,
      payload: {
        entryId: entry.id,
        collectionId: targetCollectionId,
        movedAt: metadata.timestamp,
      },
    };
    events.push(parentMoveEvent);

    // 4. Get all sub-tasks (only if entry is a task)
    if (entry.type === 'task') {
      const children = await this.projection.getSubTasks(entry.id);
      
      // 5. Cascade move: For each child in SAME collection as parent
      for (const child of children) {
        // Compare child's collection with parent's CURRENT collection
        // (before the move, since we're building events)
        if ((child.collectionId ?? null) === currentCollectionId) {
          // Child is in same collection as parent → cascade migrate
          const childMetadata = generateEventMetadata();
          const childMoveEvent: EntryMovedToCollection = {
            ...childMetadata,
            type: 'EntryMovedToCollection',
            aggregateId: child.id,
            payload: {
              entryId: child.id,
              collectionId: targetCollectionId, // Same as parent's new collection
              movedAt: childMetadata.timestamp,
            },
          };
          events.push(childMoveEvent);
        }
        // Else: Child is in different collection (already migrated) → skip (preserve symlink)
      }
    }

    // 6. Batch append all events for atomicity
    // Use appendBatch() to ensure all-or-nothing semantics
    // If cascade migration fails, entire operation is rolled back
    await this.eventStore.appendBatch(events);
  }
}
