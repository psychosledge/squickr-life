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

  it('should match hierarchical ordering: favorited customs, daily logs (newest first), other customs', async () => {
    // Bug #2: Navigation order should match the collection index order
    // Expected order: 1) Favorited customs (by order), 2) Daily logs (newest first), 3) Other customs (by order)
    
    collectionsData = [
      // Favorited customs (should appear first)
      { id: 'fav1', name: 'Favorite 1', type: 'custom', order: 'a0', isFavorite: true, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'fav2', name: 'Favorite 2', type: 'custom', order: 'a1', isFavorite: true, createdAt: '2024-01-02T00:00:00Z' },
      
      // Daily logs (should appear in date order, newest first)
      { id: 'daily1', name: 'Feb 1', type: 'daily', date: '2026-02-01', createdAt: '2024-01-03T00:00:00Z' },
      { id: 'daily2', name: 'Feb 2', type: 'daily', date: '2026-02-02', createdAt: '2024-01-04T00:00:00Z' },
      { id: 'daily3', name: 'Jan 31', type: 'daily', date: '2026-01-31', createdAt: '2024-01-05T00:00:00Z' },
      
      // Other customs (should appear last)
      { id: 'custom1', name: 'Custom 1', type: 'custom', order: 'b0', isFavorite: false, createdAt: '2024-01-06T00:00:00Z' },
      { id: 'custom2', name: 'Custom 2', type: 'custom', order: 'b1', isFavorite: false, createdAt: '2024-01-07T00:00:00Z' },
    ];

    // Test navigation from fav1 (first favorited custom)
    const { result: result1 } = renderHook(
      () => useCollectionNavigation('fav1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result1.current.previousCollection).toBeNull(); // First collection
      expect(result1.current.nextCollection?.id).toBe('fav2'); // Next is fav2
    });

    // Test navigation from fav2 (second favorited custom)
    const { result: result2 } = renderHook(
      () => useCollectionNavigation('fav2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result2.current.previousCollection?.id).toBe('fav1'); // Previous is fav1
      expect(result2.current.nextCollection?.id).toBe('daily2'); // Next is daily2 (newest daily log)
    });

    // Test navigation from daily2 (newest daily log)
    const { result: result3 } = renderHook(
      () => useCollectionNavigation('daily2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result3.current.previousCollection?.id).toBe('fav2'); // Previous is fav2
      expect(result3.current.nextCollection?.id).toBe('daily1'); // Next is daily1 (second newest)
    });

    // Test navigation from daily1 (second newest daily log)
    const { result: result4 } = renderHook(
      () => useCollectionNavigation('daily1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result4.current.previousCollection?.id).toBe('daily2'); // Previous is daily2
      expect(result4.current.nextCollection?.id).toBe('daily3'); // Next is daily3 (third newest)
    });

    // Test navigation from daily3 (third newest daily log)
    const { result: result5 } = renderHook(
      () => useCollectionNavigation('daily3'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result5.current.previousCollection?.id).toBe('daily1'); // Previous is daily1
      expect(result5.current.nextCollection?.id).toBe('custom1'); // Next is custom1 (first other custom)
    });

    // Test navigation from custom1 (first other custom)
    const { result: result6 } = renderHook(
      () => useCollectionNavigation('custom1'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result6.current.previousCollection?.id).toBe('daily3'); // Previous is daily3
      expect(result6.current.nextCollection?.id).toBe('custom2'); // Next is custom2
    });

    // Test navigation from custom2 (last collection)
    const { result: result7 } = renderHook(
      () => useCollectionNavigation('custom2'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result7.current.previousCollection?.id).toBe('custom1'); // Previous is custom1
      expect(result7.current.nextCollection).toBeNull(); // Last collection
    });
  });

  describe('Swipe Gesture Sensitivity', () => {
    beforeEach(() => {
      collectionsData = [
        { id: 'c1', name: 'First', type: 'custom', order: 'a', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'c2', name: 'Second', type: 'custom', order: 'b', createdAt: '2024-01-02T00:00:00Z' },
        { id: 'c3', name: 'Third', type: 'custom', order: 'c', createdAt: '2024-01-03T00:00:00Z' },
      ];
    });

    it('should not navigate when vertical scroll dominates horizontal movement', async () => {
      // Bug #1: Vertical scrolling triggers horizontal navigation
      // Expected: If vertical movement > horizontal movement, don't navigate
      
      const { result } = renderHook(
        () => useCollectionNavigation('c2'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.nextCollection).toBeDefined();
      });

      // Simulate vertical scroll with slight horizontal drift (150px vertical, 30px horizontal)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      window.dispatchEvent(touchStart);

      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 70, clientY: 250 } as Touch], // 30px left, 150px down
      });
      window.dispatchEvent(touchEnd);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should navigate when horizontal swipe clearly exceeds threshold', async () => {
      // Horizontal swipe (120px) should navigate when vertical movement is minimal
      
      const { result } = renderHook(
        () => useCollectionNavigation('c2'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.nextCollection).toBeDefined();
      });

      // Simulate horizontal swipe left (120px horizontal, 10px vertical)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 100 } as Touch],
      });
      window.dispatchEvent(touchStart);

      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 80, clientY: 110 } as Touch], // 120px left, 10px down
      });
      window.dispatchEvent(touchEnd);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockNavigate).toHaveBeenCalledWith('/collection/c3');
    });

    it('should not navigate when horizontal movement is below threshold', async () => {
      // Small horizontal movement (60px) below new threshold should not navigate
      
      const { result } = renderHook(
        () => useCollectionNavigation('c2'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.previousCollection).toBeDefined();
      });

      // Simulate small horizontal swipe (60px horizontal, 5px vertical)
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      window.dispatchEvent(touchStart);

      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 160, clientY: 105 } as Touch], // 60px right, 5px down
      });
      window.dispatchEvent(touchEnd);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should navigate when horizontal swipe is clearly intentional (diagonal)', async () => {
      // Diagonal swipe where horizontal > vertical should navigate
      
      const { result } = renderHook(
        () => useCollectionNavigation('c2'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.previousCollection).toBeDefined();
      });

      // Simulate diagonal swipe (150px right, 50px down) - horizontal dominates
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      window.dispatchEvent(touchStart);

      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [{ clientX: 250, clientY: 150 } as Touch], // 150px right, 50px down
      });
      window.dispatchEvent(touchEnd);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockNavigate).toHaveBeenCalledWith('/collection/c1');
    });
  });
});
