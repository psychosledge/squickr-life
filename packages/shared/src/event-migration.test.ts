import { describe, it, expect, beforeEach } from 'vitest';
import { MigrateEventHandler } from './event.handlers';
import { CreateEventHandler } from './event.handlers';
import { EventStore } from './event-store';
import { EntryListProjection } from './entry.projections';
import type { MigrateEventCommand, EventMigrated } from './task.types';

describe('MigrateEventHandler', () => {
  let eventStore: EventStore;
  let entryProjection: EntryListProjection;
  let handler: MigrateEventHandler;
  let createEventHandler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new MigrateEventHandler(eventStore, entryProjection);
    createEventHandler = new CreateEventHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create EventMigrated event for valid event', async () => {
      // Create an event
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        eventDate: '2026-01-27',
        collectionId: 'collection-A',
      });

      // Migrate event to collection B
      const command: MigrateEventCommand = {
        eventId,
        targetCollectionId: 'collection-B',
      };

      const newEventId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // EventCreated + EventMigrated

      const migrateEvent = events[1] as EventMigrated;
      expect(migrateEvent.type).toBe('EventMigrated');
      expect(migrateEvent.payload.originalEventId).toBe(eventId);
      expect(migrateEvent.payload.targetCollectionId).toBe('collection-B');
      expect(migrateEvent.payload.migratedToId).toBe(newEventId);
      expect(migrateEvent.aggregateId).toBe(eventId);
    });

    it('should create new event in target collection with same content and eventDate', async () => {
      // Create an event
      const eventId = await createEventHandler.handle({ 
        content: 'Original event content',
        eventDate: '2026-01-27',
        collectionId: 'collection-A',
      });

      // Migrate to collection B
      const newEventId = await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      // Verify new event has same properties
      const newEvent = await entryProjection.getEventById(newEventId);
      const originalEvent = await entryProjection.getEventById(eventId);

      expect(newEvent).toBeDefined();
      expect(newEvent!.content).toBe(originalEvent!.content);
      expect(newEvent!.eventDate).toBe(originalEvent!.eventDate);
      expect(newEvent!.collectionId).toBe('collection-B');
      expect(newEvent!.migratedFrom).toBe(eventId);
      expect(newEvent!.id).not.toBe(eventId); // Different ID
    });

    it('should mark original event with migratedTo pointer', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      const newEventId = await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      const originalEvent = await entryProjection.getEventById(eventId);
      expect(originalEvent!.migratedTo).toBe(newEventId);
    });

    it('should preserve original event in original collection', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      // Original event should still exist and be in collection A
      const originalEvent = await entryProjection.getEventById(eventId);
      expect(originalEvent).toBeDefined();
      expect(originalEvent!.collectionId).toBe('collection-A');
    });

    it('should throw error if event does not exist', async () => {
      const command: MigrateEventCommand = {
        eventId: 'non-existent-event',
        targetCollectionId: 'collection-B',
      };

      await expect(handler.handle(command)).rejects.toThrow('Entry non-existent-event not found');
    });

    it('should throw error if event is already migrated', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      // Migrate once
      await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again
      await expect(handler.handle({
        eventId,
        targetCollectionId: 'collection-C',
      })).rejects.toThrow('Event has already been migrated');
    });

    it('should be idempotent - return existing migration if same target collection', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      // Migrate once
      const newEventId1 = await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again to same collection
      const newEventId2 = await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      expect(newEventId1).toBe(newEventId2);
      
      // Should only have 2 events (EventCreated + EventMigrated), not 3
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
    });

    it('should set event metadata correctly', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      const events = await eventStore.getAll();
      const migrateEvent = events[1] as EventMigrated;

      expect(migrateEvent.id).toBeDefined();
      expect(migrateEvent.timestamp).toBeDefined();
      expect(migrateEvent.version).toBe(1);
      expect(migrateEvent.payload.migratedAt).toBe(migrateEvent.timestamp);
    });

    it('should allow migrating from uncategorized (null collection)', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Uncategorized event',
        // No collectionId
      });

      const newEventId = await handler.handle({
        eventId,
        targetCollectionId: 'collection-B',
      });

      const newEvent = await entryProjection.getEventById(newEventId);
      expect(newEvent!.collectionId).toBe('collection-B');
      expect(newEvent!.migratedFrom).toBe(eventId);
    });

    it('should allow migrating to uncategorized (null collection)', async () => {
      const eventId = await createEventHandler.handle({ 
        content: 'Test event',
        collectionId: 'collection-A',
      });

      const newEventId = await handler.handle({
        eventId,
        targetCollectionId: null,
      });

      const newEvent = await entryProjection.getEventById(newEventId);
      expect(newEvent!.collectionId).toBeUndefined();
      expect(newEvent!.migratedFrom).toBe(eventId);
    });
  });
});
