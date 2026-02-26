import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type {
  AddEventToCollectionCommand,
  RemoveEventFromCollectionCommand,
  MoveEventToCollectionCommand,
  EventAddedToCollection,
  EventRemovedFromCollection,
} from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * AddEventToCollectionHandler
 * Adds an event entry to an additional collection (multi-collection presence)
 */
export class AddEventToCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: AddEventToCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }

    const evt = await this.entryProjection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Idempotency: Already in this collection?
    if (evt.collections?.includes(command.collectionId)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: EventAddedToCollection = {
      ...metadata,
      type: 'EventAddedToCollection',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        collectionId: command.collectionId,
        addedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * RemoveEventFromCollectionHandler
 * Removes an event entry from a collection (creates ghost entry)
 */
export class RemoveEventFromCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: RemoveEventFromCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }

    const evt = await this.entryProjection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Idempotency: Not in this collection?
    if (!evt.collections?.includes(command.collectionId)) {
      return;
    }

    const metadata = generateEventMetadata();

    const event: EventRemovedFromCollection = {
      ...metadata,
      type: 'EventRemovedFromCollection',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        collectionId: command.collectionId,
        removedAt: metadata.timestamp,
      },
    };

    await this.eventStore.append(event);
  }
}

/**
 * MoveEventToCollectionHandler
 * Moves an event entry from current collection to target collection
 *
 * Multi-collection behavior:
 * - Removes event from CURRENT collection only (not all collections)
 * - Preserves event in any other collections it belongs to
 * - Example: Event in [A, B, C] moved from B → D results in [A, C, D]
 */
export class MoveEventToCollectionHandler {
  constructor(
    private readonly addHandler: AddEventToCollectionHandler,
    private readonly removeHandler: RemoveEventFromCollectionHandler,
    private readonly entryProjection: EntryListProjection
  ) {}

  async handle(command: MoveEventToCollectionCommand): Promise<void> {
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

    const evt = await this.entryProjection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Validate event is actually in current collection
    if (!evt.collections?.includes(command.currentCollectionId)) {
      throw new Error(
        `Event ${command.eventId} is not in collection ${command.currentCollectionId}`
      );
    }

    // Remove from current collection only (not all collections)
    await this.removeHandler.handle({
      eventId: command.eventId,
      collectionId: command.currentCollectionId,
    });

    // Add to target collection
    await this.addHandler.handle({
      eventId: command.eventId,
      collectionId: command.targetCollectionId,
    });
  }
}
