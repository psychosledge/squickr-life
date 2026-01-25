import { describe, it, expect, beforeEach } from 'vitest';
import { CreateEventHandler, UpdateEventContentHandler, UpdateEventDateHandler, DeleteEventHandler } from './event.handlers';
import { EventStore } from './event-store';
import { EntryListProjection } from './entry.projections';
import type { CreateEventCommand, EventCreated, UpdateEventContentCommand, EventContentChanged, UpdateEventDateCommand, EventDateChanged, DeleteEventCommand, EventDeleted } from './task.types';

describe('CreateEventHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let handler: CreateEventHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    handler = new CreateEventHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create an EventCreated event for valid command', async () => {
      const command: CreateEventCommand = {
        content: 'Team meeting on project launch',
      };

      const eventId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);

      const event = events[0] as EventCreated;
      expect(event.type).toBe('EventCreated');
      expect(event.payload.content).toBe('Team meeting on project launch');
      expect(event.payload.id).toBe(eventId);
      expect(event.aggregateId).toBe(eventId);
      expect(event.payload.eventDate).toBeUndefined();
    });

    it('should generate unique UUID for event ID', async () => {
      const command: CreateEventCommand = {
        content: 'Test event',
      };

      const eventId1 = await handler.handle(command);
      const eventId2 = await handler.handle(command);

      expect(eventId1).not.toBe(eventId2);
      expect(eventId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should trim whitespace from content', async () => {
      const command: CreateEventCommand = {
        content: '  Conference attendance  ',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as EventCreated;
      expect(event.payload.content).toBe('Conference attendance');
    });

    it('should reject empty content', async () => {
      const command: CreateEventCommand = {
        content: '',
      };

      await expect(handler.handle(command)).rejects.toThrow('Content cannot be empty');
    });

    it('should reject content with only whitespace', async () => {
      const command: CreateEventCommand = {
        content: '   ',
      };

      await expect(handler.handle(command)).rejects.toThrow('Content cannot be empty');
    });

    it('should reject content longer than 5000 characters', async () => {
      const command: CreateEventCommand = {
        content: 'a'.repeat(5001),
      };

      await expect(handler.handle(command)).rejects.toThrow('Content must be between 1 and 5000 characters');
    });

    it('should accept content with exactly 5000 characters', async () => {
      const command: CreateEventCommand = {
        content: 'a'.repeat(5000),
      };

      await expect(handler.handle(command)).resolves.toBeTruthy();
    });

    it('should include eventDate when provided', async () => {
      const eventDate = '2026-02-15T10:00:00.000Z';
      const command: CreateEventCommand = {
        content: 'Product launch event',
        eventDate,
      };

      const eventId = await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as EventCreated;
      expect(event.payload.eventDate).toBe(eventDate);
    });

    it('should reject invalid eventDate format', async () => {
      const command: CreateEventCommand = {
        content: 'Invalid date event',
        eventDate: 'not-a-date',
      };

      await expect(handler.handle(command)).rejects.toThrow('Event date must be a valid ISO 8601 date');
    });

    it('should set event metadata correctly', async () => {
      const command: CreateEventCommand = {
        content: 'Metadata test event',
      };

      const eventId = await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as EventCreated;

      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
      expect(event.version).toBe(1);
      expect(event.aggregateId).toBe(eventId);
    });

    it('should generate fractional index order', async () => {
      const command: CreateEventCommand = {
        content: 'First event',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as EventCreated;

      expect(event.payload.order).toBe('a0');
    });

    it('should generate sequential fractional orders for multiple events', async () => {
      const command1: CreateEventCommand = { content: 'Event 1' };
      const command2: CreateEventCommand = { content: 'Event 2' };
      const command3: CreateEventCommand = { content: 'Event 3' };

      await handler.handle(command1);
      await handler.handle(command2);
      await handler.handle(command3);

      const events = await eventStore.getAll();
      
      const event1 = events[0] as EventCreated;
      const event2 = events[1] as EventCreated;
      const event3 = events[2] as EventCreated;

      expect(event1.payload.order).toBe('a0');
      expect(event2.payload.order).toBe('a1');
      expect(event3.payload.order).toBe('a2');
    });

    it('should include userId when provided', async () => {
      const command: CreateEventCommand = {
        content: 'User event',
        userId: 'user-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as EventCreated;
      expect(event.payload.userId).toBe('user-123');
    });
  });
});

describe('UpdateEventContentHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let createHandler: CreateEventHandler;
  let updateHandler: UpdateEventContentHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    createHandler = new CreateEventHandler(eventStore, projection);
    updateHandler = new UpdateEventContentHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create EventContentChanged event for valid update', async () => {
      // Create an event first
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      // Update the content
      const command: UpdateEventContentCommand = {
        eventId,
        content: 'Updated content',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const updateEvent = events[1] as EventContentChanged;
      expect(updateEvent.type).toBe('EventContentChanged');
      expect(updateEvent.payload.eventId).toBe(eventId);
      expect(updateEvent.payload.newContent).toBe('Updated content');
      expect(updateEvent.aggregateId).toBe(eventId);
    });

    it('should trim whitespace from new content', async () => {
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateEventContentCommand = {
        eventId,
        content: '  Trimmed content  ',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      const updateEvent = events[1] as EventContentChanged;
      expect(updateEvent.payload.newContent).toBe('Trimmed content');
    });

    it('should reject empty content', async () => {
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateEventContentCommand = {
        eventId,
        content: '',
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Content cannot be empty');
    });

    it('should reject content longer than 5000 characters', async () => {
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateEventContentCommand = {
        eventId,
        content: 'a'.repeat(5001),
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Content must be between 1 and 5000 characters');
    });

    it('should accept content with exactly 5000 characters', async () => {
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateEventContentCommand = {
        eventId,
        content: 'a'.repeat(5000),
      };

      await expect(updateHandler.handle(command)).resolves.toBeUndefined();
    });

    it('should reject update for non-existent event', async () => {
      const command: UpdateEventContentCommand = {
        eventId: 'non-existent-event',
        content: 'New content',
      };

      await expect(updateHandler.handle(command)).rejects.toThrow('Event non-existent-event not found');
    });

    it('should set event metadata correctly', async () => {
      const eventId = await createHandler.handle({
        content: 'Original content',
      });

      const command: UpdateEventContentCommand = {
        eventId,
        content: 'Updated content',
      };

      await updateHandler.handle(command);

      const events = await eventStore.getAll();
      const updateEvent = events[1] as EventContentChanged;

      expect(updateEvent.id).toBeTruthy();
      expect(updateEvent.timestamp).toBeTruthy();
      expect(updateEvent.version).toBe(1);
      expect(updateEvent.payload.changedAt).toBeTruthy();
    });
  });
});

describe('UpdateEventDateHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let createHandler: CreateEventHandler;
  let updateDateHandler: UpdateEventDateHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    createHandler = new CreateEventHandler(eventStore, projection);
    updateDateHandler = new UpdateEventDateHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create EventDateChanged event for valid update', async () => {
      // Create an event first
      const eventId = await createHandler.handle({
        content: 'Event with date',
      });

      // Update the date
      const newDate = '2026-03-20T14:00:00.000Z';
      const command: UpdateEventDateCommand = {
        eventId,
        eventDate: newDate,
      };

      await updateDateHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const updateEvent = events[1] as EventDateChanged;
      expect(updateEvent.type).toBe('EventDateChanged');
      expect(updateEvent.payload.eventId).toBe(eventId);
      expect(updateEvent.payload.newEventDate).toBe(newDate);
      expect(updateEvent.aggregateId).toBe(eventId);
    });

    it('should accept null to clear the event date', async () => {
      const eventId = await createHandler.handle({
        content: 'Event with date',
        eventDate: '2026-03-20T14:00:00.000Z',
      });

      const command: UpdateEventDateCommand = {
        eventId,
        eventDate: null,
      };

      await updateDateHandler.handle(command);

      const events = await eventStore.getAll();
      const updateEvent = events[1] as EventDateChanged;
      expect(updateEvent.payload.newEventDate).toBeNull();
    });

    it('should reject invalid date format', async () => {
      const eventId = await createHandler.handle({
        content: 'Event with date',
      });

      const command: UpdateEventDateCommand = {
        eventId,
        eventDate: 'invalid-date',
      };

      await expect(updateDateHandler.handle(command)).rejects.toThrow('Event date must be a valid ISO 8601 date');
    });

    it('should reject update for non-existent event', async () => {
      const command: UpdateEventDateCommand = {
        eventId: 'non-existent-event',
        eventDate: '2026-03-20T14:00:00.000Z',
      };

      await expect(updateDateHandler.handle(command)).rejects.toThrow('Event non-existent-event not found');
    });

    it('should set event metadata correctly', async () => {
      const eventId = await createHandler.handle({
        content: 'Event with date',
      });

      const command: UpdateEventDateCommand = {
        eventId,
        eventDate: '2026-03-20T14:00:00.000Z',
      };

      await updateDateHandler.handle(command);

      const events = await eventStore.getAll();
      const updateEvent = events[1] as EventDateChanged;

      expect(updateEvent.id).toBeTruthy();
      expect(updateEvent.timestamp).toBeTruthy();
      expect(updateEvent.version).toBe(1);
      expect(updateEvent.payload.changedAt).toBeTruthy();
    });
  });
});

describe('DeleteEventHandler', () => {
  let eventStore: EventStore;
  let projection: EntryListProjection;
  let createHandler: CreateEventHandler;
  let deleteHandler: DeleteEventHandler;

  beforeEach(() => {
    eventStore = new EventStore();
    projection = new EntryListProjection(eventStore);
    createHandler = new CreateEventHandler(eventStore, projection);
    deleteHandler = new DeleteEventHandler(eventStore, projection);
  });

  describe('handle', () => {
    it('should create EventDeleted event for valid deletion', async () => {
      // Create an event first
      const eventId = await createHandler.handle({
        content: 'Event to delete',
      });

      // Delete the event
      const command: DeleteEventCommand = {
        eventId,
      };

      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const deleteEvent = events[1] as EventDeleted;
      expect(deleteEvent.type).toBe('EventDeleted');
      expect(deleteEvent.payload.eventId).toBe(eventId);
      expect(deleteEvent.aggregateId).toBe(eventId);
    });

    it('should reject deletion of non-existent event', async () => {
      const command: DeleteEventCommand = {
        eventId: 'non-existent-event',
      };

      await expect(deleteHandler.handle(command)).rejects.toThrow('Event non-existent-event not found');
    });

    it('should set event metadata correctly', async () => {
      const eventId = await createHandler.handle({
        content: 'Event to delete',
      });

      const command: DeleteEventCommand = {
        eventId,
      };

      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      const deleteEvent = events[1] as EventDeleted;

      expect(deleteEvent.id).toBeTruthy();
      expect(deleteEvent.timestamp).toBeTruthy();
      expect(deleteEvent.version).toBe(1);
      expect(deleteEvent.payload.deletedAt).toBeTruthy();
    });
  });
});
