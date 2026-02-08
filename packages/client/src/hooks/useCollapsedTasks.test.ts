/**
 * useCollapsedTasks Hook Tests
 * 
 * Tests for expand/collapse state management with localStorage persistence.
 */

import { renderHook, act } from '@testing-library/react';
import { useCollapsedTasks } from './useCollapsedTasks';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useCollapsedTasks', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Initial State', () => {
    it('should start with no collapsed tasks (all expanded by default)', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      expect(result.current.isCollapsed('task-1')).toBe(false);
      expect(result.current.isCollapsed('task-2')).toBe(false);
    });

    it('should load collapsed tasks from localStorage on mount', () => {
      // Pre-populate localStorage
      localStorageMock.setItem('collapsed-tasks', JSON.stringify(['task-1', 'task-3']));
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      expect(result.current.isCollapsed('task-1')).toBe(true);
      expect(result.current.isCollapsed('task-2')).toBe(false);
      expect(result.current.isCollapsed('task-3')).toBe(true);
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorageMock.setItem('collapsed-tasks', 'invalid-json');
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      // Should fall back to empty set
      expect(result.current.isCollapsed('task-1')).toBe(false);
    });

    it('should handle localStorage containing non-array data', () => {
      localStorageMock.setItem('collapsed-tasks', JSON.stringify({ foo: 'bar' }));
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      // Should fall back to empty set
      expect(result.current.isCollapsed('task-1')).toBe(false);
    });
  });

  describe('Toggle Collapse', () => {
    it('should collapse a task when toggled from expanded state', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      expect(result.current.isCollapsed('task-1')).toBe(true);
    });

    it('should expand a task when toggled from collapsed state', () => {
      localStorageMock.setItem('collapsed-tasks', JSON.stringify(['task-1']));
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      expect(result.current.isCollapsed('task-1')).toBe(true);
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      expect(result.current.isCollapsed('task-1')).toBe(false);
    });

    it('should persist collapsed state to localStorage when collapsed', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      const stored = localStorageMock.getItem('collapsed-tasks');
      expect(stored).toBe(JSON.stringify(['task-1']));
    });

    it('should persist multiple collapsed tasks to localStorage', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
        result.current.toggleCollapsed('task-2');
      });
      
      const stored = localStorageMock.getItem('collapsed-tasks');
      const parsed = JSON.parse(stored!);
      expect(parsed).toContain('task-1');
      expect(parsed).toContain('task-2');
      expect(parsed).toHaveLength(2);
    });

    it('should remove task from localStorage when expanded', () => {
      localStorageMock.setItem('collapsed-tasks', JSON.stringify(['task-1', 'task-2']));
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      const stored = localStorageMock.getItem('collapsed-tasks');
      const parsed = JSON.parse(stored!);
      expect(parsed).not.toContain('task-1');
      expect(parsed).toContain('task-2');
      expect(parsed).toHaveLength(1);
    });

    it('should clear localStorage when all tasks are expanded', () => {
      localStorageMock.setItem('collapsed-tasks', JSON.stringify(['task-1']));
      
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      const stored = localStorageMock.getItem('collapsed-tasks');
      expect(stored).toBe(JSON.stringify([]));
    });
  });

  describe('Reactivity', () => {
    it('should trigger re-render when collapsed state changes', () => {
      const { result, rerender } = renderHook(() => useCollapsedTasks());
      
      const isCollapsedBefore = result.current.isCollapsed('task-1');
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      rerender();
      
      const isCollapsedAfter = result.current.isCollapsed('task-1');
      
      expect(isCollapsedBefore).toBe(false);
      expect(isCollapsedAfter).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle toggling the same task multiple times', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      expect(result.current.isCollapsed('task-1')).toBe(true);
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      expect(result.current.isCollapsed('task-1')).toBe(false);
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      expect(result.current.isCollapsed('task-1')).toBe(true);
    });

    it('should handle empty string task IDs', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('');
      });
      
      expect(result.current.isCollapsed('')).toBe(true);
    });

    it('should maintain separate state for different task IDs', () => {
      const { result } = renderHook(() => useCollapsedTasks());
      
      act(() => {
        result.current.toggleCollapsed('task-1');
      });
      
      expect(result.current.isCollapsed('task-1')).toBe(true);
      expect(result.current.isCollapsed('task-2')).toBe(false);
      expect(result.current.isCollapsed('task-3')).toBe(false);
    });
  });
});
