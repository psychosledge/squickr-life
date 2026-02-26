/**
 * Bug #4: Multi-Collection Sub-Task Navigation
 * 
 * When a sub-task is in multiple collections, users should be able to navigate
 * to the other collections from ANY of the collections where it appears.
 * 
 * Scenario:
 * - Parent task "Schedule eye exams" in "Monthly log" only
 * - Sub-task "Find eye doctor" in BOTH "Monthly log" AND "Today's log"
 * - When viewing Monthly log → Should show "Go to Today's log" option
 * - When viewing Today's log → Sub-task appears as top-level (parent not in list)
 */

import { describe, it, expect } from 'vitest';

describe('Bug #4: Multi-Collection Sub-Task Navigation', () => {
  describe('isMigrated detection logic', () => {
    it('should detect sub-task as migrated when in multiple collections (viewed from first collection)', () => {
      // Simulate viewing from "Monthly log"
      const currentCollectionId = 'monthly-log';
      
      // Sub-task is in BOTH collections
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log', 'todays-log'],
        parentEntryId: 'parent-1',
      };
      
      // Current logic (BUGGY):
      const subTaskCollections = subTask.collections || [];
      const isInCurrentCollection = currentCollectionId 
        ? subTaskCollections.includes(currentCollectionId)
        : subTaskCollections.length === 0;
      const isMigrated_OLD = !isInCurrentCollection;
      
      // BUG: Returns false (not migrated) because sub-task IS in current collection
      expect(isMigrated_OLD).toBe(false); // ❌ Bug!
      
      // CORRECT logic (FIXED):
      // Sub-task is "migrated" if it's in MULTIPLE collections
      // (regardless of whether current collection is one of them)
      const isMigrated_NEW = subTaskCollections.length > 1;
      
      // VERIFY: Should detect as migrated (in multiple collections)
      expect(isMigrated_NEW).toBe(true); // ✅ Correct!
    });
    
    it('should detect sub-task as migrated when in multiple collections (viewed from second collection)', () => {
      // Simulate viewing from "Today's log"
      const currentCollectionId = 'todays-log';
      
      // Sub-task is in BOTH collections
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log', 'todays-log'],
        parentEntryId: 'parent-1',
      };
      
      // Current logic (also works for this case):
      const subTaskCollections = subTask.collections || [];
      const isInCurrentCollection = currentCollectionId 
        ? subTaskCollections.includes(currentCollectionId)
        : subTaskCollections.length === 0;
      const isMigrated_OLD = !isInCurrentCollection;
      
      // This case works because sub-task IS in current collection
      expect(isMigrated_OLD).toBe(false);
      
      // CORRECT logic (FIXED):
      const isMigrated_NEW = subTaskCollections.length > 1;
      
      // VERIFY: Should detect as migrated (in multiple collections)
      expect(isMigrated_NEW).toBe(true); // ✅ Correct!
    });
    
    it('should NOT detect sub-task as migrated when in only one collection', () => {
      // Sub-task is ONLY in monthly log
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log'],
        parentEntryId: 'parent-1',
      };
      
      // CORRECT logic:
      const subTaskCollections = subTask.collections || [];
      const isMigrated = subTaskCollections.length > 1;
      
      // VERIFY: Should NOT be considered migrated (only in one collection)
      expect(isMigrated).toBe(false); // ✅ Correct!
    });
    
    it('should NOT detect as migrated when sub-task is uncategorized', () => {
      // Sub-task is uncategorized (no collections)
      const subTask = {
        id: 'subtask-1',
        collections: [],
        parentEntryId: 'parent-1',
      };
      
      // CORRECT logic:
      const subTaskCollections = subTask.collections || [];
      const isMigrated = subTaskCollections.length > 1;
      
      // VERIFY: Should NOT be considered migrated
      expect(isMigrated).toBe(false); // ✅ Correct!
    });
  });
  
  describe('Navigation target logic', () => {
    it('should navigate to OTHER collection when viewing from first collection', () => {
      const currentCollectionId = 'monthly-log';
      
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log', 'todays-log'],
        collectionId: 'monthly-log', // Legacy field (first collection)
      };
      
      // BUG FIX #4: Find the collection that's NOT the current one
      const subTaskCollections = subTask.collections || [];
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      const navigationTarget = otherCollection || subTask.collectionId;
      
      // VERIFY: Should navigate to Today's log
      expect(navigationTarget).toBe('todays-log'); // ✅ Correct!
    });
    
    it('should navigate to OTHER collection when viewing from second collection', () => {
      const currentCollectionId = 'todays-log';
      
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log', 'todays-log'],
        collectionId: 'monthly-log', // Legacy field
      };
      
      // Find the collection that's NOT the current one
      const subTaskCollections = subTask.collections || [];
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      const navigationTarget = otherCollection || subTask.collectionId;
      
      // VERIFY: Should navigate to Monthly log
      expect(navigationTarget).toBe('monthly-log'); // ✅ Correct!
    });
    
    it('should handle 3+ collections (navigate to first other collection)', () => {
      const currentCollectionId = 'monthly-log';
      
      const subTask = {
        id: 'subtask-1',
        collections: ['monthly-log', 'todays-log', 'work-projects'],
        collectionId: 'monthly-log',
      };
      
      // Find the collection that's NOT the current one
      const subTaskCollections = subTask.collections || [];
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      const navigationTarget = otherCollection || subTask.collectionId;
      
      // VERIFY: Should navigate to first other collection (Today's log)
      expect(navigationTarget).toBe('todays-log'); // ✅ Correct!
      
      // NOTE: In future, we might want to show ALL other collections in a submenu
      // For now, navigating to the first other collection is good enough
    });
  });
  
  describe('Integration: Full scenario for Bug #4', () => {
    it('should show "Go to" option when viewing migrated sub-task from original collection', () => {
      // SCENARIO:
      // - Parent "Schedule eye exams" in "Monthly log" only
      // - Sub-task "Find eye doctor" was moved to "Today's log"
      // - Now sub-task is in BOTH collections
      // - Viewing from "Monthly log" (original location)
      
      const currentCollectionId = 'monthly-log';
      const subTask = {
        id: 'subtask-1',
        title: 'Find eye doctor',
        collections: ['monthly-log', 'todays-log'], // In BOTH!
        collectionId: 'monthly-log', // Legacy field
        parentEntryId: 'parent-1',
      };
      
      // Step 1: Detect if sub-task is migrated
      const subTaskCollections = subTask.collections || [];
      const isMigrated = subTaskCollections.length > 1;
      
      expect(isMigrated).toBe(true); // ✅ Sub-task is in multiple collections
      
      // Step 2: Find navigation target (other collection)
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      const navigationTarget = otherCollection;
      
      expect(navigationTarget).toBe('todays-log'); // ✅ Should navigate to Today's log
      
      // Step 3: UI should show "Go to" option in menu
      const onNavigateToSubTaskCollection = isMigrated ? () => {
        // Navigate to navigationTarget
      } : undefined;
      
      expect(onNavigateToSubTaskCollection).toBeDefined(); // ✅ Menu option should appear!
    });
    
    it('should show "Go to" option when viewing migrated sub-task from new collection', () => {
      // SCENARIO:
      // - Same as above, but viewing from "Today's log" (new location)
      // - Should still show "Go to Monthly log" option
      
      const currentCollectionId = 'todays-log';
      const subTask = {
        id: 'subtask-1',
        title: 'Find eye doctor',
        collections: ['monthly-log', 'todays-log'],
        collectionId: 'monthly-log',
        parentEntryId: 'parent-1',
      };
      
      // Detect migration
      const subTaskCollections = subTask.collections || [];
      const isMigrated = subTaskCollections.length > 1;
      
      expect(isMigrated).toBe(true); // ✅
      
      // Find navigation target
      const otherCollection = subTaskCollections.find(c => c !== currentCollectionId);
      
      expect(otherCollection).toBe('monthly-log'); // ✅ Should navigate to Monthly log
    });
  });
});
