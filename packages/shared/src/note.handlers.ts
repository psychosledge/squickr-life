import type { IEventStore } from './event-store';
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

// We'll need a NoteListProjection for validation
// For now, we'll create a simple interface
interface INoteProjection {
  getNoteById(noteId: string): Promise<{ id: string; content: string; order?: string } | undefined>;
  getNotes(): Promise<Array<{ id: string; content: string; order?: string }>>;
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

    // Get last note to generate order after it
    const notes = await this.projection.getNotes();
    const lastNote = notes[notes.length - 1];
    const order = generateKeyBetween(lastNote?.order ?? null, null);

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
 * - Validate neighboring notes exist (if provided)
 * - Calculate new fractional index order
 * - Create NoteReordered event
 * - Persist event to EventStore
 */
export class ReorderNoteHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: INoteProjection
  ) {}

  /**
   * Handle ReorderNote command
   * 
   * Validation rules:
   * - Note must exist
   * - previousNoteId and nextNoteId must exist if provided
   * 
   * @param command - The ReorderNote command
   * @throws Error if validation fails
   */
  async handle(command: ReorderNoteCommand): Promise<void> {
    // Validate note exists
    const note = await this.projection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Get the neighboring notes to calculate new order
    let previousOrder: string | null = null;
    let nextOrder: string | null = null;

    if (command.previousNoteId) {
      const previousNote = await this.projection.getNoteById(command.previousNoteId);
      if (!previousNote) {
        throw new Error(`Previous note ${command.previousNoteId} not found`);
      }
      previousOrder = previousNote.order || null;
    }

    if (command.nextNoteId) {
      const nextNote = await this.projection.getNoteById(command.nextNoteId);
      if (!nextNote) {
        throw new Error(`Next note ${command.nextNoteId} not found`);
      }
      nextOrder = nextNote.order || null;
    }

    // Generate new fractional index between the neighboring notes
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
