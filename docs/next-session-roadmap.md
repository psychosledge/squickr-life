# Next Session Roadmap
**Last Updated:** January 31, 2026

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

## 📋 Remaining Enhancement Backlog

---

### 🟢 POLISH: Session 3 (Future Enhancements) - ~8-9 hours

#### Collection Navigation (Page Flipping) 🎨 JOURNAL METAPHOR
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

### Future Considerations

#### Collection Types (Deferred)
**Decision:** Deferred in favor of per-collection view options  
**Rationale:** 
- Current solution (collapse completed toggle) solves immediate problem
- More flexible - users control each collection individually
- Don't need to commit to type architecture before understanding real usage patterns
- Can revisit when adding calendar integration or habit trackers

**Future scenarios where types might be needed:**
- Calendar views for daily logs
- Habit tracker charts
- Entry type restrictions (tasks-only collections)
- Collection-specific default icons/colors

---

## 📊 Session Summary

### **✅ Session 1: Quick Wins & Critical Fixes** (~5 hours) - COMPLETE!
Focus on immediate value and unblocking mobile users.

```
✅ FAB mobile fix (30 min)
✅ Periodic background sync (1.5 hours)
✅ Active task count (3 hours)
```

**Outcome:** ✅ Mobile users unblocked, Firebase feature complete, better collection prioritization.

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

### **Session 3: Polish & Delight** (~8-9 hours) - FUTURE
Add features that make the app feel more like a physical journal.

```
🎨 Page flipping navigation (8-9 hours)
```

**Outcome:** App feels more like a physical bullet journal.

---

## 🔧 Technical Context

### Project Setup
- **Build:** `pnpm build` (must pass before commits)
- **Tests:** `pnpm test` (736 tests currently passing - up from 667!)
- **Deploy:** Auto-deploys to squickr.com on push to master
- **Architecture:** Event sourcing (CQRS), TypeScript, React, Vite, Tailwind

### Key Files Reference
```
packages/client/src/
├── components/
│   ├── FAB.tsx                          (Session 1)
│   ├── CollectionSettingsModal.tsx      (Session 2 - new)
│   ├── MigrateEntryModal.tsx            (Session 2 - renamed)
│   └── CollectionViewHeader.tsx         (Session 3)
├── views/
│   ├── CollectionIndexView.tsx          (Session 1)
│   └── CollectionDetailView.tsx         (Session 2)
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

### Current State (After Session 2)
- 736 tests passing (348 backend + 388 frontend)
- Collections feature fully functional
- Migration workflow streamlined
- Completed tasks manageable per-collection
- Firebase sync working with periodic background updates
- Mobile-optimized FAB positioning
- Active task counts on collection index

### Next Steps
Consider Session 3 (Page Flipping Navigation) OR user testing/feedback on existing features before adding more.

---

## ✅ Definition of Done

**For Each Enhancement:**
- [x] All new code has tests (TDD approach)
- [x] All 736 tests passing (`pnpm test`)
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
- [x] Session 2 changes committed to repository

---

**Ready for Session 3?** Consider page flipping navigation OR gather user feedback first! 🚀
