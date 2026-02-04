# User Feedback - Session 9: v0.4.0 Mobile UX Issues
**Date:** February 3, 2026 (Evening)  
**Context:** User deployed v0.4.0 to production and tested on mobile device  
**Version:** 0.4.0 (Session 8 deployment)  
**Related Commit:** b86780d - Version 0.4.0

---

## 📱 Context

After successfully deploying Session 8 (v0.4.0) with three new features (Collection Stats, Completed Task Behavior, Monthly Logs), the user tested the app on their mobile device and discovered 5 UX issues that prevent comfortable daily use.

**Session 8 Features Deployed:**
1. Collection stats display (bullet journal symbols below collection names)
2. Completed task behavior settings (3 modes: keep in place, move to bottom, collapse)
3. Monthly log collection type (new 'monthly' type with hierarchy integration)

**Test Results:** 925 tests passing, Casey rating 9.5/10, production deployment successful

---

## 🐛 Issues Identified (Priority Order)

### Issue #1: Swipe Navigation Too Sensitive 🔴 CRITICAL
**Problem:** Vertical scrolling frequently triggers horizontal page navigation on mobile

**User Description:**
> "The swipe navigation is too sensitive. When I try to scroll down the page vertically, it often switches to the previous/next collection instead."

**Impact:**
- Makes mobile scrolling frustrating
- Accidental page switches lose context
- Core mobile UX is broken

**User Decision:**
- Make swipe less sensitive (not disabled)
- Distinguish scroll intent from navigation intent

**Priority:** CRITICAL - Blocks daily mobile use

---

### Issue #2: Missing Today/Yesterday/Tomorrow Indicators 🟡 HIGH
**Problem:** Cannot tell if a daily log is today, yesterday, or tomorrow

**User Description:**
> "Looking at the collection list, I can't easily tell which daily log is today vs yesterday vs tomorrow. The dates are formatted nicely (e.g., 'Saturday, February 1'), but I have to mentally calculate which one is today."

**Impact:**
- Slows down navigation
- Requires mental calculation
- Common task (finding today) is harder than it should be

**User Decision:**
- Use inline text format: "Today, February 3" or "Yesterday, February 2"
- Apply to both hierarchical collection list and migration modal

**Format Examples:**
- "Today, February 3, 2026"
- "Yesterday, February 2, 2026"
- "Tomorrow, February 4, 2026"
- Regular: "Saturday, February 1, 2026"

**Priority:** HIGH - Frequent pain point in daily use

---

### Issue #3: Missing "Tomorrow" in Migration Common Choices 🟡 MEDIUM
**Problem:** Migration modal's smart filtering doesn't include tomorrow or monthly logs

**User Description:**
> "The migration modal shows today, pinned collections, and yesterday. But I often want to migrate tasks to tomorrow, or to this month's monthly log. I have to expand 'Show all collections' every time."

**Impact:**
- Extra click required for common migration destinations
- Reduces usefulness of smart filtering
- Slows down common workflows

**Current Smart Filtering:**
- Today's daily log
- Pinned collections
- Yesterday (if exists)

**Requested Additions:**
- Tomorrow's daily log (create if doesn't exist)
- Current monthly log (e.g., "February 2026")
- Next monthly log (e.g., "March 2026")

**Priority:** MEDIUM - Frequent but not critical

---

### Issue #4: Collection Stats Icons Too Small 🟡 MEDIUM
**Problem:** Bullet journal symbols in collection stats are hard to read on mobile

**User Description:**
> "The collection stats look great, but the symbols (• × – ○) are a bit too small on mobile. They're hard to see at a glance."

**Current Implementation:**
- Typography: `text-xs` (12px)
- Format: `• 3  × 12  – 5  ○ 2`

**User Decision:**
- Increase size from `text-xs` (12px) to `text-base` (16px)
- Keep existing bullet symbols (• × – ○)

**File:** `CollectionStats.tsx`

**Priority:** MEDIUM - Polish improvement

---

### Issue #5: Mobile Back Button Behavior 🟢 LOW (Bonus)
**Problem:** Mobile back button navigates away from app instead of closing dialogs

**User Description:**
> "When a modal is open (like migration or settings), pressing the back button on my phone closes the whole app instead of just closing the modal. That's unexpected behavior for a PWA."

**Expected Behavior:**
1. Back button closes dialogs (if open)
2. Back button goes to collection list (if on collection detail)
3. Back button exits app (if on collection list)

**Implementation:**
- Use History API (`pushState`/`popState`)
- Standard PWA pattern for back button handling

**Priority:** LOW - Nice-to-have enhancement

---

## 📋 Session 9 Plan (APPROVED)

### Title
**Session 9: v0.4.0 Mobile & UX Polish**

### Scope
All 5 issues above, in priority order

### Estimated Time
5-8 hours total

### Target Version
**v0.4.1** (patch release - bug fixes and polish)

### Work Loop (NEW PATTERN)
**Incremental Casey Reviews:**
1. Sam implements Item #1
2. **Casey reviews Item #1** (not whole session)
3. Sam implements Item #2
4. **Casey reviews Item #2**
5. Continue until all 5 items done
6. User manual testing
7. Deploy v0.4.1

**Rationale:** This is different from Sessions 7-8 where Casey reviewed once at the end. For Session 9, we have 5 distinct items that could each introduce bugs. Catching issues early prevents cascading problems and rework.

---

## 🔄 Roadmap Impact

### Session 9 (New Plan)
- **Title:** v0.4.0 Mobile & UX Polish
- **Status:** READY TO START
- **Estimated Time:** 5-8 hours
- **Items:** 5 issues from user feedback above

### Session 10 (Postponed from Session 9)
- **Title:** Bulk Entry Migration
- **Status:** DEFERRED
- **Reason:** Mobile UX polish takes priority over new features

**User Decision:** Fix mobile UX issues before adding bulk migration feature. The app needs to be comfortable for daily mobile use first.

---

## 🎯 Success Criteria

### Implementation
- [ ] All 5 items implemented in priority order
- [ ] Casey reviews and approves each item individually
- [ ] All existing 925 tests still passing
- [ ] 935+ tests after Session 9 (target: +10 new tests)

### Testing
- [ ] Swipe navigation works without false triggers
- [ ] Today/yesterday/tomorrow indicators display correctly
- [ ] Migration modal includes tomorrow and monthly logs
- [ ] Collection stats symbols are readable on mobile
- [ ] Back button behaves correctly (closes dialogs, then navigates)

### Deployment
- [ ] User manual testing on mobile passes
- [ ] Casey final approval
- [ ] Deploy v0.4.1 to production

---

## 💡 User Design Decisions

### Issue #1: Swipe Sensitivity
- ✅ Make less sensitive (not disabled)
- ✅ Distinguish scroll intent from navigation intent
- ❌ Don't remove swipe navigation entirely

### Issue #2: Date Indicators
- ✅ Use inline text format (not separate badges or icons)
- ✅ Examples: "Today, February 3" or "Yesterday, February 2"
- ✅ Apply to both collection list and migration modal

### Issue #3: Migration Choices
- ✅ Add "Tomorrow" to smart filtering
- ✅ Add current monthly log to smart filtering
- ✅ Add next monthly log to smart filtering

### Issue #4: Stats Icon Size
- ✅ Increase from `text-xs` (12px) to `text-base` (16px)
- ✅ Keep existing bullet symbols (• × – ○)
- ❌ Don't change symbols or design

### Issue #5: Back Button
- ✅ Implement back button behavior
- ✅ Include in Session 9 scope
- ✅ Use standard PWA History API pattern

---

## 📊 Version History Context

**v0.3.0 (Session 7):**
- Bug fixes (daily log creation, page navigation, drag handles)
- Code quality improvements (refactoring, logger, constants)
- 848 tests passing
- Casey rating: 10/10

**v0.4.0 (Session 8):**
- Collection stats display
- Completed task behavior settings (3 modes)
- Monthly log collection type
- 925 tests passing (+77 from v0.3.0)
- Casey rating: 9.5/10
- **Status:** Deployed to production (commit b86780d)

**v0.4.1 (Session 9 - This Session):**
- Mobile UX polish (5 items above)
- Target: 935+ tests passing (+10 from v0.4.0)
- Target: Casey rating 9+/10
- **Status:** Ready to start

---

## 🔗 Related Documentation

- **Roadmap:** `docs/next-session-roadmap.md` (updated with Session 9 plan)
- **Session 8 Design:** `docs/session-2026-02-03-session8-design.md`
- **Session 8 Feedback:** `docs/user-feedback-2026-02-03.md`
- **Git Commit:** b86780d - Version 0.4.0

---

**Document Created:** February 3, 2026 (Evening)  
**Next Action:** Sam starts Item #1 (Swipe navigation sensitivity)  
**Work Loop:** Sam → Casey (incremental) → User testing → Deploy v0.4.1
