# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
