import { describe, it, expect, beforeEach } from 'vitest';
import { CreateNoteHandler, UpdateNoteContentHandler, DeleteNoteHandler } from './note.handlers';
import { EventStore } from './event-store';
import { EntryListProjection } from './entry.projections';
import type { CreateNoteCommand, NoteCreated, UpdateNoteContentCommand, NoteContentChanged, DeleteNoteCommand, NoteDeleted } from './task.types';

describe('CreateNoteHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let handler: CreateNoteHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    handler = new CreateNoteHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a NoteCreated event for valid command', async () => {
      const command: CreateNoteCommand = {
        content: 'Meeting notes from standup',
      };

      const noteId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);

      const event = events[0] as NoteCreated;
      expect(event.type).toBe('NoteCreated');
      expect(event.payload.content).toBe('Meeting notes from standup');
      expect(event.payload.id).toBe(noteId);
      expect(event.aggregateId).toBe(noteId);
    });

    it('should generate unique UUID for note ID', async () => {
      const command: CreateNoteCommand = {
        content: 'Test note',
      };

      const noteId1 = await handler.handle(command);
      const noteId2 = await handler.handle(command);

      expect(noteId1).not.toBe(noteId2);
      expect(noteId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should trim whitespace from content', async () => {
      const command: CreateNoteCommand = {
        content: '  Meeting notes  ',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;
      expect(event.payload.content).toBe('Meeting notes');
    });

    it('should reject empty content after trimming', async () => {
      const command: CreateNoteCommand = {
        content: '   ',
      };

      await expect(handler.handle(command)).rejects.toThrow('Content cannot be empty');
    });

    it('should reject content longer than 5000 characters', async () => {
      const command: CreateNoteCommand = {
        content: 'a'.repeat(5001),
      };

      await expect(handler.handle(command)).rejects.toThrow('Content must be between 1 and 5000 characters');
    });

    it('should accept content with exactly 5000 characters', async () => {
      const longContent = 'a'.repeat(5000);
      const command: CreateNoteCommand = {
        content: longContent,
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;
      expect(event.payload.content).toBe(longContent);
    });

    it('should set event metadata correctly', async () => {
      const command: CreateNoteCommand = {
        content: 'Test note',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should generate fractional index order', async () => {
      const command: CreateNoteCommand = {
        content: 'First note',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;

      expect(event.payload.order).toBeDefined();
      expect(event.payload.order).toBe('a0'); // First item
    });

    it('should generate sequential orders for multiple notes', async () => {
      await handler.handle({ content: 'Note 1' });
      await handler.handle({ content: 'Note 2' });
      await handler.handle({ content: 'Note 3' });

      const events = await eventStore.getAll();
      
      expect((events[0] as NoteCreated).payload.order).toBe('a0');
      expect((events[1] as NoteCreated).payload.order).toBe('a1');
      expect((events[2] as NoteCreated).payload.order).toBe('a2');
    });

    it('should include userId if provided', async () => {
      const command: CreateNoteCommand = {
        content: 'Note with user',
        userId: 'user-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;
      expect(event.payload.userId).toBe('user-123');
    });

    it('should include collectionId if provided', async () => {
      const command: CreateNoteCommand = {
        content: 'Note in collection',
        collectionId: 'collection-456',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;
      expect(event.payload.collectionId).toBe('collection-456');
    });

    it('should create note without collectionId (uncategorized)', async () => {
      const command: CreateNoteCommand = {
        content: 'Uncategorized note',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as NoteCreated;
      expect(event.payload.collectionId).toBeUndefined();
    });
  });
});

describe('UpdateNoteContentHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let createHandler: CreateNoteHandler;
  let updateHandler: UpdateNoteContentHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    createHandler = new CreateNoteHandler(eventStore, projection);
    updateHandler = new UpdateNoteContentHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a NoteContentChanged event for valid command', async () => {
      // Create a note first
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      // Update the content
      const command: UpdateNoteContentCommand = {
        noteId,
        content: 'New content',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // NoteCreated + NoteContentChanged

      const event = events[1] as NoteContentChanged;
      expect(event.type).toBe('NoteContentChanged');
      expect(event.payload.noteId).toBe(noteId);
      expect(event.payload.newContent).toBe('New content');
      expect(event.aggregateId).toBe(noteId);
    });

    it('should trim whitespace from new content', async () => {
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateNoteContentCommand = {
        noteId,
        content: '  New content  ',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as NoteContentChanged;
      expect(event.payload.newContent).toBe('New content');
    });

    it('should reject empty content after trimming', async () => {
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateNoteContentCommand = {
        noteId,
        content: '   ',
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Content cannot be empty');
    });

    it('should reject content longer than 5000 characters', async () => {
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateNoteContentCommand = {
        noteId,
        content: 'a'.repeat(5001),
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Content must be between 1 and 5000 characters');
    });

    it('should accept content with exactly 5000 characters', async () => {
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      const longContent = 'a'.repeat(5000);
      const command: UpdateNoteContentCommand = {
        noteId,
        content: longContent,
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as NoteContentChanged;
      expect(event.payload.newContent).toBe(longContent);
    });

    it('should reject updating non-existent note', async () => {
      const command: UpdateNoteContentCommand = {
        noteId: 'non-existent-note',
        content: 'New content',
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Note non-existent-note not found');
    });

    it('should set event metadata correctly', async () => {
      const noteId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateNoteContentCommand = {
        noteId,
        content: 'New content',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as NoteContentChanged;

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(event.payload.changedAt).toBe(event.timestamp);
    });
  });
});

describe('DeleteNoteHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let createHandler: CreateNoteHandler;
  let deleteHandler: DeleteNoteHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    createHandler = new CreateNoteHandler(eventStore, projection);
    deleteHandler = new DeleteNoteHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create a NoteDeleted event for valid command', async () => {
      const noteId = await createHandler.handle({
        content: 'Note to delete',
      });

      const command: DeleteNoteCommand = {
        noteId,
      };

      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // NoteCreated + NoteDeleted

      const event = events[1] as NoteDeleted;
      expect(event.type).toBe('NoteDeleted');
      expect(event.payload.noteId).toBe(noteId);
      expect(event.aggregateId).toBe(noteId);
    });

    it('should reject deleting non-existent note', async () => {
      const command: DeleteNoteCommand = {
        noteId: 'non-existent-note',
      };

      await expect(deleteHandler.handle(command)).rejects.toThrow('Note non-existent-note not found');
    });

    it('should set event metadata correctly', async () => {
      const noteId = await createHandler.handle({
        content: 'Note to delete',
      });

      const command: DeleteNoteCommand = {
        noteId,
      };

      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as NoteDeleted;

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(event.payload.deletedAt).toBe(event.timestamp);
    });
  });
});
