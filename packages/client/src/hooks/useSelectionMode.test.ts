/**
 * Tests for useSelectionMode hook
 * 
 * Tests the selection mode state management including:
 * - Entering/exiting selection mode
 * - Selecting/deselecting entries
 * - Bulk selection operations
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionMode } from './useSelectionMode';

describe('useSelectionMode', () => {
  it('should initialize with selection mode off and no selections', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedEntryIds.size).toBe(0);
    expect(result.current.selectedCount).toBe(0);
  });

  it('should enter selection mode', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
    });
    
    expect(result.current.isSelectionMode).toBe(true);
  });

  it('should exit selection mode and clear selections', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    // Enter selection mode and select some entries
    act(() => {
      result.current.enterSelectionMode();
      result.current.toggleSelection('entry-1');
      result.current.toggleSelection('entry-2');
    });
    
    expect(result.current.selectedCount).toBe(2);
    
    // Exit selection mode
    act(() => {
      result.current.exitSelectionMode();
    });
    
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('should toggle individual entry selection', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
    });
    
    // Select entry
    act(() => {
      result.current.toggleSelection('entry-1');
    });
    
    expect(result.current.selectedEntryIds.has('entry-1')).toBe(true);
    expect(result.current.selectedCount).toBe(1);
    
    // Deselect entry
    act(() => {
      result.current.toggleSelection('entry-1');
    });
    
    expect(result.current.selectedEntryIds.has('entry-1')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('should select multiple entries', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
      result.current.toggleSelection('entry-1');
      result.current.toggleSelection('entry-2');
      result.current.toggleSelection('entry-3');
    });
    
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.selectedEntryIds.has('entry-1')).toBe(true);
    expect(result.current.selectedEntryIds.has('entry-2')).toBe(true);
    expect(result.current.selectedEntryIds.has('entry-3')).toBe(true);
  });

  it('should select all entries', () => {
    const { result } = renderHook(() => useSelectionMode());
    const entryIds = ['entry-1', 'entry-2', 'entry-3', 'entry-4'];
    
    act(() => {
      result.current.enterSelectionMode();
      result.current.selectAll(entryIds);
    });
    
    expect(result.current.selectedCount).toBe(4);
    entryIds.forEach(id => {
      expect(result.current.selectedEntryIds.has(id)).toBe(true);
    });
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
      result.current.selectAll(['entry-1', 'entry-2', 'entry-3']);
    });
    
    expect(result.current.selectedCount).toBe(3);
    
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selectedCount).toBe(0);
  });

  it('should replace selections when calling selectAll multiple times', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
      result.current.selectAll(['entry-1', 'entry-2']);
    });
    
    expect(result.current.selectedCount).toBe(2);
    
    act(() => {
      result.current.selectAll(['entry-3', 'entry-4', 'entry-5']);
    });
    
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.selectedEntryIds.has('entry-1')).toBe(false);
    expect(result.current.selectedEntryIds.has('entry-3')).toBe(true);
  });

  it('should track selected count accurately', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
    });
    
    expect(result.current.selectedCount).toBe(0);
    
    act(() => {
      result.current.toggleSelection('entry-1');
    });
    
    expect(result.current.selectedCount).toBe(1);
    
    act(() => {
      result.current.toggleSelection('entry-2');
      result.current.toggleSelection('entry-3');
    });
    
    expect(result.current.selectedCount).toBe(3);
    
    act(() => {
      result.current.toggleSelection('entry-2');
    });
    
    expect(result.current.selectedCount).toBe(2);
  });

  it('should handle empty selectAll', () => {
    const { result } = renderHook(() => useSelectionMode());
    
    act(() => {
      result.current.enterSelectionMode();
      result.current.selectAll([]);
    });
    
    expect(result.current.selectedCount).toBe(0);
  });
});
