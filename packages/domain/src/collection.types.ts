import type { DomainEvent } from './domain-event';

// ============================================================================
// Collection Domain Types
// ============================================================================

/**
 * Collection type discriminator
 * - 'daily': Daily log collections (e.g., "Saturday, February 1") with date "2026-02-01"
 * - 'monthly': Monthly log collections (e.g., "February 2026") with date "2026-02"
 * - 'yearly': Yearly log collections (reserved for future use)
 * - 'custom': User-defined topical collections (e.g., "App Ideas", "Home Projects")
 * - 'log': Legacy type, treated as 'custom' by projections (for backward compatibility)
 * - 'tracker': Legacy type, treated as 'custom' by projections (for backward compatibility)
 */
export type CollectionType = 'daily' | 'monthly' | 'yearly' | 'custom' | 'log' | 'tracker';

/**
 * How to display completed tasks in a collection
 * - 'keep-in-place': Completed tasks stay where they are (default for migration)
 * - 'move-to-bottom': Completed tasks move below a separator
 * - 'collapse': Completed tasks hidden in expandable section
 */
export type CompletedTaskBehavior = 'keep-in-place' | 'move-to-bottom' | 'collapse';

/**
 * Collection settings - user preferences for a collection
 */
export interface CollectionSettings {
  /** @deprecated Use completedTaskBehavior instead. Migrated on read. */
  readonly collapseCompleted?: boolean;
  
  /** How to display completed tasks (null = use global user default) */
  readonly completedTaskBehavior?: CompletedTaskBehavior | null;
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
  
  /** Collection type (daily/monthly/yearly/custom/log/tracker) */
  readonly type: CollectionType;
  
  /** Fractional index for user-defined ordering */
  readonly order: string;
  
  /** ISO date for temporal collections (YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly) */
  readonly date?: string;
  
  /** Mark custom collection as favorite (pinned to top) */
  readonly isFavorite?: boolean;
  
  /** Track last access time for smart sorting */
  readonly lastAccessedAt?: string;
  
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
 * - date is required for daily/monthly/yearly collections
 * - date must match format for collection type (YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly)
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
    readonly date?: string;
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

/**
 * CollectionFavorited Event
 * Emitted when a collection is marked as favorite
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 * - Only custom collections can be favorited
 */
export interface CollectionFavorited extends DomainEvent {
  readonly type: 'CollectionFavorited';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly favoritedAt: string;
  };
}

/**
 * CollectionUnfavorited Event
 * Emitted when a collection is unmarked as favorite
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 */
export interface CollectionUnfavorited extends DomainEvent {
  readonly type: 'CollectionUnfavorited';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly unfavoritedAt: string;
  };
}

/**
 * CollectionAccessed Event
 * Emitted when a collection is accessed (navigated to)
 * 
 * Invariants:
 * - aggregateId must match an existing collection
 */
export interface CollectionAccessed extends DomainEvent {
  readonly type: 'CollectionAccessed';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly accessedAt: string;
  };
}

/**
 * CollectionRestored Event
 * Emitted when a soft-deleted collection is restored
 * 
 * Invariants:
 * - aggregateId must match an existing deleted collection
 */
export interface CollectionRestored extends DomainEvent {
  readonly type: 'CollectionRestored';
  readonly aggregateId: string;
  readonly payload: {
    readonly collectionId: string;
    readonly restoredAt: string;
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
 * - date: Required for daily/monthly/yearly collections, must match format for type
 */
export interface CreateCollectionCommand {
  readonly name: string;
  readonly type?: CollectionType;
  readonly date?: string;
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
 * FavoriteCollection Command
 * Represents the user's intent to mark a collection as favorite
 */
export interface FavoriteCollectionCommand {
  readonly collectionId: string;
}

/**
 * UnfavoriteCollection Command
 * Represents the user's intent to remove favorite status from a collection
 */
export interface UnfavoriteCollectionCommand {
  readonly collectionId: string;
}

/**
 * RestoreCollection Command
 * Represents the user's intent to restore a soft-deleted collection
 */
export interface RestoreCollectionCommand {
  readonly collectionId: string;
}

/**
 * AccessCollection Command
 * Represents the user's intent to track collection access
 */
export interface AccessCollectionCommand {
  readonly collectionId: string;
}

/**
 * Union type of all collection-related events
 * This enables type-safe event handling with discriminated unions
 */
export type CollectionEvent = 
  | CollectionCreated 
  | CollectionRenamed 
  | CollectionReordered 
  | CollectionDeleted 
  | CollectionRestored
  | CollectionSettingsUpdated
  | CollectionFavorited
  | CollectionUnfavorited
  | CollectionAccessed;
