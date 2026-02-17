# Bug Fix Report: Phase 3 Parent Migration Cascade

## Issue
When migrating a parent task to a different collection, unmigrated children (sub-tasks in the same collection) were NOT following the parent. Only the parent was being migrated.

## Expected Behavior
- Parent migrates to target collection ✅
- Unmigrated children (in same collection as parent) should follow parent ✅ (NOW FIXED!)
- Migrated children (in different collection) should stay put ✅ (working as expected)

## Root Cause
The `MigrateTaskHandler` was missing cascade logic for Phase 3. It only migrated the parent task without checking for sub-tasks.

## Solution Implemented

### 1. Handler Changes (`packages/domain/src/task.handlers.ts`)
Added cascade migration logic to `MigrateTaskHandler.handle()`:
- After migrating parent, check if it has children
- For each child in SAME collection as parent AND not already migrated:
  - Create `TaskMigrated` event for child
  - Batch all events (parent + children) for atomicity

### 2. Projection Changes (`packages/domain/src/entry.projections.ts`)
Updated `TaskMigrated` event handling in `applyTaskEvent()`:
- When creating migrated child task, check if parent was migrated to same collection
- If yes, update child's `parentTaskId` to point to migrated parent ID
- This preserves the parent-child hierarchy in the new collection

## Test Coverage
Created `migrate-parent-task-cascade.test.ts` with comprehensive scenario:
1. Create parent with 3 sub-tasks in "Work Projects"
2. Migrate 1 sub-task to "Today's Log" (creates symlink)
3. Migrate parent to "Monthly Log"
4. Verify:
   - Parent has symlink in "Monthly Log" ✅
   - 2 unmigrated children have symlinks in "Monthly Log" ✅
   - 1 migrated child stays in "Today's Log" ✅
   - All symlinks point to correct parent IDs ✅

## Test Results
- **Before fix**: Test failed - unmigrated children did not have symlinks
- **After fix**: Test passed ✅
- **All existing tests**: 496/496 passing ✅

## Files Changed
- `packages/domain/src/task.handlers.ts` - Added cascade logic to MigrateTaskHandler
- `packages/domain/src/entry.projections.ts` - Updated TaskMigrated projection to preserve hierarchy
- `packages/domain/src/migrate-parent-task-cascade.test.ts` - New comprehensive test

## Manual Testing Steps
1. Start dev server: `pnpm dev`
2. Open localhost:3000
3. Create collection "Work Projects"
4. Create parent task "App launch" in "Work Projects"
5. Add 3 sub-tasks under "App launch"
6. Create collection "Today's Log"
7. Migrate 1 sub-task to "Today's Log" (should create symlink)
8. Create collection "Monthly Log"
9. Migrate parent "App launch" to "Monthly Log"
10. Expected results:
    - "Work Projects" shows original parent (with "migrated" indicator) + 2 original sub-tasks
    - "Monthly Log" shows migrated parent + 2 migrated sub-tasks (that followed parent)
    - "Today's Log" shows 1 migrated sub-task (that stayed put)

## Next Steps
Ready for code review with Casey.
