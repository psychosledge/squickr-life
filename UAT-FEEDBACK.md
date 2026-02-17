# TODO

## UI Bugs

### Z-Index Issue: Collection Menu Behind Debug/Entry Icons
**Priority**: Medium  
**Reported**: 2026-02-16

The collection menu (kebab menu in top-right) is rendering behind:
- Debug button (purple badge icons showing "1", "2", "3")
- Entry menu icons

This is a z-index layering issue where the dropdown menu needs a higher z-index than the debug/entry UI elements.

**Location**: Daily log view header (e.g., "Yesterday, February 15, 2026")

**Expected**: Menu should overlay all other UI elements when open

**Screenshot**: Available (shows menu items "Select Entries", "Add to Favorites", "Settings", "Rename", "Delete" partially obscured by purple debug badges)

### Sub-Task Missing Multi-Collection Visual Indicators
**Priority**: Medium  
**Reported**: 2026-02-16

When a sub-task exists in multiple collections (e.g., created in monthly log, then added to daily log), it's missing the visual indicators that show it's in multiple places.

**Current behavior**: 
- Sub-task appears as a regular task without any indication it's in multiple collections
- No link icon shown
- No parent task name displayed for context

**Expected behavior**:
- Show link icon to indicate the task exists in multiple collections
- Display parent task name (e.g., "under [Parent Task Name]") for context
- Make it visually clear this is a sub-task that's been added to another collection

**Example scenario**:
- Parent "Monthly Parent Task" in monthly log
- Sub-task "Find eye doctor" created under parent
- Sub-task added to yesterday's daily log
- When viewing yesterday's log, sub-task shows NO indication it's also in monthly log or that it has a parent

**Impact**: Users can't tell if a sub-task is in multiple collections, leading to confusion about whether bulk migration will affect other collections.

**Location**: Collection detail view, task list items

### Ghost Entry Context Menu Shows Current Collection as "Go to" Option
**Priority**: Low  
**Reported**: 2026-02-16

When viewing a ghost entry (migrated task showing as crossed out), the context menu includes a "Go to [Current Collection]" option, which is a no-op since the user is already viewing that collection.

**Current behavior**: 
- Ghost entry shows multiple "Go to" options in its context menu
- One of the options is for the current collection being viewed
- Clicking it does nothing (already on that collection)

**Example**:
- Viewing "Yesterday, February 15, 2026" (Sunday)
- Ghost entry "Find eye doctor" (migrated to Monday)
- Context menu shows:
  - "Go to February 2026" (month collection)
  - "Go to Monday, February 16" (migrated target - correct)
  - "Go to Sunday, February 15" (current collection - redundant)
  - "Delete"

**Expected behavior**:
- Don't show "Go to" option for the current collection
- Only show navigation to OTHER collections where the task exists

**Impact**: Minor UX confusion - user might think clicking will do something when it won't.

**Location**: Ghost entry context menu

---

## UX Improvements

### Smart Default Migration Mode for Sub-Tasks
**Priority**: Medium  
**Reported**: 2026-02-16

When migrating or bulk-migrating a sub-task, the default migration mode should be context-aware:

**Current behavior**: Default is always "add" for sub-tasks (keeps them in all collections)

**Desired behavior**:
- **Default to "move"** when migrating a sub-task that is on a different collection than its parent
  - Example: Sub-task is in "Daily Log 2/15" but parent is in "Monthly Log" → default to "move" (remove from 2/15, add to target)
- **Default to "add"** only when migrating a sub-task from the collection where it's shown with its parent
  - Example: Sub-task is in "Monthly Log" with its parent → default to "add" (keep in Monthly Log, also add to target)

**Rationale**: When a sub-task has already been migrated away from its parent, the user typically wants to move it (not duplicate it across collections). Only when migrating from the parent's collection does it make sense to default to "add" (so it stays with the parent).

**Implementation**: Update migration dialog logic to check if `task.collectionId !== currentCollectionId` to determine default mode.

---

## In Progress

### Bulk Migration Fix - v0.10.0
**Status**: Ready for manual UI testing, then commit

- ✅ Core fix implemented (sourceCollectionId parameter)
- ✅ Validation added (mode='move' requires sourceCollectionId)
- ✅ Tests passing (1,556 tests across all packages)
- ✅ Casey approved (9/10 - production ready)
- ⏳ Manual UI testing needed
- ⏳ Commit and deploy

**Next**: Manual test migrated sub-task bulk migration scenario
