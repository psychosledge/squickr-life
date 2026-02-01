# Next Session Roadmap
**Last Updated:** February 1, 2026

## 🎉 Session 3 Complete - Polish & UX Enhancements Delivered! ✅

**Completed Today (February 1, 2026):**

### ✅ User Profile Menu (2-3 hours)
- Replaced email text + sign-out button with Google profile picture avatar
- Dropdown menu with user display name, email, and sign out option
- Initials fallback with gradient background (when no profile photo)
- Full accessibility (ARIA labels, keyboard navigation, focus management)
- Dark mode support with proper contrast
- Created `userUtils.ts` with `getInitials()` utility (9 tests)
- Created `UserProfileMenu.tsx` component (13 tests)
- Modified `CollectionIndexView.tsx` and `CollectionHeader.tsx`
- 22 new tests (all passing)
- **Casey Review:** 9/10 - "Excellent implementation with strong accessibility"
- **Status:** Committed (commit 0386c98)

### ✅ Page Flipping Navigation (8-9 hours)
- Previous/Next arrow buttons in collection headers
- Shows collection names in tooltips on hover
- Keyboard shortcuts (left/right arrow keys) - only when not editing text
- Swipe gestures on mobile (left/right to navigate)
- Reactive updates when collections are added/removed/reordered
- Disabled state when at first/last collection
- Created `useCollectionNavigation.ts` hook (8 tests)
- Created `CollectionNavigationControls.tsx` component (10 tests)
- Integrated into `CollectionHeader.tsx` and `CollectionDetailView.tsx`
- 18 new tests (all passing)
- **Casey Review:** 9/10 - "Solid implementation with good separation of concerns"
- **Status:** Committed (commit 0386c98)

**Total Time:** ~11 hours (estimate was 10-12 hours) ✅  
**Test Count:** 776 tests passing (348 backend + 428 frontend)  
**Code Quality:** Both features approved by Casey, deployed to production  
**Files:** 8 created, 4 modified, 1,219 lines added

See detailed implementation notes in this session's conversation history.

---

## 🎉 Session 2 Complete - Strategic Features Delivered! ✅

**Completed Today (January 31, 2026):**

### ✅ Collapse Completed Tasks Feature (4-5 hours)
- Per-collection setting to collapse completed tasks
- Completed tasks shown in expandable section at bottom
- Settings option added to collection menu (⋮)
- Default: OFF (preserves current behavior)
- Backend: `CollectionSettingsUpdated` event + `UpdateCollectionSettingsHandler`
- Frontend: `CollectionSettingsModal` + collapsible UI in `CollectionDetailView`
- 42 new tests (13 backend + 29 frontend)
- **Casey Review:** 9.5/10 - "Exceptional implementation"
- **Status:** Committed (commit 52e10f7)

### ✅ Create Collection During Migration (3-4 hours)
- Added "+ Create New Collection" option in migration modal
- Streamlined workflow (no need to cancel and restart)
- Nested modal flow with auto-selection
- Renamed: `MoveEntryToCollectionModal` → `MigrateEntryModal` (more BuJo-authentic)
- Updated terminology throughout UI
- 29 new tests for nested modal flow
- **Casey Review:** 8.5/10 - "Solid, well-tested implementation"
- **Status:** Committed (commit 52e10f7)

**Total Time:** ~7-8 hours (estimate was 6-9 hours) ✅  
**Test Count:** 736 tests passing (348 backend + 388 frontend)  
**Code Quality:** Both features approved by Casey, ready for production

**Architecture Decision Made:**
- **Deferred collection types** - Opted for per-collection view option instead of fundamental collection types
- Rationale: Solves immediate problem (clutter), more flexible, doesn't lock into architecture before understanding real usage patterns
- Future: Can introduce types later when calendar integration or habit trackers are needed

See detailed implementation notes in this session's conversation history.

---

## 🎉 Session 1 Complete - All Quick Wins Delivered! ✅

**Completed (January 30, 2026):**

### ✅ #1: FAB Mobile Fix (30 min)
- Centered FAB on mobile to avoid drag handle overlap
- Desktop behavior unchanged (bottom-right)
- All tests passing

### ✅ #2: Periodic Background Sync (1.5 hours)
- Auto-sync every 5 minutes when signed in
- Sync on window focus (tab switching)
- Sync on network reconnection
- Pause timer when tab hidden (battery optimization)

### ✅ #3: Active Task Count on Collection Index (3 hours)
- Shows "3 active tasks" instead of "5 entries"
- Smart display: "No active tasks" / "1 active task" / "N active tasks"
- Excludes completed, migrated, notes, and events

**Total Time:** ~5 hours  
**Test Count:** 667 tests passing

---

## 🎉 Session 4A Complete - Quick Fixes Delivered! ✅

**Completed (February 3, 2026):**

### ✅ #1: Remove Page Footer (15 min)
- Removed footer text ("Event-Sourced • CQRS • TDD...") from CollectionIndexView
- Footer was covered by FAB and provided no user value
- Updated tests to remove footer checks
- **Status:** Committed

### ✅ #2: Shorten Menu Text (15 min)
- Changed "Migrate to Collection" → "Migrate" in EntryActionsMenu
- Cleaner, more concise menu item text
- Modal title remains verbose for context
- **Status:** Committed

### ✅ #3: Remove Uncategorized from Migration Options (1 hour)
- Removed "Uncategorized" from migration target options
- Uncategorized is now purely a virtual collection for orphaned entries
- Users must explicitly choose a collection or create one
- **Status:** Committed

### ✅ #4: Fix Modal Z-Index Bug (15 min)
- Increased CreateCollectionModal z-index to z-70
- Nested modal now appears above parent MigrateEntryModal (z-50)
- Fixed blocking issue in nested modal workflow
- **Status:** Committed

**Total Time:** ~2 hours (estimate was 2 hours) ✅  
**Test Count:** 772 tests passing (348 backend + 424 frontend)  
**Code Quality:** All fixes verified and deployed

### ✅ Bug Fix: Entry Not Migrated During Collection Creation (30 min)
- Fixed bug where entries weren't migrated when creating new collection during migration flow
- Changed `onCreateCollection` to return new collection ID
- Auto-migrate entry after collection creation, then close modals
- Added test coverage for complete flow
- **Test Count:** 773 tests passing (348 backend + 425 frontend)
- **Status:** Fixed and verified

---

## 📝 User Feedback Summary (February 2, 2026)

After using the app in production, user identified the following strategic feature requests:

**Strategic Feature Requests:**

1. 📅 **Calendar integration & naming templates** - Big idea requiring architecture design
   - Template-based collection naming (e.g., "Daily {MM}-{DD}-{dw}" → "Daily 02-01-Sat")
   - Collection types aligned with BuJo methodology (Daily Log, Monthly Log, Future Log)
   - Calendar navigation and date-based organization
   - Google Calendar integration (import/export - details TBD)
   - Virtual migrations between daily logs
   - Manual creation workflow (for now)

2. ⭐ **Collection prioritization/favoriting** - Solve collection list growth problem
   - **Problem:** As collection count grows, harder to navigate to relevant collections
   - **Need:** Prioritize active/relevant collections over historical ones
   - **Context:** Traditional BuJo has future/monthly/daily hierarchy + custom collections
   - **Possible solutions to explore:**
     - Simple favoriting feature (star/unstar collections)
     - Collection types with automatic prioritization (Daily > Monthly > Custom > Historical)
     - Pinned collections (always at top)
     - Smart sorting (recently accessed, most active tasks)
     - Collection filters/views (show only favorites, show only active)
   - **Applies to:** Both collection index list AND migration modal target list

---

## 📋 Session 4B Plan - Calendar Architecture Design

**Status:** 🟢 NEXT UP  
**Total Estimated Time:** 1-2 hours

### **Session 4B: Calendar Architecture Design** 🎨 DESIGN SESSION

Strategic planning session to design collection types, naming templates, calendar integration, and collection prioritization before implementation.

#### Goals:
1. **Design collection type architecture** (Daily Log, Monthly Log, Future Log, Custom)
2. **Define template system** for date-based collection naming
3. **Solve collection prioritization problem** (favoriting, pinning, smart sorting)
4. **Scope Google Calendar integration** (import/export/sync?)
5. **Plan virtual migration behavior** (auto-migrate tasks between days?)
6. **Create detailed implementation roadmap** for Session 5+

#### Key Questions to Answer:

**Collection Types:**
- What types do we need? (Daily, Monthly, Future, Custom)
- How do we model date-based collections in event sourcing?
- Should collection type be immutable or changeable?

**Template System:**
- Template syntax: `Daily {MM}-{DD}-{dw}` → "Daily 02-01-Sat"
- Preset templates vs custom template editing?
- Where to store user's preferred templates?

**Calendar Integration:**
- **Import:** Google Calendar events → BuJo entries?
- **Export:** BuJo tasks → Google Calendar events?
- **Two-way sync** or read-only?
- OAuth flow and data persistence?

**Daily Workflow:**
- Auto-create daily logs or manual creation?
- Virtual migrations (yesterday's incomplete tasks → today)?
- How does template creation fit into daily ritual?

**Implementation Phases:**
- Phase 1: Template-based naming (no types yet)
- Phase 2: Collection types + date fields
- Phase 3: Calendar UI navigation
- Phase 4: Virtual migrations
- Phase 5: Google Calendar integration

#### Deliverables:
- Architecture decision document
- Data model diagrams
- Implementation plan with effort estimates
- Updated roadmap for Session 5+

#### Participants:
- **Alex** (Architecture decisions, system design)
- **User** (Requirements, BuJo workflow insights)
- **Sam** (Implementation feasibility)

---

### **Session 5+: Implementation (TBD after design)**

Will be planned after Session 4B architecture design session.

Likely phases:
1. **Template-Based Collection Creation** (~2-3 hours)
2. **Collection Types & Date Fields** (~3-4 hours)
3. **Calendar UI Navigation** (~4-5 hours)
4. **Virtual Migrations** (~2-3 hours)
5. **Google Calendar Integration** (~4-6 hours)

**Total Estimated:** ~15-20 hours across multiple sessions

---

## 📋 Enhancement Backlog (Longer Term)

### Collection Types Architecture (Being Designed in Session 4B)
**Status:** Architecture design needed before implementation

**Core Concept:**  
Align with Bullet Journal methodology by introducing typed collections:

**Proposed Types:**
1. **Daily Log** - Date-based daily journal (e.g., "Daily 02-01-Sat")
2. **Monthly Log** - Month overview and planning (e.g., "Monthly 2026-02")
3. **Future Log** - Long-term planning (e.g., "Future 2026")
4. **Custom Collection** - Topic-based (e.g., "Work Projects", "Books to Read")

**Key Features:**
- Template-based naming for date-based logs
- Calendar navigation (jump to any date)
- Virtual migrations (tasks auto-suggest migration between days)
- Google Calendar integration (import/export events)
- Hierarchical organization (Year → Month → Day)

**Why Now:**  
User is ready to adopt full BuJo workflow with daily ritual. Previous decision to defer types was correct (we learned what we needed first), but now we have clear requirements.

**Next Step:**  
Session 4B architecture design to plan implementation approach.

---

### Firebase Sync Enhancements (Low Priority)
**Status:** Deferred - Core sync working well

**Optional improvements:**
- Sync status indicator ("Syncing...", "✓ Synced")
- Better error handling for sync failures
- Retry logic for failed uploads
- Offline change queue visualization

**Estimated Effort:** ~3-4 hours  
**Priority:** Low - Current implementation is solid, these are polish items

---

## 📊 Session Summary

### **✅ Session 4A: Quick Fixes** (~2 hours) - COMPLETE!
Small UX improvements and bug fixes identified from user feedback.

```
✅ Remove page footer (15 min)
✅ Shorten menu text (15 min)
✅ Remove Uncategorized from migrations (1 hour)
✅ Fix modal z-index bug (15 min)
```

**Outcome:** ✅ Cleaner UI, better migration UX, nested modals work correctly.

---

### **✅ Session 2: Strategic Features** (~7-8 hours) - COMPLETE!
Tackle workflow improvements and collection management.

```
✅ Collapse completed tasks (4-5 hours)
✅ Create collection during migration (3-4 hours)
✅ Architecture decision: Deferred collection types
```

**Outcome:** ✅ Better task management, streamlined daily ritual workflow, flexible per-collection settings.

---

### **✅ Session 3: Polish & UX Enhancements** (~11 hours) - COMPLETE!
Add features that make the app feel more polished and professional.

```
✅ User profile menu (2-3 hours)
✅ Page flipping navigation (8-9 hours)
```

**Outcome:** ✅ Cleaner header UI, better navigation UX, app feels more like a physical bullet journal.

---

### **✅ Session 4A: Quick Fixes** (~2 hours) - COMPLETE!
Small UX improvements and bug fixes identified from user feedback.

```
✅ Remove page footer (15 min)
✅ Shorten menu text (15 min)
✅ Remove Uncategorized from migrations (1 hour)
✅ Fix modal z-index bug (15 min)
```

**Outcome:** ✅ Cleaner UI, better migration UX, nested modals work correctly.

---

## 🔧 Technical Context

### Project Setup
- **Build:** `pnpm build` (must pass before commits)
- **Tests:** `pnpm test` (776 tests currently passing)
- **Deploy:** Auto-deploys to squickr.com on push to master
- **Architecture:** Event sourcing (CQRS), TypeScript, React, Vite, Tailwind

### Key Files Reference
```
packages/client/src/
├── components/
│   ├── FAB.tsx                          (Session 1)
│   ├── CollectionSettingsModal.tsx      (Session 2 - new)
│   ├── MigrateEntryModal.tsx            (Session 2 - renamed)
│   ├── UserProfileMenu.tsx              (Session 3 - new)
│   ├── CollectionNavigationControls.tsx (Session 3 - new)
│   └── CollectionHeader.tsx             (Session 3 - modified)
├── views/
│   ├── CollectionIndexView.tsx          (Session 1, 3)
│   └── CollectionDetailView.tsx         (Session 2, 3)
├── hooks/
│   └── useCollectionNavigation.ts       (Session 3 - new)
├── utils/
│   └── userUtils.ts                     (Session 3 - new)
├── firebase/
│   ├── syncEvents.ts                    (Session 1)
│   └── SyncManager.ts                   (Session 1)
└── context/
    └── AuthContext.tsx                  (Session 1)

packages/shared/src/
├── collection.types.ts                  (Session 2)
├── collection.handlers.ts               (Session 2)
├── collection.projections.ts            (Session 2)
└── entry.projections.ts                 (Session 1)
```

### Development Workflow
1. Write tests first (TDD approach)
2. Implement feature incrementally
3. Run `pnpm test` to verify all tests pass
4. Run `pnpm build` to verify TypeScript compiles
5. Commit with clear message (e.g., "feat: add periodic background sync")
6. Push to master (auto-deploys to production)

---

## 📝 Notes for Next Session

### User Preferences
- **TDD approach:** Write tests first
- **Incremental commits:** Clear, atomic changes
- **BuJo alignment:** Stay true to bullet journal methodology
- **Mobile matters:** User actively uses both PC and mobile
- **Quick wins preferred:** Deliver value early, save big changes for later
- **Flexibility over types:** Prefer per-collection settings over rigid collection types

### Current State (After Session 4A)
- 772 tests passing (348 backend + 424 frontend)
- Quick fixes complete (footer removed, menu shortened, uncategorized fixed, modal z-index fixed)
- User profile menu with Google photos and dropdown
- Page flipping navigation with keyboard/swipe support
- Collections feature fully functional
- Migration workflow streamlined
- Completed tasks manageable per-collection
- Firebase sync working with periodic background updates
- Mobile-optimized FAB positioning
- Active task counts on collection index

### Next Steps
**Session 4B:** Calendar architecture design session with Alex  
**Session 5+:** Implementation based on architecture design

---

## ✅ Definition of Done

**For Each Enhancement:**
- [x] All new code has tests (TDD approach)
- [x] All 776 tests passing (`pnpm test`)
- [x] TypeScript compiles without errors (`pnpm build`)
- [x] Mobile responsiveness verified (if UI change)
- [x] Feature works on both PC and mobile
- [x] Code committed with clear message
- [x] Successfully deployed to squickr.com

**For This Roadmap:**
- [x] Firebase sync marked as complete
- [x] All enhancements documented with effort estimates
- [x] Clear session plan with priorities
- [x] Technical context provided for next session
- [x] Session 3 changes committed to repository

---

**Ready for Session 4?** Consider user testing and feedback gathering first! 🚀
