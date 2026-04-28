# Product Roadmap
**Last Updated:** April 28, 2026  
**Current Version:** v1.20.5  
**Status:** v1.20.5 shipped — Firestore quota fix (habitReminders index)

> **Version history:** See `CHANGELOG.md` for all past releases.

---

## Recently Shipped

| Version | Feature |
|---------|---------|
| v1.11.0 | **Review screen** — `/review` route, weekly/monthly completed work + stalled projects |
| v1.12.0 | **Habit tracking** — `Habit` aggregate, streak algorithms, HabitsSection, HabitsView, HabitDetailView |
| v1.13.0 | **FCM push notifications** — Per-habit reminders, `habitReminderFanOut`, Notifications settings tab, service worker |
| v1.14.x | **Task reminders** — Date+time reminder on tasks, FCM push, `taskReminderFanOut`, `taskReminders` index |
| v1.15.0 | **Events as log** — Removed date picker from event create flow, removed date display from event items |
| v1.16.0 | **Cold-start snapshot restore** (ADR-024) — Remote snapshot seeding on empty local store |
| v1.17.0 | **Delta-only sync** (ADR-025/026) — Snapshot cursor scopes Firestore downloads; habit + prefs in snapshot |
| v1.18.0 | **Eager sync + FCM token refresh** (ADR-023) — Event-driven sync, device identity, token rotation |
| v1.19.0 | **Snapshot cursor fix** — `serverReceivedAt` hybrid cursor eliminates timestamp collision bugs |
| v1.20.5 | **Firestore quota fix** — `habitReminders` index eliminates ~197k reads/day from event-log scan |

---

## Up Next

### Snapshot Fallback on Invalid Local Snapshot

When a device has a non-empty local event log but its local snapshot is discarded (version mismatch after an upgrade), the cold-start sequencer takes the fast path — rendering from local events only. If some events were only captured in a remote snapshot and not yet synced to this device, it renders stale state until the next background sync catches up.

Fix: add a `wasLocalSnapshotInvalid()` signal to `EntryListProjection` and update the cold-start sequencer to attempt remote snapshot restore when the local snapshot was discarded, even if the local event log is non-empty.

### Google Calendar Read-Only Integration

Surface today's Google Calendar events as a read-only section in the daily log, above HabitsSection. Online-only. User selects which calendars to include (stored in UserPreferences). Uses incremental OAuth scope (`calendar.readonly`) via re-auth popup. Client-side API calls only — no Cloud Functions.

---

## Retired

| Item | Why retired |
|------|-------------|
| AI-assisted journaling | The review screen + passive completion summary covers the underlying need without requiring AI |
| Gamification | Habit streaks + the review screen's completion view cover the "acknowledge progress" need |
