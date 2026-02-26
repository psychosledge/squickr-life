import { describe, it, expect } from 'vitest';
import { getNavigationCollections } from './collectionNavigation';
import type { Entry } from '@squickr/domain';

describe('getNavigationCollections', () => {
  it('should return active collections excluding current collection', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15', 'yesterday-feb-14'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: false },
    ]);
  });

  it('should return ghost collections from collectionHistory with removedAt', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z' },
        { collectionId: 'yesterday-feb-14', addedAt: '2026-02-14T10:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
        { collectionId: 'today-feb-15', addedAt: '2026-02-15T10:00:00Z' },
      ],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: true },
    ]);
  });

  it('should prioritize active over ghost when collection appears in both', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z', removedAt: '2026-02-10T10:00:00Z' },
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-11T10:00:00Z' },
      ],
    };

    const result = getNavigationCollections(entry, null);

    // Should show as active (not ghost) since it's in collections array
    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
    ]);
  });

  it('should handle legacy migratedTo pattern', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
      migratedTo: 'task-2',
      migratedToCollectionId: 'tomorrow-feb-16',
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'tomorrow-feb-16', isGhost: false },
    ]);
  });

  it('should handle legacy migratedFrom pattern', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
      migratedFrom: 'task-0',
      migratedFromCollectionId: 'yesterday-feb-14',
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'yesterday-feb-14', isGhost: true },
    ]);
  });

  it('should de-duplicate collections from multiple sources', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15'],
      collectionHistory: [
        { collectionId: 'monthly-feb-2026', addedAt: '2026-02-01T10:00:00Z' },
        { collectionId: 'yesterday-feb-14', addedAt: '2026-02-14T10:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
      ],
      migratedTo: 'task-2',
      migratedToCollectionId: 'today-feb-15', // Duplicate of collections[1]
    };

    const result = getNavigationCollections(entry, null);

    // Should not have duplicates
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { collectionId: 'monthly-feb-2026', isGhost: false },
        { collectionId: 'today-feb-15', isGhost: false },
        { collectionId: 'yesterday-feb-14', isGhost: true },
      ])
    );
  });

  it('should exclude currentCollectionId from results', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026', 'today-feb-15', 'yesterday-feb-14'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'monthly-feb-2026');

    expect(result).toEqual([
      { collectionId: 'today-feb-15', isGhost: false },
      { collectionId: 'yesterday-feb-14', isGhost: false },
    ]);
    expect(result).not.toContainEqual({ collectionId: 'monthly-feb-2026', isGhost: false });
  });

  it('should handle null currentCollectionId (uncategorized view)', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['monthly-feb-2026'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'monthly-feb-2026', isGhost: false },
    ]);
  });

  it('should return empty array when entry only in current collection', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: ['today-feb-15'],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, 'today-feb-15');

    expect(result).toEqual([]);
  });

  it('should handle entries with no collections or history', () => {
    const entry: Entry = {
      id: 'task-1',
      type: 'task',
      title: 'Test Task',
      status: 'open',
      createdAt: '2026-02-15T10:00:00Z',
      collections: [],
      collectionHistory: [],
    };

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([]);
  });

  it('should handle legacy entries without collections array but with migratedTo', () => {
    // Legacy task entries may not have collections array
    const entry = {
      id: 'task-1',
      type: 'task' as const,
      title: 'Test Task',
      status: 'open' as const,
      createdAt: '2026-02-15T10:00:00Z',
      migratedTo: 'task-2',
      migratedToCollectionId: 'tomorrow-feb-16',
    } as Entry;

    const result = getNavigationCollections(entry, null);

    expect(result).toEqual([
      { collectionId: 'tomorrow-feb-16', isGhost: false },
    ]);
  });

  it('should handle legacy entries with migratedToCollectionId undefined', () => {
    // When migratedToCollectionId is undefined, treat as uncategorized (null)
    // When viewing from global view (undefined), should show navigation to uncategorized
    const entry = {
      id: 'task-1',
      type: 'task' as const,
      title: 'Test Task',
      status: 'open' as const,
      createdAt: '2026-02-15T10:00:00Z',
      migratedTo: 'task-2',
      migratedToCollectionId: undefined,
    } as Entry;

    const result = getNavigationCollections(entry, undefined);

    expect(result).toEqual([
      { collectionId: null, isGhost: false },
    ]);
  });

  // ─── Last-Hop Ghost Link Tests ────────────────────────────────────────────

  describe('last-hop ghost link algorithm', () => {
    it('should show zero ghost links when entry has no history (created in current collection)', () => {
      // Entry created directly in 'col-c', never moved
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-c'],
        collectionHistory: [
          { collectionId: 'col-c', addedAt: '2026-02-15T08:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-c');

      expect(result).toEqual([]);
    });

    it('should show one ghost link for a single hop (A → B, viewing B)', () => {
      // Created in A, moved to B
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-b'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T10:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-b');

      expect(result).toEqual([
        { collectionId: 'col-a', isGhost: true },
      ]);
    });

    it('should show only the LAST hop for a multi-hop chain (A→B→C→D, viewing D)', () => {
      // Chain: A → B → C → D (current)
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-d'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z', removedAt: '2026-02-15T11:00:00Z' },
          { collectionId: 'col-d', addedAt: '2026-02-15T11:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-d');

      // Only C (the most recent predecessor), not A or B
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ collectionId: 'col-c', isGhost: true });
    });

    it('should show correct ghost when viewing a non-final collection (A→B→C→D, viewing C)', () => {
      // Viewing C: active = D, ghost = B (predecessor of C)
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-d'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z', removedAt: '2026-02-15T11:00:00Z' },
          { collectionId: 'col-d', addedAt: '2026-02-15T11:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-c');

      expect(result).toEqual(
        expect.arrayContaining([
          { collectionId: 'col-d', isGhost: false }, // active: current home of the entry
          { collectionId: 'col-b', isGhost: true },  // ghost: last hop before C
        ])
      );
      expect(result).toHaveLength(2);
      // col-a must NOT appear (it's not the last hop before C)
      expect(result).not.toContainEqual({ collectionId: 'col-a', isGhost: true });
    });

    it('should show correct ghost when viewing B in chain (A→B→C→D, viewing B)', () => {
      // Viewing B: active = D, ghost = A
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-d'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z', removedAt: '2026-02-15T11:00:00Z' },
          { collectionId: 'col-d', addedAt: '2026-02-15T11:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-b');

      expect(result).toEqual(
        expect.arrayContaining([
          { collectionId: 'col-d', isGhost: false }, // active: current home
          { collectionId: 'col-a', isGhost: true },  // ghost: last hop before B
        ])
      );
      expect(result).toHaveLength(2);
      // col-c must NOT appear (it's after B, not before)
      expect(result).not.toContainEqual({ collectionId: 'col-c', isGhost: true });
    });

    it('should show zero ghost links when viewing origin (A→B→C→D, viewing A)', () => {
      // Viewing A: active = D, ghost = none (A was created here, no predecessor)
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-d'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z', removedAt: '2026-02-15T11:00:00Z' },
          { collectionId: 'col-d', addedAt: '2026-02-15T11:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-a');

      // Only active link to col-d, no ghost links
      expect(result).toEqual([
        { collectionId: 'col-d', isGhost: false },
      ]);
    });

    it('should fall through to legacy migratedFrom when collectionHistory is absent', () => {
      // No collectionHistory at all → legacy fallback
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T10:00:00Z',
        collections: [],
        collectionHistory: [],
        migratedFrom: 'task-0',
        migratedFromCollectionId: 'yesterday-feb-14',
      };

      const result = getNavigationCollections(entry, null);

      expect(result).toEqual([
        { collectionId: 'yesterday-feb-14', isGhost: true },
      ]);
    });

    it('should use entry.createdAt as arrivedAt when current collection has no history entry', () => {
      // Simulate an edge case: current collection not found in history
      // (e.g. history was partially recorded). Should use createdAt as fallback.
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T11:00:00Z',
        collections: ['col-d'],
        collectionHistory: [
          // col-a, col-b removed before createdAt — only col-b is the last hop
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          // col-d not in history (missing), so arrivedAt falls back to createdAt = 11:00
        ],
      };

      const result = getNavigationCollections(entry, 'col-d');

      // col-b is the most recent removal before createdAt (11:00)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ collectionId: 'col-b', isGhost: true });
    });

    it('should not show ghost links for entries with only active collections (no removedAt)', () => {
      // Task in multiple active collections, none removed
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T10:00:00Z',
        collections: ['col-a', 'col-b'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z' },
        ],
      };

      const result = getNavigationCollections(entry, 'col-a');

      expect(result).toEqual([
        { collectionId: 'col-b', isGhost: false },
      ]);
      // No ghost links at all
      expect(result.some(r => r.isGhost)).toBe(false);
    });

    it('should handle re-add cycle (A→B→A, viewing A) — ghost should be B', () => {
      // Entry created in A, moved to B, then moved back to A.
      // History has two entries for col-a: the original (removedAt=09:00) and the re-add (no removedAt).
      // arrivedAtCurrentAt = most recent addedAt for col-a = 10:00
      // candidates: col-b (removedAt=10:00 ≤ 10:00) ✅, old col-a entry excluded (same id as current)
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-a'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-a', addedAt: '2026-02-15T10:00:00Z' }, // re-added, no removedAt
        ],
      };

      const result = getNavigationCollections(entry, 'col-a');

      // Ghost should be col-b (the last hop before re-arriving at col-a)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ collectionId: 'col-b', isGhost: true });
    });

    it('should handle Note entries — no ghost links, no crash', () => {
      // Notes have no collectionHistory and no collections[] — only legacy fields
      const entry: Entry = {
        id: 'note-1',
        type: 'note',
        content: 'A note',
        createdAt: '2026-02-15T10:00:00Z',
        collections: [],
      };

      const result = getNavigationCollections(entry, 'col-a');

      expect(result).toEqual([]);
    });

    it('should handle Event entries with legacy migratedFrom — ghost link shown', () => {
      // Events have no collectionHistory — fall through to legacy fallback
      const entry: Entry = {
        id: 'event-1',
        type: 'event',
        content: 'An event',
        eventDate: '2026-02-15',
        createdAt: '2026-02-15T10:00:00Z',
        migratedFrom: 'event-0',
        migratedFromCollectionId: 'yesterday-feb-14',
        collections: [],
      };

      const result = getNavigationCollections(entry, null);

      expect(result).toEqual([
        { collectionId: 'yesterday-feb-14', isGhost: true },
      ]);
    });

    // ─── Regression: A→B→C last-hop ghost for legacy (self-ref migratedFrom) ──

    it('should NOT show a ghost link when viewing origin collection A (A→B→C, self-ref migratedFrom)', () => {
      // This is the UAT failure: a modern-format entry moved A→B→C has
      // collectionHistory + a self-reference migratedFrom set by TaskAddedToCollection.
      // When viewing Collection A (the origin), step 4 (legacy) was incorrectly
      // adding migratedFromCollectionId=B as a ghost even though B is the LAST
      // collection the entry was in, not a predecessor of A.
      //
      // The entry lives in col-c (current home). collectionHistory records A→B→C.
      // TaskAddedToCollection sets migratedFrom=entry.id (self-ref) and
      // migratedFromCollectionId=col-b (most recent removal = B, because B→C was last move).
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-c'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z' },
        ],
        // Self-reference migratedFrom (set by TaskAddedToCollection on last move B→C)
        migratedFrom: 'task-1', // same as entry.id
        migratedFromCollectionId: 'col-b', // most recent removal
      };

      const result = getNavigationCollections(entry, 'col-a');

      // col-c is active (current home), no ghost (A is the origin — no predecessor)
      expect(result).toEqual([
        { collectionId: 'col-c', isGhost: false },
      ]);
      // Critically: col-b must NOT appear as a ghost when viewing col-a
      expect(result).not.toContainEqual({ collectionId: 'col-b', isGhost: true });
    });

    it('should show correct ghost when viewing middle collection B (A→B→C, self-ref migratedFrom)', () => {
      // Same entry as above but viewing col-b. Expected: active=col-c, ghost=col-a.
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-c'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z' },
        ],
        migratedFrom: 'task-1',
        migratedFromCollectionId: 'col-b',
      };

      const result = getNavigationCollections(entry, 'col-b');

      expect(result).toEqual(
        expect.arrayContaining([
          { collectionId: 'col-c', isGhost: false }, // active: current home
          { collectionId: 'col-a', isGhost: true },  // ghost: last hop before B
        ])
      );
      expect(result).toHaveLength(2);
    });

    it('should show correct ghost when viewing destination C (A→B→C, self-ref migratedFrom)', () => {
      // Viewing col-c (current home). Expected: ghost=col-b (last hop before C).
      const entry: Entry = {
        id: 'task-1',
        type: 'task',
        title: 'Test Task',
        status: 'open',
        createdAt: '2026-02-15T08:00:00Z',
        collections: ['col-c'],
        collectionHistory: [
          { collectionId: 'col-a', addedAt: '2026-02-15T08:00:00Z', removedAt: '2026-02-15T09:00:00Z' },
          { collectionId: 'col-b', addedAt: '2026-02-15T09:00:00Z', removedAt: '2026-02-15T10:00:00Z' },
          { collectionId: 'col-c', addedAt: '2026-02-15T10:00:00Z' },
        ],
        migratedFrom: 'task-1',
        migratedFromCollectionId: 'col-b',
      };

      const result = getNavigationCollections(entry, 'col-c');

      // Only ghost=col-b (the last hop), no active links (col-c is current)
      expect(result).toEqual([
        { collectionId: 'col-b', isGhost: true },
      ]);
    });
  });
});
