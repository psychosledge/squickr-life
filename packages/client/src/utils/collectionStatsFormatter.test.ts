import { describe, it, expect } from 'vitest';
import { formatCollectionStats } from './collectionStatsFormatter';
import type { HierarchyNode } from '../hooks/useCollectionHierarchy';
import type { Entry } from '@squickr/domain';

describe('formatCollectionStats', () => {
  describe('container nodes (no collection)', () => {
    it('should format count for container nodes with logs', () => {
      const node: HierarchyNode = {
        type: 'year',
        id: 'year-2026',
        label: '2026',
        count: 3,
        children: [],
        isExpanded: false,
      };

      const result = formatCollectionStats(node);
      expect(result).toBe('(3 logs)');
    });

    it('should use singular "log" for count of 1', () => {
      const node: HierarchyNode = {
        type: 'year',
        id: 'year-2026',
        label: '2026',
        count: 1,
        children: [],
        isExpanded: false,
      };

      const result = formatCollectionStats(node);
      expect(result).toBe('(1 log)');
    });

    it('should return empty string when count is undefined', () => {
      const node: HierarchyNode = {
        type: 'year',
        id: 'year-2026',
        label: '2026',
        children: [],
        isExpanded: false,
      };

      const result = formatCollectionStats(node);
      expect(result).toBe('');
    });

    it('should return empty string when count is 0', () => {
      const node: HierarchyNode = {
        type: 'year',
        id: 'year-2026',
        label: '2026',
        count: 0,
        children: [],
        isExpanded: false,
      };

      const result = formatCollectionStats(node);
      expect(result).toBe('(0 logs)');
    });
  });

  describe('monthly collections', () => {
    it('should format total entry count for monthly collections', () => {
      const node: HierarchyNode = {
        type: 'monthly',
        id: 'feb-2026',
        label: 'February 2026',
        collection: {
          id: 'feb-2026',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          createdAt: '2026-02-01T00:00:00Z',
          order: '2026-02',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'feb-2026',
          createdAt: '2026-02-01T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'note' as const,
          content: 'Note 1',
          collectionId: 'feb-2026',
          createdAt: '2026-02-02T10:00:00Z',
        },
        {
          id: '3',
          type: 'event' as const,
          content: 'Event 1',
          eventDate: '2026-02-03',
          collectionId: 'feb-2026',
          createdAt: '2026-02-03T10:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('feb-2026', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(3 entries)');
    });

    it('should use singular "entry" for monthly with 1 entry', () => {
      const node: HierarchyNode = {
        type: 'monthly',
        id: 'feb-2026',
        label: 'February 2026',
        collection: {
          id: 'feb-2026',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          createdAt: '2026-02-01T00:00:00Z',
          order: '2026-02',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'feb-2026',
          createdAt: '2026-02-01T10:00:00Z',
          collections: [],
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('feb-2026', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(1 entry)');
    });

    it('should return empty string for monthly with no entries', () => {
      const node: HierarchyNode = {
        type: 'monthly',
        id: 'feb-2026',
        label: 'February 2026',
        collection: {
          id: 'feb-2026',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          createdAt: '2026-02-01T00:00:00Z',
          order: '2026-02',
        },
        children: [],
        isExpanded: false,
      };

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('feb-2026', []);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('');
    });
  });

  describe('daily and custom collections (breakdown by type)', () => {
    it('should format breakdown for daily collection with mixed entries', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'task' as const,
          title: 'Task 2',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T11:00:00Z',
          collections: [],
        },
        {
          id: '3',
          type: 'note' as const,
          content: 'Note 1',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T12:00:00Z',
        },
        {
          id: '4',
          type: 'event' as const,
          content: 'Event 1',
          eventDate: '2026-02-09',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T13:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(2 tasks, 1 note, 1 event)');
    });

    it('should use singular forms when count is 1', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'note' as const,
          content: 'Note 1',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T11:00:00Z',
        },
        {
          id: '3',
          type: 'event' as const,
          content: 'Event 1',
          eventDate: '2026-02-09',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T12:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(1 task, 1 note, 1 event)');
    });

    it('should omit types with zero count', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'task' as const,
          title: 'Task 2',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T11:00:00Z',
          collections: [],
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(2 tasks)');
    });

    it('should return empty string for daily collection with no entries', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', []);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('');
    });

    it('should work for custom collections', () => {
      const node: HierarchyNode = {
        type: 'custom',
        id: 'work-projects',
        label: 'Work Projects',
        collection: {
          id: 'work-projects',
          name: 'Work Projects',
          type: 'custom',
          createdAt: '2026-01-01T00:00:00Z',
          order: 'a',
        },
        children: [],
        isExpanded: false,
      };

      const entries: Entry[] = [
        {
          id: '1',
          type: 'task' as const,
          title: 'Task 1',
          status: 'open',
          collectionId: 'work-projects',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'note' as const,
          content: 'Note 1',
          collectionId: 'work-projects',
          createdAt: '2026-02-09T11:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('work-projects', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(1 task, 1 note)');
    });
  });

  describe('edge cases', () => {
    it('should exclude migrated entries from stats', () => {
      const node: HierarchyNode = {
        id: 'day-1',
        label: 'Feb 7, 2026',
        type: 'day',
        isExpanded: false,
        children: [],
        collection: { id: '1', name: 'Feb 7', type: 'daily', createdAt: '2026-02-07T00:00:00.000Z', order: 'a', date: '2026-02-07' },
      };
      const entries: Entry[] = [
        { 
          id: '1', 
          type: 'task' as const, 
          title: 'Task 1', 
          createdAt: '2026-02-07T00:00:00.000Z', 
          status: 'open', 
          collectionId: '1',
          collections: [],
        },
        { 
          id: '2', 
          type: 'task' as const, 
          title: 'Task 2 (migrated)', 
          createdAt: '2026-02-07T00:00:00.000Z', 
          status: 'open', 
          collectionId: '1',
          collections: [],
          migratedTo: 'other-collection',
        },
        { 
          id: '3', 
          type: 'note' as const, 
          content: 'Note 1', 
          createdAt: '2026-02-07T00:00:00.000Z', 
          collectionId: '1',
        },
      ];
      // Should only count non-migrated entries (1 task, 1 note)
      expect(formatCollectionStats(node, new Map([['1', entries]]))).toBe('(1 task, 1 note)');
    });

    it('should handle missing entriesByCollection map', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const result = formatCollectionStats(node);
      expect(result).toBe('');
    });

    it('should handle collection not in entriesByCollection map', () => {
      const node: HierarchyNode = {
        type: 'day',
        id: 'daily-2026-02-09',
        label: 'Feb 9, 2026',
        collection: {
          id: 'daily-2026-02-09',
          name: 'Feb 9, 2026',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      const entriesByCollection = new Map<string | null, Entry[]>();
      // Don't add the collection to the map

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('');
    });
  });
});
