# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-19

### Added
- **7-Step Interactive Tutorial (react-joyride):** First-run onboarding walkthrough for new users
  - Auto-triggers after sign-in when user has zero real collections (once per session)
  - Spotlight overlay highlights real DOM elements via `data-tutorial-id` anchors
  - Option A pause/resume: tutorial pauses after Step 3 (FAB), resumes automatically when user navigates into their first collection
  - Steps cover: Welcome, Collections, Create a Collection, Entry Types, Manage Collection, Migration, Navigation
  - Skip button on every step; Finish button on last step
  - Controlled mode: step index and run state managed in `TutorialContext`
  - Persists completion to `localStorage`; session deduplication via `sessionStorage`

- **Help Menu (extended UserProfileMenu):** 7 new items in the avatar dropdown
  - Restart Tutorial — replays tour from Step 1
  - Bullet Journal Guide — modal with BuJo methodology primer (entry types, states, migration practice)
  - Keyboard Shortcuts — modal with complete shortcuts table
  - Report a Bug — opens GitHub issue template in new tab (version pre-filled)
  - Request a Feature — opens GitHub feature request template in new tab
  - GitHub Discussions — opens project discussions in new tab
  - About Squickr Life — modal with version number, credits, and repository link

- **New files:** `TutorialContext.tsx`, `useTutorial.ts`, `constants/github.ts`, `BulletJournalGuideModal.tsx`, `KeyboardShortcutsModal.tsx`, `AboutModal.tsx`

- **DOM anchors:** `data-tutorial-id` attributes added to `FAB`, `CollectionHeader`, `HierarchicalCollectionList`, `CollectionNavigationControls`, `CollectionIndexView` title

### Technical
- `TutorialContext` state machine: `isRunning`, `isPaused`, `stepIndex`, `hasCompletedTutorial`; actions: `startTutorial`, `stopTutorial`, `pauseTutorial`, `resumeTutorial`, `nextStep`, `completeTutorial`, `resetTutorial`
- `CollectionDetailView` resumes tutorial on mount after loading completes; `hasResumedRef` guard prevents double-resume under React StrictMode
- `TUTORIAL_STEP_COUNT` constant kept in sync with `TUTORIAL_STEPS.length` via a startup assertion
- `constants/github.ts` centralises repo owner/name and URL builders for all GitHub links
- Tooltip width set to 340px; Step 4 content uses JSX for proper list formatting
- All debug `console.log` statements removed from `CollectionDetailView`, `TutorialContext`, and `App`

### Tests
- 1,018 tests passing (client)
- New test files: `TutorialContext.test.tsx`, `BulletJournalGuideModal.test.tsx`, `KeyboardShortcutsModal.test.tsx`, `AboutModal.test.tsx`
- Extended: `UserProfileMenu.test.tsx`, `CollectionIndexView.test.tsx`, `CollectionDetailView.test.tsx`
- Casey review: Approved

### Developer
- Implementation: 4 commits across infrastructure, Help menu, tutorial steps, and polish/bug fixes
- Milestone: v1.0.0 — first public-ready release

## [0.10.0] - 2026-02-15

### Fixed
- **Collection History Preservation (Issue #7G):** Multi-collection task migrations now preserve full collection history
  - Root cause: Deprecated `TaskMigrated` events created new task IDs, losing collection history
  - Solution: Migrated `BulkMigrateEntriesHandler` to use modern multi-collection pattern (`TaskAddedToCollection` + `TaskRemovedFromCollection`)
  - Task IDs now preserved across migrations, maintaining complete `collectionHistory`
  - Example: "Find eye doctor" sub-task now shows all 3 history entries (Monthly created, Yesterday added/removed, Today added)
  - Documented in ADR-015

- **Temporal Route Circular Navigation (Issue #7G Follow-up):** Fixed navigation menu showing current collection
  - Problem: Temporal routes like `/this-month` showed "Go to February 2026" when already viewing February
  - Root cause: Temporal identifiers (`"this-month"`) passed to navigation instead of actual collection UUIDs
  - Solution: Added `resolvedCollectionId` state to track actual UUID after temporal route resolution
  - Entry action menus now correctly exclude current collection from navigation options
  - Casey review: 8.5/10 - Production ready with excellent architecture
  - 2 new tests added for temporal route resolution

- **Ghost Entry Debug Tool Consistency:** Debug buttons now appear on all ghost entries
  - Added `EventHistoryDebugTool` to `GhostEntry` component
  - Multi-collection ghost entries now show debug buttons like legacy migrated entries
  - Consistent debugging experience across all entry types
  - 31/31 GhostEntry tests passing

- **Move Semantics:** `MoveTaskToCollectionHandler` now correctly removes from current collection only
  - Previous behavior: Incorrectly removed task from ALL collections in a loop
  - New behavior: Requires `currentCollectionId` parameter, removes from specified collection only
  - Added comprehensive validation (empty checks, task-in-collection verification, same-collection no-op)
  - Added null safety check in UI before move operations

### Technical
- **Multi-Collection Pattern Migration:**
  - `BulkMigrateEntriesHandler` refactored to eliminate `TaskMigrated` event generation for tasks
  - Added idempotency checks to prevent duplicate events if migration runs twice
  - Uses `generateEventMetadata()` helper for consistency across handlers
  - Notes and Events still use legacy migration pattern (out of scope)

- **Command Interface Enhancement:**
  - `MoveTaskToCollectionCommand` now includes `currentCollectionId` parameter
  - Enhanced JSDoc documentation for command interfaces
  - Improved type safety and validation in collection management

- **Integration Testing:**
  - Added 19 comprehensive integration tests (`multi-collection-integration.test.ts`)
  - Coverage areas: ID preservation, history preservation, move vs add modes, idempotency, atomicity, edge cases
  - All 1,540 tests passing (577 domain + 21 infrastructure + 942 client)

### Changed
- **Handler Updates:**
  - `MoveTaskToCollectionHandler` - Added `currentCollectionId` parameter, enhanced validation
  - `BulkMigrateEntriesHandler` - Removed `TaskMigrated` events for tasks, added idempotency
  - All multi-collection tests updated to pass `currentCollectionId`

- **Bug Fixes:**
  - Fixed dependency array bug in `useEntryOperations.ts` (added missing `collectionId`)
  - Fixed 3 date/time mocking issues in `CollectionDetailView.test.tsx` (system time configuration)

### Developer
- Implementation time: ~12 hours (under 18-22 hour estimate)
- 5-phase implementation: Move semantics, bulk migration, UI wiring, integration tests, documentation
- Casey review ratings: 9.5/10 (Phase 1), 9.2/10 (Phase 2)
- Zero regressions across all features
- Documented in ADR-015 with implementation details, testing strategy, and SOLID principles alignment

## [0.9.0] - 2026-02-14

### Added
- **Temporal Labels in Collection Titles (Issue #3):** Collection detail view now shows contextual date labels
  - Today's collection: "Today, February 14, 2026"
  - Yesterday's collection: "Yesterday, February 13, 2026"
  - Tomorrow's collection: "Tomorrow, February 15, 2026"
  - Monthly collections: "February 2026"
  - Uses existing `getCollectionDisplayName()` formatter for consistency
  - 6 new tests added

- **Sub-Task Visual Hierarchy (Issue #4):** Improved visual grouping of sub-tasks under parent tasks
  - Subtle background tinting (gray-50/50 light mode, gray-900/30 dark mode)
  - 2px left border (gray-200/700) for clear grouping
  - Bottom-right rounded corner for visual polish
  - Preserves existing pl-8 indentation (no additional indentation added)
  - WCAG AA compliant colors
  - 9 new tests covering light/dark modes and edge cases

### Changed
- **Link Icon Repositioning (Issue #5):** Migrated sub-task link indicators moved from bullet to after task title
  - Before: `🔗☐ Buy groceries (Shopping List)`
  - After: `☐ Buy groceries 🔗 (Shopping List)`
  - Uses Lucide React `Link2` icon (16px, blue) for consistency with other UI elements
  - Icon appears inline after title, before parent title reference
  - Includes accessibility attributes (aria-label, title tooltip)
  - 8 new tests (2 for BulletIcon, 6 for TaskEntryItem)

### Fixed
- **Menu Coverage by Long Sub-Task Text (Issue #1):** Three-dot actions menu now stays accessible
  - Portal-based rendering with position: fixed (viewport-relative)
  - Added pr-8 padding to prevent text wrapping under menu button
  - Fixed sub-task menu closing immediately after opening
  - Scroll-to-close behavior with passive listeners
  - 8 new tests for menu positioning
  - Documented in ADR-014

### Technical
- EventHistoryDebugTool (ADR-015 Phase 7) for development debugging
  - Dev-mode only debug tool for viewing event history
  - React Context pattern (eliminates 7-layer prop drilling)
  - Positioned top-right to avoid FAB overlap
  - 23 unit tests (100% passing)
- All 942 tests passing (63 test files)
- Zero regressions across all features

### Developer
- Issue #1 (menu coverage): ~6 hours
- Issue #3 (temporal labels): ~1 hour
- Issue #4 (sub-task styling): ~2 hours
- Issue #5 (link icon): ~2 hours
- Total development time: ~11 hours with testing and reviews
- Casey review ratings: 9/10, 9/10, 9/10, 9.5/10 (average 9.1/10)

### Planned for v1.0.0 - Code Quality & Polish

**Timezone Utilities & Consistency:**
- Extract date comparison to reusable utility function
- Add centralized date parsing utilities
- Fix timezone inconsistencies in `DateHeader.tsx` and `formatters.ts`
- Create ADR-014 documenting local timezone strategy

**Test Coverage Improvements:**
- Add timezone edge case tests (late night EST, positive UTC offsets)
- Add drag-and-drop tests for `HierarchicalCollectionList.tsx`
- Import `getLocalDateKey` in tests instead of duplicating logic

**Error Handling:**
- Show error toast to user in `CollectionDetailView.tsx`

**Estimated Time:** 2-4 hours  
**Status:** Ready to implement (Casey's recommendations from v0.8.0 reviews)

---

## [0.8.0] - 2026-02-11

### Added
- **Auto-Favorite Monthly Logs:** Automatically favorite last month, current month, and next month in user preferences
  - Checkbox in Settings: "Auto-favorite recent monthly logs"
  - Favorited monthly logs appear in both favorites section AND calendar hierarchy
  - Handles year boundaries correctly (Dec→Jan transitions)
  - 20 comprehensive tests added (16 for utility functions, 4 for navigation)

- **Combined Monthly Log + Month Rollup:** Unified UX for monthly logs with two-zone clickable interface
  - Triangle button: Expands/collapses child daily logs
  - Text/icon area: Navigates to monthly log collection
  - Displays calendar icon, year, and star icon for favorited monthlies
  - Favorited monthly logs appear in both locations (favorites + calendar)
  - Enhanced type safety with discriminated union
  - 7 new tests for Feature 3 scenarios

- **Parent Title for Migrated Sub-Tasks:** Show parent task context for sub-tasks in different collections
  - Format: "find hardware (Put together Bed Frame)"
  - Only displays when sub-task is in different collection than parent
  - Gray text, smaller font, in parentheses
  - O(n) batch query for performance
  - 7 comprehensive tests covering all edge cases

- **Dual Navigation with Temporal URLs:** Auto-favorited collections accessible via both temporal and stable URLs
  - Temporal URLs: `/today`, `/yesterday`, `/tomorrow`, `/this-month`, `/last-month`, `/next-month`
  - Stable URLs: `/collection/{uuid}` (always point to same collection)
  - Auto-favorited collections appear twice in navigation (temporal URL first, stable URL in calendar)
  - Chronological ordering: Last Month → Current Month → Yesterday → Today → Tomorrow → Next Month
  - Monthly logs appear BEFORE their daily logs in sort order
  - Navigation sidebar order matches Collection Index order
  - 38 comprehensive tests added (16 temporal utils, 9 navigation entries, 13 navigation hook)

### Fixed
- **Chronological Sorting:** Auto-favorited daily and monthly logs now sort correctly in chronological order
  - Fixed timezone bug: `getSortKey()` now uses local timezone instead of UTC
  - Yesterday → Today → Tomorrow order now works correctly across all timezones
  - All 31 collectionSorting tests passing (was 27/31)

### Technical
- Enhanced `HierarchyNode` type with discriminated union for better type safety
- Added `getParentTitlesForSubTasks()` batch query method to EntryListProjection
- Refactored `buildHierarchy()` to attach monthly logs to month nodes
- Added `temporalUtils.ts` for temporal URL date/month key conversion
- Added `navigationEntries.ts` for URL metadata layer (wraps collections with URLs)
- Exported `sortAutoFavoritedChronologically()` for consistent chronological sorting
- Fixed timezone handling in `getSortKey()` to use local timezone
- Fixed TypeScript errors in `collectionStatsFormatter` and `HierarchicalCollectionList`
- All 1,496 tests passing (545 domain, 21 infrastructure, 930 client)

### Developer
- Feature 1 (auto-favorite monthly logs): ~2.5 hours (under 3h estimate)
- Feature 2 (parent titles): ~2 hours (under 3.5h estimate)
- Feature 3 (combined monthly log): ~4.5 hours (on estimate)
- Feature 4 (dual navigation with temporal URLs): ~5 hours (including chronological sorting fix)
- Total development time: ~14 hours with testing and reviews
- Casey review ratings: 9/10, 9.5/10, 9/10, 9.5/10 (average 9.25/10)

## [0.7.2] - 2026-02-11

### Fixed
- **Date-dependent tests:** Collection sorting test now uses `vi.setSystemTime()` to prevent failures when date changes
- **Async handling:** Navigation tests now properly wrap callbacks in `act()` to handle React side effects

### Changed
- **CI Pipeline:** Refactored for efficiency and fail-fast behavior (version check before tests)
- **Documentation:** Added time-mocking guidelines to development guide to prevent future test issues

### Developer
- All 1,396 tests now reliable and non-flaky
- CI runs ~7-13 seconds faster per run

## [0.7.1] - 2026-02-10

### Fixed
- **Collection Stats:** Task count now only includes open tasks (excludes completed and migrated tasks)
- **Migrate Modal:** "Active" filter now correctly selects only open, non-migrated tasks
- **Favorites:** Favorited monthly logs now appear in favorites section on index page
- **Multi-Collection Navigation:** Sub-tasks in multiple collections now show "Go to [Collection Name]" menu option for easier navigation

### Changed
- **UX:** Removed redundant "Go to Parent" menu option - multi-collection navigation already provides this functionality with clearer collection names
- **Context Menu:** Sub-task menu now shows "Go to [Collection Name]" instead of duplicate navigation options

## [0.7.0] - In Progress

### Added
- **Sub-Tasks Feature (In Development):** Break down large tasks into actionable sub-tasks
  - Phase 1: Core sub-task creation and display under parent tasks
  - Phase 2: Migration symlink behavior (sub-tasks appear in both parent and migrated locations)
  - Phase 3: Parent migration cascade (unmigrated children follow parent)
  - Phase 4: Completion cascade with confirmation (complete parent → complete all children)
  - Phase 5: Deletion cascade with confirmation (delete parent → delete all children)
  - Two-level hierarchy for MVP (parent → sub-task, expandable to unlimited later)
  - Symlink behavior: migrated sub-tasks visible in both daily log and parent's collection
  - Context menu: "Add Sub-Task", "Go to [Collection]"
  - Visual indicators: 🔗 icon for migrated sub-tasks, completion badge on parents (e.g., "2/4")

### Design
- Comprehensive sub-tasks design specification (`docs/sub-tasks-design.md`)
- No orphaning allowed: parent completion/deletion cascades to all children
- Clean Architecture maintained: domain events, projections, handlers pattern
- Event sourcing: `TaskCreated` extended with optional `parentTaskId` field
- Estimated implementation: 30-38 hours across 6 phases

### Developer
- Iterative delivery: ship each phase after code review
- Casey reviews each phase before moving to next
- All phases follow TDD workflow (tests first, then implementation)

## [0.6.1] - 2026-02-07

### Fixed
- **Data Integrity:** Invalid migration indicators now automatically cleared when migrated entry is deleted (projection-level filtering)
- **Visual:** Eliminated large gap (89% reduction: 144px → 16px) between active and completed tasks sections by moving FAB clearance padding to parent container
- **UX:** Auto-favorited daily logs (Today/Yesterday/Tomorrow) now persist in Favorites section even when year/month hierarchy is collapsed
- **Mobile:** Added swipe feedback indicators with arrows, collection names, and progress bar for clearer navigation

### Changed
- **Collection Modal:** Reordered "Create Collection" modal fields - type selector now appears first for better decision flow
- **Collection List:** Removed star icons from sidebar and added clear section headers ("Favorites", "Daily Logs", "Collections") for improved visual hierarchy
- **Architecture:** Moved bottom padding responsibility from EntryList component to parent views for proper separation of concerns

### Added
- New hook: `useSwipeProgress` for tracking swipe gestures and progress
- New component: `SwipeIndicator` for visual swipe feedback with dark mode support
- Section headers in hierarchical collection list for better visual organization
- Projection filtering for invalid migration pointers with comprehensive test coverage

### Developer
- Added 6 regression tests for migration pointer sanitization
- Added 1 regression test for auto-favorites persistence  
- Added 25 new tests for swipe feedback feature (11 hook + 14 component)
- Improved component reusability by removing layout assumptions from EntryList
- All 682 tests passing (shared + client)
- No breaking changes to existing APIs

## [0.5.1] - 2026-02-06

### Fixed
- **Mobile UX:** FAB (floating action button) now hides when in selection mode to prevent overlap with SelectionToolbar
- **Clarity:** Changed AddEntryDialog title from "Add to Today" to "Add Entry" since entries are added to current collection, not necessarily "Today"

### Tests
- All 996 tests passing
- Updated 2 test assertions to match new modal title

## [0.5.0] - 2026-02-05

### Added
- **Bulk Entry Migration:** Select and migrate multiple entries at once
  - Selection mode toggle in collection header menu
  - Checkboxes for individual entry selection
  - Quick filters: Select all, incomplete tasks, notes, and deselect all
  - Bulk migration modal shows accurate count (e.g., "Migrate 12 entries")
  - Unlimited selection support with smooth performance
  - Entries maintain relative order in target collection
  - Selection clears automatically after migration or navigation
- New components: SelectionModeToggle, SelectionToolbar, SelectableEntryItem
- New hook: useSelectionMode for managing selection state

### Changed
- MigrateEntryModal now supports both single entry and bulk entry arrays
- CollectionDetailView integrates selection mode functionality
- Entry operations support batch migration handlers

### Tests
- Added 33 new test cases for bulk migration feature
- All 996 tests passing (+33 from v0.4.4)

## [0.4.4] - 2026-02-05

### Fixed
- **CRITICAL:** Monthly logs now reachable via arrow/swipe navigation - previously filtered out entirely from navigation sequence
- **UX:** Long collection names no longer truncated on mobile - now wrap to multiple lines for full visibility

### Changed
- Updated collection sorting to include monthly logs between favorited customs and daily logs
- Removed truncate CSS class from collection header title

### Tests
- Added 5 new test cases for monthly log navigation
- All 963 tests passing

## [0.4.2] - 2026-02-03

### Fixed
- Swipe navigation sensitivity improved to prevent accidental page switches during vertical scrolling
- Added Today/Yesterday/Tomorrow indicators to daily logs for easier identification
- Collection stats icons size increased for better mobile readability
- Mobile back button now closes dialogs before exiting app

### Added
- Tomorrow option added to migration modal common choices
- Current and next monthly logs in migration smart filtering

## [0.4.0] - 2026-02-03

### Added
- Collection stats display showing entry counts below collection names
- Completed task behavior settings with 3 modes (keep in place, move to bottom, collapse)
- Monthly log collection type for tracking tasks at month level
- Global and per-collection settings for completed task behavior

### Tests
- 925 tests passing (+77 from v0.3.0)

## [0.3.0] - 2026-02-03

### Fixed
- Daily log creation via migration now correctly sets type as 'daily'
- Page navigation ordering now matches collection index hierarchy
- Drag handle position on mobile moved for better thumb reach

### Changed
- Refactored CollectionDetailView (488 → 311 lines, -36%)
- Created 3 new hooks: useCollectionHandlers, useCollectionModals, useEntryOperations
- Replaced all console.log with logger utility
- Extracted constants to dedicated file

### Tests
- 848 tests passing

## Earlier Versions

See git history for versions prior to 0.3.0.
