import { describe, it, expect } from 'vitest';
import { getNavigationCollections } from './collectionNavigation';
import type { Entry } from '@squickr/domain';

describe('getNavigationCollections', () => {
  it('should return active collections excluding current collection', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15', 'yesterday-feb-14'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: false },
    ]);
  });

  it('should return ghost collections from collectionHistory with removedAt', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z' },
        { collectionId: 'yesterday-feb-14', addedAt: '2026-02-14T10:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
        { collectionId: 'today-feb-15', addedAt: '2026-02-15T10:00:00Z' },
      ],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: true },
    ]);
  });

  it('should prioritize active over ghost when collection appears in both', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z', removedAt: '2026-02-10T10:00:00Z' },
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-11T10:00:00Z' },
      ],
    };

    const result = getNavigationCollections(entry, null);

    // Should show as active (not ghost) since it's in collections array
    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
    ]);
  });

  it('should handle legacy migratedTo pattern', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
      migratedTo: 'task-2',
      migratedToCollectionId: 'tomorrow-feb-16',
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'tomorrow-feb-16', isGhost: false },
    ]);
  });

  it('should handle legacy migratedFrom pattern', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
      migratedFrom: 'task-0',
      migratedFromCollectionId: 'yesterday-feb-14',
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'yesterday-feb-14', isGhost: true },
    ]);
  });

  it('should de-duplicate collections from multiple sources', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z' },
        { collectionId: 'yesterday-feb-14', addedAt: '2026-02-14T10:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
      ],
      migratedTo: 'task-2',
      migratedToCollectionId: 'today-feb-15', // Duplicate of collections[1]
    };

    const result = getNavigationCollections(entry, null);

    // Should not have duplicates
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { collectionId: 'monthly-feb-2026', isGhost: false },
        { collectionId: 'today-feb-15', isGhost: false },
        { collectionId: 'yesterday-feb-14', isGhost: true },
      ])
    );
  });

  it('should exclude currentCollectionId from results', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15', 'yesterday-feb-14'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'monthly-feb-2026');

    expect(result).toEqual([
      { collectionId: 'today-feb-15', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: false },
    ]);
    expect(result).not.toContainEqual({ collectionId: 'monthly-feb-2026', isGhost: false });
  });

  it('should handle null currentCollectionId (uncategorized view)', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
    ]);
  });

  it('should return empty array when entry only in current collection', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['today-feb-15'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([]);
  });

  it('should handle entries with no collections or history', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([]);
  });

  it('should handle legacy entries without collections array but with migratedTo', () => {
    // Legacy task entries may not have collections array
    const entry = {
      id: 'task-1',
      type: 'task' as const,
      title: 'Test Task',
      status: 'open' as const,
      createdAt: '2026-02-15T10:00:00Z',
      migratedTo: 'task-2',
      migratedToCollectionId: 'tomorrow-feb-16',
    } as Entry;

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'tomorrow-feb-16', isGhost: false },
    ]);
  });

  it('should handle legacy entries with migratedToCollectionId undefined', () => {
    // When migratedToCollectionId is undefined, treat as uncategorized (null)
    // When viewing from global view (undefined), should show navigation to uncategorized
    const entry = {
      id: 'task-1',
      type: 'task' as const,
      title: 'Test Task',
      status: 'open' as const,
      createdAt: '2026-02-15T10:00:00Z',
      migratedTo: 'task-2',
      migratedToCollectionId: undefined,
    } as Entry;

    const result = getNavigationCollections(entry, undefined);

    expect(result).toEqual([
      { collectionId: null, isGhost: false },
    ]);
  });
});
