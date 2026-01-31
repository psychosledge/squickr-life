/**
 * useCollectionNavigation Hook Tests
 * 
 * Tests for the collection navigation hook that enables page flipping between collections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useCollectionNavigation } from './useCollectionNavigation';
import { AppProvider } from '../context/AppContext';
import type { ReactNode } from 'react';
import type { Collection } from '@squickr/shared';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useCollectionNavigation', () => {
  let mockCollectionProjection: any;
  let mockEntryProjection: any;
  let collectionsData: Collection[];

  beforeEach(() => {
    collectionsData = [];
    mockNavigate.mockClear();
    
    mockCollectionProjection = {
      getCollections: vi.fn(async () => collectionsData),
      subscribe: vi.fn(() => () => {}),
    };

    mockEntryProjection = {
      getEntriesByCollection: vi.fn(async () => []),
      subscribe: vi.fn(() => () => {}),
    };
  });

  function createWrapper() {
    return ({ children }: { children: ReactNode }) => (
      <BrowserRouter>
        <AppProvider 
          value={{
            eventStore: {} as any,
            collectionProjection: mockCollectionProjection,
            entryProjection: mockEntryProjection,
            taskProjection: {} as any,
            createCollectionHandler: {} as any,
            migrateTaskHandler: {} as any,
            migrateNoteHandler: {} as any,
            migrateEventHandler: {} as any,
          }}
        >
          {children}
        </AppProvider>
      </BrowserRouter>
    );
  }

  it('should calculate correct previous and next collections', async () => {
    // Set up 3 collections
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'c3', name: 'Third', type: 'custom', order: 'c', createdAt: '2024-01-03T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection?.name).toBe('First');
      expect(result.current.nextCollection?.name).toBe('Third');
    });
  });

  it('should have null previous when at first collection', async () => {
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection).toBeNull();
      expect(result.current.nextCollection).toBeDefined();
    });

    expect(result.current.nextCollection?.name).toBe('Second');
  });

  it('should have null next when at last collection', async () => {
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection).toBeDefined();
      expect(result.current.nextCollection).toBeNull();
    });

    expect(result.current.previousCollection?.name).toBe('First');
  });

  it('should navigate to previous collection', async () => {
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection).toBeDefined();
    });

    result.current.navigateToPrevious();

    expect(mockNavigate).toHaveBeenCalledWith('/collection/c1');
  });

  it('should navigate to next collection', async () => {
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.nextCollection).toBeDefined();
    });

    result.current.navigateToNext();

    expect(mockNavigate).toHaveBeenCalledWith('/collection/c2');
  });

  it('should not navigate when at boundaries', async () => {
    collectionsData = [
      { id: 'c1', name: 'Only', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection).toBeNull();
      expect(result.current.nextCollection).toBeNull();
    });

    result.current.navigateToPrevious();
    result.current.navigateToNext();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle single collection (both buttons disabled)', async () => {
    collectionsData = [
      { id: 'c1', name: 'Only', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const { result } = renderHook(
      () => useCollectionNavigation('c1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.previousCollection).toBeNull();
      expect(result.current.nextCollection).toBeNull();
    });
  });

  it('should clean up event listeners on unmount', async () => {
    collectionsData = [
      { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
    ];

    const { unmount } = renderHook(
      () => useCollectionNavigation('c1'),
      { wrapper: createWrapper() }
    );

    // Unmount the hook
    unmount();

    // Keyboard events should no longer trigger navigation
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    window.dispatchEvent(event);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
