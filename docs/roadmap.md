# Product Roadmap
**Last Updated:** March 19, 2026  
**Current Version:** v1.10.0  
**Status:** v1.10.0 shipped — planning next phase

> **Version history:** See `CHANGELOG.md` for all past releases.

---

## Up Next — Under Discussion

The UAT feedback backlog (Rounds 1 & 2) is fully shipped as of v1.10.0. The items below are candidates for the next phase — not yet committed.

### Next: Proactive Squickr (design complete, not yet started)

Design: `docs/archive/designs/proactive-squickr.md`

Three phases, each independently shippable:

| Phase | Feature | Notes |
|-------|---------|-------|
| 1 | **Review screen** | Weekly/monthly view: completed work, stalled projects, habit summary. No new domain work — reads existing projections. Route `/review`, accessible via avatar menu + notification deep link. |
| 2 | **Habit tracking** | New `Habit` aggregate. Recurring tasks (with streak + 30-day history grid) appear in a dedicated "Habits" section at top of daily log. Ritual reminders (notification-only) stored in `UserPreferences`. |
| 3 | **FCM push notifications** | First real use of `packages/backend`. Cloud Functions on schedule → FCM → Android lock screen. Morning migration nudge, weekly/monthly review prompts, per-habit reminders. Permission requested immediately on sign-in. |

### Retired (superseded by Proactive Squickr)

| Item | Why retired |
|------|-------------|
| AI-assisted journaling (#4) | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification (#9) | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
| Habit tracking (#10) | Incorporated into Proactive Squickr Phase 2 |
