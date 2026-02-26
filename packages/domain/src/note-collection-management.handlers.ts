import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type {
  AddNoteToCollectionCommand,
  RemoveNoteFromCollectionCommand,
  MoveNoteToCollectionCommand,
  NoteAddedToCollection,
  NoteRemovedFromCollection,
} from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * AddNoteToCollectionHandler
 * Adds a note to an additional collection (multi-collection presence)
 */
export class AddNoteToCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: AddNoteToCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }

    const note = await this.entryProjection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Idempotency: Already in this collection?
    if (note.collections?.includes(command.collectionId)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: NoteAddedToCollection = {
      ...metadata,
      type: 'NoteAddedToCollection',
      aggregateId: command.noteId,
      payload: {
        noteId: command.noteId,
        collectionId: command.collectionId,
        addedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * RemoveNoteFromCollectionHandler
 * Removes a note from a collection (creates ghost entry)
 */
export class RemoveNoteFromCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: RemoveNoteFromCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }

    const note = await this.entryProjection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Idempotency: Not in this collection?
    if (!note.collections?.includes(command.collectionId)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: NoteRemovedFromCollection = {
      ...metadata,
      type: 'NoteRemovedFromCollection',
      aggregateId: command.noteId,
      payload: {
        noteId: command.noteId,
        collectionId: command.collectionId,
        removedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * MoveNoteToCollectionHandler
 * Moves a note from current collection to target collection
 *
 * Multi-collection behavior:
 * - Removes note from CURRENT collection only (not all collections)
 * - Preserves note in any other collections it belongs to
 * - Example: Note in [A, B, C] moved from B → D results in [A, C, D]
 */
export class MoveNoteToCollectionHandler {
  constructor(
    private readonly addHandler: AddNoteToCollectionHandler,
    private readonly removeHandler: RemoveNoteFromCollectionHandler,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: MoveNoteToCollectionCommand): Promise<void> {
    // Validate command parameters
    if (!command.currentCollectionId?.trim()) {
      throw new Error('Current collection ID cannot be empty');
    }
    if (!command.targetCollectionId?.trim()) {
      throw new Error('Target collection ID cannot be empty');
    }

    // No-op if moving to same collection (idempotent)
    if (command.currentCollectionId === command.targetCollectionId) {
      return;
    }

    const note = await this.entryProjection.getNoteById(command.noteId);
    if (!note) {
      throw new Error(`Note ${command.noteId} not found`);
    }

    // Validate note is actually in current collection
    if (!note.collections?.includes(command.currentCollectionId)) {
      throw new Error(
        `Note ${command.noteId} is not in collection ${command.currentCollectionId}`
      );
    }

    // Remove from current collection only (not all collections)
    await this.removeHandler.handle({
      noteId: command.noteId,
      collectionId: command.currentCollectionId,
    });

    // Add to target collection
    await this.addHandler.handle({
      noteId: command.noteId,
      collectionId: command.targetCollectionId,
    });
  }
}
