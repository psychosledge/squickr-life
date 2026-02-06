/**
 * Hook: useSelectionMode
 * 
 * Manages selection mode state for bulk entry operations.
 * Provides methods to:
 * - Enter/exit selection mode
 * - Toggle individual entry selection
 * - Select all entries
 * - Clear all selections
 * 
 * Used in CollectionDetailView for bulk entry migration.
 */

import { useState, useCallback } from 'react';

export interface SelectionModeState {
  isSelectionMode: boolean;
  selectedEntryIds: Set<string>;
  selectedCount: number;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSelection: (entryId: string) => void;
  selectAll: (entryIds: string[]) => void;
  clearSelection: () => void;
}

/**
 * Custom hook for managing selection mode state
 */
export function useSelectionMode(): SelectionModeState {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedEntryIds(new Set());
  }, []);

  const toggleSelection = useCallback((entryId: string) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((entryIds: string[]) => {
    setSelectedEntryIds(new Set(entryIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntryIds(new Set());
  }, []);

  return {
    isSelectionMode,
    selectedEntryIds,
    selectedCount: selectedEntryIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}
