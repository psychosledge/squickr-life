import type { IEventStore } from './event-store';
import type { CollectionListProjection } from './collection.projections';
import type { 
  CreateCollectionCommand, 
  CollectionCreated,
  RenameCollectionCommand,
  CollectionRenamed,
  ReorderCollectionCommand,
  CollectionReordered,
  DeleteCollectionCommand,
  CollectionDeleted,
  UpdateCollectionSettingsCommand,
  CollectionSettingsUpdated
} from './collection.types';
import { generateEventMetadata } from './event-helpers';
import { generateKeyBetween } from 'fractional-indexing';
import { validateCollectionName } from './collection-validation';

/**
 * Command Handler for CreateCollection
 * 
 * Responsibilities:
 * - Validate command input (business rules)
 * - Generate unique identifiers
 * - Generate fractional index for collection ordering
 * - Create domain events
 * - Persist events to EventStore
 * 
 * This is the "write side" of CQRS
 */
export class CreateCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: CollectionListProjection
  ) {}

  /**
   * Handle CreateCollection command
   * 
   * Validation rules:
   * - Name must not be empty after trimming
   * - Type defaults to 'log' if not provided
   * - Name can duplicate (NO uniqueness check)
   * 
   * Idempotency:
   * - If a collection with the same name was created within the last 5 seconds,
   *   returns the existing collection ID instead of creating a duplicate.
   *   This prevents accidental double-clicks or rapid retries from creating duplicates.
   * 
   * @param command - The CreateCollection command
   * @returns The ID of the created (or existing) collection
   * @throws Error if validation fails
   */
  async handle(command: CreateCollectionCommand): Promise<string> {
    // Validate and normalize name
    const name = validateCollectionName(command.name);

    // Idempotency check: Look for recent duplicate creation (within 5 seconds)
    const recentCollections = await this.projection.getCollections();
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    
    const recentDuplicate = recentCollections.find(
      c => c.name === name && c.createdAt > fiveSecondsAgo
    );
    
    if (recentDuplicate) {
      // Idempotent: return existing collection ID instead of creating duplicate
      return recentDuplicate.id;
    }

    // Default type to 'log'
    const type = command.type ?? 'log';

    // Get last collection to generate order after it
    const collections = await this.projection.getCollections();
    const lastCollection = collections[collections.length - 1];
    const order = generateKeyBetween(lastCollection?.order ?? null, null);

    // Generate unique collection ID and event metadata
    const collectionId = crypto.randomUUID();
    const metadata = generateEventMetadata();

    // Create CollectionCreated event
    const event: CollectionCreated = {
      ...metadata,
      type: 'CollectionCreated',
      aggregateId: collectionId,
      payload: {
        id: collectionId,
        name,
        type,
        order,
        createdAt: metadata.timestamp,
        userId: command.userId,
      },
    };

    // Persist event
    await this.eventStore.append(event);

    // Return collection ID for reference
    return collectionId;
  }
}

/**
 * Command Handler for RenameCollection
 * 
 * Responsibilities:
 * - Validate collection exists
 * - Validate new name
 * - Create CollectionRenamed event
 * - Persist event to EventStore
 */
export class RenameCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: CollectionListProjection
  ) {}

  /**
   * Handle RenameCollection command
   * 
   * Validation rules:
   * - Collection must exist
   * - Name must not be empty after trimming
   * - Name can duplicate (NO uniqueness check)
   * 
   * Idempotency:
   * - If the collection already has the target name, no event is emitted.
   *   This prevents duplicate events from double-clicks or retries.
   * 
   * @param command - The RenameCollection command
   * @throws Error if validation fails
   */
  async handle(command: RenameCollectionCommand): Promise<void> {
    // Validate collection exists
    const collection = await this.projection.getCollectionById(command.collectionId);
    if (!collection) {
      throw new Error(`Collection ${command.collectionId} not found`);
    }

    // Validate and normalize name
    const name = validateCollectionName(command.name);

    // Idempotency: if already renamed to this name, do nothing
    if (collection.name === name) {
      return; // Already in desired state, no event needed
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create CollectionRenamed event
    const event: CollectionRenamed = {
      ...metadata,
      type: 'CollectionRenamed',
      aggregateId: command.collectionId,
      payload: {
        collectionId: command.collectionId,
        newName: name,
        renamedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for ReorderCollection
 * 
 * Responsibilities:
 * - Validate collection exists
 * - Calculate new fractional index based on neighboring collections
 * - Create CollectionReordered event
 * - Persist event to EventStore
 */
export class ReorderCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: CollectionListProjection
  ) {}

  /**
   * Handle ReorderCollection command
   * 
   * Validation rules:
   * - Collection must exist
   * - previousCollectionId must exist if provided
   * - nextCollectionId must exist if provided
   * 
   * Idempotency:
   * - If the calculated order matches the collection's current order,
   *   no event is emitted. This prevents duplicate events from retries.
   * 
   * @param command - The ReorderCollection command
   * @throws Error if validation fails
   */
  async handle(command: ReorderCollectionCommand): Promise<void> {
    // Validate collection exists
    const collection = await this.projection.getCollectionById(command.collectionId);
    if (!collection) {
      throw new Error(`Collection ${command.collectionId} not found`);
    }

    // Get the neighboring collections to calculate new order
    let previousOrder: string | null = null;
    let nextOrder: string | null = null;

    if (command.previousCollectionId) {
      const previousCollection = await this.projection.getCollectionById(command.previousCollectionId);
      if (!previousCollection) {
        throw new Error(`Collection ${command.previousCollectionId} not found`);
      }
      previousOrder = previousCollection.order;
    }

    if (command.nextCollectionId) {
      const nextCollection = await this.projection.getCollectionById(command.nextCollectionId);
      if (!nextCollection) {
        throw new Error(`Collection ${command.nextCollectionId} not found`);
      }
      nextOrder = nextCollection.order;
    }

    // Generate new fractional index between the neighboring collections
    const order = generateKeyBetween(previousOrder, nextOrder);

    // Idempotency: if already at this order, do nothing
    if (collection.order === order) {
      return; // Already in desired position, no event needed
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create CollectionReordered event
    const event: CollectionReordered = {
      ...metadata,
      type: 'CollectionReordered',
      aggregateId: command.collectionId,
      payload: {
        collectionId: command.collectionId,
        order,
        reorderedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for DeleteCollection
 * 
 * Responsibilities:
 * - Validate collection exists
 * - Create CollectionDeleted event (soft delete)
 * - Persist event to EventStore
 */
export class DeleteCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: CollectionListProjection
  ) {}

  /**
   * Handle DeleteCollection command
   * 
   * Validation rules:
   * - Collection must exist
   * 
   * @param command - The DeleteCollection command
   * @throws Error if validation fails
   */
  async handle(command: DeleteCollectionCommand): Promise<void> {
    // Validate collection exists
    const collection = await this.projection.getCollectionById(command.collectionId);
    if (!collection) {
      throw new Error(`Collection ${command.collectionId} not found`);
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create CollectionDeleted event
    const event: CollectionDeleted = {
      ...metadata,
      type: 'CollectionDeleted',
      aggregateId: command.collectionId,
      payload: {
        collectionId: command.collectionId,
        deletedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}

/**
 * Command Handler for UpdateCollectionSettings
 * 
 * Responsibilities:
 * - Validate collection exists
 * - Create CollectionSettingsUpdated event
 * - Persist event to EventStore
 */
export class UpdateCollectionSettingsHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projection: CollectionListProjection
  ) {}

  /**
   * Handle UpdateCollectionSettings command
   * 
   * Validation rules:
   * - Collection must exist
   * 
   * Idempotency:
   * - If the collection already has the target settings, no event is emitted.
   *   This prevents duplicate events from double-clicks or retries.
   * - Treats undefined as false for boolean settings
   * 
   * @param command - The UpdateCollectionSettings command
   * @throws Error if validation fails
   */
  async handle(command: UpdateCollectionSettingsCommand): Promise<void> {
    // Validate collection exists
    const collection = await this.projection.getCollectionById(command.collectionId);
    if (!collection) {
      throw new Error(`Collection ${command.collectionId} not found`);
    }

    // Normalize settings for comparison (treat undefined as false)
    const currentCollapseCompleted = collection.settings?.collapseCompleted ?? false;
    const newCollapseCompleted = command.settings.collapseCompleted ?? false;

    // Idempotency: if settings unchanged, do nothing
    if (currentCollapseCompleted === newCollapseCompleted) {
      return; // Already in desired state, no event needed
    }

    // Generate event metadata
    const metadata = generateEventMetadata();

    // Create CollectionSettingsUpdated event
    const event: CollectionSettingsUpdated = {
      ...metadata,
      type: 'CollectionSettingsUpdated',
      aggregateId: command.collectionId,
      payload: {
        collectionId: command.collectionId,
        settings: command.settings,
        updatedAt: metadata.timestamp,
      },
    };

    // Persist event
    await this.eventStore.append(event);
  }
}
