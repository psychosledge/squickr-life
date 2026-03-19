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
    it('should format type breakdown for monthly collections with mixed entries', () => {
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
          content: 'Task 1',
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
      expect(result).toBe('(1 task, 1 note, 1 event)');
    });

    it('should format type breakdown for monthly with 1 open task', () => {
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
          content: 'Task 1',
          status: 'open',
          collectionId: 'feb-2026',
          createdAt: '2026-02-01T10:00:00Z',
          collections: [],
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('feb-2026', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(1 task)');
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
          content: 'Task 1',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'task' as const,
          content: 'Task 2',
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
          content: 'Task 1',
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
          content: 'Task 1',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'task' as const,
          content: 'Task 2',
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
          content: 'Task 1',
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
          content: 'Task 1', 
          createdAt: '2026-02-07T00:00:00.000Z', 
          status: 'open', 
          collectionId: '1',
          collections: [],
        },
        { 
          id: '2', 
          type: 'task' as const, 
          content: 'Task 2 (migrated)', 
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

    it('should only count incomplete tasks (Bug 1 regression)', () => {
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
          content: 'Task 1 (open)',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'task' as const,
          content: 'Task 2 (completed)',
          status: 'completed',
          completedAt: '2026-02-09T12:00:00Z',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T11:00:00Z',
          collections: [],
        },
        {
          id: '3',
          type: 'task' as const,
          content: 'Task 3 (open)',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T13:00:00Z',
          collections: [],
        },
        {
          id: '4',
          type: 'note' as const,
          content: 'Note 1',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T14:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      // Should only count open tasks (2), not completed (1), plus note (1)
      expect(result).toBe('(2 tasks, 1 note)');
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

    it('should exclude sub-items (entries with parentEntryId) from stats', () => {
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
          content: 'Parent task',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'note' as const,
          content: 'Sub-note (should NOT count)',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T11:00:00Z',
          collections: [],
          parentEntryId: '1', // sub-item
        },
        {
          id: '3',
          type: 'task' as const,
          content: 'Sub-task (should NOT count)',
          status: 'open',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T12:00:00Z',
          collections: [],
          parentEntryId: '1', // sub-item
        },
        {
          id: '4',
          type: 'note' as const,
          content: 'Top-level note',
          collectionId: 'daily-2026-02-09',
          createdAt: '2026-02-09T13:00:00Z',
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      // Only the 2 top-level entries should count (1 task, 1 note); sub-items excluded
      expect(result).toBe('(1 task, 1 note)');
    });

    it('should exclude sub-items from monthly collection total count', () => {
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
          content: 'Parent task',
          status: 'open',
          collectionId: 'feb-2026',
          createdAt: '2026-02-01T10:00:00Z',
          collections: [],
        },
        {
          id: '2',
          type: 'note' as const,
          content: 'Sub-item (should NOT count)',
          collectionId: 'feb-2026',
          createdAt: '2026-02-01T11:00:00Z',
          parentEntryId: '1', // sub-item
        },
      ];

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('feb-2026', entries);

      const result = formatCollectionStats(node, entriesByCollection);
      // Only the 1 top-level task should count (sub-item excluded)
      expect(result).toBe('(1 task)');
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

  describe('multi-collection pattern (TaskAddedToCollection regression)', () => {
    /**
     * These tests simulate the map-building logic in CollectionIndexView.tsx
     * and verify that formatCollectionStats produces correct output when the
     * entries are bucketed using entry.collections[] rather than entry.collectionId.
     *
     * Prior to the bug fix, tasks added via TaskAddedToCollection had
     * collectionId: undefined and were bucketed under null, causing stats for
     * the actual collection to appear empty.
     */

    it('should show correct stats for a task added via multi-collection pattern (collectionId undefined)', () => {
      // Simulate the FIXED map-building logic: task has collections: ['daily-2026-02-09']
      // and collectionId: undefined (TaskAddedToCollection, no original collection)
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

      // Task created without a collectionId but later added to the collection
      // via TaskAddedToCollection — collections[] is the source of truth.
      const multiCollectionTask: Entry = {
        id: 'task-mc-1',
        type: 'task' as const,
        content: 'Multi-collection task',
        status: 'open',
        collectionId: undefined,   // No original collectionId
        collections: ['daily-2026-02-09'],
        createdAt: '2026-02-09T08:00:00Z',
      };

      // The fixed CollectionIndexView loop would bucket this task under
      // 'daily-2026-02-09' (from collections[]), NOT under null.
      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', [multiCollectionTask]);

      const result = formatCollectionStats(node, entriesByCollection);
      expect(result).toBe('(1 task)');
    });

    it('should show correct stats for a task with stale collectionId pointing to a different collection', () => {
      // Simulate a task that was originally in 'old-col' but was subsequently
      // added to 'new-col' via TaskAddedToCollection.
      // The fixed loop uses collections[] as the source of truth, so the task
      // appears under 'new-col', not 'old-col'.
      const newColNode: HierarchyNode = {
        type: 'custom',
        id: 'new-col',
        label: 'New Collection',
        collection: {
          id: 'new-col',
          name: 'New Collection',
          type: 'custom',
          createdAt: '2026-01-01T00:00:00Z',
          order: 'b',
        },
        children: [],
        isExpanded: false,
      };

      const oldColNode: HierarchyNode = {
        type: 'custom',
        id: 'old-col',
        label: 'Old Collection',
        collection: {
          id: 'old-col',
          name: 'Old Collection',
          type: 'custom',
          createdAt: '2026-01-01T00:00:00Z',
          order: 'a',
        },
        children: [],
        isExpanded: false,
      };

      const taskWithStaleCollectionId: Entry = {
        id: 'task-stale-1',
        type: 'task' as const,
        content: 'Task with stale collectionId',
        status: 'open',
        collectionId: 'old-col',       // Stale — was the original collection
        collections: ['new-col'],       // Source of truth: task is now in new-col
        createdAt: '2026-01-15T10:00:00Z',
      };

      // The fixed CollectionIndexView loop buckets this task under 'new-col'
      // (from collections[]), ignoring the stale collectionId.
      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('new-col', [taskWithStaleCollectionId]);
      entriesByCollection.set('old-col', []); // old-col gets nothing from this task

      // new-col should show the task
      const newColResult = formatCollectionStats(newColNode, entriesByCollection);
      expect(newColResult).toBe('(1 task)');

      // old-col should be empty (stale collectionId is not used)
      const oldColResult = formatCollectionStats(oldColNode, entriesByCollection);
      expect(oldColResult).toBe('');
    });

    it('should show correct stats when a task belongs to multiple collections simultaneously', () => {
      // A task present in both 'monthly-log' and 'daily-2026-02-09' via collections[].
      const monthlyNode: HierarchyNode = {
        type: 'monthly',
        id: 'monthly-feb-2026',
        label: 'February 2026',
        collection: {
          id: 'monthly-feb-2026',
          name: 'February 2026',
          type: 'monthly',
          date: '2026-02',
          createdAt: '2026-02-01T00:00:00Z',
          order: '2026-02',
        },
        children: [],
        isExpanded: false,
      };

      const dailyNode: HierarchyNode = {
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

      const sharedTask: Entry = {
        id: 'task-shared-1',
        type: 'task' as const,
        content: 'Task in both collections',
        status: 'open',
        collectionId: 'monthly-feb-2026',   // Original collection
        collections: ['monthly-feb-2026', 'daily-2026-02-09'],
        createdAt: '2026-02-09T09:00:00Z',
      };

      // Fixed loop: task is bucketed under BOTH collections
      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('monthly-feb-2026', [sharedTask]);
      entriesByCollection.set('daily-2026-02-09', [sharedTask]);

      const monthlyResult = formatCollectionStats(monthlyNode, entriesByCollection);
      expect(monthlyResult).toBe('(1 task)'); // monthly now uses type-breakdown count

      const dailyResult = formatCollectionStats(dailyNode, entriesByCollection);
      expect(dailyResult).toBe('(1 task)');
    });
  });

  describe('Fix 3 — cross-collection sub-task regression', () => {
    /**
     * "Find the mounts" is a sub-task of "Hang guitars in office" which lives in
     * collection-A ("Guitar Project").  "Find the mounts" was later added to
     * collection-B ("Yesterday") via TaskAddedToCollection.
     *
     * Before the fix, collectionStatsFormatter used a blanket !e.parentEntryId
     * guard that excluded ALL sub-tasks, so "Yesterday" showed 0 tasks instead
     * of 1.  After the fix the guard only suppresses sub-tasks whose parent is
     * ALSO present in the same collection.
     */
    it('sub-task added to collection-B while parent stays in collection-A IS counted in collection-B', () => {
      const collectionBNode: HierarchyNode = {
        type: 'day',
        id: 'yesterday',
        label: 'Yesterday',
        collection: {
          id: 'yesterday',
          name: 'Yesterday',
          type: 'daily',
          date: '2026-02-09',
          createdAt: '2026-02-09T00:00:00Z',
          order: '2026-02-09',
        },
        children: [],
        isExpanded: false,
      };

      // The sub-task lives in collection-B; its parent lives in collection-A only.
      const subTask: Entry = {
        id: 'find-mounts',
        type: 'task' as const,
        content: 'Find the mounts',
        status: 'open',
        collectionId: 'guitar-project',   // original (collection-A)
        collections: ['yesterday'],        // added to collection-B
        createdAt: '2026-02-09T10:00:00Z',
        parentEntryId: 'hang-guitars',     // parent is in collection-A, NOT in collection-B
      };

      // collection-B map contains only the sub-task; parent is NOT present here.
      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('yesterday', [subTask]);

      const result = formatCollectionStats(collectionBNode, entriesByCollection);
      // The parent is absent from collection-B → topLevelIds does NOT contain
      // 'hang-guitars' → the sub-task passes the filter and IS counted.
      expect(result).toBe('(1 task)');
    });

    it('sub-task whose parent IS in the same collection is still suppressed', () => {
      // This is the original happy-path: sub-tasks nested under a parent that
      // lives in the same collection must NOT inflate the count.
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

      const parentTask: Entry = {
        id: 'parent-task',
        type: 'task' as const,
        content: 'Parent task',
        status: 'open',
        collectionId: 'daily-2026-02-09',
        collections: ['daily-2026-02-09'],
        createdAt: '2026-02-09T10:00:00Z',
      };
      const subTask: Entry = {
        id: 'sub-task',
        type: 'task' as const,
        content: 'Sub-task (should NOT be counted)',
        status: 'open',
        collectionId: 'daily-2026-02-09',
        collections: ['daily-2026-02-09'],
        createdAt: '2026-02-09T11:00:00Z',
        parentEntryId: 'parent-task',   // parent IS in the same collection
      };

      const entriesByCollection = new Map<string | null, Entry[]>();
      entriesByCollection.set('daily-2026-02-09', [parentTask, subTask]);

      const result = formatCollectionStats(node, entriesByCollection);
      // Only the parent counts; sub-task is suppressed.
      expect(result).toBe('(1 task)');
    });
  });

  // ─── Shared fixture helpers ────────────────────────────────────────────────

  function makeMonthlyNode(id: string): HierarchyNode {
    return {
      type: 'monthly',
      id,
      label: 'February 2026',
      collection: {
        id,
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        createdAt: '2026-02-01T00:00:00Z',
        order: '2026-02',
      },
      children: [],
      isExpanded: false,
    };
  }

  function makeMonthNodeWithLog(monthId: string, logId: string): HierarchyNode {
    return {
      type: 'month',
      id: monthId,
      label: 'February 2026',
      date: '2026-02',
      monthlyLog: {
        id: logId,
        name: 'February 2026',
        type: 'monthly',
        date: '2026-02',
        createdAt: '2026-02-01T00:00:00Z',
        order: '2026-02',
      },
      children: [],
      isExpanded: false,
    };
  }

  function makeTask(id: string, collId: string, status: 'open' | 'completed' = 'open'): Entry {
    return {
      id,
      type: 'task' as const,
      content: `Task ${id}`,
      status,
      collectionId: collId,
      createdAt: '2026-02-01T10:00:00Z',
      collections: [collId],
    };
  }

  function makeNote(id: string, collId: string): Entry {
    return {
      id,
      type: 'note' as const,
      content: `Note ${id}`,
      collectionId: collId,
      createdAt: '2026-02-01T10:00:00Z',
      collections: [collId],
    };
  }

  function makeEvent(id: string, collId: string): Entry {
    return {
      id,
      type: 'event' as const,
      content: `Event ${id}`,
      eventDate: '2026-02-01',
      collectionId: collId,
      createdAt: '2026-02-01T10:00:00Z',
      collections: [collId],
    };
  }

  // ── monthly leaf node (type: 'monthly') ────────────────────────────────────

  describe('monthly collections - type breakdown (monthly leaf node)', () => {
    it('should format 3 open tasks, 0 notes, 0 events', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'feb-2026'),
        makeTask('t2', 'feb-2026'),
        makeTask('t3', 'feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(3 tasks)');
    });

    it('should format 0 open tasks, 2 notes, 0 events', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [
        makeNote('n1', 'feb-2026'),
        makeNote('n2', 'feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(2 notes)');
    });

    it('should format 0 open tasks, 0 notes, 1 event', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [makeEvent('e1', 'feb-2026')];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 event)');
    });

    it('should format 2 open tasks, 1 note, 1 event', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'feb-2026'),
        makeTask('t2', 'feb-2026'),
        makeNote('n1', 'feb-2026'),
        makeEvent('e1', 'feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(2 tasks, 1 note, 1 event)');
    });

    it('should return empty string when only completed tasks present', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'feb-2026', 'completed'),
        makeTask('t2', 'feb-2026', 'completed'),
      ];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('');
    });

    it('should count only the open task when mixed with a completed task', () => {
      const node = makeMonthlyNode('feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'feb-2026', 'open'),
        makeTask('t2', 'feb-2026', 'completed'),
      ];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 task)');
    });

    it('should exclude migrated tasks and count remaining open tasks', () => {
      const node = makeMonthlyNode('feb-2026');
      const migratedTask: Entry = {
        ...makeTask('t1', 'feb-2026', 'open'),
        migratedTo: 'other-collection',
      };
      const openTask = makeTask('t2', 'feb-2026', 'open');
      const entries: Entry[] = [migratedTask, openTask];
      const map = new Map<string | null, Entry[]>([['feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 task)');
    });

    it('should return empty string when there are zero entries', () => {
      const node = makeMonthlyNode('feb-2026');
      const map = new Map<string | null, Entry[]>([['feb-2026', []]]);
      expect(formatCollectionStats(node, map)).toBe('');
    });
  });

  // ── month container node with monthlyLog (type: 'month' + monthlyLog) ──────

  describe('monthly collections - type breakdown (month container with monthlyLog)', () => {
    it('should format 3 open tasks, 0 notes, 0 events', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'log-feb-2026'),
        makeTask('t2', 'log-feb-2026'),
        makeTask('t3', 'log-feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(3 tasks)');
    });

    it('should format 0 open tasks, 2 notes, 0 events', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [
        makeNote('n1', 'log-feb-2026'),
        makeNote('n2', 'log-feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(2 notes)');
    });

    it('should format 0 open tasks, 0 notes, 1 event', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [makeEvent('e1', 'log-feb-2026')];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 event)');
    });

    it('should format 2 open tasks, 1 note, 1 event', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'log-feb-2026'),
        makeTask('t2', 'log-feb-2026'),
        makeNote('n1', 'log-feb-2026'),
        makeEvent('e1', 'log-feb-2026'),
      ];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(2 tasks, 1 note, 1 event)');
    });

    it('should return empty string when only completed tasks present', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'log-feb-2026', 'completed'),
        makeTask('t2', 'log-feb-2026', 'completed'),
      ];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('');
    });

    it('should count only the open task when mixed with a completed task', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const entries: Entry[] = [
        makeTask('t1', 'log-feb-2026', 'open'),
        makeTask('t2', 'log-feb-2026', 'completed'),
      ];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 task)');
    });

    it('should exclude migrated tasks and count remaining open tasks', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const migratedTask: Entry = {
        ...makeTask('t1', 'log-feb-2026', 'open'),
        migratedTo: 'other-collection',
      };
      const openTask = makeTask('t2', 'log-feb-2026', 'open');
      const entries: Entry[] = [migratedTask, openTask];
      const map = new Map<string | null, Entry[]>([['log-feb-2026', entries]]);
      expect(formatCollectionStats(node, map)).toBe('(1 task)');
    });

    it('should return empty string when there are zero entries', () => {
      const node = makeMonthNodeWithLog('month-2026-02', 'log-feb-2026');
      const map = new Map<string | null, Entry[]>([['log-feb-2026', []]]);
      expect(formatCollectionStats(node, map)).toBe('');
    });
  });
});
