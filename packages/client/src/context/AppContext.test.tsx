import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AppProvider, useApp, useProjections } from './AppContext';
import type {
  IEventStore,
  EntryListProjection,
  TaskListProjection,
  CollectionListProjection,
  CreateCollectionHandler,
} from '@squickr/shared';

describe('AppContext', () => {
  const createMockContext = () => ({
    eventStore: {} as IEventStore,
    entryProjection: {} as EntryListProjection,
    taskProjection: {} as TaskListProjection,
    collectionProjection: {} as CollectionListProjection,
    createCollectionHandler: {} as CreateCollectionHandler,
  });

  describe('useApp', () => {
    it('should provide context value to children', () => {
      const mockContext = createMockContext();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider value={mockContext}>{children}</AppProvider>
      );

      const { result } = renderHook(() => useApp(), { wrapper });

      expect(result.current).toBe(mockContext);
      expect(result.current.eventStore).toBe(mockContext.eventStore);
    });

    it('should throw error when used outside AppProvider', () => {
      expect(() => {
        renderHook(() => useApp());
      }).toThrow('useApp must be used within AppProvider');
    });
  });

  describe('useProjections', () => {
    it('should provide all projections via useProjections hook', () => {
      const mockContext = createMockContext();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AppProvider value={mockContext}>{children}</AppProvider>
      );

      const { result } = renderHook(() => useProjections(), { wrapper });

      expect(result.current.entryProjection).toBe(mockContext.entryProjection);
      expect(result.current.taskProjection).toBe(mockContext.taskProjection);
      expect(result.current.collectionProjection).toBe(
        mockContext.collectionProjection
      );
    });

    it('should throw error when used outside AppProvider', () => {
      expect(() => {
        renderHook(() => useProjections());
      }).toThrow('useApp must be used within AppProvider');
    });
  });
});
