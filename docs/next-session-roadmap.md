# Next Session Roadmap
**Last Updated:** January 30, 2026

## 🎉 Session 1 Complete - All Quick Wins Delivered! ✅

**Completed Today (January 30, 2026):**

### ✅ #1: FAB Mobile Fix (30 min)
- Centered FAB on mobile to avoid drag handle overlap
- Desktop behavior unchanged (bottom-right)
- All tests passing
- **Status:** Committed, ready for deployment

### ✅ #2: Periodic Background Sync (1.5 hours including test fixes)
- Auto-sync every 5 minutes when signed in
- Sync on window focus (tab switching)
- Sync on network reconnection
- Pause timer when tab hidden (battery optimization)
- Debouncing to prevent sync storms
- All 332 tests passing (fixed 6 timer-related tests)
- **Status:** Committed, ready for deployment

### ✅ #5: Active Task Count on Collection Index (3 hours)
- Shows "3 active tasks" instead of "5 entries"
- Smart display: "No active tasks" / "1 active task" / "N active tasks"
- Excludes completed, migrated, notes, and events
- All 667 tests passing (10 new projection tests)
- **Status:** Committed, ready for deployment

**Total Time:** ~5 hours (estimate was 4.5 hours)  
**Test Count:** 667 tests passing (up from 332)  
**Code Quality:** All reviews approved (Alex planned, Sam implemented, Casey reviewed)

See detailed implementation notes in this session's conversation history.

---

## 📋 Remaining Enhancement Backlog

### 🟡 MEDIUM: Session 2 (Next Session) - ~6-9 hours

#### #2: Collection Types & Completed Task Management 🏗️ NEEDS DESIGN
**Effort:** 4-6 hours (after design review)  
**Priority:** 🟡 Medium - Requires architecture discussion  
**Files:** Multiple - domain events, projections, UI components

**Problem:**  
Completed tasks clutter collections. Need a way to collapse/hide them while maintaining bullet journal methodology.

**Proposed Solution:**  
Introduce collection types aligned with BuJo methodology:

**Collection Types:**
- **Log** (default) - Chronological entries (existing behavior)
  - Shows all entries in order
  - Used for daily logs, journals, meeting notes
  
- **List** - Reference lists (existing behavior, different context)
  - Shows all entries in order
  - Used for books to read, project ideas, contacts
  
- **ToDo** - Task-focused collections
  - Only accepts task entries
  - Auto-collapses completed tasks
  - Shows active tasks prominently
  - Used for project task lists, sprint backlogs

**Architecture Questions for User:**
1. Should collection type be set at creation or changed later?
2. Should we add a new domain event `CollectionTypeSet`?
3. How should migration work for ToDo collections (tasks only)?
4. Should completed tasks be hidden or collapsed (expandable)?

**Files to Change:**
- `packages/shared/src/collection.events.ts` - Add collection type
- `packages/shared/src/collection.projections.ts` - Filter logic
- `packages/client/src/views/CollectionView.tsx` - Conditional rendering
- Domain tests for new behavior

**⚠️ Action Required:** Schedule 30-minute design review before implementing.

---

#### #3: Create Collection During Migration 🏗️ WORKFLOW IMPROVEMENT
**Effort:** 3-4 hours  
**Priority:** 🟡 Medium - Improves daily ritual workflow  
**Files:** `packages/client/src/components/MigrateEntryModal.tsx`

**Current Behavior:**  
User must cancel migration, create collection, then retry migration.

**Desired Behavior:**  
Add "+ Create New Collection" option in migration modal dropdown.

**User Flow:**
1. User clicks migrate on entry
2. Migration modal opens with collection dropdown
3. User selects "+ Create New Collection"
4. Create collection modal opens (nested/chained)
5. User creates collection
6. Returns to migration modal with new collection pre-selected
7. User confirms migration

**Implementation:**
- Add "+ Create New Collection" as first option in dropdown
- Handle selection to open `CreateCollectionModal`
- Pass callback to pre-select newly created collection
- Ensure modal focus management works (nested modals)
- Add tests for two-modal flow

**Why This Matters:**  
Streamlines the daily ritual of migrating tasks to new collections.

---

### 🟢 POLISH: Session 3 (Future) - ~8-9 hours

#### #4: Collection Navigation (Page Flipping) 🎨 JOURNAL METAPHOR
**Effort:** 8-9 hours  
**Priority:** 🟢 Low - Nice to have, aligns with journal metaphor  
**Files:** Multiple - headers, keyboard handlers, gesture library

**Desired Behavior:**  
Navigate between collections like flipping pages in a physical journal.

**Features:**
- **Previous/Next Arrow Buttons** in collection headers
  - Show previous/next collection names on hover
  - Disable when at first/last collection
  
- **Swipe Gestures** on mobile
  - Swipe right → Previous collection
  - Swipe left → Next collection
  
- **Keyboard Shortcuts** on desktop
  - Left arrow → Previous collection
  - Right arrow → Next collection
  - Only active when not editing text

**Implementation:**
1. **Navigation Order** - Use collection index sort order
2. **Header Buttons** - Add to `CollectionViewHeader.tsx`
3. **Keyboard Shortcuts** - Global event listener with input detection
4. **Swipe Gestures** - Add gesture library (e.g., `react-swipeable`)
5. **Circular Navigation** - Decide if first/last wraps around

**Dependencies:**
- May need gesture library for swipe detection
- Requires careful keyboard event handling (don't interfere with editing)

**Why This Matters:**  
Makes the app feel more like a physical bullet journal, improving the user experience.

---

## 📊 Recommended Session Plan

### **✅ Session 1: Quick Wins & Critical Fixes** (~5 hours) - COMPLETE!
Focus on immediate value and unblocking mobile users.

```
✅ #1: FAB mobile fix (30 min) - DONE
✅ #2: Periodic background sync (1.5 hours) - DONE  
✅ #5: Active task count (3 hours) - DONE
```

**Outcome:** ✅ Mobile users unblocked, Firebase feature complete, better collection prioritization.

---

### **Session 2: Strategic Features** (~6-9 hours)
Tackle features that need architecture review.

```
🏗️ #2: Collection types design review (30 min)
🏗️ #2: Implement collection types (4-6 hours)
🏗️ #3: Create collection during migration (3-4 hours)
```

**Outcome:** Better task management, streamlined daily ritual workflow.

---

### **Session 3: Polish & Delight** (~8-9 hours)
Add features that make the app feel more like a physical journal.

```
🎨 #4: Page flipping navigation (8-9 hours)
```

**Outcome:** App feels more like a physical bullet journal.

---

## 🔧 Technical Context

### Project Setup
- **Build:** `pnpm build` (must pass before commits)
- **Tests:** `pnpm test` (667 tests currently passing - up from 332!)
- **Deploy:** Auto-deploys to squickr.com on push to master
- **Architecture:** Event sourcing (CQRS), TypeScript, React, Vite, Tailwind

### Key Files Reference
```
packages/client/src/
├── components/
│   ├── FAB.tsx                          (#1 - completed)
│   ├── MigrateEntryModal.tsx            (#3)
│   └── CollectionViewHeader.tsx         (#4)
├── views/
│   ├── CollectionIndexView.tsx          (#5 - completed)
│   └── CollectionView.tsx               (#2, #4)
├── firebase/
│   ├── syncEvents.ts                    (#2 - completed)
│   └── SyncManager.ts                   (#2 - completed, new file)
└── context/
    └── AuthContext.tsx                  (#2 - completed)

packages/shared/src/
├── collection.events.ts                 (#2)
├── collection.projections.ts            (#2)
└── entry.projections.ts                 (#5 - completed)
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

### Design Questions to Resolve
Before implementing **#4 (Collection Types)**, schedule a 30-minute design review to answer:
1. Can users change collection type after creation?
2. What domain events are needed for collection types?
3. How should migration work for ToDo-type collections?
4. Should completed tasks be hidden entirely or just collapsed?

### Future Enhancements (Not Prioritized Yet)
From `docs/session-2026-01-29-phase5-feedback.md`, there are additional items that may be prioritized in future sessions. Review that document for comprehensive feedback.

---

## ✅ Definition of Done

**For Each Enhancement:**
- [ ] All new code has tests (TDD approach)
- [ ] All 311+ tests passing (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] Mobile responsiveness verified (if UI change)
- [ ] Feature works on both PC and mobile
- [ ] Code committed with clear message
- [ ] Successfully deployed to squickr.com

**For This Roadmap:**
- [x] Firebase sync marked as complete
- [x] All enhancements documented with effort estimates
- [x] Clear session plan with priorities
- [x] Technical context provided for next session
- [ ] Changes committed to repository

---

**Ready to start Session 1?** Begin with the FAB mobile fix (#1) for immediate impact! 🚀
