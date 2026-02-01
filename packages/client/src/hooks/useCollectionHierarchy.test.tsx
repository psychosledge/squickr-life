/**
 * useCollectionHierarchy Hook Tests
 * 
 * Tests for the collection hierarchy hook that builds tree structures from flat collections.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollectionHierarchy, formatDayLabel, formatMonthLabel, formatYearLabel, getCurrentYearMonth } from './useCollectionHierarchy';
import type { Collection } from '@squickr/shared';

describe('useCollectionHierarchy', () => {
  const STORAGE_KEY = 'collection-hierarchy-expanded';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('formatDayLabel', () => {
    it('should format YYYY-MM-DD as "Weekday, Month Day"', () => {
      expect(formatDayLabel('2026-02-01')).toBe('Sunday, February 1');
      expect(formatDayLabel('2026-12-25')).toBe('Friday, December 25');
    });

    it('should handle undefined gracefully', () => {
      expect(formatDayLabel(undefined)).toBe('Unknown Date');
    });
  });

  describe('formatMonthLabel', () => {
    it('should format YYYY-MM as "Month"', () => {
      expect(formatMonthLabel('2026-02')).toBe('February');
      expect(formatMonthLabel('2026-12')).toBe('December');
    });

    it('should handle undefined gracefully', () => {
      expect(formatMonthLabel(undefined)).toBe('Unknown Month');
    });
  });

  describe('formatYearLabel', () => {
    it('should format YYYY as "YYYY Logs"', () => {
      expect(formatYearLabel('2026')).toBe('2026 Logs');
      expect(formatYearLabel('2025')).toBe('2025 Logs');
    });

    it('should handle undefined gracefully', () => {
      expect(formatYearLabel(undefined)).toBe('Unknown Year');
    });
  });

  describe('getCurrentYearMonth', () => {
    it('should return current year and yearMonth', () => {
      const { year, yearMonth } = getCurrentYearMonth();
      expect(year).toMatch(/^\d{4}$/);
      expect(yearMonth).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('building hierarchy', () => {
    it('should build hierarchy from flat collections', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Ideas',
          type: 'custom',
          order: 'b',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      expect(result.current.nodes).toHaveLength(2);
      
      // Check that we have a year node and a custom node
      const yearNode = result.current.nodes.find(n => n.type === 'year');
      const customNode = result.current.nodes.find(n => n.type === 'custom');
      
      expect(yearNode).toBeDefined();
      expect(customNode).toBeDefined();
      expect(customNode?.label).toBe('Ideas');
    });

    it('should group daily logs by year and month', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Saturday, January 31',
          type: 'daily',
          date: '2026-01-31',
          order: 'b',
          createdAt: '2026-01-31T00:00:00Z',
        },
        {
          id: '3',
          name: 'Wednesday, December 31',
          type: 'daily',
          date: '2025-12-31',
          order: 'c',
          createdAt: '2025-12-31T00:00:00Z',
        },
      ];

      // Expand all nodes for testing
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        'year-2026',
        'month-2026-02',
        'month-2026-01',
        'year-2025',
        'month-2025-12',
      ]));

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      // Should have 2 year nodes
      const yearNodes = result.current.nodes.filter(n => n.type === 'year');
      expect(yearNodes).toHaveLength(2);

      // 2026 should come first (newest)
      expect(yearNodes[0]?.id).toBe('year-2026');
      expect(yearNodes[1]?.id).toBe('year-2025');

      // 2026 should have 2 month nodes
      const year2026 = yearNodes[0];
      expect(year2026?.children).toHaveLength(2);

      // February should come first (newest)
      expect(year2026?.children[0]?.id).toBe('month-2026-02');
      expect(year2026?.children[1]?.id).toBe('month-2026-01');
    });

    it('should place custom collections at root level', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Ideas',
          type: 'custom',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Projects',
          type: 'log', // Legacy type, treated as custom
          order: 'b',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      const customNodes = result.current.nodes.filter(n => n.type === 'custom');
      expect(customNodes).toHaveLength(2);
    });

    it('should sort pinned customs first, then years, then unpinned customs', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Unpinned Custom',
          type: 'custom',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Pinned Custom',
          type: 'custom',
          isFavorite: true,
          order: 'b',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: '3',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'c',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Auto-expand current year/month
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      expect(result.current.nodes).toHaveLength(3);
      
      // First should be pinned custom
      expect(result.current.nodes[0]?.type).toBe('custom');
      expect(result.current.nodes[0]?.collection?.isFavorite).toBe(true);
      
      // Second should be year
      expect(result.current.nodes[1]?.type).toBe('year');
      
      // Third should be unpinned custom
      expect(result.current.nodes[2]?.type).toBe('custom');
      expect(result.current.nodes[2]?.collection?.isFavorite).toBeFalsy();
    });

    it('should auto-expand current year and month on first load', () => {
      const { year, yearMonth } = getCurrentYearMonth();
      
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Today',
          type: 'daily',
          date: new Date().toISOString().substring(0, 10), // Today's date
          order: 'a',
          createdAt: new Date().toISOString(),
        },
      ];

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      expect(result.current.isExpanded(`year-${year}`)).toBe(true);
      expect(result.current.isExpanded(`month-${yearMonth}`)).toBe(true);
    });
  });

  describe('expand/collapse state', () => {
    it('should persist expand state in localStorage', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Clear localStorage to get auto-expand behavior
      localStorage.clear();

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      // Should have auto-expanded current year/month
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBeTruthy();
      
      const initialParsed = JSON.parse(stored!);
      const initialCount = initialParsed.length;

      // Now toggle a specific node
      act(() => {
        result.current.toggleExpand('year-2026');
      });

      const storedAfter = localStorage.getItem(STORAGE_KEY);
      const parsedAfter = JSON.parse(storedAfter!);
      
      // Should either have added or removed year-2026
      expect(parsedAfter.length).not.toBe(initialCount);
    });

    it('should toggle expand state', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      const initialExpanded = result.current.isExpanded('year-2026');

      act(() => {
        result.current.toggleExpand('year-2026');
      });

      expect(result.current.isExpanded('year-2026')).toBe(!initialExpanded);

      act(() => {
        result.current.toggleExpand('year-2026');
      });

      expect(result.current.isExpanded('year-2026')).toBe(initialExpanded);
    });

    it('should show count when year is collapsed', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Saturday, January 31',
          type: 'daily',
          date: '2026-01-31',
          order: 'b',
          createdAt: '2026-01-31T00:00:00Z',
        },
      ];

      // Don't expand year
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      expect(yearNode?.count).toBe(2);
      expect(yearNode?.isExpanded).toBe(false);
    });

    it('should not show count when year is expanded', () => {
      const collections: Collection[] = [
        {
          id: '1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026']));

      const { result } = renderHook(() => useCollectionHierarchy(collections));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      expect(yearNode?.count).toBeUndefined();
      expect(yearNode?.isExpanded).toBe(true);
    });
  });
});
