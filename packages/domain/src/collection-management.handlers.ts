import type { IEventStore } from './event-store';
import type { EntryListProjection } from './entry.projections';
import type { 
  AddTaskToCollectionCommand,
  RemoveTaskFromCollectionCommand,
  MoveTaskToCollectionCommand,
  TaskAddedToCollection, 
  TaskRemovedFromCollection 
} from './task.types';
import { generateEventMetadata } from './event-helpers';

/**
 * AddTaskToCollectionHandler
 * Adds a task to an additional collection (multi-collection presence)
 */
export class AddTaskToCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}
  
  async handle(command: AddTaskToCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }
    
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    
    // Idempotency: Already in this collection?
    if (task.collections?.includes(command.collectionId)) {
      return;
    }
    
    const metadata = generateEventMetadata();
    
    const event: TaskAddedToCollection = {
      ...metadata,
      type: 'TaskAddedToCollection',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        collectionId: command.collectionId,
        addedAt: metadata.timestamp,
      },
    };
    
    await this.eventStore.append(event);
  }
}

/**
 * RemoveTaskFromCollectionHandler
 * Removes a task from a collection (creates ghost entry)
 */
export class RemoveTaskFromCollectionHandler {
  constructor(
    private readonly eventStore: IEventStore,
    private readonly entryProjection: EntryListProjection
  ) {}
  
  async handle(command: RemoveTaskFromCollectionCommand): Promise<void> {
    // Validate collectionId
    if (!command.collectionId?.trim()) {
      throw new Error('Collection ID cannot be empty');
    }
    
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    
    // Idempotency: Not in this collection?
    if (!task.collections?.includes(command.collectionId)) {
      return;
    }
    
    const metadata = generateEventMetadata();
    
    const event: TaskRemovedFromCollection = {
      ...metadata,
      type: 'TaskRemovedFromCollection',
      aggregateId: command.taskId,
      payload: {
        taskId: command.taskId,
        collectionId: command.collectionId,
        removedAt: metadata.timestamp,
      },
    };
    
    await this.eventStore.append(event);
  }
}

/**
 * MoveTaskToCollectionHandler
 * Moves a task from current collection to target collection
 * 
 * Multi-collection behavior:
 * - Removes task from CURRENT collection only (not all collections)
 * - Preserves task in any other collections it belongs to
 * - Example: Task in [A, B, C] moved from B → D results in [A, C, D]
 * 
 * Validation:
 * - Task must exist
 * - Task must be in currentCollectionId
 * - currentCollectionId ≠ targetCollectionId (otherwise no-op)
 */
export class MoveTaskToCollectionHandler {
  constructor(
    private readonly addHandler: AddTaskToCollectionHandler,
    private readonly removeHandler: RemoveTaskFromCollectionHandler,
    private readonly entryProjection: EntryListProjection
  ) {}
  
  async handle(command: MoveTaskToCollectionCommand): Promise<void> {
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
    
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    
    // Validate task is actually in current collection
    if (!task.collections?.includes(command.currentCollectionId)) {
      throw new Error(
        `Task ${command.taskId} is not in collection ${command.currentCollectionId}`
      );
    }
    
    // Remove from current collection only (not all collections)
    await this.removeHandler.handle({
      taskId: command.taskId,
      collectionId: command.currentCollectionId,
    });
    
    // Add to target collection
    await this.addHandler.handle({
      taskId: command.taskId,
      collectionId: command.targetCollectionId,
    });
  }
}
