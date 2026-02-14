# Session: UX Fixes & Navigation Refactor

**Date:** February 14, 2026  
**Current Version:** v0.8.0 (deployed)  
**Session Type:** Bug fixes and UX improvements  
**Estimated Time:** TBD (depends on ADR-015 scope)

---

## Session Goals

Fix 5 UX issues identified by the user during daily usage of the Squickr Life PWA.

---

## Issues Overview

### ✅ Issue #1: Menu Coverage by Long Sub-Task Text (COMPLETED)
**Status:** ✅ Committed and deployed  
**Time Spent:** ~6 hours (multiple iterations)  
**Commits:**
- `d6d1139` - Attempted fix for Issue #2 (migration pointers)
- `0e01c74` - Initial portal-based rendering fix
- `a3025c8` - Follow-up fixes (scroll, sub-tasks, event listeners)
- `f591f00` - ADR-014 documentation

**Problem:**
- Long sub-task text was wrapping under the three-dot actions menu
- Menu was visually covered by text
- Sub-task menus were closing immediately after opening

**Solution:**
- Portal-based rendering with `position: fixed` (viewport-relative)
- Deferred event listener registration (`setTimeout(..., 0)`)
- Scroll-to-close behavior with passive listeners
- `pr-8` padding on entry content to prevent text wrapping under menu button

**Test Coverage:**
- All 894 client tests passing
- 8 new tests added for menu positioning

**Documentation:**
- `docs/architecture-decisions.md` - ADR-014: Portal-based Menu Positioning

**Files Changed:**
- `packages/client/src/components/EntryActionsMenu.tsx`
- `packages/client/src/components/EntryActionsMenu.test.tsx`
- `packages/client/src/components/TaskEntryItem.tsx`
- `packages/client/src/components/NoteEntryItem.tsx`
- `packages/client/src/components/EventEntryItem.tsx`

---

### 🔄 Issue #2: "Go to {collection}" Link Simplification (IN PROGRESS)
**Status:** 🔄 Planning complete, implementation pending  
**Time Spent:** ~8 hours (analysis + planning)  
**Complexity:** HIGH - Evolved into major architectural refactor

**Problem:**
- "Go to {collection}" links breaking during migration
- System has 4 different navigation types with complex conditional logic
- 13+ props in EntryActionsMenu
- Dual migration tracking systems (`migratedFrom` vs `collectionHistory`)
- Self-reference hack (`migratedFrom: task.id`)
- Timing-based heuristics to distinguish Move vs Add

**User's Vision:**
- Simplify to 1 navigation type: "Go to [Collection]"
- Show all collections where entry appears (active or ghost)
- Exclude current collection (would be no-op)
- No distinction between "Go to" vs "Go back" - all are just "Go to [Collection]"

**User's Mental Model:**
"Entries do not belong to collections, they 'appear' on collections"

**Migration Types:**
1. **Move migration**: Entry removed from current, added to new
   - Original collections show **ghost entries** (crossed out, dimmed)
   - Ghost entries have menu to navigate to new location
   - Sub-tasks cascade with parent (both become ghosts)
   
2. **Add migration**: Entry added to new collection, kept in current
   - Entry appears **active** in both locations
   - Both show linked indicator

**Architecture Analysis (by Alex):**
- Current system has 4 navigation types
- User's model perfectly aligns with existing Move/Add events
- Projection-only solution is feasible
- TaskMigrated events will be deprecated in favor of Move/Add

**Implementation Plan:**
- **8 phases, 19 hours total**
- Phase 1 (3h): Stop TaskMigrated, add Move/Add UI
- Phase 2 (4h): Enhanced ghost rendering with de-duplication
- Phase 3 (3h): Unified `getNavigationCollectionsForEntry()` method
- Phase 4 (2h): Simplify EntryActionsMenu (380 → 200 lines)
- Phase 5 (1h): Update GhostEntry component
- Phase 6 (2h): Sub-task de-duplication UI verification
- Phase 7 (2h): Debug tool ✅ COMPLETED
- Phase 8 (2h): Documentation & ADR-015

**Key Decisions (User-Confirmed):**
1. Sub-task cascade: Children move with parent, both become ghosts in source
2. Hide child ghost if parent is also ghost (de-duplication)
3. Menu with many collections: Show all (accept 10+ menu items if needed)
4. Legacy TaskMigrated data: Keep as-is (render as two separate entries)
5. Bulk migration: Remove from current collection only (creates ghosts)
6. Entry creation: Auto-add to current collection (implicit)

**Documentation:**
- `docs/adr-015-implementation-plan.md` - 8-phase implementation plan
- ✅ ADR-015 documentation (pending Phase 8)

**Tools Created:**
- ✅ `packages/client/src/components/EventHistoryDebugTool.tsx` (Phase 7 complete)
- ✅ `packages/client/src/context/DebugContext.tsx` (Refactored from prop drilling)
- ✅ 23 unit tests added - ALL PASSING
- ✅ Manual testing checklist created: `docs/manual-testing/EventHistoryDebugTool-checklist.md`

**Files to Change (Planned):**
- Phase 1: App.tsx, MigrateEntryModal.tsx, useBulkMigration.ts
- Phase 2: entry.projections.ts, task.types.ts
- Phase 3: entry.projections.ts
- Phase 4: EntryActionsMenu.tsx, EntryList.tsx
- Phase 5: GhostEntry.tsx
- Phase 8: architecture-decisions.md, MIGRATION_GUIDE_ADR015.md

**User Decision Needed:**
- Commit debug tool now, or include with Phase 1?
- Start Phase 1 implementation, or address Issues #3-5 first?
- Test debug tool on real migration data first?

---

### ⏸️ Issue #3: Auto-Fav Labels in Collection Titles (PENDING)
**Status:** ⏸️ Not started  
**Priority:** Medium  
**Estimated Time:** TBD

**Problem:**
- Collection titles like "Today - Friday, February 13" need auto-fav labels
- User wants to see which collections are auto-favorited vs manually favorited

**Current Behavior:**
- Auto-favorited daily logs show hollow star (✦) in collection list
- Manually favorited collections show filled star (⭐)

**Desired Behavior:**
- Collection detail view should show similar indicators in the title
- Or some other label/badge to indicate auto-fav status

**Files Likely Affected:**
- `packages/client/src/views/CollectionDetailView.tsx`
- `packages/client/src/utils/formatters.ts` (collection title formatting)
- `packages/client/src/components/CollectionHeader.tsx` (if it exists)

**Design Questions:**
- What format? "(Auto-favorited)" suffix? Badge? Icon?
- Should it match the hollow star (✦) from collection list?
- Mobile vs desktop considerations?

---

### ⏸️ Issue #4: Improve Sub-Task Nesting Visual Styling (PENDING)
**Status:** ⏸️ Not started  
**Priority:** Medium  
**Estimated Time:** TBD

**Problem:**
- Current sub-task indentation/styling could be improved
- User wants better visual hierarchy

**Current Behavior:**
- Sub-tasks are indented under parent tasks
- Uses standard indentation (likely `ml-4` or similar)

**Desired Behavior:**
- TBD - need user input on specific improvements
- Possible options:
  - More indentation?
  - Connecting lines (like a tree view)?
  - Different background color?
  - Border or visual separator?

**Files Likely Affected:**
- `packages/client/src/components/TaskEntryItem.tsx`
- `packages/client/src/components/EntryList.tsx`
- CSS/Tailwind classes for sub-task styling

**Design Questions:**
- What specific improvements does the user want?
- Reference designs or examples to follow?
- Mobile vs desktop considerations?

---

### ⏸️ Issue #5: Reposition Linked Sub-Task Icons (PENDING)
**Status:** ⏸️ Not started  
**Priority:** Low  
**Estimated Time:** TBD

**Problem:**
- Linked sub-task icons (🔗) need repositioning
- Current position is unclear or confusing

**Current Behavior:**
- Sub-tasks show 🔗 icon when migrated separately from parent
- Icon position is TBD (need to verify current implementation)

**Desired Behavior:**
- Icon should be repositioned to a more intuitive location
- TBD - need user input on where it should go

**Files Likely Affected:**
- `packages/client/src/components/TaskEntryItem.tsx`
- Icon rendering logic for linked sub-tasks

**Design Questions:**
- Where should the icon be positioned?
- Should it replace another icon or be additional?
- Mobile vs desktop considerations?

---

## Work Completed This Session

### ✅ Issue #1: Menu Coverage
- Fully resolved with portal-based rendering
- Committed and deployed
- ADR-014 documented

### ✅ EventHistoryDebugTool - Phase 7 Complete
**Time Spent:** ~3 hours
**Status:** ✅ COMMITTED (commit: 2d64480)
**Casey's Final Rating:** 9/10 - Excellent, ready to commit

**Casey's Critical Issues (ALL FIXED):**
1. ✅ **No tests written** → 23 unit tests added (100% passing)
2. ✅ **Performance concerns** → Replaced prop drilling with React Context (DebugContext)
3. ✅ **Type safety issues** → Removed `as any`, used proper type guards
4. ✅ **UI/UX issue** → Fixed button position (no longer covered by FAB)
5. ✅ **No manual testing documented** → Created comprehensive 16-test checklist

**Implementation Changes:**
- Created `DebugContext` and `DebugProvider` (eliminates 7-layer prop drilling)
- Removed `allEvents` prop from all components:
  - `TaskEntryItem`, `NoteEntryItem`, `EventEntryItem`
  - `EntryItem`, `SortableEntryItem`, `EntryList`
  - `CollectionDetailView`
- Repositioned debug button to **top-right** corner (inline with actions menu)
- Fixed type safety with proper type guards for event payload fields
- Wrapped App with `<DebugProvider>` in `App.tsx`

**Test Results:**
- ✅ All 23 EventHistoryDebugTool tests passing
- ✅ All 919 client tests passing (no regressions)
- ✅ TypeScript compilation passes with zero errors

**Test Coverage:**
- Production mode exclusion
- Event filtering (tasks, notes, events, migration events)
- UI interactions (expand/collapse)
- Event display and metadata
- Edge cases (no events, malformed events)
- Type safety (proper type guards)
- Position and layout (no FAB overlap)

**Manual Testing:**
- 16-test checklist ready for user verification
- Tests cover: visibility, filtering, migration tracking, performance, accessibility

**Files Changed:**
- Created:
  - `packages/client/src/context/DebugContext.tsx`
  - `packages/client/src/components/EventHistoryDebugTool.test.tsx`
  - `docs/manual-testing/EventHistoryDebugTool-checklist.md`
- Updated:
  - `packages/client/src/components/EventHistoryDebugTool.tsx` (fixed type safety, repositioned)
  - `packages/client/src/App.tsx` (added DebugProvider)
  - 7 components (removed allEvents prop)

**User Feedback Addressed:**
- ✅ "I had hoped to see all events for the entry, not filtered" → Clarified: Shows events for current entry ID only (Option A chosen)
- ✅ Tool correctly reveals data integrity issues from legacy TaskMigrated pattern
- ✅ Decision: Will be fully accurate post-ADR-015 (no migration history walking needed)

**Commit:** 2d64480
**Casey's Final Review:** 9/10 - Excellent

---

## Pending User Decisions

### For Issue #2 (Navigation Refactor):
**Status:** Deferred - Will revisit after Issues #3-5

ADR-015 implementation plan is ready (8 phases, 19 hours), but user has decided to:
1. Complete smaller UX fixes (#3-5) first
2. Return to ADR-015 in a focused session later

### For Issues #3-5:
**Status:** Ready for design phase

Need to design solutions for:
- Issue #3: Auto-fav labels in collection titles
- Issue #4: Improve sub-task nesting visual styling
- Issue #5: Reposition linked sub-task icons

---

## Next Steps

**Current Plan:** Design and implement Issues #3-5 before returning to ADR-015

1. ✅ EventHistoryDebugTool committed (2d64480)
2. ✅ Documentation updated
3. 🔄 **NOW:** Design solutions for Issues #3-5
4. ⏸️ **LATER:** Return to ADR-015 in focused session

---

## Files Created This Session

### Documentation:
- `docs/adr-015-implementation-plan.md` - 8-phase plan for navigation refactor

### Code:
- `packages/client/src/components/EventHistoryDebugTool.tsx` - Debug tool (Phase 7) ✅ REFACTORED
- `packages/client/src/components/EventHistoryDebugTool.test.tsx` - 23 unit tests ✅ NEW
- `packages/client/src/context/DebugContext.tsx` - Context provider ✅ NEW

### Manual Testing:
- `docs/manual-testing/EventHistoryDebugTool-checklist.md` - 16-test checklist ✅ NEW

### Session Notes:
- `docs/session-2026-02-14-ux-fixes.md` - This file

---

## Success Criteria

**For Issue #1:**
- ✅ Menu coverage resolved
- ✅ All tests passing
- ✅ Committed and deployed
- ✅ ADR-014 documented

**For Issue #2:**
- ✅ Analysis complete
- ✅ Implementation plan documented (ADR-015)
- ✅ Debug tool created and committed
- ✅ User decision: Defer until after Issues #3-5
- ⏸️ Implementation deferred to future session

**For Issues #3-5:**
- 🔄 Design phase in progress
- ⏸️ Implementation pending design completion

---

**Session Status:** In Progress  
**Current Focus:** Designing solutions for Issues #3-5  
**Prepared by:** OpenCode  
**Last Updated:** February 14, 2026 - 14:30
