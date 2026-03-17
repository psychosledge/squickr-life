/**
 * Tests for useEntryOperations hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEntryOperations } from './useEntryOperations';
import type { CollectionHandlers } from './useCollectionHandlers';
import type { Entry, Collection } from '@squickr/domain';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('useEntryOperations', () => {
  let mockHandlers: CollectionHandlers;
  let mockEntries: Entry[];
  let mockCollection: Collection;
  let mockMigrateTaskHandler: any;
  let mockCreateCollectionHandler: any;
  let mockConfig: any;
  let mockAddNoteToCollectionHandler: any;
  let mockMoveNoteToCollectionHandler: any;
  let mockAddEventToCollectionHandler: any;
  let mockMoveEventToCollectionHandler: any;

  beforeEach(() => {
    // Create mock handlers
    mockHandlers = {
      createTaskHandler: { handle: vi.fn() } as any,
      createSubTaskHandler: { handle: vi.fn() } as any,
      createNoteHandler: { handle: vi.fn() } as any,
      createEventHandler: { handle: vi.fn() } as any,
      completeTaskHandler: { handle: vi.fn() } as any,
      completeParentTaskHandler: { handle: vi.fn() } as any,
      reopenTaskHandler: { handle: vi.fn() } as any,
      updateTaskTitleHandler: { handle: vi.fn() } as any,
      updateNoteContentHandler: { handle: vi.fn() } as any,
      updateEventContentHandler: { handle: vi.fn() } as any,
      updateEventDateHandler: { handle: vi.fn() } as any,
      deleteTaskHandler: { handle: vi.fn() } as any,
      deleteParentTaskHandler: { handle: vi.fn() } as any,
      deleteNoteHandler: { handle: vi.fn() } as any,
      deleteEventHandler: { handle: vi.fn() } as any,
      reorderTaskHandler: { handle: vi.fn() } as any,
      reorderNoteHandler: { handle: vi.fn() } as any,
      reorderEventHandler: { handle: vi.fn() } as any,
      renameCollectionHandler: { handle: vi.fn() } as any,
      deleteCollectionHandler: { handle: vi.fn() } as any,
      updateSettingsHandler: { handle: vi.fn() } as any,
      favoriteCollectionHandler: { handle: vi.fn() } as any,
      unfavoriteCollectionHandler: { handle: vi.fn() } as any,
    };

    mockCollection = {
      id: 'collection-1',
      name: 'Test Collection',
      type: 'custom',
      order: 'a0',
      createdAt: new Date().toISOString(),
    };

    mockEntries = [
      {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'active',
        order: 'a0',
        createdAt: new Date().toISOString(),
        collections: [],
      },
      {
        id: 'note-1',
        type: 'note',
        content: 'Test Note',
        order: 'a1',
        createdAt: new Date().toISOString(),
        collections: [],
      },
    ] as Entry[];

    mockMigrateTaskHandler = { handle: vi.fn() };
    mockCreateCollectionHandler = { handle: vi.fn() };
    mockAddNoteToCollectionHandler = { handle: vi.fn() };
    mockMoveNoteToCollectionHandler = { handle: vi.fn() };
    mockAddEventToCollectionHandler = { handle: vi.fn() };
    mockMoveEventToCollectionHandler = { handle: vi.fn() };

    mockConfig = {
      collectionId: 'collection-1',
      onOpenRenameModal: vi.fn(),
      onCloseDeleteModal: vi.fn(),
      onOpenDeleteModal: vi.fn(),
      onOpenSettingsModal: vi.fn(),
    };
  });

  function buildParams(overrides = {}) {
    return {
      handlers: mockHandlers,
      entries: mockEntries,
      collection: mockCollection,
      migrateTaskHandler: mockMigrateTaskHandler,
      createCollectionHandler: mockCreateCollectionHandler,
      entryProjection: {
        isParentTask: vi.fn().mockResolvedValue(false),
        getParentCompletionStatus: vi.fn().mockResolvedValue({ total: 0, completed: 0, allComplete: true }),
        getSubTasks: vi.fn().mockResolvedValue([]),
      } as any,
      addTaskToCollectionHandler: { handle: vi.fn() } as any,
      moveTaskToCollectionHandler: { handle: vi.fn() } as any,
      addNoteToCollectionHandler: mockAddNoteToCollectionHandler,
      moveNoteToCollectionHandler: mockMoveNoteToCollectionHandler,
      addEventToCollectionHandler: mockAddEventToCollectionHandler,
      moveEventToCollectionHandler: mockMoveEventToCollectionHandler,
      bulkMigrateEntriesHandler: { handle: vi.fn() } as any,
      restoreTaskHandler: { handle: vi.fn() } as any,
      restoreNoteHandler: { handle: vi.fn() } as any,
      restoreEventHandler: { handle: vi.fn() } as any,
      ...overrides,
    };
  }

  it('should return all operation functions', () => {
    const { result } = renderHook(() =>
      useEntryOperations(buildParams(), mockConfig)
    );

    expect(result.current).toHaveProperty('handleCreateTask');
    expect(result.current).toHaveProperty('handleCreateNote');
    expect(result.current).toHaveProperty('handleCreateEvent');
    expect(result.current).toHaveProperty('handleCompleteTask');
    expect(result.current).toHaveProperty('handleReopenTask');
    expect(result.current).toHaveProperty('handleUpdateTaskTitle');
    expect(result.current).toHaveProperty('handleUpdateNoteContent');
    expect(result.current).toHaveProperty('handleUpdateEventContent');
    expect(result.current).toHaveProperty('handleUpdateEventDate');
    expect(result.current).toHaveProperty('handleDelete');
    expect(result.current).toHaveProperty('handleReorder');
    expect(result.current).toHaveProperty('handleMigrate');
    expect(result.current).toHaveProperty('handleNavigateToMigrated');
    expect(result.current).toHaveProperty('handleCreateCollection');
    expect(result.current).toHaveProperty('handleRenameCollection');
    expect(result.current).toHaveProperty('handleRenameSubmit');
    expect(result.current).toHaveProperty('handleDeleteCollection');
    expect(result.current).toHaveProperty('handleDeleteConfirm');
    expect(result.current).toHaveProperty('handleOpenSettings');
    expect(result.current).toHaveProperty('handleSettingsSubmit');
    expect(result.current).toHaveProperty('handleToggleFavorite');
  });

  it('should call createTaskHandler when handleCreateTask is invoked', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(buildParams(), mockConfig)
    );

    await result.current.handleCreateTask('New Task');

    expect(mockHandlers.createTaskHandler.handle).toHaveBeenCalledWith({
      title: 'New Task',
      collectionId: 'collection-1',
    });
  });

  it('should call renameCollectionHandler when handleRenameSubmit is invoked', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(buildParams(), mockConfig)
    );

    await result.current.handleRenameSubmit('New Name');

    expect(mockHandlers.renameCollectionHandler.handle).toHaveBeenCalledWith({
      collectionId: 'collection-1',
      name: 'New Name',
    });
  });

  it('should toggle favorite correctly when collection is not favorited', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(
        buildParams({ collection: { ...mockCollection, isFavorite: false } }),
        mockConfig
      )
    );

    await result.current.handleToggleFavorite();

    expect(mockHandlers.favoriteCollectionHandler.handle).toHaveBeenCalledWith({
      collectionId: 'collection-1',
    });
    expect(mockHandlers.unfavoriteCollectionHandler.handle).not.toHaveBeenCalled();
  });

  it('should toggle favorite correctly when collection is already favorited', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(
        buildParams({ collection: { ...mockCollection, isFavorite: true } }),
        mockConfig
      )
    );

    await result.current.handleToggleFavorite();

    expect(mockHandlers.unfavoriteCollectionHandler.handle).toHaveBeenCalledWith({
      collectionId: 'collection-1',
    });
    expect(mockHandlers.favoriteCollectionHandler.handle).not.toHaveBeenCalled();
  });

  it('should use moveNoteToCollectionHandler for note migration when in a collection', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(buildParams(), mockConfig)
    );

    await result.current.handleMigrate('note-1', 'target-collection');

    expect(mockMoveNoteToCollectionHandler.handle).toHaveBeenCalledWith({
      noteId: 'note-1',
      currentCollectionId: 'collection-1',
      targetCollectionId: 'target-collection',
    });
  });

  it('should use addNoteToCollectionHandler for note migration when not in a specific collection', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(
        buildParams({ collection: null }),
        mockConfig
      )
    );

    await result.current.handleMigrate('note-1', 'target-collection');

    expect(mockAddNoteToCollectionHandler.handle).toHaveBeenCalledWith({
      noteId: 'note-1',
      collectionId: 'target-collection',
    });
  });
});
