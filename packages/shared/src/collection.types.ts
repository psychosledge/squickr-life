import type { DomainEvent } from './domain-event';

// ============================================================================
// Collection Domain Types
// ============================================================================

/**
 * Collection type discriminator
 */
export type CollectionType = 'log' | 'custom' | 'tracker';

/**
 * Collection settings - user preferences for a collection
 */
export interface CollectionSettings {
  /** Whether to collapse completed tasks into a collapsible section */
  readonly collapseCompleted?: boolean;
}

/**
 * Collection entity - represents a user-created collection
 * This is derived from events, not stored directly
 */
export interface Collection {
  /** Unique identifier (UUID v4) */
  readonly id: string;
  
  /** User-facing name (can duplicate) */
  readonly name: string;
  
  /** Collection type (log/custom/tracker) */
  readonly type: CollectionType;
  
  /** Fractional index for user-defined ordering */
  readonly order: string;
  
  /** When the collection was created (ISO 8601) */
  readonly createdAt: string;
  
  /** Soft delete timestamp (ISO 8601) */
  readonly deletedAt?: string;
  
  /** Optional: User who created the collection (for future multi-user support) */
  readonly userId?: string;
  
  /** Collection-specific settings */
  readonly settings?: CollectionSettings;
}

// ============================================================================
// Collection Events
// ============================================================================

/**
 * CollectionCreated Event
 * Emitted when a new collection is created
 * 
 * Invariants:
 * - aggregateId must equal payload.id
 * - name must be at least 1 character (after trim)
 * - type defaults to 'log' if not provided
 * - createdAt must not be in the future
 * - order is a fractional index for positioning
 */
export interface CollectionCreated extends DomainEvent {
  readonly type: 'CollectionCreated';
  readonly aggregateId: string;
  readonly payload: {
    readonly id: string;
    readonly name: string;
    readonly type: CollectionType;
    readonly order: string;
    readonly createdAt: string;
    readonly userId?: string;
  };
}

/**
 * CollectionRenamed Event
 * Emitted when a collection is renamed
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 * - newName must be at least 1 character (after trim)
 */
export interface CollectionRenamed extends DomainEvent {
  readonly type: 'CollectionRenamed';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly newName: string;
    readonly renamedAt: string;
  };
}

/**
 * CollectionReordered Event
 * Emitted when a collection's position is changed
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 * - order must be a valid fractional index string
 */
export interface CollectionReordered extends DomainEvent {
  readonly type: 'CollectionReordered';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly order: string;
    readonly reorderedAt: string;
  };
}

/**
 * CollectionDeleted Event
 * Emitted when a collection is soft deleted
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 */
export interface CollectionDeleted extends DomainEvent {
  readonly type: 'CollectionDeleted';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly deletedAt: string;
  };
}

/**
 * CollectionSettingsUpdated Event
 * Emitted when a collection's settings are updated
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 * - settings must contain at least one property
 */
export interface CollectionSettingsUpdated extends DomainEvent {
  readonly type: 'CollectionSettingsUpdated';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly settings: CollectionSettings;
    readonly updatedAt: string;
  };
}

// ============================================================================
// Collection Commands
// ============================================================================

/**
 * CreateCollection Command
 * Represents the user's intent to create a new collection
 * 
 * Validation rules:
 * - name: Required, will be trimmed, minimum 1 character
 * - type: Optional, defaults to 'log'
 */
export interface CreateCollectionCommand {
  readonly name: string;
  readonly type?: CollectionType;
  readonly userId?: string;
}

/**
 * RenameCollection Command
 * Represents the user's intent to rename a collection
 * 
 * Validation rules:
 * - name: Required, will be trimmed, minimum 1 character
 */
export interface RenameCollectionCommand {
  readonly collectionId: string;
  readonly name: string;
}

/**
 * ReorderCollection Command
 * Represents the user's intent to reorder a collection
 * 
 * @param collectionId - The collection to reorder
 * @param previousCollectionId - The collection that should come before this one (null if moving to start)
 * @param nextCollectionId - The collection that should come after this one (null if moving to end)
 */
export interface ReorderCollectionCommand {
  readonly collectionId: string;
  readonly previousCollectionId: string | null;
  readonly nextCollectionId: string | null;
}

/**
 * DeleteCollection Command
 * Represents the user's intent to delete a collection (soft delete)
 */
export interface DeleteCollectionCommand {
  readonly collectionId: string;
}

/**
 * UpdateCollectionSettings Command
 * Represents the user's intent to update collection settings
 */
export interface UpdateCollectionSettingsCommand {
  readonly collectionId: string;
  readonly settings: CollectionSettings;
}

/**
 * Union type of all collection-related events
 * This enables type-safe event handling with discriminated unions
 */
export type CollectionEvent = CollectionCreated | CollectionRenamed | CollectionReordered | CollectionDeleted | CollectionSettingsUpdated;
