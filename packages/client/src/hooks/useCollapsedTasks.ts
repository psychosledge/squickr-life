/**
 * useCollapsedTasks Hook
 * 
 * Manages expand/collapse state for parent tasks with sub-tasks.
 * Persists state in localStorage to survive page refresh.
 * 
 * Default state: all tasks expanded (collapsed set is empty)
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'collapsed-tasks';

interface UseCollapsedTasksResult {
  isCollapsed: (taskId: string) => boolean;
  toggleCollapsed: (taskId: string) => void;
}

/**
 * Custom hook to manage collapsed/expanded state of parent tasks
 * 
 * @returns Object with isCollapsed checker and toggleCollapsed function
 */
export function useCollapsedTasks(): UseCollapsedTasksResult {
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that it's an array
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (error) {
      // Invalid JSON or other error - fall back to empty set
      console.warn('Failed to load collapsed tasks from localStorage:', error);
    }
    return new Set<string>();
  });

  // Persist to localStorage whenever collapsedTaskIds changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(collapsedTaskIds)));
    } catch (error) {
      console.warn('Failed to save collapsed tasks to localStorage:', error);
    }
  }, [collapsedTaskIds]);

  // Check if a task is collapsed
  // Simple lookup function - no useCallback needed since it's just a Set.has() operation
  const isCollapsed = (taskId: string): boolean => {
    return collapsedTaskIds.has(taskId);
  };

  // Toggle collapse state for a task
  const toggleCollapsed = useCallback((taskId: string): void => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  return {
    isCollapsed,
    toggleCollapsed,
  };
}
