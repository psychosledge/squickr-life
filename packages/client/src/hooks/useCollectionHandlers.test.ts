/**
 * Tests for useCollectionHandlers hook
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCollectionHandlers } from './useCollectionHandlers';
import { EventStore, CollectionListProjection, EntryListProjection, TaskListProjection } from '@squickr/shared';

describe('useCollectionHandlers', () => {
  let eventStore: EventStore;
  let collectionProjection: CollectionListProjection;
  let entryProjection: EntryListProjection;
  let taskProjection: TaskListProjection;

  beforeEach(() => {
    eventStore = new EventStore();
    collectionProjection = new CollectionListProjection(eventStore);
    entryProjection = new EntryListProjection(eventStore);
    taskProjection = new TaskListProjection(eventStore);
  });

  it('should initialize all handlers', () => {
    const { result } = renderHook(() =>
      useCollectionHandlers({
        eventStore,
        collectionProjection,
        entryProjection,
        taskProjection,
      })
    );

    expect(result.current).toHaveProperty('createTaskHandler');
    expect(result.current).toHaveProperty('createNoteHandler');
    expect(result.current).toHaveProperty('createEventHandler');
    expect(result.current).toHaveProperty('completeTaskHandler');
    expect(result.current).toHaveProperty('reopenTaskHandler');
    expect(result.current).toHaveProperty('updateTaskTitleHandler');
    expect(result.current).toHaveProperty('updateNoteContentHandler');
    expect(result.current).toHaveProperty('updateEventContentHandler');
    expect(result.current).toHaveProperty('updateEventDateHandler');
    expect(result.current).toHaveProperty('deleteTaskHandler');
    expect(result.current).toHaveProperty('deleteNoteHandler');
    expect(result.current).toHaveProperty('deleteEventHandler');
    expect(result.current).toHaveProperty('reorderTaskHandler');
    expect(result.current).toHaveProperty('reorderNoteHandler');
    expect(result.current).toHaveProperty('reorderEventHandler');
    expect(result.current).toHaveProperty('renameCollectionHandler');
    expect(result.current).toHaveProperty('deleteCollectionHandler');
    expect(result.current).toHaveProperty('updateSettingsHandler');
    expect(result.current).toHaveProperty('favoriteCollectionHandler');
    expect(result.current).toHaveProperty('unfavoriteCollectionHandler');
  });

  it('should return the same handler instances on re-render', () => {
    const { result, rerender } = renderHook(() =>
      useCollectionHandlers({
        eventStore,
        collectionProjection,
        entryProjection,
        taskProjection,
      })
    );

    const firstRender = result.current;
    rerender();
    const secondRender = result.current;

    // All handlers should be memoized and return same instance
    expect(firstRender.createTaskHandler).toBe(secondRender.createTaskHandler);
    expect(firstRender.createNoteHandler).toBe(secondRender.createNoteHandler);
    expect(firstRender.createEventHandler).toBe(secondRender.createEventHandler);
    expect(firstRender.completeTaskHandler).toBe(secondRender.completeTaskHandler);
    expect(firstRender.reopenTaskHandler).toBe(secondRender.reopenTaskHandler);
    expect(firstRender.updateTaskTitleHandler).toBe(secondRender.updateTaskTitleHandler);
    expect(firstRender.updateNoteContentHandler).toBe(secondRender.updateNoteContentHandler);
    expect(firstRender.updateEventContentHandler).toBe(secondRender.updateEventContentHandler);
    expect(firstRender.updateEventDateHandler).toBe(secondRender.updateEventDateHandler);
    expect(firstRender.deleteTaskHandler).toBe(secondRender.deleteTaskHandler);
    expect(firstRender.deleteNoteHandler).toBe(secondRender.deleteNoteHandler);
    expect(firstRender.deleteEventHandler).toBe(secondRender.deleteEventHandler);
    expect(firstRender.reorderTaskHandler).toBe(secondRender.reorderTaskHandler);
    expect(firstRender.reorderNoteHandler).toBe(secondRender.reorderNoteHandler);
    expect(firstRender.reorderEventHandler).toBe(secondRender.reorderEventHandler);
    expect(firstRender.renameCollectionHandler).toBe(secondRender.renameCollectionHandler);
    expect(firstRender.deleteCollectionHandler).toBe(secondRender.deleteCollectionHandler);
    expect(firstRender.updateSettingsHandler).toBe(secondRender.updateSettingsHandler);
    expect(firstRender.favoriteCollectionHandler).toBe(secondRender.favoriteCollectionHandler);
    expect(firstRender.unfavoriteCollectionHandler).toBe(secondRender.unfavoriteCollectionHandler);
  });

  it('should create new handlers when dependencies change', () => {
    const { result, rerender } = renderHook(
      (props) =>
        useCollectionHandlers({
          eventStore: props.eventStore,
          collectionProjection: props.collectionProjection,
          entryProjection: props.entryProjection,
          taskProjection: props.taskProjection,
        }),
      {
        initialProps: {
          eventStore,
          collectionProjection,
          entryProjection,
          taskProjection,
        },
      }
    );

    const firstRender = result.current;

    // Change dependencies
    const newEventStore = new EventStore();
    const newCollectionProjection = new CollectionListProjection(newEventStore);
    const newEntryProjection = new EntryListProjection(newEventStore);
    const newTaskProjection = new TaskListProjection(newEventStore);

    rerender({
      eventStore: newEventStore,
      collectionProjection: newCollectionProjection,
      entryProjection: newEntryProjection,
      taskProjection: newTaskProjection,
    });

    const secondRender = result.current;

    // Handlers should be different instances when dependencies change
    expect(firstRender.createTaskHandler).not.toBe(secondRender.createTaskHandler);
    expect(firstRender.renameCollectionHandler).not.toBe(secondRender.renameCollectionHandler);
  });
});
