/**
 * Barrel file for @squickr/shared package
 * Re-exports all types for clean imports in other packages
 */

// Base domain event
export type { DomainEvent } from './domain-event';

// Task domain types
export type {
  TaskStatus,
  Task,
  TaskCreated,
  TaskCompleted,
  TaskReopened,
  CreateTaskCommand,
  CompleteTaskCommand,
  ReopenTaskCommand,
  TaskEvent,
} from './task.types';

// Union type of all domain events in Squickr Life
export type { TaskEvent as SquickrEvent } from './task.types';

// Event Store
export { EventStore, type IEventStore } from './event-store';
export { IndexedDBEventStore } from './indexeddb-event-store';

// Command Handlers
export { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler } from './task.handlers';

// Projections (Read Models)
export { TaskListProjection } from './task.projections';
