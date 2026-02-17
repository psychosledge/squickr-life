# Product Roadmap
**Last Updated:** February 16, 2026  
**Current Version:** v0.10.1  
**Status:** Roadmap finalized through v1.0.0

---

## Version Plan

### ✅ v0.6.0 - User Preferences Enhancements (COMPLETED)
**Released:** February 6, 2026  
**Actual Time:** ~7 hours (including bug fixes)  
**Status:** Deployed to production

**Features Delivered:**
1. ✅ Global default for completed task behavior
   - Event-sourced user preferences system
   - Settings modal with dropdown for default behavior
   - Per-collection "Use default" option
   - Proper fallback chain (collection → legacy → global default)

2. ✅ Auto-favorite Today/Yesterday/Tomorrow daily logs
   - Global toggle in Settings modal
   - UI-only treatment (doesn't modify isFavorite)
   - Hollow star (✦) for auto-favorited, filled star (⭐) for manual
   - Favorites section includes auto-favorited daily logs

**Bug Fixes:**
- Fixed critical sync timestamp bug (events were being skipped)
- Fixed hollow star icon not appearing
- Fixed React hooks violation causing page crashes
- Fixed global default not being applied

**Test Coverage:**
- 656/656 client tests passing
- 411/419 shared tests passing (8 IndexedDB skipped)
- All eventStore mocks updated for user preferences

**Infrastructure Improvements:**
- Auto-kill port 3000 before dev server starts
- Updated workflow documentation (version agreement, full test suite)
- Branch protection rules configured on production branch

---

### ✅ v0.7.0 - Sub-tasks Feature (COMPLETED)
**Released:** February 7-10, 2026  
**Actual Time:** ~12 hours (design + implementation + bug fixes)  
**Status:** Deployed to production

**Features Delivered:**
1. ✅ Hierarchical task structure (two-level hierarchy for MVP)
   - Sub-tasks are independent entries with `parentTaskId` link
   - Sub-tasks created with same `collectionId` as parent initially
   - Parent tasks show completion badge (e.g., "2/5 ✓")
   - Indented rendering under parent tasks
   - Expand/collapse functionality with keyboard accessibility

2. ✅ Sub-task creation and management
   - Add sub-task button appears on parent tasks
   - Create sub-task via dedicated UI component
   - Edit sub-task titles inline (same as regular tasks)
   - Delete cascade: deleting parent deletes all sub-tasks
   - Independent sub-task deletion (doesn't affect parent)

3. ✅ Completion cascade behavior
   - Parent completion requires all sub-tasks complete (soft warning)
   - Option to complete parent and cascade to sub-tasks
   - Completing last sub-task auto-completes parent (optional)
   - Sub-tasks can be completed independently

4. ✅ Migration "symlink" behavior
   - Migrating parent cascades to all sub-tasks in same collection
   - Sub-tasks appear in both original and migrated collections
   - "Go to Parent" navigation for migrated sub-tasks
   - "Go to Collection" navigation shows origin collection
   - Sub-tasks display 🔗 icon when migrated separately from parent

5. ✅ Event sourcing implementation
   - `TaskCreated` with optional `parentTaskId` field
   - `SubTaskAdded` event for parent linking
   - `SubTaskRemoved` event for parent unlinking  
   - Completion and deletion cascade handlers
   - Migration cascade handlers

**Architecture Decisions:**
- Two-level hierarchy (parent → children) - can extend later with zero tech debt
- Sub-tasks are independent entries (Liskov Substitution Principle)
- Explicit collection membership (sub-tasks inherit parent's `collectionId`)
- Migration creates symlink behavior (children appear in multiple collections)
- Parent completion requires all children complete (cascade option available)

**Design Document:**
- `docs/sub-tasks-design.md` (comprehensive 900+ line spec)

**Test Coverage:**
- All 816+ client tests passing
- Event sourcing projections tested
- Cascade behaviors fully tested
- Migration symlink behavior tested

**Bug Fixes During Implementation:**
- Fixed migrated sub-tasks not appearing in daily logs
- Fixed "Go to Parent" navigation for migrated sub-tasks
- Fixed race condition in completion cascade
- Fixed expand/collapse keyboard accessibility

---

### ✅ v0.7.2 - Test Fixes (COMPLETED)
**Released:** February 11, 2026  
**Actual Time:** ~2 hours (test fixes + CI improvements)  
**Status:** Deployed to production

**Test Fixes:**
1. ✅ Fixed date-dependent collection sorting test with proper time mocking (`vi.setSystemTime()`)
2. ✅ Fixed async handling in navigation tests (wrapped callbacks in `act()`)

**Infrastructure Improvements:**
- Refactored CI pipeline for efficiency and fail-fast behavior
- Version check now runs before tests (faster feedback on version bumps)
- Added time-mocking guidelines to development docs
- CI runs ~7-13 seconds faster per run

**Test Coverage:**
- All 1,396 tests passing reliably (Domain: 538, Infrastructure: 21, Client: 837)
- Zero flaky tests
- All tests now time-independent and deterministic

**Documentation:**
- Added "Testing Date/Time-Dependent Code" section to development guide
- Documents when and how to use `vi.setSystemTime()`
- Prevents future date-dependent test failures

---

### ✅ v0.7.1 - Production Bug Fixes (COMPLETED)
**Released:** February 11, 2026  
**Actual Time:** ~4 hours (bug fixes + testing + code review)  
**Status:** Deployed to production

**Bug Fixes:**
1. ✅ Collection stats now only count open tasks (exclude completed/migrated)
2. ✅ "Active" filter in migrate modal correctly selects only open, non-migrated tasks
3. ✅ Favorited monthly logs now appear in favorites section on index page
4. ✅ Multi-collection sub-tasks show "Go to [Collection Name]" menu option for navigation

**UX Improvements:**
- Removed redundant "Go to Parent" menu option (covered by multi-collection navigation)
- Removed visual clutter: arrows (→) and helper text for migrated entries
- Cleaner navigation experience with single "Go to [Collection]" option

**Code Quality:**
- Cleaned up stale test mocks (getParentTask)
- Updated CHANGELOG with v0.7.1 release notes
- Version bumped across all packages

**Test Coverage:**
- 1,068 tests passing (Domain: 538, Infrastructure: 21, Client: 509)
- Added 2 new test files for multi-collection navigation
- All existing tests maintained

**Code Review:**
- Casey review: 9/10 rating - "Professional-grade bug fixing"
- All changes approved for deployment

---

### ✅ v0.8.0 - UX Enhancements (COMPLETED)
**Released:** February 11, 2026  
**Actual Time:** ~14 hours (2.5h + 2h + 4.5h + 5h)  
**Status:** Deployed to production

**Features Delivered:**

#### ✅ Feature 1: Auto-favorite last/current/next month (~2.5 hours)
- **Implementation:** Added `autoFavoriteRecentMonthlyLogs: boolean` preference
- **Behavior:** Auto-favorite monthly logs for last month, current month, next month (3 months total)
- **Navigation Fix:** Favorited monthly logs now appear in navigation order
- **Year Boundaries:** Handles Dec→Jan transitions correctly
- **Test Coverage:** 20 new tests (16 utility, 4 navigation)
- **Files Changed:**
  - Domain: user-preferences types, handlers, projections
  - Client: collectionUtils, collectionSorting, SettingsModal

#### ✅ Feature 2: Show parent title for migrated sub-tasks (~2 hours)
- **Implementation:** Inline suffix format "find hardware (Put together Bed Frame)"
- **Display Logic:** Only for migrated sub-tasks (different collection than parent)
- **Performance:** O(n) batch query via `getParentTitlesForSubTasks()`
- **Styling:** Gray text, smaller font, in parentheses
- **Test Coverage:** 7 comprehensive tests
- **Files Changed:**
  - Domain: entry.projections (batch query method)
  - Client: EntryList, EntryItem, SortableEntryItem, TaskEntryItem, CollectionDetailView

#### ✅ Feature 3: Combined monthly log + month rollup (~4.5 hours)
- **Implementation:** Unified UX with two-zone clickable interface
  - Triangle button: Expands/collapses child daily logs
  - Text/icon area: Navigates to monthly log collection
- **Visual:** Calendar icon, year display, star icon for favorited monthlies
- **Dual Appearance:** Favorited monthly logs appear in both favorites AND calendar hierarchy
- **Type Safety:** Enhanced HierarchyNode with discriminated union
- **Test Coverage:** 7 new tests for Feature 3 scenarios
- **Files Changed:**
  - Client: useCollectionHierarchy, CollectionTreeNode, collectionStatsFormatter, HierarchicalCollectionList

#### ✅ Feature 4: Dual navigation with temporal URLs (~5 hours)
- **Implementation:** Auto-favorited collections accessible via both temporal and stable URLs
  - Temporal URLs: `/today`, `/yesterday`, `/tomorrow`, `/this-month`, `/last-month`, `/next-month`
  - Stable URLs: `/collection/{uuid}` (always point to same collection)
  - Auto-favorited collections appear twice in navigation
- **Chronological Ordering:** Last Month → Current Month → Yesterday → Today → Tomorrow → Next Month
  - Monthly logs appear BEFORE their daily logs
  - Fixed timezone bug: `getSortKey()` now uses local timezone instead of UTC
  - Navigation sidebar order matches Collection Index order
- **Test Coverage:** 38 comprehensive tests
  - 16 temporal utils tests (edge cases: month/year boundaries, timezones)
  - 9 navigation entries tests (URL assignment, deduplication)
  - 13 useCollectionNavigation tests (arrow keys, swipe gestures)
  - Fixed 4 pre-existing test failures in collectionSorting
- **Files Changed:**
  - Client: temporalUtils, navigationEntries, App, CollectionDetailView, useCollectionNavigation, HierarchicalCollectionList, collectionSorting

**Technical Achievements:**
- All 1,496 tests passing (545 domain, 21 infrastructure, 930 client)
- Zero regressions across 4 major features
- Comprehensive code reviews (9/10, 9.5/10, 9/10, 9.5/10 ratings from Casey - average 9.25/10)
- TDD approach followed throughout

**Developer Efficiency:**
- Feature 1: Under estimate (2.5h vs 3h)
- Feature 2: Under estimate (2h vs 3.5h)
- Feature 3: On estimate (4.5h)
- Feature 4: 5 hours (including chronological sorting fix and timezone debugging)
- Total: 14 hours for 4 production-ready features

---

### ✅ v0.10.1 - Bulk Migration Bug Fix & UAT Feedback (COMPLETED)
**Released:** February 16, 2026  
**Actual Time:** ~8 hours (investigation + fixes + testing)  
**Status:** Deployed to production

**Critical Bug Fix:**
- ✅ Bulk migration not removing sub-tasks from source collections in temporal routes
  - Root cause: Handler used display collectionId, UI passed temporal identifier
  - Solution: Added `sourceCollectionId` parameter, pass `resolvedCollectionId` from UI
  - Added comprehensive integration test

**UAT Feedback Fixes (4 issues):**
1. ✅ Collection menu z-index fixed (z-50 → z-[200])
2. ✅ Multi-collection indicators for sub-tasks in multiple collections
3. ✅ Ghost entry menus no longer show redundant current collection option
4. ✅ Smart migration defaults - context-aware 'move' vs 'add' for orphaned sub-tasks

**Test Coverage:**
- All 1,565 tests passing (580 domain + 21 infrastructure + 964 client)
- Casey review: 9/10 overall rating

**Files Changed:**
- Domain: bulk-migrate-entries handler + tests
- Client: 10 files (CollectionHeader, TaskEntryItem, GhostEntry, MigrateDialog, etc.)
- Added comprehensive test coverage for all fixes

---

### v0.9.0 - Code Quality & Refactoring Session (NEXT)
**Target:** After v0.10.1  
**Estimated Time:** 4-6 hours  
**Status:** Ready to implement

**Scope:** Combined code quality improvements and minor refactoring

**Phase 1: Timezone Utilities & Consistency (1-1.5 hours)**
- Extract date comparison to reusable utility function
- Add centralized date parsing utilities
- Fix timezone inconsistencies in `DateHeader.tsx` and `formatters.ts`
- Create ADR-014 documenting local timezone strategy

**Phase 2: Test Coverage Improvements (1.5-2 hours)**
- Add timezone edge case tests (late night EST, positive UTC offsets)
- Add drag-and-drop tests for `HierarchicalCollectionList.tsx`
- Import `getLocalDateKey` in tests instead of duplicating logic

**Phase 3: Code TODOs & Refactoring (1.5-2 hours)**
- Add error toast to user in `CollectionDetailView.tsx`
- Multi-collection pattern for Notes/Events (bulk-migrate-entries.handler.ts)
- Remove outdated TODOs and clean up comments

**Phase 4: Documentation Cleanup (0.5-1 hour)**
- Archive or remove superseded design docs (ADR-015 implementation plan)
- Update README and development guide
- Clean up session notes and move to archive

**Value Proposition:**
- Eliminate technical debt before v1.0.0
- Improve maintainability and test coverage
- Better developer experience with centralized utilities
- Clean documentation reflects actual implementation

---

### v1.0.0 - Intro Guide/Walkthrough (MILESTONE RELEASE)
**Target:** After v0.9.0 refactoring  
**Estimated Time:** 7-11 hours  
**Status:** ✅ Design complete and approved

**Features:**
- 7-step interactive tutorial with spotlight overlays
- Help menu (?) with:
  - Restart Tutorial
  - Bullet Journal Guide
  - Keyboard Shortcuts
  - Report a Bug (GitHub pre-filled)
  - Request a Feature (GitHub pre-filled)
  - GitHub Discussions
  - About Squickr Life
- Auto-triggers when user has zero collections (once per session)
- Mobile-optimized with dark mode support

**Value Proposition:**
- Onboarding for new users
- Feature discovery
- Bullet journal methodology education
- Self-service support via Help menu

**Design Documents:**
- `docs/session-2026-02-06-intro-guide-final.md` (approved spec)
- `docs/session-2026-02-06-intro-guide-design.md` (comprehensive design)

**Implementation Phases:**
1. **Infrastructure** (2-3 hours)
   - Install React Joyride or similar tutorial library
   - Create tutorial state management
   - Add help menu (?) icon to header

2. **Tutorial Steps** (2-3 hours)
   - Implement 7-step interactive walkthrough
   - Add spotlight overlays for key UI elements
   - Mobile-optimized step positioning

3. **Help Menu** (2.5-3 hours)
   - Restart Tutorial
   - Bullet Journal Guide (modal with methodology)
   - Keyboard Shortcuts (modal with shortcuts table)
   - Report a Bug (pre-filled GitHub issue)
   - Request a Feature (pre-filled GitHub issue)
   - GitHub Discussions link
   - About Squickr Life (version, credits)

4. **Polish** (1-2 hours)
   - Dark mode support for tutorial
   - Auto-trigger logic (once per session, zero collections)
   - Accessibility (keyboard navigation, ARIA)
   - Testing

---

## Rationale for v1.0.0 Milestone

**Why v1.0.0 for Intro Guide:**
- Represents "ready for public use"
- Onboarding is critical for first-time users
- Help menu provides self-service support
- Feature-complete for core bullet journaling workflow
- Polish and UX refinements complete

**Features Complete by v1.0.0:**
- ✅ Event sourcing architecture
- ✅ Collections (daily, monthly, custom)
- ✅ Entry types (tasks, notes, events)
- ✅ Migration (single and bulk)
- ✅ Multi-collection support
- ✅ Sub-tasks for complex work breakdown
- ✅ Collection settings and preferences
- ✅ User preferences with sensible defaults
- ✅ Temporal navigation (today/yesterday/tomorrow)
- ✅ First-time user experience (FTUX)
- ✅ Self-service help and support

---

## Version History

### Completed Versions

**v0.10.1** (February 16, 2026)
- Critical bulk migration bug fix
- 4 UAT feedback UI/UX fixes
- 1,565 tests passing
- Casey review: 9/10

**v0.8.0** (February 11, 2026)
- Production bug fixes from v0.7.0
- Fixed collection stats counting
- Fixed "Active" filter selection
- Fixed favorited monthly logs display
- Fixed multi-collection navigation
- Removed redundant UI elements
- 1,068 tests passing

**v0.7.0** (February 7-10, 2026)
- Sub-tasks feature (hierarchical task structure)
- Two-level hierarchy with parent/child relationships
- Completion and deletion cascades
- Migration symlink behavior
- Expand/collapse with keyboard accessibility
- 816+ tests passing

**v0.6.0** (February 6, 2026)
- User Preferences Enhancements
- Global default for completed task behavior
- Auto-favorite Today/Yesterday/Tomorrow daily logs
- Settings modal with user preferences
- 656+ client tests passing

**v0.5.1** (February 6, 2026)
- Fixed FAB covering bulk migrate UI
- Changed "Add to Today" → "Add Entry"
- All 996 tests passing

**v0.5.0** (February 5, 2026)
- Bulk Entry Migration
- Selection mode with checkboxes
- Quick filters (All, Incomplete, Notes, Clear)
- 33 new tests

**v0.4.4** (February 5, 2026)
- Fixed monthly log navigation
- Fixed long collection names wrapping

**v0.4.2** (February 3, 2026)
- Swipe navigation improvements
- Today/Yesterday/Tomorrow indicators
- Tomorrow in migration modal
- Mobile back button handling

**v0.4.0** (February 3, 2026)
- Collection stats display
- Completed task behavior settings
- Monthly log collection type
- 925 tests passing

---

## Next Steps

### Immediate: v0.9.0 Code Quality & Refactoring Session

**Status:** Ready to implement  
**Estimated Time:** 4-6 hours  
**Target Release:** After v0.10.1

**Goal:** Clean up technical debt, improve test coverage, and prepare codebase for v1.0.0

---

## Timeline Estimate

**Completed:**
- v0.6.0: ✅ ~7 hours (February 6, 2026)
- v0.7.0: ✅ ~12 hours (February 7-10, 2026)
- v0.8.0: ✅ ~14 hours (February 11, 2026)
- v0.10.1: ✅ ~8 hours (February 16, 2026)

**Remaining to v1.0.0:**
- v0.9.0 Code Quality & Refactoring: 4-6 hours
- v1.0.0 Intro Guide: 7-11 hours
- **Total:** 11-17 hours

**Optimistic:** 2-3 weeks to v1.0.0  
**Realistic:** 3-4 weeks to v1.0.0

---

## Success Metrics for v1.0.0

**Functionality:**
- All core bullet journaling workflows supported
- Event sourcing architecture proven stable
- Mobile-first UX polished and tested
- Help and support self-service available

**Quality:**
- All automated tests passing (target: 1000+)
- No known critical bugs
- Code review rating ≥9/10
- SOLID principles compliance verified

**User Experience:**
- New users can onboard without external help
- Mobile UX feels native and responsive
- Dark mode fully supported
- Accessibility standards met

**Documentation:**
- Architecture decisions documented
- Feature designs archived
- Deployment guide complete
- User-facing help content available

---

**Roadmap Status:** ✅ Finalized  
**Next Milestone:** v0.9.0 Code Quality & Polish → v1.0.0 Intro Guide/Walkthrough  
**Ultimate Goal:** v1.0.0 Public Launch  
**Date:** February 11, 2026
