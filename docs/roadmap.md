# Product Roadmap
**Last Updated:** February 6, 2026  
**Current Version:** v0.6.0  
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

### v0.7.0 - Sub-tasks Feature
**Target:** After v0.6.0  
**Estimated Time:** TBD (requires design)  
**Status:** Not yet designed

**Concept:**
- Support hierarchical/nested tasks
- Sub-tasks within parent tasks
- Indentation or checkboxes for sub-items

**Design Needed:**
- UX flow (how to create/edit sub-tasks)
- Data model (event sourcing implications)
- Migration strategy (existing tasks)
- UI patterns (indentation, collapse/expand)

**Questions to Answer:**
- How many levels deep? (1 level? unlimited nesting?)
- Should sub-tasks be separate entries or embedded in parent?
- How does migration work with sub-tasks?
- What happens when parent task is completed?

---

### v1.0.0 - Intro Guide/Walkthrough
**Target:** After v0.7.0 (Milestone release)  
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
- ✅ Collection settings and preferences
- ✅ User preferences with sensible defaults
- ✅ Sub-tasks for complex work breakdown
- ✅ First-time user experience (FTUX)
- ✅ Self-service help and support

---

## Version History

### Completed Versions

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

### Immediate: v0.6.0 User Preferences

**Step 1: Investigation (Sam)**
- Verify if `defaultCompletedTaskBehavior` exists in user preferences types
- Check Session 8 implementation status
- Identify gaps in current implementation

**Step 2: Design (Alex - if needed)**
- If not already implemented, design event sourcing approach
- Define user preferences events
- Plan Settings UI updates

**Step 3: Implementation (Sam)**
- Feature 1: Global default for completed task behavior (2-3 hours)
- Feature 2: Auto-favorite daily logs (2-3 hours)
- Tests and documentation

**Step 4: Review (Casey)**
- Code quality review
- Test coverage check
- SOLID principles compliance

**Step 5: Deploy**
- User testing
- Deploy v0.6.0 to production

---

### Future: v0.7.0 Sub-tasks

**Design Phase:**
- User provides requirements and use cases
- Alex designs event sourcing approach
- Define UX patterns and data model

**Implementation Phase:**
- TBD based on design complexity

---

### Future: v1.0.0 Intro Guide

**Implementation Phase:**
- Design already complete
- 4 phases: Infrastructure → Targeting → Help Menu → Polish
- 7-11 hours total
- Ready to execute when v0.7.0 complete

---

## Timeline Estimate

**Optimistic:**
- v0.6.0: 1 week (4-6 hours)
- v0.7.0: 2 weeks (8-12 hours, includes design)
- v1.0.0: 2 weeks (7-11 hours)
- **Total to v1.0.0:** ~5 weeks

**Realistic:**
- v0.6.0: 1-2 weeks
- v0.7.0: 3-4 weeks (sub-tasks can be complex)
- v1.0.0: 2-3 weeks
- **Total to v1.0.0:** 6-9 weeks

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
**Next Milestone:** v0.6.0 User Preferences  
**Ultimate Goal:** v1.0.0 Public Launch  
**Date:** February 6, 2026
