/**
 * TDD tests for Note and Event multi-collection handlers
 *
 * Tests AddNoteToCollectionHandler, RemoveNoteFromCollectionHandler, MoveNoteToCollectionHandler,
 * AddEventToCollectionHandler, RemoveEventFromCollectionHandler, MoveEventToCollectionHandler.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { EntryListProjection } from './entry.projections';
import {
  AddNoteToCollectionHandler,
  RemoveNoteFromCollectionHandler,
  MoveNoteToCollectionHandler,
} from './note-collection-management.handlers';
import {
  AddEventToCollectionHandler,
  RemoveEventFromCollectionHandler,
  MoveEventToCollectionHandler,
} from './event-collection-management.handlers';
import { generateEventMetadata } from './event-helpers';
import type {
  NoteCreated,
  EventCreated,
} from './task.types';
import type { DomainEvent } from './domain-event';

// ============================================================================
// Helpers
// ============================================================================

function makeNoteCreatedEvent(noteId: string, collectionId?: string): NoteCreated {
  return {
    ...generateEventMetadata(),
    type: 'NoteCreated',
    aggregateId: noteId,
    payload: {
      id: noteId,
      content: 'Test note content',
      createdAt: new Date().toISOString(),
      collectionId,
    },
  };
}

function makeEventCreatedEvent(eventId: string, collectionId?: string): EventCreated {
  return {
    ...generateEventMetadata(),
    type: 'EventCreated',
    aggregateId: eventId,
    payload: {
      id: eventId,
      content: 'Test event content',
      createdAt: new Date().toISOString(),
      collectionId,
    },
  };
}

// ============================================================================
// Note Collection Management Tests
// ============================================================================

describe('AddNoteToCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let handler: AddNoteToCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new AddNoteToCollectionHandler(eventStore, entryProjection);
  });

  it('should add a note to a collection by emitting NoteAddedToCollection event', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    const events = await eventStore.getAll();
    const collectionEvent = events.find((e: DomainEvent) => e.type === 'NoteAddedToCollection');
    expect(collectionEvent).toBeDefined();
    expect(collectionEvent).toMatchObject({
      type: 'NoteAddedToCollection',
      aggregateId: noteId,
      payload: { noteId, collectionId: 'col-a' },
    });
  });

  it('should update note collections projection after adding', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toContain('col-a');
  });

  it('should be idempotent — no event emitted if note already in collection', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if note not found', async () => {
    await expect(
      handler.handle({ noteId: 'nonexistent', collectionId: 'col-a' })
    ).rejects.toThrow('Note nonexistent not found');
  });

  it('should throw if collectionId is empty', async () => {
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));
    await expect(
      handler.handle({ noteId, collectionId: '' })
    ).rejects.toThrow('Collection ID cannot be empty');
  });

  it('should preserve existing collections when adding a new one', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({ noteId, collectionId: 'col-b' });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toContain('col-a');
    expect(note?.collections).toContain('col-b');
  });
});

describe('RemoveNoteFromCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let handler: RemoveNoteFromCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new RemoveNoteFromCollectionHandler(eventStore, entryProjection);
  });

  it('should remove a note from a collection by emitting NoteRemovedFromCollection event', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    const events = await eventStore.getAll();
    const removeEvent = events.find((e: DomainEvent) => e.type === 'NoteRemovedFromCollection');
    expect(removeEvent).toBeDefined();
    expect(removeEvent).toMatchObject({
      type: 'NoteRemovedFromCollection',
      aggregateId: noteId,
      payload: { noteId, collectionId: 'col-a' },
    });
  });

  it('should update note collections projection after removing', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).not.toContain('col-a');
  });

  it('should add removedAt to collectionHistory after removing', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    const historyEntry = note?.collectionHistory?.find(h => h.collectionId === 'col-a');
    expect(historyEntry?.removedAt).toBeDefined();
  });

  it('should be idempotent — no event emitted if note not in collection', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({ noteId, collectionId: 'col-a' });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if note not found', async () => {
    await expect(
      handler.handle({ noteId: 'nonexistent', collectionId: 'col-a' })
    ).rejects.toThrow('Note nonexistent not found');
  });
});

describe('MoveNoteToCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let addHandler: AddNoteToCollectionHandler;
  let handler: MoveNoteToCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    addHandler = new AddNoteToCollectionHandler(eventStore, entryProjection);
    const removeHandler = new RemoveNoteFromCollectionHandler(eventStore, entryProjection);
    handler = new MoveNoteToCollectionHandler(addHandler, removeHandler, entryProjection);
  });

  it('should move a note from current collection to target collection', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({
      noteId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toContain('col-b');
    expect(note?.collections).not.toContain('col-a');
  });

  it('should emit both NoteRemovedFromCollection and NoteAddedToCollection events', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({
      noteId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const events = await eventStore.getAll();
    expect(events.some((e: DomainEvent) => e.type === 'NoteRemovedFromCollection')).toBe(true);
    expect(events.some((e: DomainEvent) => e.type === 'NoteAddedToCollection')).toBe(true);
  });

  it('should be idempotent — no-op when moving to same collection', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({
      noteId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-a',
    });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if note not in current collection', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act/Assert
    await expect(
      handler.handle({
        noteId,
        currentCollectionId: 'col-b', // Not in this collection
        targetCollectionId: 'col-c',
      })
    ).rejects.toThrow(`Note ${noteId} is not in collection col-b`);
  });

  it('should preserve membership in other collections when moving (multi-collection)', async () => {
    // Arrange: note is in col-a and col-b
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));
    await addHandler.handle({ noteId, collectionId: 'col-b' });

    // Act: move from col-a to col-c
    await handler.handle({
      noteId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-c',
    });

    // Assert: note is now in col-b and col-c (col-a removed, col-c added)
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toContain('col-b');
    expect(note?.collections).toContain('col-c');
    expect(note?.collections).not.toContain('col-a');
  });

  it('should set migratedFromCollectionId as ghost link after move', async () => {
    // Arrange
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    // Act
    await handler.handle({
      noteId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const note = await entryProjection.getNoteById(noteId);
    expect(note?.migratedFromCollectionId).toBe('col-a');
  });
});

// ============================================================================
// Event Collection Management Tests
// ============================================================================

describe('AddEventToCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let handler: AddEventToCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new AddEventToCollectionHandler(eventStore, entryProjection);
  });

  it('should add an event to a collection by emitting EventAddedToCollection event', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    const events = await eventStore.getAll();
    const collectionEvent = events.find((e: DomainEvent) => e.type === 'EventAddedToCollection');
    expect(collectionEvent).toBeDefined();
    expect(collectionEvent).toMatchObject({
      type: 'EventAddedToCollection',
      aggregateId: eventId,
      payload: { eventId, collectionId: 'col-a' },
    });
  });

  it('should update event collections projection after adding', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).toContain('col-a');
  });

  it('should be idempotent — no event emitted if event already in collection', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if event not found', async () => {
    await expect(
      handler.handle({ eventId: 'nonexistent', collectionId: 'col-a' })
    ).rejects.toThrow('Event nonexistent not found');
  });

  it('should throw if collectionId is empty', async () => {
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));
    await expect(
      handler.handle({ eventId, collectionId: '' })
    ).rejects.toThrow('Collection ID cannot be empty');
  });
});

describe('RemoveEventFromCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let handler: RemoveEventFromCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    handler = new RemoveEventFromCollectionHandler(eventStore, entryProjection);
  });

  it('should remove an event from a collection by emitting EventRemovedFromCollection event', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    const events = await eventStore.getAll();
    const removeEvent = events.find((e: DomainEvent) => e.type === 'EventRemovedFromCollection');
    expect(removeEvent).toBeDefined();
    expect(removeEvent).toMatchObject({
      type: 'EventRemovedFromCollection',
      aggregateId: eventId,
      payload: { eventId, collectionId: 'col-a' },
    });
  });

  it('should update event collections projection after removing', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).not.toContain('col-a');
  });

  it('should add removedAt to collectionHistory after removing', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    const evt = await entryProjection.getEventById(eventId);
    const historyEntry = evt?.collectionHistory?.find(h => h.collectionId === 'col-a');
    expect(historyEntry?.removedAt).toBeDefined();
  });

  it('should be idempotent — no event emitted if event not in collection', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({ eventId, collectionId: 'col-a' });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if event not found', async () => {
    await expect(
      handler.handle({ eventId: 'nonexistent', collectionId: 'col-a' })
    ).rejects.toThrow('Event nonexistent not found');
  });
});

describe('MoveEventToCollectionHandler', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;
  let addHandler: AddEventToCollectionHandler;
  let handler: MoveEventToCollectionHandler;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
    addHandler = new AddEventToCollectionHandler(eventStore, entryProjection);
    const removeHandler = new RemoveEventFromCollectionHandler(eventStore, entryProjection);
    handler = new MoveEventToCollectionHandler(addHandler, removeHandler, entryProjection);
  });

  it('should move an event from current collection to target collection', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({
      eventId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).toContain('col-b');
    expect(evt?.collections).not.toContain('col-a');
  });

  it('should emit both EventRemovedFromCollection and EventAddedToCollection events', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({
      eventId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const events = await eventStore.getAll();
    expect(events.some((e: DomainEvent) => e.type === 'EventRemovedFromCollection')).toBe(true);
    expect(events.some((e: DomainEvent) => e.type === 'EventAddedToCollection')).toBe(true);
  });

  it('should be idempotent — no-op when moving to same collection', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    const beforeCount = (await eventStore.getAll()).length;

    // Act
    await handler.handle({
      eventId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-a',
    });

    // Assert
    expect((await eventStore.getAll()).length).toBe(beforeCount);
  });

  it('should throw if event not in current collection', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act/Assert
    await expect(
      handler.handle({
        eventId,
        currentCollectionId: 'col-b', // Not in this collection
        targetCollectionId: 'col-c',
      })
    ).rejects.toThrow(`Event ${eventId} is not in collection col-b`);
  });

  it('should preserve membership in other collections when moving (multi-collection)', async () => {
    // Arrange: event is in col-a and col-b
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));
    await addHandler.handle({ eventId, collectionId: 'col-b' });

    // Act: move from col-a to col-c
    await handler.handle({
      eventId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-c',
    });

    // Assert: event is now in col-b and col-c (col-a removed, col-c added)
    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).toContain('col-b');
    expect(evt?.collections).toContain('col-c');
    expect(evt?.collections).not.toContain('col-a');
  });

  it('should set migratedFromCollectionId as ghost link after move', async () => {
    // Arrange
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    // Act
    await handler.handle({
      eventId,
      currentCollectionId: 'col-a',
      targetCollectionId: 'col-b',
    });

    // Assert
    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.migratedFromCollectionId).toBe('col-a');
  });
});

// ============================================================================
// Cross-cutting: NoteCreated/EventCreated initialize collections
// ============================================================================

describe('NoteCreated initializes collections array', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
  });

  it('should initialize collections with collectionId if provided', async () => {
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toEqual(['col-a']);
  });

  it('should initialize collections as empty array if no collectionId', async () => {
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));

    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collections).toEqual([]);
  });

  it('should initialize collectionHistory with collectionId if provided', async () => {
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId, 'col-a'));

    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collectionHistory).toHaveLength(1);
    expect(note?.collectionHistory?.[0]?.collectionId).toBe('col-a');
    expect(note?.collectionHistory?.[0]?.addedAt).toBeDefined();
  });

  it('should initialize collectionHistory as empty array if no collectionId', async () => {
    const noteId = 'note-1';
    await eventStore.append(makeNoteCreatedEvent(noteId));

    const note = await entryProjection.getNoteById(noteId);
    expect(note?.collectionHistory).toEqual([]);
  });
});

describe('EventCreated initializes collections array', () => {
  let eventStore: InMemoryEventStore;
  let entryProjection: EntryListProjection;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    entryProjection = new EntryListProjection(eventStore);
  });

  it('should initialize collections with collectionId if provided', async () => {
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).toEqual(['col-a']);
  });

  it('should initialize collections as empty array if no collectionId', async () => {
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));

    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collections).toEqual([]);
  });

  it('should initialize collectionHistory with collectionId if provided', async () => {
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId, 'col-a'));

    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collectionHistory).toHaveLength(1);
    expect(evt?.collectionHistory?.[0]?.collectionId).toBe('col-a');
  });

  it('should initialize collectionHistory as empty array if no collectionId', async () => {
    const eventId = 'event-1';
    await eventStore.append(makeEventCreatedEvent(eventId));

    const evt = await entryProjection.getEventById(eventId);
    expect(evt?.collectionHistory).toEqual([]);
  });
});
