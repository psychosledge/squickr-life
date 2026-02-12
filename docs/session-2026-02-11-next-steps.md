# Next Session: v0.9.0 Code Quality & Polish

**Date Prepared:** February 11, 2026  
**Current Version:** v0.8.0 (deployed)  
**Next Version:** v0.9.0  
**Estimated Time:** 2-4 hours

---

## Session Goals

Implement Casey's recommendations from v0.8.0 code reviews to improve code quality, test coverage, and developer experience before v1.0.0.

---

## Tasks Breakdown

### 1. Timezone Utilities & Consistency (1 hour)

**Objective:** Centralize timezone handling and eliminate inconsistencies

**Tasks:**
- [ ] Extract date comparison to reusable utility function
- [ ] Add centralized date parsing utilities
- [ ] Fix timezone inconsistencies in `DateHeader.tsx`
- [ ] Fix timezone inconsistencies in `formatters.ts`

**Files to Update:**
- Create: `packages/client/src/utils/dateUtils.ts` (or similar)
- Update: `packages/client/src/components/DateHeader.tsx`
- Update: `packages/client/src/utils/formatters.ts`
- Update: Any other files using date parsing/formatting

**Expected Outcome:**
- Single source of truth for date operations
- Consistent timezone handling across the app
- Easier to maintain and test

---

### 2. Test Coverage Improvements (1-2 hours)

**Objective:** Add missing test coverage for edge cases and untested functionality

**Tasks:**
- [ ] Add timezone edge case tests (late night EST, positive UTC offsets)
- [ ] Add drag-and-drop tests for `HierarchicalCollectionList.tsx`
- [ ] Import `getLocalDateKey` in tests instead of duplicating logic

**Files to Update:**
- `packages/client/src/utils/temporalUtils.test.ts` (add edge cases)
- `packages/client/src/utils/collectionSorting.test.ts` (add edge cases)
- `packages/client/src/components/HierarchicalCollectionList.test.tsx` (add drag-and-drop tests)
- Any tests duplicating `getLocalDateKey` logic

**Expected Outcome:**
- Better coverage for timezone edge cases
- Confidence in drag-and-drop functionality
- DRY principle applied to test code

---

### 3. Documentation & Error Handling (0.5-1 hour)

**Objective:** Document timezone strategy and improve user error feedback

**Tasks:**
- [ ] Create ADR-014 documenting local timezone strategy
- [ ] Add error toast to user in `CollectionDetailView.tsx`

**Files to Create:**
- `docs/architecture-decisions/ADR-014-local-timezone-strategy.md`

**Files to Update:**
- `packages/client/src/views/CollectionDetailView.tsx` (add error toast)

**Expected Outcome:**
- Clear documentation of timezone decisions
- Better user experience when errors occur

---

## Success Criteria

**Code Quality:**
- [ ] All date/time operations use centralized utilities
- [ ] No timezone inconsistencies in the codebase
- [ ] Casey review rating ≥9/10

**Test Coverage:**
- [ ] Timezone edge cases covered
- [ ] Drag-and-drop functionality tested
- [ ] All tests passing (maintain 100% pass rate)
- [ ] No duplicated test logic

**Documentation:**
- [ ] ADR-014 created and approved
- [ ] Architecture decisions up to date

**User Experience:**
- [ ] Error toasts appear when operations fail
- [ ] Users get clear feedback on errors

---

## Context from v0.8.0 Reviews

### Casey's Review: Timezone Fix (9/10)

**Strengths:**
- Excellent bug fix with proper root cause analysis
- Comprehensive test coverage
- Clear commit message

**Recommendations:**
1. Import `getLocalDateKey` in tests instead of duplicating logic ✅
2. Add timezone edge case tests (late night EST, positive UTC offsets) ⏳
3. Create ADR-014 documenting local timezone strategy ⏳
4. Extract date comparison to reusable utility function ⏳

### Casey's Review: ADR-014 Implementation (10/10)

**Strengths:**
- Perfect documentation
- Clear decision rationale
- Excellent alternatives analysis

**Recommendations:**
1. Fix timezone inconsistencies in `DateHeader.tsx` and `formatters.ts` ⏳
2. Add centralized date parsing utilities ⏳

---

## Post-Session Checklist

After completing v0.9.0:

- [ ] All tasks completed
- [ ] All tests passing
- [ ] Casey review ≥9/10
- [ ] CHANGELOG.md updated
- [ ] Version bumped to 0.9.0
- [ ] Committed and pushed to master
- [ ] PR created to production
- [ ] Ready for v1.0.0 (Intro Guide)

---

## Next After v0.9.0

**v1.0.0 - Intro Guide/Walkthrough**
- 7-step interactive tutorial
- Help menu with support resources
- First-time user experience (FTUX)
- Ready for public launch

**Estimated Time:** 7-11 hours  
**Design Status:** ✅ Complete and approved  
**Implementation Status:** Ready to begin after v0.9.0

---

**Prepared by:** OpenCode  
**Session:** v0.8.0 completion and v0.9.0 planning  
**Status:** Ready for next session
