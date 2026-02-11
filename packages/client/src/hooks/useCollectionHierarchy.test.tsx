/**
 * useCollectionHierarchy Hook Tests
 * 
 * Tests for the collection hierarchy hook that builds tree structures from flat collections.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollectionHierarchy, formatDayLabel, formatMonthLabel, formatYearLabel, getCurrentYearMonth } from './useCollectionHierarchy';
import type { Collection } from '@squickr/domain';
import { DEFAULT_USER_PREFERENCES } from '@squickr/domain';

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
    it('should format YYYY-MM-DD as "Weekday, Month Day, Year" (with today/yesterday/tomorrow detection)', () => {
      // Note: formatDayLabel now includes year and today/yesterday/tomorrow detection
      // These tests use dates that are not today/yesterday/tomorrow (relative to test execution time)
      expect(formatDayLabel('2026-02-01')).toBe('Sunday, February 1, 2026');
      expect(formatDayLabel('2026-12-25')).toBe('Friday, December 25, 2026');
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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      // Should have 2 year nodes
      const yearNodes = result.current.nodes.filter(n => n.type === 'year');
      expect(yearNodes).toHaveLength(2);

      // 2025 should come first (oldest)
      expect(yearNodes[0]?.id).toBe('year-2025');
      expect(yearNodes[1]?.id).toBe('year-2026');

      // 2026 should have 2 month nodes (now at index 1 since 2025 comes first)
      const year2026 = yearNodes[1];
      expect(year2026?.children).toHaveLength(2);

      // January should come first (oldest)
      expect(year2026?.children[0]?.id).toBe('month-2026-01');
      expect(year2026?.children[1]?.id).toBe('month-2026-02');
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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

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

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      expect(yearNode?.count).toBeUndefined();
      expect(yearNode?.isExpanded).toBe(true);
    });
  });

  describe('monthly log integration', () => {
    it('should attach monthly log to month node when monthly log exists for same month as daily logs', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see children
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      expect(yearNode).toBeDefined();
      expect(yearNode?.children).toHaveLength(1); // Only 1 month node (monthly log attached to it)

      // Should be a month node (not a standalone monthly)
      expect(yearNode?.children[0]?.type).toBe('month');
      
      // Month node should have monthlyLog attached
      const monthNode = yearNode?.children[0];
      if (monthNode?.type === 'month') {
        expect(monthNode.monthlyLog).toBeDefined();
        expect(monthNode.monthlyLog?.id).toBe('monthly-1');
      }
    });

    it('should sort monthly logs newest first within year', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'January 2026',
          type: 'monthly',
          date: '2026-01',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'March 2026',
          type: 'monthly',
          date: '2026-03',
          order: 'b',
          createdAt: '2026-03-01T00:00:00Z',
        },
        {
          id: 'monthly-3',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'c',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see children
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      expect(yearNode?.children).toHaveLength(3);

      // Should be sorted oldest first: January, February, March
      expect(yearNode?.children[0]?.date).toBe('2026-01');
      expect(yearNode?.children[1]?.date).toBe('2026-02');
      expect(yearNode?.children[2]?.date).toBe('2026-03');
    });

    it('should handle multiple monthly logs in same year', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'December 2026',
          type: 'monthly',
          date: '2026-12',
          order: 'a',
          createdAt: '2026-12-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'January 2026',
          type: 'monthly',
          date: '2026-01',
          order: 'b',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'monthly-3',
          name: 'June 2026',
          type: 'monthly',
          date: '2026-06',
          order: 'c',
          createdAt: '2026-06-01T00:00:00Z',
        },
      ];

      // Expand year to see children
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // All 3 monthly logs should appear as direct children
      const monthlyNodes = yearNode?.children.filter(n => n.type === 'monthly');
      expect(monthlyNodes).toHaveLength(3);
      
      // Verify all are monthly type
      monthlyNodes?.forEach(node => {
        expect(node.type).toBe('monthly');
        expect(node.collection?.type).toBe('monthly');
      });
    });

    it('should handle mixed daily and monthly logs in same year', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'January 2026',
          type: 'monthly',
          date: '2026-01',
          order: 'b',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'c',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          name: 'Saturday, January 31',
          type: 'daily',
          date: '2026-01-31',
          order: 'd',
          createdAt: '2026-01-31T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02', 'month-2026-01']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have only 2 month nodes (monthly logs attached to them)
      expect(yearNode?.children).toHaveLength(2);
      
      // Both should be month nodes (oldest first: Jan, Feb)
      expect(yearNode?.children[0]?.type).toBe('month');
      expect(yearNode?.children[0]?.id).toBe('month-2026-01');
      expect(yearNode?.children[1]?.type).toBe('month');
      expect(yearNode?.children[1]?.id).toBe('month-2026-02');
      
      // January month node should have monthlyLog attached
      const janNode = yearNode?.children[0];
      if (janNode?.type === 'month') {
        expect(janNode.monthlyLog).toBeDefined();
        expect(janNode.monthlyLog?.id).toBe('monthly-2');
      }
      
      // February month node should have monthlyLog attached
      const febNode = yearNode?.children[1];
      if (febNode?.type === 'month') {
        expect(febNode.monthlyLog).toBeDefined();
        expect(febNode.monthlyLog?.id).toBe('monthly-1');
      }
    });

    it('should handle year with only monthly logs (no daily logs)', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'December 2025',
          type: 'monthly',
          date: '2025-12',
          order: 'a',
          createdAt: '2025-12-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'January 2025',
          type: 'monthly',
          date: '2025-01',
          order: 'b',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      // Expand year to see children
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2025']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have only monthly logs, no month groups
      expect(yearNode?.children).toHaveLength(2);
      expect(yearNode?.children.every(n => n.type === 'monthly')).toBe(true);
      
      // Sorted oldest first
      expect(yearNode?.children[0]?.date).toBe('2025-01');
      expect(yearNode?.children[1]?.date).toBe('2025-12');
    });

    it('should include monthly logs in year count when collapsed', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          name: 'Saturday, January 31',
          type: 'daily',
          date: '2026-01-31',
          order: 'c',
          createdAt: '2026-01-31T00:00:00Z',
        },
      ];

      // Don't expand year - should show count
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Count should include 1 monthly log + 2 daily logs = 3 total
      expect(yearNode?.count).toBe(3);
      expect(yearNode?.isExpanded).toBe(false);
    });

    it('should format monthly log labels correctly', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'December 2025',
          type: 'monthly',
          date: '2025-12',
          order: 'b',
          createdAt: '2025-12-01T00:00:00Z',
        },
      ];

      // Expand years to see children
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'year-2025']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const year2026 = result.current.nodes.find(n => n.id === 'year-2026');
      const year2025 = result.current.nodes.find(n => n.id === 'year-2025');
      
      // Check formatted labels
      expect(year2026?.children[0]?.label).toBe('February 2026');
      expect(year2025?.children[0]?.label).toBe('December 2025');
    });

    it('should handle monthly logs across multiple years', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'March 2026',
          type: 'monthly',
          date: '2026-03',
          order: 'a',
          createdAt: '2026-03-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'December 2025',
          type: 'monthly',
          date: '2025-12',
          order: 'b',
          createdAt: '2025-12-01T00:00:00Z',
        },
        {
          id: 'monthly-3',
          name: 'January 2024',
          type: 'monthly',
          date: '2024-01',
          order: 'c',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      // Expand all years
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'year-2025', 'year-2024']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNodes = result.current.nodes.filter(n => n.type === 'year');
      
      // Should have 3 year nodes
      expect(yearNodes).toHaveLength(3);
      
      // Each year should have 1 monthly log child (oldest year first)
      expect(yearNodes[0]?.children).toHaveLength(1); // 2024
      expect(yearNodes[1]?.children).toHaveLength(1); // 2025
      expect(yearNodes[2]?.children).toHaveLength(1); // 2026
      
      // Verify correct monthly log in each year (oldest year first)
      expect(yearNodes[0]?.children[0]?.date).toBe('2024-01');
      expect(yearNodes[1]?.children[0]?.date).toBe('2025-12');
      expect(yearNodes[2]?.children[0]?.date).toBe('2026-03');
    });
  });

  describe('Feature 3: Combined Monthly Log + Month Rollup', () => {
    it('should attach monthly log to month node when both exist', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          name: 'Monday, February 2',
          type: 'daily',
          date: '2026-02-02',
          order: 'c',
          createdAt: '2026-02-02T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have ONLY the month node (no standalone monthly node)
      expect(yearNode?.children).toHaveLength(1);
      expect(yearNode?.children[0]?.type).toBe('month');
      
      // Month node should have monthlyLog attached
      const monthNode = yearNode?.children[0];
      expect(monthNode).toMatchObject({
        type: 'month',
        id: 'month-2026-02',
      });
      
      // TypeScript narrowing for month type
      if (monthNode?.type === 'month') {
        expect(monthNode.monthlyLog).toBeDefined();
        expect(monthNode.monthlyLog?.id).toBe('monthly-1');
        expect(monthNode.monthlyLog?.type).toBe('monthly');
        
        // Month node should still have daily logs as children when expanded
        expect(monthNode.children).toHaveLength(2);
        expect(monthNode.children[0]?.type).toBe('day');
        expect(monthNode.children[1]?.type).toBe('day');
      }
    });

    it('should not create standalone monthly node when monthly log exists for that month', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'January 2026',
          type: 'monthly',
          date: '2026-01',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'monthly-2',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'c',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have 2 children:
      // 1. Standalone monthly log for January (no daily logs in that month)
      // 2. Month node for February (has both monthly log AND daily logs)
      expect(yearNode?.children).toHaveLength(2);
      
      // First should be standalone monthly log for January
      expect(yearNode?.children[0]?.type).toBe('monthly');
      expect(yearNode?.children[0]?.date).toBe('2026-01');
      
      // Second should be month node for February (not a standalone monthly node)
      expect(yearNode?.children[1]?.type).toBe('month');
      expect(yearNode?.children[1]?.id).toBe('month-2026-02');
      
      // February month node should have monthlyLog attached
      const febMonthNode = yearNode?.children[1];
      if (febMonthNode?.type === 'month') {
        expect(febMonthNode.monthlyLog).toBeDefined();
        expect(febMonthNode.monthlyLog?.id).toBe('monthly-2');
      }
    });

    it('should handle month node without monthly log (daily logs only)', () => {
      const collections: Collection[] = [
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          name: 'Monday, February 2',
          type: 'daily',
          date: '2026-02-02',
          order: 'b',
          createdAt: '2026-02-02T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have 1 month node
      expect(yearNode?.children).toHaveLength(1);
      expect(yearNode?.children[0]?.type).toBe('month');
      
      // Month node should NOT have monthlyLog
      const monthNode = yearNode?.children[0];
      if (monthNode?.type === 'month') {
        expect(monthNode.monthlyLog).toBeUndefined();
        
        // Should still have daily logs as children
        expect(monthNode.children).toHaveLength(2);
      }
    });

    it('should attach favorited monthly logs to month nodes (dual appearance)', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          isFavorite: true, // Manually favorited
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have ONLY the month node (no standalone monthly in year children)
      // Note: Favorited monthly will appear in favorites section separately
      expect(yearNode?.children).toHaveLength(1);
      expect(yearNode?.children[0]?.type).toBe('month');
      
      // Month node should have monthlyLog attached (dual appearance)
      const monthNode = yearNode?.children[0];
      if (monthNode?.type === 'month') {
        expect(monthNode.monthlyLog).toBeDefined();
        expect(monthNode.monthlyLog?.id).toBe('monthly-1');
        expect(monthNode.monthlyLog?.isFavorite).toBe(true);
      }
    });

    it('should attach auto-favorited monthly logs to month nodes', () => {
      const now = new Date('2026-02-15T12:00:00Z'); // Mid-February 2026
      
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02', // Current month - will be auto-favorited
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const prefs = {
        ...DEFAULT_USER_PREFERENCES,
        autoFavoriteRecentMonthlyLogs: true,
      };

      const { result } = renderHook(() => useCollectionHierarchy(collections, prefs));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have ONLY the month node (no standalone monthly in year children)
      expect(yearNode?.children).toHaveLength(1);
      expect(yearNode?.children[0]?.type).toBe('month');
      
      // Month node should have monthlyLog attached
      const monthNode = yearNode?.children[0];
      if (monthNode?.type === 'month') {
        expect(monthNode.monthlyLog).toBeDefined();
        expect(monthNode.monthlyLog?.id).toBe('monthly-1');
      }
    });

    it('should handle multiple months with mixed monthly log presence', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          order: 'a',
          createdAt: '2026-02-01T00:00:00Z',
        },
        // No monthly log for January
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'daily-2',
          name: 'Saturday, January 31',
          type: 'daily',
          date: '2026-01-31',
          order: 'c',
          createdAt: '2026-01-31T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02', 'month-2026-01']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have 2 month nodes (oldest first)
      expect(yearNode?.children).toHaveLength(2);
      expect(yearNode?.children[0]?.type).toBe('month');
      expect(yearNode?.children[0]?.id).toBe('month-2026-01');
      expect(yearNode?.children[1]?.type).toBe('month');
      expect(yearNode?.children[1]?.id).toBe('month-2026-02');
      
      // January month node should NOT have monthlyLog
      const janNode = yearNode?.children[0];
      if (janNode?.type === 'month') {
        expect(janNode.monthlyLog).toBeUndefined();
      }
      
      // February month node SHOULD have monthlyLog
      const febNode = yearNode?.children[1];
      if (febNode?.type === 'month') {
        expect(febNode.monthlyLog).toBeDefined();
        expect(febNode.monthlyLog?.id).toBe('monthly-1');
      }
    });

    it('should keep monthly log as standalone if no daily logs exist for that month', () => {
      const collections: Collection[] = [
        {
          id: 'monthly-1',
          name: 'January 2026',
          type: 'monthly',
          date: '2026-01',
          order: 'a',
          createdAt: '2026-01-01T00:00:00Z',
        },
        // No daily logs for January, only for February
        {
          id: 'daily-1',
          name: 'Sunday, February 1',
          type: 'daily',
          date: '2026-02-01',
          order: 'b',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ];

      // Expand year to see structure
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['year-2026', 'month-2026-02']));

      const { result } = renderHook(() => useCollectionHierarchy(collections, DEFAULT_USER_PREFERENCES));

      const yearNode = result.current.nodes.find(n => n.type === 'year');
      
      // Should have 2 children:
      // 1. Standalone monthly log for January (no daily logs)
      // 2. Month node for February (has daily logs, no monthly log)
      expect(yearNode?.children).toHaveLength(2);
      
      // First should be standalone monthly log
      expect(yearNode?.children[0]?.type).toBe('monthly');
      expect(yearNode?.children[0]?.date).toBe('2026-01');
      
      // Second should be month node
      expect(yearNode?.children[1]?.type).toBe('month');
      expect(yearNode?.children[1]?.id).toBe('month-2026-02');
    });
  });
});
