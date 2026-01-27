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
  ReorderNoteCommand,
  NoteReordered
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
 * - Create NoteDeleted event
 * - Persist event to EventStore
 */
export class DeleteNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: INoteProjection
  ) {}

  /**
   * Handle DeleteNote command
   * 
   * Validation rules:
   * - Note must exist
   * 
   * @param command - The DeleteNote command
   * @throws Error if validation fails
   */
  async handle(command: DeleteNoteCommand): Promise<void> {
    // Validate note exists
    const note = await this.projection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create NoteDeleted event
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
