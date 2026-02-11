# Next Session Roadmap
**Last Updated:** February 11, 2026  
**Current Version:** v0.7.1 (PR pending)  
**Next Session:** Fix failing tests, then v0.8.0 feature implementation

---

## 🎯 Immediate Priority

### Fix PR #24 Failing Tests (URGENT)
**Status:** Blocking deployment  
**Estimated Time:** 30 minutes - 1 hour

**Issue:**
- PR #24 (v0.7.1) has failing tests
- Deployment to production blocked

**Steps:**
1. Check GitHub PR checks to identify which tests are failing
2. Sam investigates and fixes failing tests
3. Push fixes to master branch
4. Wait for CI validation to pass
5. Merge PR #24 and deploy v0.7.1

---

## 🎯 After Deployment: v0.8.0 Feature Implementation

### v0.8.0 - UX Enhancements (NEXT)
**Target:** After v0.7.1 is deployed  
**Estimated Time:** 7 hours (3 hours + 4 hours)  
**Status:** ✅ Designs complete and approved by Alex

**Features:**

#### 1. Auto-favorite last/current/next month (~3 hours)
- **Design:** Separate `autoFavoriteRecentMonthlyLogs: boolean` preference
- **Behavior:** Auto-favorite monthlies for last month, current month, next month
- **Implementation:**
  - Add to `packages/domain/src/user-preferences.types.ts`
  - Create `isRecentMonthlyLog()` utility in `packages/client/src/utils/collectionUtils.ts`
  - Add checkbox to `packages/client/src/components/SettingsModal.tsx`
  - Update `useCollectionHierarchy` hook to check preference

#### 2. Show parent title for linked sub-tasks (~4 hours)
- **Design:** Inline suffix format: "find hardware (Put together Bed Frame)"
- **When to show:** Only for migrated sub-tasks (in different collection than parent)
- **Where:** Entry list only (not in menus or modals)
- **Implementation:**
  - Modify `packages/client/src/views/CollectionDetailView.tsx` to fetch parent titles
  - Update `packages/client/src/components/TaskEntryItem.tsx` to display parent title
  - Thread `parentTitle` prop through component tree
  - Add CSS for muted inline display

**Design Documents:**
- Alex's task output from Session (February 11, 2026)
- Full specifications already approved

---

## 📋 Next Session Workflow

### Step 1: Fix Failing Tests (CRITICAL)
1. Say: "Check PR #24 test failures and fix them"
2. Sam investigates and fixes
3. Push and verify CI passes

### Step 2: Implement v0.8.0 Features
1. Say: "Implement auto-favorite recent monthly logs" (Feature 1)
2. Sam implements with tests
3. Casey reviews code quality
4. User tests manually

5. Say: "Implement parent title display for migrated sub-tasks" (Feature 2)
6. Sam implements with tests
7. Casey reviews code quality
8. User tests manually

### Step 3: Deploy v0.8.0
1. Commit both features
2. Create PR: master → production
3. Merge and deploy

---

## 🗺️ Long-term Roadmap

### v1.0.0 - Intro Guide/Walkthrough (MILESTONE)
**Target:** After v0.8.0  
**Estimated Time:** 7-11 hours  
**Status:** ✅ Design complete and approved

**Features:**
- 7-step interactive tutorial with spotlight overlays
- Help menu with bug/feature reporting, guides, shortcuts
- Auto-triggers for new users (zero collections)
- Mobile-optimized with dark mode

**Design Documents:**
- `docs/session-2026-02-06-intro-guide-final.md`
- `docs/session-2026-02-06-intro-guide-design.md`

---

## Recent Completion ✅

### v0.7.1 - Production Bug Fixes (PR #24 - Pending)
**Completed:** February 11, 2026  
**Actual Time:** ~4 hours

**Bug Fixes:**
- Fixed collection stats counting
- Fixed "Active" filter selection  
- Fixed favorited monthly logs display
- Fixed multi-collection navigation

**UX Improvements:**
- Removed redundant "Go to Parent" menu option
- Removed visual clutter (arrows and helper text)

**Status:** Awaiting test fixes and deployment

---

**See full roadmap:** `docs/roadmap.md`
