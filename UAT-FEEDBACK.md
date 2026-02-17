# UAT Feedback Tracking - v0.10.1

## ✅ COMPLETED (Deployed in v0.10.1 - 2026-02-16)

### Issue #1: Z-Index - Collection Menu Behind Debug/Entry Icons
**Status**: ✅ FIXED  
**Reported**: 2026-02-16  
**Fixed**: 2026-02-16 (v0.10.1)  
**UAT**: PASSED

**Problem**: Collection menu rendering behind debug badges and entry menus (z-50 vs z-[99]/z-[150])

**Solution**: Changed `CollectionHeader.tsx` z-index from `z-50` to `z-[200]`

**Files Changed**:
- `packages/client/src/components/CollectionHeader.tsx` (line 194)

---

### Issue #2: Sub-Task Missing Multi-Collection Visual Indicators
**Status**: ✅ FIXED  
**Reported**: 2026-02-16  
**Fixed**: 2026-02-16 (v0.10.1)  
**UAT**: PASSED

**Problem**: Sub-tasks in multiple collections didn't show multi-collection indicator

**Solution**: Fixed detection logic to check `collections.length > 1 OR !collections.includes(currentCollectionId)`

**Files Changed**:
- `packages/client/src/components/TaskEntryItem.tsx` (lines 156-160, 231)
- `packages/client/src/components/TaskEntryItem.test.tsx` (added test coverage)

---

### Issue #3: Ghost Entry Context Menu Shows Current Collection
**Status**: ✅ FIXED  
**Reported**: 2026-02-16  
**Fixed**: 2026-02-16 (v0.10.1)  
**UAT**: PASSED

**Problem**: Ghost entries showed redundant "Go to current collection" option

**Solution**: 
- Fixed `collectionNavigation.ts` exclusion logic
- Propagated `currentCollectionId` through component chain: `EntryList` → `GhostEntry` → `EntryActionsMenu`
- Added test coverage

**Files Changed**:
- `packages/client/src/utils/collectionNavigation.ts` (lines 51-69)
- `packages/client/src/components/EntryList.tsx` (line 330)
- `packages/client/src/components/GhostEntry.tsx` (lines 14, 37, 120)
- `packages/client/src/components/GhostEntry.test.tsx` (lines 470-509)

---

### Issue #4: Smart Default Migration Mode for Sub-Tasks
**Status**: ✅ FIXED  
**Reported**: 2026-02-16  
**Fixed**: 2026-02-16 (v0.10.1)  
**UAT**: PASSED

**Problem**: Sub-tasks always defaulted to 'add' mode, even when orphaned from parent

**Solution**: 
- Calculate `parentCollections` in `EntryList.tsx` for top-level sub-tasks
- Propagate through component chain: `EntryList` → `SortableEntryItem` → `EntryItem` → `TaskEntryItem` → `MigrateEntryDialog`
- Fixed `getDefaultMode()` logic: `undefined` parentCollections → default to 'move'
- Added comprehensive test coverage

**Files Changed**:
- `packages/client/src/components/MigrateEntryDialog.tsx` (getDefaultMode function)
- `packages/client/src/components/EntryList.tsx` (lines 341-357, 387)
- `packages/client/src/components/SortableEntryItem.tsx` (added parentCollections prop)
- `packages/client/src/components/EntryItem.tsx` (forwarded prop)
- `packages/client/src/components/TaskEntryItem.tsx` (passed to dialog)
- `packages/client/src/components/MigrateEntryDialog.smartDefaults.test.tsx` (5 new tests)

---

### Bulk Migration Bug Fix (Original Issue)
**Status**: ✅ FIXED  
**Reported**: 2026-02-16  
**Fixed**: 2026-02-16 (v0.10.1)  
**UAT**: PASSED

**Problem**: Sub-tasks in multiple collections weren't being removed from source collections when migrated via temporal routes

**Root Cause**: 
1. Handler used `entry.collectionId` (display) instead of actual source collection
2. UI passed temporal identifier (e.g., "yesterday") instead of resolved UUID

**Solution**:
- Added `sourceCollectionId` parameter to `BulkMigrateEntriesCommand`/`Handler`
- UI passes `resolvedCollectionId` instead of `collectionId`
- Added comprehensive integration test

**Files Changed**:
- `packages/domain/src/bulk-migrate-entries.handler.ts`
- `packages/domain/src/bulk-migrate-entries.handler.test.ts` (lines 546-666)
- `packages/client/src/views/CollectionDetailView.tsx` (line 118)
- `packages/client/src/hooks/useEntryOperations.ts`

---

## Test Results

**All 1,565 tests passing** (580 domain + 21 infrastructure + 964 client)

**Casey Review Score**: 9/10 overall (excellent work)

---

## Deployment

**Version**: v0.10.1  
**Deployed**: 2026-02-16  
**Commit**: ed56d58  
**Tag**: v0.10.1
