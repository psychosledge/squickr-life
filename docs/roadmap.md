# Product Roadmap
**Last Updated:** February 28, 2026  
**Current Version:** v1.2.0  
**Status:** Post-v1.2.0 — Projection Snapshots In Progress

---

## Version Plan

> **Completed versions (v0.4.0-v1.0.0):** See [Version History](#version-history) below or `CHANGELOG.md` for full release notes.

---

## Post-v1.0.0: Code Quality & Refactoring

> Per the architectural retrospective (`docs/retrospective.md`), refactoring was deferred until after v1.0.0 ships. The event sourcing foundation is sound; the test suite is the safety net.

## Post-v1.2.0

**Current session — projection snapshots (learning exercise):**  
✅ Complete — February 28, 2026
- `ISnapshotStore` interface in domain layer
- `IndexedDBSnapshotStore` in infrastructure layer
- In-memory cache + `hydrate()` + `createSnapshot()` in `EntryListProjection`
- `SnapshotManager` with count trigger (50 events) + tab-close trigger
- Delta replay on startup
- ADR-016 written and accepted
- 725 domain / 38 infrastructure / 1117 client tests passing

**Remote Snapshot Store for Cold-Start Acceleration (ADR-017):**  
✅ Complete — February 28, 2026
- `FirestoreSnapshotStore` persists projection snapshots to Firestore (`users/{uid}/snapshots/{key}`)
- `removeUndefinedDeep` extracted to shared `firestore-utils.ts`
- `EntryEventApplicator.applyEventsOnto()` for efficient delta replay
- `EntryListProjection.hydrate()` fixed to apply delta events onto snapshot state (ADR-016 Phase 2)
- `SnapshotManager` updated with dual-store support (local + remote fire-and-forget)
- Cold-start sequence in `App.tsx`: remote snapshot restore → skip overlay if successful
- Firestore security rule for `users/{userId}/snapshots/{snapshotKey}`
- 735 domain / 51 infrastructure / 1121 client tests passing

**Previously completed deferred items:**
- ✅ Timezone utility consolidation (`DateHeader.tsx`, `formatters.ts`) — done in v2ba59d8

---

## Rationale for v1.0.0 Milestone

**Why v1.0.0 for Intro Guide:**
- Represents "ready for public use"
- Onboarding is critical for first-time users
- Help menu provides self-service support
- Feature-complete for core bullet journaling workflow
- Polish and UX refinements complete

**Features Complete at v1.0.0:**
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

**v1.2.0** (February 27, 2026) — Minor
- Bug fix: collection stats counting moved tasks as active (stats methods use `collections[]` not legacy `collectionId`)
- Recoverable deleted collections: `CollectionRestored` event, collapsed Deleted accordion in sidebar
- Recoverable deleted entries: soft-delete all entry types (tasks/notes/events), restore via actions menu, follows completed task show/hide setting, cascades to sub-tasks
- Visual distinction: deleted entries show strikethrough + reduced opacity; migrated (ghost) entries show faded text without strikethrough
- UAT bug fix: `sanitizeMigrationPointers` preserves `migratedTo` pointer even when migration target is soft-deleted
- 700 domain / 1103 client tests passing
- Casey review: approved

**v1.1.0** (February 25, 2026) — Minor
- Error toast test coverage for bulk migration failures
- `parentTaskId` → `parentEntryId` rename across domain and client (event payloads unchanged)
- Last-hop ghost "goto collection" links — only most-recent predecessor shown
- SRP split: `EntryEventApplicator` extracted from `entry.projections.ts`
- Multi-collection support for Notes and Events (feature parity with Tasks) + `BaseEntry` interface
- `isAppReady` flag with 15s Firestore timeout guard and sync error overlay
- 1,088 tests passing
- Casey review: approved

**v1.0.3** (February 21, 2026) — Patch
- Removed dead GitHub Discussions link (404 — Discussions not enabled)
- Bullet Journal Guide now shows app icons instead of raw Unicode symbols
- Fixed completed sub-tasks rendering twice when parent is in same collection
- Fixed ghost entries being invisibly included in bulk selection
- Tagline updated: "Get your shit together quicker with Squickr!"
- 1,069 tests passing
- Casey review: 9/10

**v1.0.2** (February 20, 2026) — Patch
- Fixed collection stats missing/incorrect for multi-collection tasks
- Extracted `buildEntriesByCollectionMap()` utility; `loadData` now multi-collection-aware
- 1,060 tests passing
- Casey review: 9/10

**v1.0.0** (February 19, 2026) — MILESTONE RELEASE
- 7-step interactive tutorial (react-joyride) with pause/resume across route transitions
- Help menu extended into UserProfileMenu: Restart Tutorial, Bullet Journal Guide, Keyboard Shortcuts, Report a Bug, Request a Feature, GitHub Discussions, About
- Auto-triggers on first sign-in with zero real collections (once per session)
- 1,018 tests passing
- Casey review: Approved

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

## Success Metrics for v1.0.0 — Achieved ✅

**Functionality:**
- ✅ All core bullet journaling workflows supported
- ✅ Event sourcing architecture proven stable
- ✅ Mobile-first UX polished and tested
- ✅ Help and support self-service available

**Quality:**
- ✅ All automated tests passing (1,018)
- ✅ No known critical bugs
- ✅ Code review approved
- ✅ SOLID principles compliance verified

**User Experience:**
- ✅ New users can onboard without external help
- ✅ Mobile UX feels native and responsive
- ✅ Dark mode fully supported

**Documentation:**
- ✅ Architecture decisions documented
- ✅ Feature designs archived
- ✅ Deployment guide complete
- ✅ User-facing help content available

---

**Roadmap Status:** Post-v1.2.0 — Projection Snapshots Complete  
**Current Phase:** Session Complete  
**Date:** February 28, 2026
