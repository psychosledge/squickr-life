import { describe, it, expect, beforeEach } from 'vitest';
import { CollectionListProjection } from './collection.projections';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import type { CollectionCreated, CollectionRenamed, CollectionReordered, CollectionDeleted, CollectionSettingsUpdated } from './collection.types';
import { generateEventMetadata } from './event-helpers';

describe('CollectionListProjection', () => {
  let eventStore: IEventStore;
  let projection: CollectionListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new CollectionListProjection(eventStore);
  });

  describe('getCollections', () => {
    it('should return empty array when no collections', async () => {
      const collections = await projection.getCollections();
      expect(collections).toEqual([]);
    });

    it('should rebuild collections from CollectionCreated events', async () => {
      const event1: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'First Collection',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const event2: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-2',
        payload: {
          id: 'col-2',
          name: 'Second Collection',
          type: 'custom',
          order: 'a1',
          createdAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(2);
      expect(collections[0].id).toBe('col-1');
      expect(collections[0].name).toBe('First Collection');
      expect(collections[0].type).toBe('log');
      expect(collections[1].id).toBe('col-2');
      expect(collections[1].name).toBe('Second Collection');
      expect(collections[1].type).toBe('custom');
    });

    it('should handle CollectionRenamed events', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Old Name',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const renamed: CollectionRenamed = {
        ...generateEventMetadata(),
        type: 'CollectionRenamed',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          newName: 'New Name',
          renamedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(renamed);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('New Name');
    });

    it('should handle CollectionReordered events', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const reordered: CollectionReordered = {
        ...generateEventMetadata(),
        type: 'CollectionReordered',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          order: 'a1',
          reorderedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(reordered);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].order).toBe('a1');
    });

    it('should filter out deleted collections', async () => {
      const created1: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'First',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const created2: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-2',
        payload: {
          id: 'col-2',
          name: 'Second',
          type: 'log',
          order: 'a1',
          createdAt: '2026-01-26T00:01:00.000Z',
        },
      };

      const deleted: CollectionDeleted = {
        ...generateEventMetadata(),
        type: 'CollectionDeleted',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          deletedAt: '2026-01-26T00:02:00.000Z',
        },
      };

      await eventStore.append(created1);
      await eventStore.append(created2);
      await eventStore.append(deleted);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].id).toBe('col-2');
    });

    it('should sort collections by order field', async () => {
      const created1: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Second',
          type: 'log',
          order: 'a1', // Higher order
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const created2: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-2',
        payload: {
          id: 'col-2',
          name: 'First',
          type: 'log',
          order: 'a0', // Lower order
          createdAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created1);
      await eventStore.append(created2);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(2);
      // Should be sorted by order, not creation time
      expect(collections[0].id).toBe('col-2'); // 'a0' comes first
      expect(collections[1].id).toBe('col-1'); // 'a1' comes second
    });

    it('should handle multiple events for same collection', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Original',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const renamed: CollectionRenamed = {
        ...generateEventMetadata(),
        type: 'CollectionRenamed',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          newName: 'Renamed',
          renamedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      const reordered: CollectionReordered = {
        ...generateEventMetadata(),
        type: 'CollectionReordered',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          order: 'a2',
          reorderedAt: '2026-01-26T00:02:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(renamed);
      await eventStore.append(reordered);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Renamed');
      expect(collections[0].order).toBe('a2');
    });

    it('should include userId if provided', async () => {
      const event: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
          userId: 'user-123',
        },
      };

      await eventStore.append(event);

      const collections = await projection.getCollections();
      expect(collections[0].userId).toBe('user-123');
    });
  });

  describe('getCollectionById', () => {
    it('should return undefined for non-existent ID', async () => {
      const collection = await projection.getCollectionById('non-existent');
      expect(collection).toBeUndefined();
    });

    it('should return correct collection by ID', async () => {
      const event1: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'First',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const event2: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-2',
        payload: {
          id: 'col-2',
          name: 'Second',
          type: 'log',
          order: 'a1',
          createdAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(event1);
      await eventStore.append(event2);

      const collection = await projection.getCollectionById('col-2');
      expect(collection).toBeDefined();
      expect(collection?.id).toBe('col-2');
      expect(collection?.name).toBe('Second');
    });

    it('should return undefined for deleted collection', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const deleted: CollectionDeleted = {
        ...generateEventMetadata(),
        type: 'CollectionDeleted',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          deletedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(deleted);

      const collection = await projection.getCollectionById('col-1');
      expect(collection).toBeUndefined();
    });

    it('should reflect latest state with multiple events', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Original',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const renamed: CollectionRenamed = {
        ...generateEventMetadata(),
        type: 'CollectionRenamed',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          newName: 'Updated',
          renamedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(renamed);

      const collection = await projection.getCollectionById('col-1');
      expect(collection?.name).toBe('Updated');
    });
  });

  describe('CollectionSettingsUpdated events', () => {
    it('should handle CollectionSettingsUpdated event', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settingsUpdated: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: {
            collapseCompleted: true,
          },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settingsUpdated);

      const collections = await projection.getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].settings?.collapseCompleted).toBe(true);
    });

    it('should update settings when changed', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settings1: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: { collapseCompleted: true },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      const settings2: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: { collapseCompleted: false },
          updatedAt: '2026-01-26T00:02:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settings1);
      await eventStore.append(settings2);

      const collection = await projection.getCollectionById('col-1');
      expect(collection?.settings?.collapseCompleted).toBe(false);
    });

    it('should preserve collection without settings', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      await eventStore.append(created);

      const collection = await projection.getCollectionById('col-1');
      expect(collection?.settings).toBeUndefined();
    });
  });

  describe('CollectionSettings migration (collapseCompleted → completedTaskBehavior)', () => {
    it('should migrate collapseCompleted: true to completedTaskBehavior: collapse', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settingsUpdated: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: {
            collapseCompleted: true, // Legacy format
          },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settingsUpdated);

      const collection = await projection.getCollectionById('col-1');
      
      // Migration should convert to new format
      expect(collection?.settings?.completedTaskBehavior).toBe('collapse');
      // Legacy field should still be present for backward compat
      expect(collection?.settings?.collapseCompleted).toBe(true);
    });

    it('should migrate collapseCompleted: false to completedTaskBehavior: keep-in-place', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settingsUpdated: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: {
            collapseCompleted: false, // Legacy format
          },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settingsUpdated);

      const collection = await projection.getCollectionById('col-1');
      
      // Migration should convert to new format
      expect(collection?.settings?.completedTaskBehavior).toBe('keep-in-place');
      expect(collection?.settings?.collapseCompleted).toBe(false);
    });

    it('should not migrate if completedTaskBehavior is already set', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settingsUpdated: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: {
            collapseCompleted: true, // Legacy field present
            completedTaskBehavior: 'move-to-bottom', // But new field takes precedence
          },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settingsUpdated);

      const collection = await projection.getCollectionById('col-1');
      
      // Should use explicitly set completedTaskBehavior, not migrate from boolean
      expect(collection?.settings?.completedTaskBehavior).toBe('move-to-bottom');
    });

    it('should handle completedTaskBehavior: null (use global default)', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      const settingsUpdated: CollectionSettingsUpdated = {
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: {
            completedTaskBehavior: null, // Explicitly use global default
          },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(created);
      await eventStore.append(settingsUpdated);

      const collection = await projection.getCollectionById('col-1');
      
      // null means "use global user default"
      expect(collection?.settings?.completedTaskBehavior).toBe(null);
    });

    it('should handle all three new behavior modes', async () => {
      const created: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      await eventStore.append(created);

      // Test 'keep-in-place'
      await eventStore.append({
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: { completedTaskBehavior: 'keep-in-place' },
          updatedAt: '2026-01-26T00:01:00.000Z',
        },
      } as CollectionSettingsUpdated);

      let collection = await projection.getCollectionById('col-1');
      expect(collection?.settings?.completedTaskBehavior).toBe('keep-in-place');

      // Test 'move-to-bottom'
      await eventStore.append({
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: { completedTaskBehavior: 'move-to-bottom' },
          updatedAt: '2026-01-26T00:02:00.000Z',
        },
      } as CollectionSettingsUpdated);

      collection = await projection.getCollectionById('col-1');
      expect(collection?.settings?.completedTaskBehavior).toBe('move-to-bottom');

      // Test 'collapse'
      await eventStore.append({
        ...generateEventMetadata(),
        type: 'CollectionSettingsUpdated',
        aggregateId: 'col-1',
        payload: {
          collectionId: 'col-1',
          settings: { completedTaskBehavior: 'collapse' },
          updatedAt: '2026-01-26T00:03:00.000Z',
        },
      } as CollectionSettingsUpdated);

      collection = await projection.getCollectionById('col-1');
      expect(collection?.settings?.completedTaskBehavior).toBe('collapse');
    });
  });


  describe('reactive updates', () => {
    it('should notify subscribers when events are appended', async () => {
      let notifyCount = 0;
      
      projection.subscribe(() => {
        notifyCount++;
      });

      const event: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      await eventStore.append(event);

      // Should be notified once
      expect(notifyCount).toBe(1);
    });

    it('should allow unsubscribing', async () => {
      let notifyCount = 0;
      
      const unsubscribe = projection.subscribe(() => {
        notifyCount++;
      });

      const event: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-1',
        payload: {
          id: 'col-1',
          name: 'Test',
          type: 'log',
          order: 'a0',
          createdAt: '2026-01-26T00:00:00.000Z',
        },
      };

      await eventStore.append(event);
      expect(notifyCount).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Append another event
      const event2: CollectionCreated = {
        ...generateEventMetadata(),
        type: 'CollectionCreated',
        aggregateId: 'col-2',
        payload: {
          id: 'col-2',
          name: 'Test 2',
          type: 'log',
          order: 'a1',
          createdAt: '2026-01-26T00:01:00.000Z',
        },
      };

      await eventStore.append(event2);

      // Should still be 1 (not notified after unsubscribe)
      expect(notifyCount).toBe(1);
    });
  });
});
