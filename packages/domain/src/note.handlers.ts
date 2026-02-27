import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { Entry } from './task.types';
import type { 
  CreateNoteCommand,
  NoteCreated,
  UpdateNoteContentCommand,
  NoteContentChanged,
  DeleteNoteCommand,
  NoteDeleted,
  NoteRemovedFromCollection,
  ReorderNoteCommand,
  NoteReordered,
  MigrateNoteCommand,
  NoteMigrated,
  NoteRestored,
  RestoreNoteCommand,
} from './task.types';
import { generateEventMetadata } from './event-helpers';
import { generateKeyBetween } from 'fractional-indexing';
import { validateContent } from './content-validation';

// Interface for note projection (backward compatibility)
interface INoteProjection {
  getNoteById(noteId: string): Promise<{ id: string; content: string; order?: string } | undefined>;
  getNotes(): Promise<Array<{ id: string; content: string; order?: string }>>;
  getEntries(): Promise<Entry[]>; // Added for unified ordering
}

/**
 * Command Handler for CreateNote
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Generate unique identifiers
 * - Generate fractional index for ordering
 * - Create domain events
 * - Persist events to EventStore
 */
export class CreateNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: INoteProjection
  ) {}

  /**
   * Handle CreateNote command
   * 
   * Validation rules:
   * - Content must not be empty after trimming
   * - Content must be 1-5000 characters
   * 
   * @param command - The CreateNote command
   * @returns The ID of the created note
   * @throws Error if validation fails
   */
  async handle(command: CreateNoteCommand): Promise<string> {
    // Validate and trim content
    const content = validateContent(command.content, 5000);

    // Get last entry (of any type) to generate order after it
    const entries = await this.projection.getEntries();
    const lastEntry = entries[entries.length - 1];
    const order = generateKeyBetween(lastEntry?.order ?? null, null);

    // Generate unique note ID and event metadata
    const noteId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    // Create NoteCreated event
    const event: NoteCreated = {
      ...metadata,
      type: 'NoteCreated',
      aggregateId: noteId,
      payload: {
        id: noteId,
        content,
        createdAt: metadata.timestamp,
        order,
        collectionId: command.collectionId,
        userId: command.userId,
      },
    };

    // Persist event
    await this.eventStore.append(event);

    // Return note ID for reference
    return noteId;
  }
}

/**
 * Command Handler for UpdateNoteContent
 * 
 * Responsibilities:
 * - Validate note exists
 * - Validate new content meets requirements
 * - Create NoteContentChanged event
 * - Persist event to EventStore
 */
export class UpdateNoteContentHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: INoteProjection
  ) {}

  /**
   * Handle UpdateNoteContent command
   * 
   * Validation rules:
   * - Note must exist
   * - Content must not be empty after trimming
   * - Content must be 1-5000 characters
   * 
   * @param command - The UpdateNoteContent command
   * @throws Error if validation fails
   */
  async handle(command: UpdateNoteContentCommand): Promise<void> {
    // Validate note exists
    const note = await this.projection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Validate and trim content
    const content = validateContent(command.content, 5000);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create NoteContentChanged event
    const event: NoteContentChanged = {
      ...metadata,
      type: 'NoteContentChanged',
      aggregateId: command.noteId,
      payload: {
        noteId: command.noteId,
        newContent: content,
        changedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for DeleteNote
 * 
 * Responsibilities:
 * - Validate note exists
 * - Multi-collection logic: if currentCollectionId and note is in multiple collections,
 *   emit NoteRemovedFromCollection only. Otherwise emit NoteDeleted (soft delete).
 * - Persist event to EventStore
 */
export class DeleteNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: EntryListProjection
  ) {}

  /**
   * Handle DeleteNote command
   * 
   * Multi-collection logic:
   * - If `currentCollectionId` is provided AND note is in multiple collections:
   *   emit `NoteRemovedFromCollection` only (keep note alive in other collections)
   * - Otherwise: emit `NoteDeleted` (soft delete)
   * 
   * @param command - The DeleteNote command
   * @throws Error if validation fails
   */
  async handle(command: DeleteNoteCommand): Promise<void> {
    // Validate note exists (use getNoteById which bypasses active filter)
    const note = await this.projection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }
    if (note.deletedAt) {
      throw new Error(`Note ${command.noteId} already deleted`);
    }

    // Multi-collection logic: if a specific collection is given AND note is in >1 collections,
    // only remove from that collection instead of soft-deleting the entire note.
    // Guard: currentCollectionId must actually be a member of the note's collections —
    // a bogus/stale collectionId must not accidentally suppress the full soft-delete.
    if (
      command.currentCollectionId &&
      note.collections.includes(command.currentCollectionId) &&
      note.collections.length > 1
    ) {
      const metadata = generateEventMetadata();
      const event: NoteRemovedFromCollection = {
        ...metadata,
        type: 'NoteRemovedFromCollection',
        aggregateId: command.noteId,
        payload: {
          noteId: command.noteId,
          collectionId: command.currentCollectionId,
          removedAt: metadata.timestamp,
        },
      };
      await this.eventStore.append(event);
      return;
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create NoteDeleted event (soft delete)
    const event: NoteDeleted = {
      ...metadata,
      type: 'NoteDeleted',
      aggregateId: command.noteId,
      payload: {
        noteId: command.noteId,
        deletedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ReorderNote
 * 
 * Responsibilities:
 * - Validate note exists
 * - Validate neighboring entries exist (if provided) - can be ANY entry type
 * - Calculate new fractional index order
 * - Create NoteReordered event
 * - Persist event to EventStore
 */
export class ReorderNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly noteProjection: INoteProjection,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle ReorderNote command
   * 
   * Validation rules:
   * - Note must exist
   * - previousNoteId and nextNoteId can be ANY entry type (task, note, or event)
   * 
   * @param command - The ReorderNote command
   * @throws Error if validation fails
   */
  async handle(command: ReorderNoteCommand): Promise<void> {
    // Validate note exists
    const note = await this.noteProjection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Get the neighboring ENTRIES (not just notes) to calculate new order
    // This allows notes to be reordered relative to tasks and events
    let previousOrder: string | null = null;
    let nextOrder: string | null = null;

    if (command.previousNoteId) {
      const previousEntry = await this.entryProjection.getEntryById(command.previousNoteId);
      if (!previousEntry) {
        throw new Error(`Previous entry ${command.previousNoteId} not found`);
      }
      previousOrder = previousEntry.order || null;
    }

    if (command.nextNoteId) {
      const nextEntry = await this.entryProjection.getEntryById(command.nextNoteId);
      if (!nextEntry) {
        throw new Error(`Next entry ${command.nextNoteId} not found`);
      }
      nextOrder = nextEntry.order || null;
    }

    // Generate new fractional index between the neighboring entries
    const order = generateKeyBetween(previousOrder, nextOrder);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create NoteReordered event
    const event: NoteReordered = {
      ...metadata,
      type: 'NoteReordered',
      aggregateId: command.noteId,
      payload: {
        noteId: command.noteId,
        order,
        reorderedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for MigrateNote
 * 
 * Responsibilities:
 * - Validate note exists
 * - Validate note has not already been migrated
 * - Create NoteMigrated event
 * - Ensure idempotency (return existing migration if same target)
 * 
 * This implements the bullet journal migration pattern:
 * - Original note is preserved in its original collection
 * - NoteMigrated event marks original with migratedTo pointer
 * - Projection creates new note in target collection with migratedFrom pointer
 */
export class MigrateNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle MigrateNote command
   * 
   * Validation rules:
   * - Note must exist
   * - Note must not already be migrated (migratedTo must be undefined)
   * - Idempotent: Return existing migration if already migrated to same target
   * 
   * @param command - The MigrateNote command
   * @returns The ID of the newly created note in the target collection
   * @throws Error if validation fails
   */
  async handle(command: MigrateNoteCommand): Promise<string> {
    // Validate note exists
    const originalNote = await this.entryProjection.getNoteById(command.noteId);
    if (!originalNote) {
      throw new Error(`Entry ${command.noteId} not found`);
    }

    // Idempotency check: If already migrated, check if to same target
    if (originalNote.migratedTo) {
      // Note has already been migrated
      // Check if the target is the same - if so, return existing migration (idempotent)
      const migratedNote = await this.entryProjection.getNoteById(originalNote.migratedTo);
      if (migratedNote) {
        const migratedCollectionId = migratedNote.collectionId ?? null;
        const targetCollectionId = command.targetCollectionId;
        
        if (migratedCollectionId === targetCollectionId) {
          // Already migrated to the same collection - idempotent, return existing
          return originalNote.migratedTo;
        }
      }
      
      // Migrated to different collection - throw error
      throw new Error('Note has already been migrated');
    }

    // Generate unique ID for new note
    const newNoteId = crypto.randomUUID();
    
    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create NoteMigrated event
    // The projection will handle creating the new note with proper properties
    const event: NoteMigrated = {
      ...metadata,
      type: 'NoteMigrated',
      aggregateId: command.noteId,
      payload: {
        originalNoteId: command.noteId,
        targetCollectionId: command.targetCollectionId,
        migratedToId: newNoteId,
        migratedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
    
    return newNoteId;
  }
}

/**
 * Command Handler for RestoreNote (Item 3: Recoverable Deleted Entries)
 * 
 * Responsibilities:
 * - Validate note exists and is soft-deleted
 * - Emit NoteRestored event to clear deletedAt
 */
export class RestoreNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle RestoreNote command
   * 
   * Validation rules:
   * - Note must exist (found via getEntryById which includes soft-deleted)
   * - Note must have deletedAt set (must be soft-deleted)
   * 
   * @param command - The RestoreNote command
   * @throws Error if note not found or not deleted
   */
  async handle(command: RestoreNoteCommand): Promise<void> {
    const entry = await this.entryProjection.getEntryById(command.noteId);
    if (!entry || entry.type !== 'note') {
      throw new Error(`Note ${command.noteId} not found`);
    }
    if (!entry.deletedAt) {
      throw new Error(`Note ${command.noteId} is not deleted`);
    }

    const metadata = generateEventMetadata();
    const restoreEvent: NoteRestored = {
      ...metadata,
      type: 'NoteRestored',
      aggregateId: command.noteId,
      payload: {
        id: command.noteId,
        restoredAt: metadata.timestamp,
      },
    };
    await this.eventStore.append(restoreEvent);
  }
}
