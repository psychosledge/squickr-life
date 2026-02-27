import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { Entry } from './task.types';
import type { 
  CreateEventCommand,
  EventCreated,
  UpdateEventContentCommand,
  EventContentChanged,
  UpdateEventDateCommand,
  EventDateChanged,
  DeleteEventCommand,
  EventDeleted,
  EventRemovedFromCollection,
  ReorderEventCommand,
  EventReordered,
  MigrateEventCommand,
  EventMigrated,
  EventRestored,
  RestoreEventCommand,
} from './task.types';
import { generateEventMetadata } from './event-helpers';
import { generateKeyBetween } from 'fractional-indexing';
import { validateContent, validateOptionalISODate } from './content-validation';

// Interface for event projection (backward compatibility)
interface IEventProjection {
  getEventById(eventId: string): Promise<{ id: string; content: string; eventDate?: string; order?: string } | undefined>;
  getEvents(): Promise<Array<{ id: string; content: string; order?: string }>>;
  getEntries(): Promise<Entry[]>; // Added for unified ordering
}

/**
 * Command Handler for CreateEvent
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Generate unique identifiers
 * - Generate fractional index for ordering
 * - Create domain events
 * - Persist events to EventStore
 */
export class CreateEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: IEventProjection
  ) {}

  /**
   * Handle CreateEvent command
   * 
   * Validation rules:
   * - Content must not be empty after trimming
   * - Content must be 1-5000 characters
   * - eventDate must be valid ISO date if provided
   * 
   * @param command - The CreateEvent command
   * @returns The ID of the created event
   * @throws Error if validation fails
   */
  async handle(command: CreateEventCommand): Promise<string> {
    // Validate and trim content
    const content = validateContent(command.content, 5000);

    // Validate eventDate if provided
    validateOptionalISODate(command.eventDate);

    // Get last entry (of any type) to generate order after it
    const entries = await this.projection.getEntries();
    const lastEntry = entries[entries.length - 1];
    const order = generateKeyBetween(lastEntry?.order ?? null, null);

    // Generate unique event ID and event metadata
    const eventId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    // Create EventCreated event
    const event: EventCreated = {
      ...metadata,
      type: 'EventCreated',
      aggregateId: eventId,
      payload: {
        id: eventId,
        content,
        createdAt: metadata.timestamp,
        eventDate: command.eventDate,
        order,
        collectionId: command.collectionId,
        userId: command.userId,
      },
    };

    // Persist event
    await this.eventStore.append(event);

    // Return event ID for reference
    return eventId;
  }
}

/**
 * Command Handler for UpdateEventContent
 * 
 * Responsibilities:
 * - Validate event exists
 * - Validate new content meets requirements
 * - Create EventContentChanged event
 * - Persist event to EventStore
 */
export class UpdateEventContentHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: IEventProjection
  ) {}

  /**
   * Handle UpdateEventContent command
   * 
   * Validation rules:
   * - Event must exist
   * - Content must not be empty after trimming
   * - Content must be 1-5000 characters
   * 
   * @param command - The UpdateEventContent command
   * @throws Error if validation fails
   */
  async handle(command: UpdateEventContentCommand): Promise<void> {
    // Validate event exists
    const evt = await this.projection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Validate and trim content
    const content = validateContent(command.content, 5000);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventContentChanged event
    const event: EventContentChanged = {
      ...metadata,
      type: 'EventContentChanged',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        newContent: content,
        changedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for UpdateEventDate
 * 
 * Responsibilities:
 * - Validate event exists
 * - Validate new date if provided
 * - Create EventDateChanged event
 * - Persist event to EventStore
 */
export class UpdateEventDateHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: IEventProjection
  ) {}

  /**
   * Handle UpdateEventDate command
   * 
   * Validation rules:
   * - Event must exist
   * - eventDate must be valid ISO date if provided (or null to clear)
   * 
   * @param command - The UpdateEventDate command
   * @throws Error if validation fails
   */
  async handle(command: UpdateEventDateCommand): Promise<void> {
    // Validate event exists
    const evt = await this.projection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Validate eventDate (can be null to clear)
    validateOptionalISODate(command.eventDate);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventDateChanged event
    const event: EventDateChanged = {
      ...metadata,
      type: 'EventDateChanged',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        newEventDate: command.eventDate,
        changedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for DeleteEvent
 * 
 * Responsibilities:
 * - Validate event exists
 * - Multi-collection logic: if currentCollectionId and event is in multiple collections,
 *   emit EventRemovedFromCollection only. Otherwise emit EventDeleted (soft delete).
 * - Persist event to EventStore
 */
export class DeleteEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: EntryListProjection
  ) {}

  /**
   * Handle DeleteEvent command
   * 
   * Multi-collection logic:
   * - If `currentCollectionId` is provided AND event is in multiple collections:
   *   emit `EventRemovedFromCollection` only (keep event alive in other collections)
   * - Otherwise: emit `EventDeleted` (soft delete)
   * 
   * @param command - The DeleteEvent command
   * @throws Error if validation fails
   */
  async handle(command: DeleteEventCommand): Promise<void> {
    // Validate event exists (getEventById returns all including soft-deleted)
    const evt = await this.projection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }
    if (evt.deletedAt) {
      throw new Error(`Event ${command.eventId} already deleted`);
    }

    // Multi-collection logic: if a specific collection is given AND event is in >1 collections,
    // only remove from that collection instead of soft-deleting the entire event.
    // Guard: currentCollectionId must actually be a member of the event's collections —
    // a bogus/stale collectionId must not accidentally suppress the full soft-delete.
    if (
      command.currentCollectionId &&
      evt.collections.includes(command.currentCollectionId) &&
      evt.collections.length > 1
    ) {
      const metadata = generateEventMetadata();
      const event: EventRemovedFromCollection = {
        ...metadata,
        type: 'EventRemovedFromCollection',
        aggregateId: command.eventId,
        payload: {
          eventId: command.eventId,
          collectionId: command.currentCollectionId,
          removedAt: metadata.timestamp,
        },
      };
      await this.eventStore.append(event);
      return;
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventDeleted event (soft delete)
    const event: EventDeleted = {
      ...metadata,
      type: 'EventDeleted',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        deletedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ReorderEvent
 * 
 * Responsibilities:
 * - Validate event exists
 * - Validate neighboring entries exist (if provided) - can be ANY entry type
 * - Calculate new fractional index order
 * - Create EventReordered event
 * - Persist event to EventStore
 */
export class ReorderEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly eventProjection: IEventProjection,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle ReorderEvent command
   * 
   * Validation rules:
   * - Event must exist
   * - previousEventId and nextEventId can be ANY entry type (task, note, or event)
   * 
   * @param command - The ReorderEvent command
   * @throws Error if validation fails
   */
  async handle(command: ReorderEventCommand): Promise<void> {
    // Validate event exists
    const evt = await this.eventProjection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Get the neighboring ENTRIES (not just events) to calculate new order
    // This allows events to be reordered relative to tasks and notes
    let previousOrder: string | null = null;
    let nextOrder: string | null = null;

    if (command.previousEventId) {
      const previousEntry = await this.entryProjection.getEntryById(command.previousEventId);
      if (!previousEntry) {
        throw new Error(`Previous entry ${command.previousEventId} not found`);
      }
      previousOrder = previousEntry.order || null;
    }

    if (command.nextEventId) {
      const nextEntry = await this.entryProjection.getEntryById(command.nextEventId);
      if (!nextEntry) {
        throw new Error(`Next entry ${command.nextEventId} not found`);
      }
      nextOrder = nextEntry.order || null;
    }

    // Generate new fractional index between the neighboring entries
    const order = generateKeyBetween(previousOrder, nextOrder);

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventReordered event
    const event: EventReordered = {
      ...metadata,
      type: 'EventReordered',
      aggregateId: command.eventId,
      payload: {
        eventId: command.eventId,
        order,
        reorderedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for MigrateEvent
 * 
 * Responsibilities:
 * - Validate event exists
 * - Validate event has not already been migrated
 * - Create EventMigrated event
 * - Ensure idempotency (return existing migration if same target)
 * 
 * This implements the bullet journal migration pattern:
 * - Original event is preserved in its original collection
 * - EventMigrated event marks original with migratedTo pointer
 * - Projection creates new event in target collection with migratedFrom pointer
 */
export class MigrateEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle MigrateEvent command
   * 
   * Validation rules:
   * - Event must exist
   * - Event must not already be migrated (migratedTo must be undefined)
   * - Idempotent: Return existing migration if already migrated to same target
   * 
   * @param command - The MigrateEvent command
   * @returns The ID of the newly created event in the target collection
   * @throws Error if validation fails
   */
  async handle(command: MigrateEventCommand): Promise<string> {
    // Validate event exists
    const originalEvent = await this.entryProjection.getEventById(command.eventId);
    if (!originalEvent) {
      throw new Error(`Entry ${command.eventId} not found`);
    }

    // Idempotency check: If already migrated, check if to same target
    if (originalEvent.migratedTo) {
      // Event has already been migrated
      // Check if the target is the same - if so, return existing migration (idempotent)
      const migratedEvent = await this.entryProjection.getEventById(originalEvent.migratedTo);
      if (migratedEvent) {
        const migratedCollectionId = migratedEvent.collectionId ?? null;
        const targetCollectionId = command.targetCollectionId;
        
        if (migratedCollectionId === targetCollectionId) {
          // Already migrated to the same collection - idempotent, return existing
          return originalEvent.migratedTo;
        }
      }
      
      // Migrated to different collection - throw error
      throw new Error('Event has already been migrated');
    }

    // Generate unique ID for new event
    const newEventId = crypto.randomUUID();
    
    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventMigrated event
    // The projection will handle creating the new event with proper properties
    const event: EventMigrated = {
      ...metadata,
      type: 'EventMigrated',
      aggregateId: command.eventId,
      payload: {
        originalEventId: command.eventId,
        targetCollectionId: command.targetCollectionId,
        migratedToId: newEventId,
        migratedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
    
    return newEventId;
  }
}

/**
 * Command Handler for RestoreEvent (Item 3: Recoverable Deleted Entries)
 * 
 * Responsibilities:
 * - Validate event exists and is soft-deleted
 * - Emit EventRestored event to clear deletedAt
 */
export class RestoreEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}

  /**
   * Handle RestoreEvent command
   * 
   * Validation rules:
   * - Event must exist (found via getEntryById which includes soft-deleted)
   * - Event must have deletedAt set (must be soft-deleted)
   * 
   * @param command - The RestoreEvent command
   * @throws Error if event not found or not deleted
   */
  async handle(command: RestoreEventCommand): Promise<void> {
    const entry = await this.entryProjection.getEntryById(command.eventId);
    if (!entry || entry.type !== 'event') {
      throw new Error(`Event ${command.eventId} not found`);
    }
    if (!entry.deletedAt) {
      throw new Error(`Event ${command.eventId} is not deleted`);
    }

    const metadata = generateEventMetadata();
    const restoreEvent: EventRestored = {
      ...metadata,
      type: 'EventRestored',
      aggregateId: command.eventId,
      payload: {
        id: command.eventId,
        restoredAt: metadata.timestamp,
      },
    };
    await this.eventStore.append(restoreEvent);
  }
}
