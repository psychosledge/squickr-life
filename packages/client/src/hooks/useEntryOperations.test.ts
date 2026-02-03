/**
 * Tests for useEntryOperations hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEntryOperations } from './useEntryOperations';
import type { CollectionHandlers } from './useCollectionHandlers';
import type { Entry, Collection } from '@squickr/shared';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('useEntryOperations', () => {
  let mockHandlers: CollectionHandlers;
  let mockEntries: Entry[];
  let mockCollection: Collection;
  let mockMigrateTaskHandler: any;
  let mockMigrateNoteHandler: any;
  let mockMigrateEventHandler: any;
  let mockCreateCollectionHandler: any;
  let mockConfig: any;

  beforeEach(() => {
    // Create mock handlers
    mockHandlers = {
      createTaskHandler: { handle: vi.fn() } as any,
      createNoteHandler: { handle: vi.fn() } as any,
      createEventHandler: { handle: vi.fn() } as any,
      completeTaskHandler: { handle: vi.fn() } as any,
      reopenTaskHandler: { handle: vi.fn() } as any,
      updateTaskTitleHandler: { handle: vi.fn() } as any,
      updateNoteContentHandler: { handle: vi.fn() } as any,
      updateEventContentHandler: { handle: vi.fn() } as any,
      updateEventDateHandler: { handle: vi.fn() } as any,
      deleteTaskHandler: { handle: vi.fn() } as any,
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
      },
      {
        id: 'note-1',
        type: 'note',
        content: 'Test Note',
        order: 'a1',
        createdAt: new Date().toISOString(),
      },
    ] as Entry[];

    mockMigrateTaskHandler = { handle: vi.fn() };
    mockMigrateNoteHandler = { handle: vi.fn() };
    mockMigrateEventHandler = { handle: vi.fn() };
    mockCreateCollectionHandler = { handle: vi.fn() };

    mockConfig = {
      collectionId: 'collection-1',
      onOpenRenameModal: vi.fn(),
      onCloseDeleteModal: vi.fn(),
      onOpenDeleteModal: vi.fn(),
      onOpenSettingsModal: vi.fn(),
    };
  });

  it('should return all operation functions', () => {
    const { result } = renderHook(() =>
      useEntryOperations(
        {
          handlers: mockHandlers,
          entries: mockEntries,
          collection: mockCollection,
          migrateTaskHandler: mockMigrateTaskHandler,
          migrateNoteHandler: mockMigrateNoteHandler,
          migrateEventHandler: mockMigrateEventHandler,
          createCollectionHandler: mockCreateCollectionHandler,
        },
        mockConfig
      )
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
      useEntryOperations(
        {
          handlers: mockHandlers,
          entries: mockEntries,
          collection: mockCollection,
          migrateTaskHandler: mockMigrateTaskHandler,
          migrateNoteHandler: mockMigrateNoteHandler,
          migrateEventHandler: mockMigrateEventHandler,
          createCollectionHandler: mockCreateCollectionHandler,
        },
        mockConfig
      )
    );

    await result.current.handleCreateTask('New Task');

    expect(mockHandlers.createTaskHandler.handle).toHaveBeenCalledWith({
      title: 'New Task',
      collectionId: 'collection-1',
    });
  });

  it('should call renameCollectionHandler when handleRenameSubmit is invoked', async () => {
    const { result } = renderHook(() =>
      useEntryOperations(
        {
          handlers: mockHandlers,
          entries: mockEntries,
          collection: mockCollection,
          migrateTaskHandler: mockMigrateTaskHandler,
          migrateNoteHandler: mockMigrateNoteHandler,
          migrateEventHandler: mockMigrateEventHandler,
          createCollectionHandler: mockCreateCollectionHandler,
        },
        mockConfig
      )
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
        {
          handlers: mockHandlers,
          entries: mockEntries,
          collection: { ...mockCollection, isFavorite: false },
          migrateTaskHandler: mockMigrateTaskHandler,
          migrateNoteHandler: mockMigrateNoteHandler,
          migrateEventHandler: mockMigrateEventHandler,
          createCollectionHandler: mockCreateCollectionHandler,
        },
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
        {
          handlers: mockHandlers,
          entries: mockEntries,
          collection: { ...mockCollection, isFavorite: true },
          migrateTaskHandler: mockMigrateTaskHandler,
          migrateNoteHandler: mockMigrateNoteHandler,
          migrateEventHandler: mockMigrateEventHandler,
          createCollectionHandler: mockCreateCollectionHandler,
        },
        mockConfig
      )
    );

    await result.current.handleToggleFavorite();

    expect(mockHandlers.unfavoriteCollectionHandler.handle).toHaveBeenCalledWith({
      collectionId: 'collection-1',
    });
    expect(mockHandlers.favoriteCollectionHandler.handle).not.toHaveBeenCalled();
  });
});
