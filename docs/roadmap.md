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

## Up Next

### Task Reminders (designed — ADR-029, ready for Sam)

Set a date+time on a task and receive an FCM push notification at that time. Taps open the app to the index. Auto-clears after firing. One reminder per task. Set at create time or via task edit. Scheduled Cloud Function mirrors habitReminderFanOut with a materialized taskReminders index document.

### Events as Log (designed — ADR-030, ready for Sam)

Reframe events as log entries, not calendar appointments. UI-only change: remove date picker from event create flow, remove date display from event items everywhere. Domain types and historical data untouched.

### Google Calendar Read-Only Integration (designed — ADR-031, ready for Sam)

Surface today's Google Calendar events as a read-only section in the daily log, above HabitsSection. Online-only. User selects which calendars to include (stored in UserPreferences). Uses incremental OAuth scope (calendar.readonly) via re-auth popup. Client-side API calls only — no Cloud Functions.

### Retired (superseded by Proactive Squickr)

| Item | Why retired |
|------|-------------|
| AI-assisted journaling (#4) | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification (#9) | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
| Habit tracking (#10) | Incorporated into Proactive Squickr Phase 2 |
