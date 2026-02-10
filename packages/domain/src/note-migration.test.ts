import { describe, it, expect, beforeEach } from 'vitest';
import { MigrateNoteHandler } from './note.handlers';
import { CreateNoteHandler } from './note.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import type { MigrateNoteCommand, NoteMigrated } from './task.types';

describe('MigrateNoteHandler', () => {
  let eventStore: IEventStore;
  let entryProjection: EntryListProjection;
  let handler: MigrateNoteHandler;
  let createNoteHandler: CreateNoteHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new MigrateNoteHandler(eventStore, entryProjection);
    createNoteHandler = new CreateNoteHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create NoteMigrated event for valid note', async () => {
      // Create a note
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      // Migrate note to collection B
      const command: MigrateNoteCommand = {
        noteId,
        targetCollectionId: 'collection-B',
      };

      const newNoteId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // NoteCreated + NoteMigrated

      const migrateEvent = events[1] as NoteMigrated;
      expect(migrateEvent.type).toBe('NoteMigrated');
      expect(migrateEvent.payload.originalNoteId).toBe(noteId);
      expect(migrateEvent.payload.targetCollectionId).toBe('collection-B');
      expect(migrateEvent.payload.migratedToId).toBe(newNoteId);
      expect(migrateEvent.aggregateId).toBe(noteId);
    });

    it('should create new note in target collection with same content', async () => {
      // Create a note
      const noteId = await createNoteHandler.handle({ 
        content: 'Original note content',
        collectionId: 'collection-A',
      });

      // Migrate to collection B
      const newNoteId = await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      // Verify new note has same properties
      const newNote = await entryProjection.getNoteById(newNoteId);
      const originalNote = await entryProjection.getNoteById(noteId);

      expect(newNote).toBeDefined();
      expect(newNote!.content).toBe(originalNote!.content);
      expect(newNote!.collectionId).toBe('collection-B');
      expect(newNote!.migratedFrom).toBe(noteId);
      expect(newNote!.id).not.toBe(noteId); // Different ID
    });

    it('should mark original note with migratedTo pointer', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      const newNoteId = await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      const originalNote = await entryProjection.getNoteById(noteId);
      expect(originalNote!.migratedTo).toBe(newNoteId);
    });

    it('should update original note collectionId to point to target collection', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      // Original note should still exist in its original collection
      // but have migratedToCollectionId set for "Go to" navigation
      const originalNote = await entryProjection.getNoteById(noteId);
      expect(originalNote).toBeDefined();
      expect(originalNote!.collectionId).toBe('collection-A'); // Stays in original collection
      expect(originalNote!.migratedToCollectionId).toBe('collection-B'); // Points to target
    });

    it('should throw error if note does not exist', async () => {
      const command: MigrateNoteCommand = {
        noteId: 'non-existent-note',
        targetCollectionId: 'collection-B',
      };

      await expect(handler.handle(command)).rejects.toThrow('Entry non-existent-note not found');
    });

    it('should throw error if note is already migrated', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      // Migrate once
      await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again
      await expect(handler.handle({
        noteId,
        targetCollectionId: 'collection-C',
      })).rejects.toThrow('Note has already been migrated');
    });

    it('should be idempotent - return existing migration if same target collection', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      // Migrate once
      const newNoteId1 = await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      // Try to migrate again to same collection
      const newNoteId2 = await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      expect(newNoteId1).toBe(newNoteId2);
      
      // Should only have 2 events (NoteCreated + NoteMigrated), not 3
      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
    });

    it('should set event metadata correctly', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      const events = await eventStore.getAll();
      const migrateEvent = events[1] as NoteMigrated;

      expect(migrateEvent.id).toBeDefined();
      expect(migrateEvent.timestamp).toBeDefined();
      expect(migrateEvent.version).toBe(1);
      expect(migrateEvent.payload.migratedAt).toBe(migrateEvent.timestamp);
    });

    it('should allow migrating from uncategorized (null collection)', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Uncategorized note',
        // No collectionId
      });

      const newNoteId = await handler.handle({
        noteId,
        targetCollectionId: 'collection-B',
      });

      const newNote = await entryProjection.getNoteById(newNoteId);
      expect(newNote!.collectionId).toBe('collection-B');
      expect(newNote!.migratedFrom).toBe(noteId);
    });

    it('should allow migrating to uncategorized (null collection)', async () => {
      const noteId = await createNoteHandler.handle({ 
        content: 'Test note',
        collectionId: 'collection-A',
      });

      const newNoteId = await handler.handle({
        noteId,
        targetCollectionId: null,
      });

      const newNote = await entryProjection.getNoteById(newNoteId);
      expect(newNote!.collectionId).toBeUndefined();
      expect(newNote!.migratedFrom).toBe(noteId);
    });
  });
});
