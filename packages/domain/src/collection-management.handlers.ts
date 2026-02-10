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
 * Moves a task to a different collection (removes from all current, adds to target)
 */
export class MoveTaskToCollectionHandler {
  constructor(
    private readonly addHandler: AddTaskToCollectionHandler,
    private readonly removeHandler: RemoveTaskFromCollectionHandler,
    private readonly entryProjection: EntryListProjection
  ) {}
  
  async handle(command: MoveTaskToCollectionCommand): Promise<void> {
    const task = await this.entryProjection.getTaskById(command.taskId);
    if (!task) {
      throw new Error(`Task ${command.taskId} not found`);
    }
    
    // Remove from ALL current collections
    for (const collectionId of task.collections || []) {
      await this.removeHandler.handle({
        taskId: command.taskId,
        collectionId,
      });
    }
    
    // Add to target collection
    await this.addHandler.handle({
      taskId: command.taskId,
      collectionId: command.targetCollectionId,
    });
  }
}
