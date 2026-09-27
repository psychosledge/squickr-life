# CHANGELOG gap

`CHANGELOG.md` stops at 1.14.2 (2026-03-29). Releases v1.20.6 through v1.21.1 exist only as git tags.

Shipped features for v1.11.0 through v1.20.5, from the retired `docs/roadmap.md`:

| Version | Feature |
|---------|---------|
| v1.11.0 | **Review screen**: `/review` route, weekly/monthly completed work + stalled projects |
| v1.12.0 | **Habit tracking**: `Habit` aggregate, streak algorithms, HabitsSection, HabitsView, HabitDetailView |
| v1.13.0 | **FCM push notifications**: per-habit reminders, `habitReminderFanOut`, Notifications settings tab, service worker |
| v1.14.x | **Task reminders**: date+time reminder on tasks, FCM push, `taskReminderFanOut`, `taskReminders` index |
| v1.15.0 | **Events as log**: removed date picker from event create flow, removed date display from event items |
| v1.16.0 | **Cold-start snapshot restore** (ADR-024): remote snapshot seeding on empty local store |
| v1.17.0 | **Delta-only sync** (ADR-025/026): snapshot cursor scopes Firestore downloads; habit + prefs in snapshot |
| v1.18.0 | **Eager sync + FCM token refresh** (ADR-023): event-driven sync, device identity, token rotation |
| v1.19.0 | **Snapshot cursor fix**: `serverReceivedAt` hybrid cursor eliminates timestamp collision bugs |
| v1.20.5 | **Firestore quota fix**: `habitReminders` index eliminates ~197k reads/day from event-log scan |

## Resolution

Closed 2026-09-27. `CHANGELOG.md` deleted, no backfill. Git tags plus conventional commit subjects are the release record (`git log --oneline <prev-tag>..<tag>`). In-app release notes, if ever needed, get generated from git at build time.
