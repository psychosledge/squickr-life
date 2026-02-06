# Next Session Roadmap
**Last Updated:** February 6, 2026 (Session 11A - v0.5.1 Complete)  
**Current Status:** v0.5.1 implemented and ready for deployment  
**Next Action:** User chooses next session focus

---

## Session 11A Completed ✅

**v0.5.1 Quick Fixes:**
- ✅ Fixed FAB covering bulk migrate UI (mobile UX issue)
- ✅ Changed "Add to Today" → "Add Entry" (clarity improvement)
- ✅ All 996 tests passing
- ✅ Code reviewed by Casey (9/10 approval)
- ✅ Documentation updated
- ✅ Ready for deployment

**User Feedback Captured:**
- Intro guide/walkthrough for new users (design completed by Alex)

---

## Next Session Options

User will choose between the following options:

### Option A: Intro Guide/Walkthrough (v0.6.0)
**From user feedback on Feb 6, 2026:**

**Feature:** First-time user experience (FTUX) walkthrough
- 7-step interactive tutorial with spotlight overlays
- Explains app purpose, bullet journal concepts, key features
- Help menu (?) for accessing guide later
- Bullet Journal primer reference
- Keyboard shortcuts guide
- Auto-triggers for first-time users, accessible later

**Design Status:** ✅ Complete (by Alex)  
**Design Document:** `docs/session-2026-02-06-intro-guide-design.md`  
**Estimated Time:** 8-12 hours (4 phases)  
**Implementation:** 12 new files, 3 modified files

**Value Proposition:**
- Faster onboarding for new users
- Reduced confusion about app purpose
- Increased feature discovery
- Better understanding of bullet journal methodology

### Option B: User Preferences Enhancements
**From user feedback on Feb 5, 2026:**

1. **Global Default for Completed Task Behavior**
   - Set global preference for task completion behavior
   - Per-collection settings override global default
   - Better UX for users with many collections

2. **Auto-Favorite Today/Yesterday/Tomorrow Daily Logs**
   - Global toggle to auto-treat recent daily logs as favorited
   - UI-only treatment (doesn't modify isFavorite in DB)
   - Recent logs always accessible at top

**Estimated time:** 4-5 hours combined

### Option C: Other Features (User-Driven)
- User can propose new priorities based on current needs
