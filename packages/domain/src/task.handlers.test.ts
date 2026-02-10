import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTaskHandler, CompleteTaskHandler, ReopenTaskHandler, DeleteTaskHandler, ReorderTaskHandler, UpdateTaskTitleHandler } from './task.handlers';
import type { IEventStore } from './event-store';
import { InMemoryEventStore } from './__tests__/in-memory-event-store';
import { TaskListProjection } from './task.projections';
import { EntryListProjection } from './entry.projections';
import type { CreateTaskCommand, TaskCreated, TaskCompleted, TaskReopened, TaskDeleted, CompleteTaskCommand, ReopenTaskCommand, DeleteTaskCommand, ReorderTaskCommand, TaskReordered, UpdateTaskTitleCommand, TaskTitleChanged } from './task.types';

describe('CreateTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    handler = new CreateTaskHandler(eventStore, projection, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskCreated event for valid command', async () => {
      const command: CreateTaskCommand = {
        title: 'Buy milk',
      };

      const taskId = await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);

      const event = events[0] as TaskCreated;
      expect(event.type).toBe('TaskCreated');
      expect(event.payload.title).toBe('Buy milk');
      expect(event.payload.status).toBe('open');
      expect(event.payload.id).toBe(taskId);
      expect(event.aggregateId).toBe(taskId);
    });

    it('should generate unique UUID for task ID', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      const taskId1 = await handler.handle(command);
      const taskId2 = await handler.handle(command);

      expect(taskId1).not.toBe(taskId2);
      expect(taskId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should trim whitespace from title', async () => {
      const command: CreateTaskCommand = {
        title: '  Buy milk  ',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.title).toBe('Buy milk');
    });

    it('should include userId if provided', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
        userId: 'user-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.userId).toBe('user-123');
    });

    it('should set createdAt timestamp', async () => {
      const beforeTime = new Date().toISOString();
      
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      await handler.handle(command);

      const afterTime = new Date().toISOString();
      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;

      expect(event.payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.payload.createdAt >= beforeTime).toBe(true);
      expect(event.payload.createdAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const command: CreateTaskCommand = {
        title: 'Test task',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;

      expect(event.id).toMatch(/^[0-9a-f-]+$/i); // UUID format
      expect(event.version).toBe(1);
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if title is empty after trim', async () => {
      const command: CreateTaskCommand = {
        title: '   ',
      };

      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should throw error if title is too long', async () => {
      const command: CreateTaskCommand = {
        title: 'a'.repeat(501),
      };

      await expect(handler.handle(command)).rejects.toThrow('Title must be between 1 and 500 characters');
    });

    it('should throw error if title is missing', async () => {
      const command: CreateTaskCommand = {
        title: '',
      };

      await expect(handler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should accept title exactly 500 characters', async () => {
      const command: CreateTaskCommand = {
        title: 'a'.repeat(500),
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      const event = events[0] as TaskCreated;
      expect(event.payload.title).toHaveLength(500);
    });

    it('should include collectionId if provided', async () => {
      const command: CreateTaskCommand = {
        title: 'Task in collection',
        collectionId: 'collection-123',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.collectionId).toBe('collection-123');
    });

    it('should create task without collectionId (uncategorized)', async () => {
      const command: CreateTaskCommand = {
        title: 'Uncategorized task',
      };

      await handler.handle(command);

      const events = await eventStore.getAll();
      const event = events[0] as TaskCreated;
      expect(event.payload.collectionId).toBeUndefined();
    });
  });
});

describe('CompleteTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createHandler: CreateTaskHandler;
  let completeHandler: CompleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore, projection, entryProjection);
    completeHandler = new CompleteTaskHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskCompleted event for valid command', async () => {
      // Create a task first
      const taskId = await createHandler.handle({ title: 'Buy milk' });

      // Complete the task
      const command: CompleteTaskCommand = { taskId };
      await completeHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const completedEvent = events[1] as TaskCompleted;
      expect(completedEvent.type).toBe('TaskCompleted');
      expect(completedEvent.payload.taskId).toBe(taskId);
      expect(completedEvent.aggregateId).toBe(taskId);
      expect(completedEvent.payload.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set completedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      const beforeTime = new Date().toISOString();
      await completeHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const completedEvent = events[1] as TaskCompleted;

      expect(completedEvent.payload.completedAt >= beforeTime).toBe(true);
      expect(completedEvent.payload.completedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const completedEvent = events[1] as TaskCompleted;

      expect(completedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(completedEvent.version).toBe(1);
      expect(completedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: CompleteTaskCommand = { taskId: 'non-existent-id' };

      await expect(completeHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should throw error if task is already completed', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });

      await expect(completeHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' is not open');
    });
  });
});

describe('ReopenTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createHandler: CreateTaskHandler;
  let completeHandler: CompleteTaskHandler;
  let reopenHandler: ReopenTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore, projection, entryProjection);
    completeHandler = new CompleteTaskHandler(eventStore, entryProjection);
    reopenHandler = new ReopenTaskHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskReopened event for valid command', async () => {
      // Create and complete a task
      const taskId = await createHandler.handle({ title: 'Buy milk' });
      await completeHandler.handle({ taskId });

      // Reopen the task
      const command: ReopenTaskCommand = { taskId };
      await reopenHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3);

      const reopenedEvent = events[2] as TaskReopened;
      expect(reopenedEvent.type).toBe('TaskReopened');
      expect(reopenedEvent.payload.taskId).toBe(taskId);
      expect(reopenedEvent.aggregateId).toBe(taskId);
      expect(reopenedEvent.payload.reopenedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set reopenedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });
      
      const beforeTime = new Date().toISOString();
      await reopenHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const reopenedEvent = events[2] as TaskReopened;

      expect(reopenedEvent.payload.reopenedAt >= beforeTime).toBe(true);
      expect(reopenedEvent.payload.reopenedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const reopenedEvent = events[2] as TaskReopened;

      expect(reopenedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(reopenedEvent.version).toBe(1);
      expect(reopenedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: ReopenTaskCommand = { taskId: 'non-existent-id' };

      await expect(reopenHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should throw error if task is not completed', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });

      await expect(reopenHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' is not completed');
    });

    it('should allow reopening and completing multiple times', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      // Complete -> Reopen -> Complete -> Reopen
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });
      await completeHandler.handle({ taskId });
      await reopenHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(5); // Created, Completed, Reopened, Completed, Reopened
    });
  });
});

describe('DeleteTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createHandler: CreateTaskHandler;
  let deleteHandler: DeleteTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore, projection, entryProjection);
    deleteHandler = new DeleteTaskHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskDeleted event for valid command', async () => {
      // Create a task first
      const taskId = await createHandler.handle({ title: 'Buy milk' });

      // Delete the task
      const command: DeleteTaskCommand = { taskId };
      await deleteHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);

      const deletedEvent = events[1] as TaskDeleted;
      expect(deletedEvent.type).toBe('TaskDeleted');
      expect(deletedEvent.payload.taskId).toBe(taskId);
      expect(deletedEvent.aggregateId).toBe(taskId);
      expect(deletedEvent.payload.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should set deletedAt timestamp', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      
      const beforeTime = new Date().toISOString();
      await deleteHandler.handle({ taskId });
      const afterTime = new Date().toISOString();

      const events = await eventStore.getAll();
      const deletedEvent = events[1] as TaskDeleted;

      expect(deletedEvent.payload.deletedAt >= beforeTime).toBe(true);
      expect(deletedEvent.payload.deletedAt <= afterTime).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      const deletedEvent = events[1] as TaskDeleted;

      expect(deletedEvent.id).toMatch(/^[0-9a-f-]+$/i);
      expect(deletedEvent.version).toBe(1);
      expect(deletedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: DeleteTaskCommand = { taskId: 'non-existent-id' };

      await expect(deleteHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should allow deleting open tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Open task' });

      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe('TaskDeleted');
    });

    it('should allow deleting completed tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Completed task' });
      const completeHandler = new CompleteTaskHandler(eventStore, entryProjection);
      await completeHandler.handle({ taskId });

      await deleteHandler.handle({ taskId });

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3); // Created, Completed, Deleted
      expect(events[2].type).toBe('TaskDeleted');
    });

    it('should not allow deleting already deleted tasks', async () => {
      const taskId = await createHandler.handle({ title: 'Test task' });
      await deleteHandler.handle({ taskId });

      // Try to delete again
      await expect(deleteHandler.handle({ taskId })).rejects.toThrow('Task ' + taskId + ' not found');
    });
  });
});

describe('ReorderTaskHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createHandler: CreateTaskHandler;
  let reorderHandler: ReorderTaskHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore, projection, entryProjection);
    reorderHandler = new ReorderTaskHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskReordered event for valid command', async () => {
      // Create three tasks
      const taskId1 = await createHandler.handle({ title: 'Task 1' });
      const taskId2 = await createHandler.handle({ title: 'Task 2' });
      const taskId3 = await createHandler.handle({ title: 'Task 3' });

      // Reorder task2 between task1 and task3
      const command: ReorderTaskCommand = {
        taskId: taskId2,
        previousTaskId: taskId1,
        nextTaskId: taskId3,
      };

      await reorderHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(4); // 3 created + 1 reordered

      const reorderedEvent = events[3] as TaskReordered;
      expect(reorderedEvent.type).toBe('TaskReordered');
      expect(reorderedEvent.payload.taskId).toBe(taskId2);
      expect(reorderedEvent.aggregateId).toBe(taskId2);
      expect(reorderedEvent.payload.order).toBeDefined();
      expect(reorderedEvent.payload.reorderedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should generate order between two tasks', async () => {
      const taskId1 = await createHandler.handle({ title: 'Task 1' });
      const taskId2 = await createHandler.handle({ title: 'Task 2' });
      const taskId3 = await createHandler.handle({ title: 'Task 3' });

      // Reorder task3 to be between task1 and task2
      await reorderHandler.handle({
        taskId: taskId3,
        previousTaskId: taskId1,
        nextTaskId: taskId2,
      });

      const task1 = await projection.getTaskById(taskId1);
      const task2 = await projection.getTaskById(taskId2);
      const task3 = await projection.getTaskById(taskId3);

      // task3's order should be between task1 and task2
      expect(task3!.order > task1!.order).toBe(true);
      expect(task3!.order < task2!.order).toBe(true);
    });

    it('should move task to start when previousTaskId is null', async () => {
      const taskId1 = await createHandler.handle({ title: 'Task 1' });
      const taskId2 = await createHandler.handle({ title: 'Task 2' });
      const taskId3 = await createHandler.handle({ title: 'Task 3' });

      // Move task3 to the start
      await reorderHandler.handle({
        taskId: taskId3,
        previousTaskId: null,
        nextTaskId: taskId1,
      });

      const task1 = await projection.getTaskById(taskId1);
      const task3 = await projection.getTaskById(taskId3);

      // task3 should now be before task1
      expect(task3!.order < task1!.order).toBe(true);
    });

    it('should move task to end when nextTaskId is null', async () => {
      const taskId1 = await createHandler.handle({ title: 'Task 1' });
      const taskId2 = await createHandler.handle({ title: 'Task 2' });
      const taskId3 = await createHandler.handle({ title: 'Task 3' });

      // Move task1 to the end
      await reorderHandler.handle({
        taskId: taskId1,
        previousTaskId: taskId3,
        nextTaskId: null,
      });

      const task1 = await projection.getTaskById(taskId1);
      const task3 = await projection.getTaskById(taskId3);

      // task1 should now be after task3
      expect(task1!.order > task3!.order).toBe(true);
    });

    it('should set event metadata correctly', async () => {
      const taskId1 = await createHandler.handle({ title: 'Task 1' });
      const taskId2 = await createHandler.handle({ title: 'Task 2' });

      await reorderHandler.handle({
        taskId: taskId2,
        previousTaskId: taskId1,
        nextTaskId: null,
      });

      const events = await eventStore.getAll();
      const reorderedEvent = events[2] as TaskReordered;

      expect(reorderedEvent.id).toMatch(/^[0-9a-f-]+$/i); // UUID format
      expect(reorderedEvent.version).toBe(1);
      expect(reorderedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if task does not exist', async () => {
      const command: ReorderTaskCommand = {
        taskId: 'non-existent-id',
        previousTaskId: null,
        nextTaskId: null,
      };

      await expect(reorderHandler.handle(command)).rejects.toThrow('Task non-existent-id not found');
    });

    it('should throw error if previousTaskId does not exist', async () => {
      const taskId = await createHandler.handle({ title: 'Task 1' });

      const command: ReorderTaskCommand = {
        taskId,
        previousTaskId: 'non-existent-previous',
        nextTaskId: null,
      };

      await expect(reorderHandler.handle(command)).rejects.toThrow('Previous entry non-existent-previous not found');
    });

    it('should throw error if nextTaskId does not exist', async () => {
      const taskId = await createHandler.handle({ title: 'Task 1' });

      const command: ReorderTaskCommand = {
        taskId,
        previousTaskId: null,
        nextTaskId: 'non-existent-next',
      };

      await expect(reorderHandler.handle(command)).rejects.toThrow('Next entry non-existent-next not found');
    });

    // Cross-type reordering tests - ensures tasks can be reordered relative to notes and events
    it('should allow reordering task after a note (cross-type)', async () => {
      const { CreateNoteHandler } = await import('./note.handlers');
      const noteHandler = new CreateNoteHandler(eventStore, entryProjection);
      
      // Create a note and a task
      const noteId = await noteHandler.handle({ content: 'My note' });
      const taskId = await createHandler.handle({ title: 'My task' });
      
      // Get current orders
      const noteBefore = await entryProjection.getEntryById(noteId);
      const taskBefore = await entryProjection.getEntryById(taskId);
      
      // Reorder task to come after note
      await reorderHandler.handle({
        taskId,
        previousTaskId: noteId, // This is a NOTE, not a task!
        nextTaskId: null,
      });
      
      // Verify new order
      const taskAfter = await entryProjection.getEntryById(taskId);
      expect(taskAfter!.order).toBeDefined();
      expect(taskAfter!.order > noteBefore!.order!).toBe(true);
    });

    it('should allow reordering task between note and event (cross-type)', async () => {
      const { CreateNoteHandler } = await import('./note.handlers');
      const { CreateEventHandler } = await import('./event.handlers');
      const noteHandler = new CreateNoteHandler(eventStore, entryProjection);
      const eventHandler = new CreateEventHandler(eventStore, entryProjection);
      
      // Create note, event, task in that order
      const noteId = await noteHandler.handle({ content: 'Note first' });
      const eventId = await eventHandler.handle({ content: 'Event second' });
      const taskId = await createHandler.handle({ title: 'Task third' });
      
      // Reorder task to be between note and event
      await reorderHandler.handle({
        taskId,
        previousTaskId: noteId,  // NOTE
        nextTaskId: eventId,     // EVENT
      });
      
      // Verify order
      const note = await entryProjection.getEntryById(noteId);
      const event = await entryProjection.getEntryById(eventId);
      const task = await entryProjection.getEntryById(taskId);
      
      expect(task!.order).toBeDefined();
      expect(task!.order! > note!.order!).toBe(true);
      expect(task!.order! < event!.order!).toBe(true);
    });

    it('should allow reordering task to the start of a mixed-type list', async () => {
      const { CreateNoteHandler } = await import('./note.handlers');
      const noteHandler = new CreateNoteHandler(eventStore, entryProjection);
      
      // Create note first, then task
      const noteId = await noteHandler.handle({ content: 'Note' });
      const taskId = await createHandler.handle({ title: 'Task' });
      
      // Move task before note
      await reorderHandler.handle({
        taskId,
        previousTaskId: null,
        nextTaskId: noteId, // NOTE is the next entry
      });
      
      const note = await entryProjection.getEntryById(noteId);
      const task = await entryProjection.getEntryById(taskId);
      
      expect(task!.order! < note!.order!).toBe(true);
    });
  });
});

describe('UpdateTaskTitleHandler', () => {
  let eventStore: IEventStore;
  let projection: TaskListProjection;
  let entryProjection: EntryListProjection;
  let createHandler: CreateTaskHandler;
  let updateTitleHandler: UpdateTaskTitleHandler;

  beforeEach(() => {
    eventStore = new InMemoryEventStore();
    projection = new TaskListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    createHandler = new CreateTaskHandler(eventStore, projection, entryProjection);
    updateTitleHandler = new UpdateTaskTitleHandler(eventStore, entryProjection);
  });

  describe('handle', () => {
    it('should create a TaskTitleChanged event for valid command', async () => {
      // Create a task first
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      // Update the title
      const command: UpdateTaskTitleCommand = {
        taskId,
        title: 'New Title',
      };

      await updateTitleHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(2); // TaskCreated + TaskTitleChanged

      const event = events[1] as TaskTitleChanged;
      expect(event.type).toBe('TaskTitleChanged');
      expect(event.payload.taskId).toBe(taskId);
      expect(event.payload.newTitle).toBe('New Title');
      expect(event.aggregateId).toBe(taskId);
    });

    it('should trim whitespace from new title', async () => {
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const command: UpdateTaskTitleCommand = {
        taskId,
        title: '  New Title  ',
      };

      await updateTitleHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as TaskTitleChanged;
      expect(event.payload.newTitle).toBe('New Title');
    });

    it('should reject empty title after trimming', async () => {
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const command: UpdateTaskTitleCommand = {
        taskId,
        title: '   ',
      };

      await expect(updateTitleHandler.handle(command)).rejects.toThrow('Title cannot be empty');
    });

    it('should reject title longer than 500 characters', async () => {
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const command: UpdateTaskTitleCommand = {
        taskId,
        title: 'a'.repeat(501),
      };

      await expect(updateTitleHandler.handle(command)).rejects.toThrow('Title must be between 1 and 500 characters');
    });

    it('should accept title with exactly 500 characters', async () => {
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const longTitle = 'a'.repeat(500);
      const command: UpdateTaskTitleCommand = {
        taskId,
        title: longTitle,
      };

      await updateTitleHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as TaskTitleChanged;
      expect(event.payload.newTitle).toBe(longTitle);
    });

    it('should reject updating non-existent task', async () => {
      const command: UpdateTaskTitleCommand = {
        taskId: 'non-existent-task',
        title: 'New Title',
      };

      await expect(updateTitleHandler.handle(command)).rejects.toThrow('Task non-existent-task not found');
    });

    it('should set event metadata correctly', async () => {
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const command: UpdateTaskTitleCommand = {
        taskId,
        title: 'New Title',
      };

      await updateTitleHandler.handle(command);

      const events = await eventStore.getAll();
      const event = events[1] as TaskTitleChanged;

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(event.payload.changedAt).toBe(event.timestamp);
    });

    it('should allow updating completed task title', async () => {
      // Create and complete a task
      const taskId = await createHandler.handle({
        title: 'Original Title',
      });

      const completeHandler = new CompleteTaskHandler(eventStore, entryProjection);
      await completeHandler.handle({ taskId });

      // Update title of completed task
      const command: UpdateTaskTitleCommand = {
        taskId,
        title: 'Updated Title',
      };

      await updateTitleHandler.handle(command);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(3); // TaskCreated + TaskCompleted + TaskTitleChanged

      const event = events[2] as TaskTitleChanged;
      expect(event.type).toBe('TaskTitleChanged');
      expect(event.payload.newTitle).toBe('Updated Title');
    });
  });
});
