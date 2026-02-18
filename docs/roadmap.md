# Product Roadmap
**Last Updated:** February 16, 2026  
**Current Version:** v0.10.1  
**Status:** Roadmap finalized through v1.0.0

---

## Version Plan

> **Completed versions (v0.4.0-v0.10.1):** See [Version History](#version-history) below or `CHANGELOG.md` for full release notes.

### v1.0.0 - Intro Guide/Walkthrough (MILESTONE RELEASE) — NEXT
**Target:** After v0.10.1  
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
- `docs/archive/designs/` — intro guide design specs

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

## Post-v1.0.0: Code Quality & Refactoring

> Per the architectural retrospective (`docs/retrospective.md`), refactoring is deferred until after v1.0.0 ships. The event sourcing foundation is sound; the test suite (1,565 tests) is the safety net.

**Deferred items:**
- Multi-collection pattern for Notes/Events (closes feature parity gap with Tasks)
- Timezone utility consolidation (`DateHeader.tsx`, `formatters.ts`)
- Split `entry.projections.ts` into focused projection classes (SRP)
- Complete `parentTaskId` → `parentEntryId` migration (remove deprecated field)
- Error toast in `CollectionDetailView.tsx`
- Incremental projection snapshots (performance at scale)

---

## Timeline Estimate

**Completed:**
- v0.6.0: ✅ ~7 hours (February 6, 2026)
- v0.7.0: ✅ ~12 hours (February 7-10, 2026)
- v0.8.0: ✅ ~14 hours (February 11, 2026)
- v0.10.1: ✅ ~8 hours (February 16, 2026)

**Remaining to v1.0.0:**
- v1.0.0 Intro Guide: 7-11 hours

**Optimistic:** 1-2 weeks to v1.0.0  
**Realistic:** 2-3 weeks to v1.0.0

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
**Next Milestone:** v1.0.0 Intro Guide/Walkthrough  
**Ultimate Goal:** v1.0.0 Public Launch  
**Date:** February 17, 2026
