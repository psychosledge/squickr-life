# Product Roadmap
**Last Updated:** March 21, 2026  
**Current Version:** v1.12.1  
**Status:** v1.12.1 shipped — UAT bug fixes for Habit Tracking

> **Version history:** See `CHANGELOG.md` for all past releases.

---

## Up Next — Under Discussion

### Next: Proactive Squickr Phase 3 (design complete, not yet started)

Design: `docs/archive/designs/proactive-squickr.md`

Three phases — Phases 1 and 2 shipped:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | **Review screen** | ✅ Shipped in v1.11.0 — `/review` route, weekly/monthly completed work + stalled projects + habit placeholder |
| 2 | **Habit tracking** | ✅ Shipped in v1.12.0 — New `Habit` aggregate, streak algorithms, HabitsSection in daily logs, HabitsView, HabitDetailView, real ReviewHabitSection |
| 3 | **FCM push notifications** | First real use of `packages/backend`. Cloud Functions on schedule → FCM → Android lock screen. Morning migration nudge, weekly/monthly review prompts, per-habit reminders. Permission requested immediately on sign-in. |

### Retired (superseded by Proactive Squickr)

| Item | Why retired |
|------|-------------|
| AI-assisted journaling (#4) | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification (#9) | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
| Habit tracking (#10) | Incorporated into Proactive Squickr Phase 2 |
