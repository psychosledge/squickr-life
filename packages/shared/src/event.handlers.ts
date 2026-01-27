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
  ReorderEventCommand,
  EventReordered
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
 * - Create EventDeleted event
 * - Persist event to EventStore
 */
export class DeleteEventHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: IEventProjection
  ) {}

  /**
   * Handle DeleteEvent command
   * 
   * Validation rules:
   * - Event must exist
   * 
   * @param command - The DeleteEvent command
   * @throws Error if validation fails
   */
  async handle(command: DeleteEventCommand): Promise<void> {
    // Validate event exists
    const evt = await this.projection.getEventById(command.eventId);
    if (!evt) {
      throw new Error(`Event ${command.eventId} not found`);
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create EventDeleted event
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
