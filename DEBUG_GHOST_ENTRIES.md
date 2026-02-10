# Ghost Entry Debugging Guide

## Changes Made

I've added comprehensive debug logging to track down all three issues. The logs will appear in the browser console.

### Files Modified

1. **packages/domain/src/entry.projections.ts**
   - Added logging in `getEntriesForCollectionView()` to show ghost entries being created
   - Added logging in `TaskRemovedFromCollection` event handler to show before/after state

2. **packages/client/src/components/EntryList.tsx**
   - Added logging to show ghost detection for each task entry
   - Added logging for sub-task migration detection (both batch and fallback paths)

3. **packages/client/src/components/MigrateEntryDialog.tsx**
   - Fixed collection list order (now sorts by `order` field)
   - Removed auto-selection of first collection
   - Added "Select a collection..." placeholder
   - Migrate button now disabled until collection selected

## How to Test

### Test 1: Ghost Entry Rendering (Issues #1 and #3)

**Steps:**
1. Open browser console (F12)
2. Navigate to Collection A (e.g., a Daily Log)
3. Create a task: "Test ghost entry"
4. Click the "..." menu on the task
5. Click "Migrate"
6. Select Collection B from dropdown
7. Ensure "Move to..." is selected (should be default)
8. Click "Migrate"
9. Stay on Collection A page

**Expected Console Logs:**

```
[TaskRemovedFromCollection] BEFORE: {
  taskId: "...",
  title: "Test ghost entry",
  collections: ["collection-a-id"],
  collectionHistory: [{collectionId: "collection-a-id", addedAt: "..."}],
  removingFrom: "collection-a-id"
}

[TaskRemovedFromCollection] AFTER: {
  taskId: "...",
  title: "Test ghost entry",
  collections: [],  // ← Should be EMPTY after removal
  collectionHistory: [{collectionId: "collection-a-id", addedAt: "...", removedAt: "..."}]  // ← Should have removedAt
}

[getEntriesForCollectionView] Result: {
  collectionId: "collection-a-id",
  activeCount: X,
  ghostCount: 1,  // ← Should be 1!
  ghosts: [{
    id: "...",
    title: "Test ghost entry",
    renderAsGhost: true,  // ← CRITICAL: Should be true
    ghostNewLocation: "collection-b-id",
    collections: [],  // ← Should NOT include collection-a-id
    collectionHistory: [{...}]
  }]
}

[EntryList] Entry ghost check: {
  id: "...",
  title: "Test ghost entry",
  hasRenderAsGhost: true,  // ← Should be true
  renderAsGhostValue: true,  // ← Should be true
  isGhost: true,  // ← Should be true
  collections: [],
  ghostNewLocation: "collection-b-id"
}
```

**Expected UI:**
- ✅ Ghost entry should render with crossed-out text (strikethrough)
- ✅ Arrow icon (➜) should appear
- ✅ Hovering over arrow should show tooltip: "Moved to Collection B"
- ✅ "Go to Collection B" button should appear below

**If Ghost Count is 0:**
The projection isn't creating ghost entries. Check:
- Is `collectionHistory` array present?
- Does it have an entry with matching `collectionId` and `removedAt`?
- Is the task's `collections` array truly empty/not including the old collection?

**If isGhost is false:**
The projection created ghosts, but EntryList isn't detecting them. Check:
- Is `renderAsGhost` property present on the entry object?
- Is it exactly `true` (boolean)?

### Test 2: Sub-task Migration Indicators (Issue #2)

**Steps:**
1. Open browser console (F12)
2. Navigate to Collection A
3. Create a parent task: "Parent task"
4. Click the "+" icon to add a sub-task: "Sub-task"
5. Click "..." menu on the sub-task
6. Click "Migrate"
7. Select Collection B from dropdown
8. Select "Also show in Collection B" (ADD mode, not MOVE)
9. Click "Migrate"
10. Collapse and re-expand the parent task

**Expected Console Logs:**

```
[EntryList] Sub-task migration: {
  subTaskId: "...",
  title: "Sub-task",
  currentCollectionId: "collection-a-id",
  subTaskCollections: ["collection-a-id", "collection-b-id"],  // ← Should include BOTH
  isInCurrentCollection: true,  // ← Should be TRUE (includes collection-a-id)
  isMigrated: false  // ← Should be FALSE (because it's in current collection)
}
```

**Expected UI:**
- ✅ Sub-task should render NORMALLY (no arrow, no helper text)
- ✅ No migration indicators should appear

**If isMigrated is true:**
The logic is detecting it as migrated when it shouldn't be. Check:
- Does `subTaskCollections` include `currentCollectionId`?
- Is `isInCurrentCollection` evaluating correctly?

### Test 3: Migration Dialog (Issue #4)

**Steps:**
1. Create multiple collections with different orders
2. Click migrate on any task
3. Check the dropdown

**Expected UI:**
- ✅ Collections should be in the correct order (matching sidebar order)
- ✅ Dropdown should show "Select a collection..." placeholder
- ✅ No collection should be pre-selected
- ✅ "Migrate" button should be DISABLED until collection selected

## Root Cause Analysis

Based on the logs, we can determine:

### If ghost entries aren't being created:
- Problem is in the projection's `TaskRemovedFromCollection` handler
- OR problem is in `getEntriesForCollectionView` filter logic
- OR problem is that the move operation isn't emitting the right events

### If ghost entries are created but not rendered:
- Problem is in EntryList's ghost detection (`isGhost` logic)
- OR problem is TypeScript type narrowing

### If sub-tasks show migration indicators incorrectly:
- Problem is in the sub-task migration detection logic in EntryList
- Check if `currentCollectionId` is being passed correctly
- Check if `subTask.collections` array has the right values

## Next Steps

After running the tests:

1. **Copy all console logs** from the browser
2. **Take screenshots** of the UI issues
3. **Report back** with:
   - What the logs showed
   - Whether ghost entries appeared in the logs but not the UI
   - Whether sub-task collections arrays were correct
   - Any errors or warnings

Then I can provide targeted fixes based on the actual root cause.
