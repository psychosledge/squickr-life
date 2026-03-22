# Product Roadmap
**Last Updated:** March 21, 2026  
**Current Version:** v1.13.0  
**Status:** v1.13.0 shipped — Proactive Squickr Phase 3 (FCM Push Notifications)

> **Version history:** See `CHANGELOG.md` for all past releases.

---

## Proactive Squickr — All Three Phases Complete ✅

Design: `docs/archive/designs/proactive-squickr.md`

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | **Review screen** | ✅ Shipped in v1.11.0 — `/review` route, weekly/monthly completed work + stalled projects + habit placeholder |
| 2 | **Habit tracking** | ✅ Shipped in v1.12.0 — New `Habit` aggregate, streak algorithms, HabitsSection in daily logs, HabitsView, HabitDetailView, real ReviewHabitSection |
| 3 | **FCM push notifications** | ✅ Shipped in v1.13.0 — Per-habit reminders, `habitReminderFanOut` Cloud Function, Notifications settings tab, FCM token registration, service worker |

---

## Up Next — Under Discussion

_(No features currently queued. Add items here as they emerge.)_

### Retired (superseded by Proactive Squickr)

| Item | Why retired |
|------|-------------|
| AI-assisted journaling (#4) | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification (#9) | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
| Habit tracking (#10) | Incorporated into Proactive Squickr Phase 2 |
