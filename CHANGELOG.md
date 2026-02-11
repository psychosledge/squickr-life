# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
