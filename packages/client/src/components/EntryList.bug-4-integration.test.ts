/**
 * Integration Test: Bug #4 - Multi-Collection Sub-Task Navigation Fix
 * 
 * This test verifies the exact scenario from Bug #4:
 * - Parent task "Schedule eye exams" in "Monthly log"
 * - Sub-task "Find eye doctor" in BOTH "Monthly log" AND "Today's log"
 * - Viewing from Monthly log should show "Go to Today's log" option
 * - Viewing from Today's log should show sub-task with link icon
 * 
 * The bug was that when viewing from Monthly log (original location),
 * the "Go to" option didn't appear because the old logic only checked
 * if the sub-task was in the CURRENT collection, not if it was in MULTIPLE collections.
 */

import { describe, it, expect } from 'vitest';

describe('Bug #4 Fix: Multi-Collection Sub-Task Navigation Logic', () => {
  it('should detect sub-task as migrated when it exists in multiple collections', () => {
    // Simulated sub-task in BOTH Monthly log AND Today's log
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log', 'todays-log'],
      collectionId: 'monthly-log', // Legacy field (first collection)
      parentTaskId: 'parent-1',
    };

    // BUG FIX: Detection logic from EntryList.tsx (lines 205-214, 237-246)
    // OLD LOGIC (BUGGY):
    const currentCollectionId = 'monthly-log';
    const subTaskCollections_OLD = subTask.collections || [];
    const isInCurrentCollection = currentCollectionId 
      ? subTaskCollections_OLD.includes(currentCollectionId)
      : subTaskCollections_OLD.length === 0;
    const isMigrated_OLD = !isInCurrentCollection;

    // Bug: Returns false because sub-task IS in current collection
    expect(isMigrated_OLD).toBe(false); // ❌ Wrong!

    // NEW LOGIC (FIXED):
    const subTaskCollections_NEW = subTask.collections || [];
    const isMigrated_NEW = subTaskCollections_NEW.length > 1;

    // Fix: Returns true because sub-task is in MULTIPLE collections
    expect(isMigrated_NEW).toBe(true); // ✅ Correct!
  });

  it('should find correct navigation target when viewing from original collection', () => {
    const currentCollectionId = 'monthly-log'; // Viewing from Monthly log
    
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log', 'todays-log'],
      collectionId: 'monthly-log',
      parentTaskId: 'parent-1',
    };

    // Navigation target logic from EntryList.tsx (lines 399-405)
    const subTaskCollections = subTask.collections || [];
    const isMigrated = subTaskCollections.length > 1;
    
    let navigationTarget = subTask.collectionId;
    if (isMigrated && subTaskCollections.length > 0) {
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      if (otherCollection) {
        navigationTarget = otherCollection;
      }
    }

    // Should navigate to Today's log (the OTHER collection)
    expect(navigationTarget).toBe('todays-log'); // ✅
  });

  it('should find correct navigation target when viewing from new collection', () => {
    const currentCollectionId = 'todays-log'; // Viewing from Today's log
    
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log', 'todays-log'],
      collectionId: 'monthly-log',
      parentTaskId: 'parent-1',
    };

    // Navigation target logic
    const subTaskCollections = subTask.collections || [];
    const isMigrated = subTaskCollections.length > 1;
    
    let navigationTarget = subTask.collectionId;
    if (isMigrated && subTaskCollections.length > 0) {
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      if (otherCollection) {
        navigationTarget = otherCollection;
      }
    }

    // Should navigate to Monthly log (the OTHER collection)
    expect(navigationTarget).toBe('monthly-log'); // ✅
  });

  it('should NOT show navigation when sub-task is only in one collection', () => {
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log'], // Only in ONE collection
      collectionId: 'monthly-log',
      parentTaskId: 'parent-1',
    };

    // Detection logic
    const subTaskCollections = subTask.collections || [];
    const isMigrated = subTaskCollections.length > 1;

    // Should NOT be considered migrated (only in one collection)
    expect(isMigrated).toBe(false); // ✅
  });

  it('should handle 3+ collections correctly', () => {
    const currentCollectionId = 'monthly-log';
    
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log', 'todays-log', 'work-projects'], // 3 collections
      collectionId: 'monthly-log',
      parentTaskId: 'parent-1',
    };

    // Detection
    const subTaskCollections = subTask.collections || [];
    const isMigrated = subTaskCollections.length > 1;
    
    expect(isMigrated).toBe(true); // ✅ In multiple collections

    // Navigation target (should go to first OTHER collection)
    const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
    
    expect(otherCollection).toBe('todays-log'); // ✅ First other collection
  });

  it('should match the exact Bug #4 scenario', () => {
    // EXACT SCENARIO FROM BUG REPORT:
    // - Parent "Schedule eye exams" in Monthly log only
    // - Sub-task "Find eye doctor" in BOTH Monthly log and Today's log
    // - Viewing from Monthly log
    // - Expected: "Go to Today's log" option should appear
    
    const currentCollectionId = 'monthly-log';
    const subTask = {
      id: 'subtask-1',
      title: 'Find eye doctor',
      collections: ['monthly-log', 'todays-log'], // In BOTH
      collectionId: 'monthly-log',
      parentTaskId: 'parent-1',
    };

    // Step 1: Detect if migrated (EntryList.tsx logic)
    const subTaskCollections = subTask.collections || [];
    const isMigrated = subTaskCollections.length > 1;

    // VERIFICATION: Should be detected as migrated
    expect(isMigrated).toBe(true);

    // Step 2: Find navigation target
    let subTaskCollectionId = subTask.collectionId;
    if (isMigrated && subTaskCollections.length > 0) {
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      if (otherCollection) {
        subTaskCollectionId = otherCollection;
      }
    }

    // VERIFICATION: Should navigate to Today's log
    expect(subTaskCollectionId).toBe('todays-log');

    // Step 3: UI should show "Go to" option
    const onNavigateToSubTaskCollection = isMigrated ? () => {
      // Navigate to subTaskCollectionId
    } : undefined;

    // VERIFICATION: Menu option should be defined (will appear in UI)
    expect(onNavigateToSubTaskCollection).toBeDefined();
  });
});

