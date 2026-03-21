# Product Roadmap
**Last Updated:** March 20, 2026  
**Current Version:** v1.11.0  
**Status:** v1.11.0 shipped — Proactive Squickr Phase 1 (Review Screen) complete

> **Version history:** See `CHANGELOG.md` for all past releases.

---

## Up Next — Under Discussion

### Next: Proactive Squickr Phase 2 & 3 (design complete, not yet started)

Design: `docs/archive/designs/proactive-squickr.md`

Three phases — Phase 1 shipped in v1.11.0:

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | **Review screen** | ✅ Shipped in v1.11.0 — `/review` route, weekly/monthly completed work + stalled projects + habit placeholder |
| 2 | **Habit tracking** | New `Habit` aggregate. Recurring tasks (with streak + 30-day history grid) appear in a dedicated "Habits" section at top of daily log. Ritual reminders (notification-only) stored in `UserPreferences`. |
| 3 | **FCM push notifications** | First real use of `packages/backend`. Cloud Functions on schedule → FCM → Android lock screen. Morning migration nudge, weekly/monthly review prompts, per-habit reminders. Permission requested immediately on sign-in. |

### Retired (superseded by Proactive Squickr)

| Item | Why retired |
|------|-------------|
| AI-assisted journaling (#4) | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification (#9) | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
| Habit tracking (#10) | Incorporated into Proactive Squickr Phase 2 |
