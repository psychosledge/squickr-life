# Next Session Roadmap
**Last Updated:** January 30, 2026

## 🎉 What We Just Completed

**Firebase Multi-Device Sync - PRODUCTION READY**
- ✅ Google authentication
- ✅ Bidirectional sync (IndexedDB ↔ Firestore)
- ✅ Multi-device support (PC ↔ Mobile)
- ✅ All tests passing (311 tests)
- ✅ Deployed to production (squickr.com)

See `docs/session-2026-01-30-firebase-sync-complete.md` for full details.

---

## 📋 Prioritized Enhancement Backlog

### 🔴 CRITICAL: Session 1 (Day 1) - ~4.5 hours

#### 1. FAB Overlapping Drag Handles on Mobile ⚡ BLOCKING
**Effort:** 30 minutes  
**Priority:** 🔴 Critical - Blocks mobile usability  
**Files:** `packages/client/src/components/FloatingActionButton.tsx`

**Problem:**  
FAB is fixed in bottom-right corner, covering drag handles for entries in that area on mobile devices.

**Solution Options:**
- **Option A (Quick Fix):** Move FAB to bottom-center on mobile only
  - Pros: 30-minute fix, immediate relief
  - Cons: Inconsistent UX across devices
  
- **Option B (Long-term):** Move drag handles to left side on all devices
  - Pros: Better UX, aligns with common patterns
  - Cons: 2-3 hours, requires testing across breakpoints

**Recommendation:** Start with Option A for immediate fix, revisit Option B in future session.

---

#### 2. Phase 6: Periodic Background Sync ⚡ COMPLETES FIREBASE
**Effort:** 1 hour  
**Priority:** 🔴 High - Completes sync feature  
**Files:** `packages/client/src/firebase/syncEvents.ts`, `packages/client/src/context/AuthContext.tsx`

**What to Add:**
- Auto-sync every 5 minutes when signed in
- Sync on network reconnection (online event listener)
- Sync on window focus (tab switching)

**Implementation:**
```typescript
// In AuthContext or sync service
useEffect(() => {
  if (!user) return;
  
  // Periodic sync every 5 minutes
  const interval = setInterval(() => syncEvents(), 5 * 60 * 1000);
  
  // Sync on network reconnection
  const handleOnline = () => syncEvents();
  window.addEventListener('online', handleOnline);
  
  // Sync on window focus
  const handleFocus = () => syncEvents();
  window.addEventListener('focus', handleFocus);
  
  return () => {
    clearInterval(interval);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('focus', handleFocus);
  };
}, [user]);
```

**Testing:**
- Verify sync triggers every 5 minutes
- Test network reconnection scenario
- Test tab switching behavior
- Ensure no duplicate sync calls

---

#### 3. Active Task Count on Collection Index ⚡ QUICK WIN
**Effort:** 3 hours  
**Priority:** 🟢 High value, low complexity  
**Files:** `packages/shared/src/entry.projections.ts`, `packages/client/src/views/CollectionIndexView.tsx`

**Current Behavior:**  
Collection index shows total entry count (e.g., "5 entries")

**Desired Behavior:**  
Show count of active tasks instead (e.g., "3 active tasks")

**Implementation Plan:**
1. Update `useCollectionProjection()` to include `activeTaskCount`
2. Modify projection logic to count entries where:
   - `entry.type === 'task'`
   - `entry.status === 'incomplete'` (not migrated, not completed)
3. Update `CollectionIndexView.tsx` to display active count
4. Add tests for edge cases (no tasks, all completed, mixed)

**Why This Matters:**  
Helps users prioritize which collections need attention without opening them.

---

### 🟡 MEDIUM: Session 2 (Day 2) - ~6-9 hours

#### 4. Collection Types & Completed Task Management 🏗️ NEEDS DESIGN
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

#### 5. Create Collection During Migration 🏗️ WORKFLOW IMPROVEMENT
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

### 🟢 POLISH: Session 3 (Day 3) - ~8-9 hours

#### 6. Collection Navigation (Page Flipping) 🎨 JOURNAL METAPHOR
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

### **Session 1: Quick Wins & Critical Fixes** (~4.5 hours)
Focus on immediate value and unblocking mobile users.

```
✅ #1: FAB mobile fix (30 min)
✅ #2: Periodic background sync (1 hour)  
✅ #5: Active task count (3 hours)
```

**Outcome:** Mobile users unblocked, Firebase feature complete, better collection prioritization.

---

### **Session 2: Strategic Features** (~6-9 hours)
Tackle features that need architecture review.

```
🏗️ #4: Collection types design review (30 min)
🏗️ #4: Implement collection types (4-6 hours)
🏗️ #3: Create collection during migration (3-4 hours)
```

**Outcome:** Better task management, streamlined daily ritual workflow.

---

### **Session 3: Polish & Delight** (~8-9 hours)
Add features that make the app feel more like a physical journal.

```
🎨 #6: Page flipping navigation (8-9 hours)
```

**Outcome:** App feels more like a physical bullet journal.

---

## 🔧 Technical Context

### Project Setup
- **Build:** `pnpm build` (must pass before commits)
- **Tests:** `pnpm test` (311 tests currently passing)
- **Deploy:** Auto-deploys to squickr.com on push to master
- **Architecture:** Event sourcing (CQRS), TypeScript, React, Vite, Tailwind

### Key Files Reference
```
packages/client/src/
├── components/
│   ├── FloatingActionButton.tsx        (#1)
│   ├── MigrateEntryModal.tsx           (#3)
│   └── CollectionViewHeader.tsx        (#6)
├── views/
│   ├── CollectionIndexView.tsx         (#5)
│   └── CollectionView.tsx              (#4, #6)
├── firebase/
│   └── syncEvents.ts                   (#2)
└── context/
    └── AuthContext.tsx                 (#2)

packages/shared/src/
├── collection.events.ts                (#4)
├── collection.projections.ts           (#4)
└── entry.projections.ts                (#5)
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
