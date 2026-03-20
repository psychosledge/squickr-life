# Design: Proactive Squickr

**Date:** 2026-03-19  
**Author:** Alex (Architecture)  
**Status:** Proposed — awaiting user approval before implementation

---

## Problem Statement

The app works well as a passive record-keeper but fails as an active system. The user knows what the BuJo rituals are but doesn't do them because the app never prompts — it requires the user to remember it exists. Recurring obligations (dishes, exercise) live elsewhere because there's no recurring task model. Accomplishments go unacknowledged because there's no reflection surface.

The core need: **the app should come to the user at the right moment, not wait to be opened.**

---

## Overview

Three interconnected areas designed as a coherent system:

1. **Review Screen** — a dedicated weekly/monthly reflection surface (ships first; no new domain work)
2. **Habit Tracking** — recurring tasks with history + ritual reminders (new aggregate)
3. **FCM Push Notifications** — the infrastructure layer that makes the other two proactive

Implementation order matches this list. Each phase is independently useful.

---

## Phase 1: Review Screen

### Goal
A single screen that answers: "What did I do? What's stuck? How are my habits going?" Accessed primarily via notification tap, secondarily via a nav entry point.

### What it shows

**Weekly view (default):**
- **Completed this week** — all completed tasks from the current Mon–Sun, grouped by collection. Read from `EntryListProjection` filtered by `completedAt` range.
- **Stalled projects** — open tasks on any monthly log whose last event (any type) is more than 14 days ago. Computed from event log timestamps (see staleness detection below).
- **Habit summary** — for each recurring habit, this week's streak count and hit/missed days (requires Phase 2; renders a placeholder "Set up habits to see this section" until then).

**Monthly view (toggle):**
- Same three sections with a calendar-month date range.

### Staleness detection
An entry is "stalled" if:
1. It lives on a monthly log collection (`type === 'monthly'`)
2. Its `status` is `'open'`
3. The most recent event with `aggregateId === entry.id` has a `timestamp` more than 14 days ago

This is computable from the existing event store without any new events. A new `StallProjection` (or a query method on `EntryListProjection`) traverses the event log once and caches results.

### Navigation placement
- Route: `/review` (or `/review/weekly`, `/review/monthly`)
- Nav entry: small "Review" icon in the bottom tab bar or sidebar — consistent with existing navigation patterns. Exact placement to be confirmed during implementation (depends on current nav structure).
- Deep-link target for push notifications: `/review?period=weekly`

### New projection needed
`ReviewProjection` — composes from:
- `EntryListProjection.getCompletedInRange(from, to)`
- A new `getstalledMonthlyTasks(olderThanDays: number)` method on `EntryListProjection`
- `HabitProjection.getSummaryForRange(from, to)` (Phase 2 — gracefully absent in Phase 1)

This projection is **read-only and derived** — no new events, no new aggregates. It is computed on demand (not continuously projected) because it is only needed when the review screen is open.

### Offline behaviour
Fully offline — all data lives in IndexedDB. No network required.

### ADR
ADR-019: Review Screen — derived read model composed from existing projections.

---

## Phase 2: Habit Tracking

### Two modes

**Mode A: Recurring tasks**
Things that produce a checkable entry in a daily log. Examples: exercise, take out trash, take medication.

**Mode B: Ritual reminders**
Things that should trigger a push notification but don't produce a task entry. Examples: weekly review, monthly reflection. These are configured alongside habits but are purely notification-driven — no domain aggregate needed beyond a preference record.

### New aggregate: `Habit`

A `Habit` is a domain aggregate (not a task) with its own event stream. It has:
- A definition: label, schedule, mode (recurring-task vs reminder)
- A history of completions (for Mode A only)

#### Events

```typescript
// A new habit was defined
HabitCreated {
  type: 'HabitCreated'
  aggregateId: string  // habit ID
  payload: {
    label: string
    mode: 'recurring-task' | 'reminder'
    schedule: HabitSchedule
    createdAt: string
  }
}

// User completed a recurring task habit for a given date
HabitCompleted {
  type: 'HabitCompleted'
  aggregateId: string  // habit ID
  payload: {
    completedAt: string   // ISO 8601 date (date only, not time)
    collectionId: string  // which daily log it was completed from
  }
}

// User skipped a habit for a given date (explicit skip, not just absence)
HabitSkipped {
  type: 'HabitSkipped'
  aggregateId: string
  payload: {
    skippedAt: string
    reason?: string
  }
}

// Habit definition was updated (schedule change, label rename)
HabitUpdated {
  type: 'HabitUpdated'
  aggregateId: string
  payload: Partial<HabitCreated['payload']> & { updatedAt: string }
}

// Habit was archived (soft delete — keeps history)
HabitArchived {
  type: 'HabitArchived'
  aggregateId: string
  payload: { archivedAt: string }
}
```

#### Schedule type

```typescript
type HabitSchedule =
  | { frequency: 'daily' }
  | { frequency: 'weekly'; dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 }  // 0 = Sunday
  | { frequency: 'every-n-days'; n: number }
  | { frequency: 'monthly'; dayOfMonth: number }
  | { frequency: 'yearly'; month: number; dayOfMonth: number }
```

### How recurring tasks appear in daily logs

**Key decision:** Habit instances are **not stored as events in the event log** until completed. Instead, the `HabitProjection` generates "due today" entries at read time, based on each habit's schedule and today's date.

Rationale: storing one event per expected instance would pollute the event log with noise. The projection derives what's due; only completions (user actions) are persisted as events.

When a recurring task is due, the `HabitProjection` emits a virtual entry that appears in the daily log collection view alongside real tasks. It renders identically to a task entry but is backed by a habit ID rather than a task ID. Checking it off dispatches `HabitCompleted`.

This means `CollectionDetailView` needs to merge real entries (from `EntryListProjection`) with virtual habit entries (from `HabitProjection`) for daily log collections. The merge is a view-layer concern — no domain changes needed.

### Streak and history

`HabitProjection` maintains per-habit:
- `currentStreak: number` — consecutive days/periods completed without a gap
- `history: Record<string, 'completed' | 'skipped' | 'missed'>` — keyed by date string (YYYY-MM-DD), covering the last 90 days
- `completionRate30Days: number` — percentage, for the review screen summary

The 30-day history grid renders in a compact calendar view on a Habit Detail screen (accessible by tapping a habit entry). It does **not** render inline in the daily log — that would clutter the primary task view.

### Ritual reminders (Mode B)
Stored as a lightweight record in `UserPreferences` (not a full aggregate — they have no completion history). A ritual reminder has: label, schedule, notification time. When FCM is set up (Phase 3), these drive notification scheduling.

```typescript
// Added to UserPreferences
ritualReminders: Array<{
  id: string
  label: string
  schedule: HabitSchedule
  notificationTime: string  // "HH:MM" local time
  enabled: boolean
}>
```

`UserPreferencesUpdated` payload is extended to include `ritualReminders`.

### Habit management UI
- **Habit list screen** (new route `/habits`) — lists all active habits with their current streak and today's status.
- **Create/edit habit** — modal or inline form: label, mode, schedule, (if recurring) notification time.
- **Habit detail** — 30-day grid, completion history, edit/archive actions.
- **In daily log** — virtual habit entries appear naturally alongside tasks; checking off creates `HabitCompleted` event.

### Offline behaviour
Fully offline. Habit definitions and completions live in IndexedDB via the existing `IndexedDBEventStore`. Virtual entries are computed at read time from the projection.

### ADR
ADR-020: Habit Tracking — definition-based recurring entries with event-sourced completion history.

---

## Phase 3: FCM Push Notifications

### Architecture

```
Client (PWA)                    Firebase
─────────────────               ──────────────────────────────
Service Worker                  FCM
  ├─ Registers for push    ───► Stores token
  ├─ Receives push message ◄─── Sends notification
  └─ Handles tap → deep link

App (on first auth)             Firestore
  ├─ Gets FCM token        ───► users/{uid}/fcmTokens/{tokenId}
  └─ Saves to Firestore          { token, device, platform, createdAt, lastSeen }

Cloud Functions (scheduled)
  ├─ Morning migration nudge (daily, 8am user local time*)
  ├─ Weekly review prompt (Sunday 7pm)
  ├─ Ritual reminders (per schedule)
  └─ Reads user preferences + FCM tokens → sends via FCM Admin SDK
```

*Scheduling by local time requires storing the user's timezone (IANA string) alongside FCM tokens. This is the trickiest part.

### Token registration flow
1. After Firebase Auth sign-in, client requests notification permission.
2. If granted, calls `getToken(messaging, { vapidKey })` from `firebase/messaging`.
3. Saves token to `users/{uid}/fcmTokens/{tokenId}` in Firestore with device metadata and timezone.
4. Service worker (`firebase-messaging-sw.js`) handles background message receipt and notification display.
5. Notification tap includes a `data.url` payload → service worker opens/focuses the PWA at that URL.

### Multi-device handling
Each device registers its own FCM token. Cloud Functions fan out to all tokens for the user. Stale tokens (no `lastSeen` update in 60 days) are pruned automatically.

### iOS / iPad limitations
Web Push on iOS requires:
- Safari 16.4+
- PWA installed to home screen (not just opened in browser)
- User explicitly grants notification permission

Graceful degradation: if `Notification.permission` is `'denied'` or the platform doesn't support it, the app silently skips registration. No error, no nag. The review screen and habits still work fully offline.

### Notification types and content

| Type | Trigger | Body | Deep link |
|------|---------|------|-----------|
| Morning migration | Daily 8am (user tz) | "You have tasks to migrate from yesterday" | `/collection/{yesterday-id}` |
| Weekly review | Sunday 7pm (user tz) | "Your weekly review is ready" | `/review?period=weekly` |
| Monthly review | Last day of month 7pm | "Your monthly review is ready" | `/review?period=monthly` |
| Ritual reminder | Per schedule + time | User-configured label | `/review` |
| Habit reminder | Per habit schedule + time | "Time to: {habit label}" | `/` (opens daily log) |

### Notification preferences UI
New section in Settings modal: **Notifications**
- Master on/off toggle (requests permission if off → on)
- Per-type toggles: Morning migration, Weekly review, Monthly review
- Notification time for morning migration (default 8:00am)
- Ritual reminder and habit notification times are configured per-item (not here)

Preferences stored via extended `UserPreferences` aggregate:

```typescript
notificationPreferences: {
  enabled: boolean
  morningMigrationEnabled: boolean
  morningMigrationTime: string    // "HH:MM"
  weeklyReviewEnabled: boolean
  monthlyReviewEnabled: boolean
}
```

### Backend package activation
This is the first real use of `packages/backend`. It will contain:
- `src/notifications/` — Cloud Functions for each notification type
- `src/notifications/scheduler.ts` — shared scheduling logic
- `src/notifications/fcm.ts` — FCM Admin SDK wrapper
- `firebase.json` / `firestore.rules` updates for the `fcmTokens` subcollection

### ADR
ADR-021: Push Notifications via FCM — Cloud Functions scheduling + service worker delivery.

---

## How the three areas interconnect

```
Habit definition (Phase 2)
  └─ schedule + notificationTime
       └─ Cloud Function reads this (Phase 3) → sends habit reminder notification
            └─ Tap opens daily log with virtual habit entry
                 └─ User checks off → HabitCompleted event
                      └─ HabitProjection updates streak
                           └─ Review screen shows habit summary (Phase 1 + 2)

Weekly review notification (Phase 3)
  └─ Tap opens /review (Phase 1)
       └─ Shows completed tasks + stalled projects + habit summary
```

Phase 1 ships useful immediately (review screen, accessible from nav). Phase 2 adds the habits that make the review screen's habit summary meaningful. Phase 3 adds the proactive nudges that make you actually open the review screen without having to remember.

---

## Decisions

All open questions resolved (2026-03-19):

1. **Habit notification time** — each habit has its own individual notification time.
2. **Missed vs skipped** — explicit "skip today" action available on each habit entry; missed days show as gaps.
3. **Stalled threshold** — 14 days.
4. **Review screen placement** — avatar/profile menu. Notification is the primary entry point; the menu item is the always-accessible fallback. Does not clutter the primary nav.
5. **Notification permission timing** — request immediately after sign-in.
6. **Habit on daily log** — separate "Habits" section at the top of the daily log, above regular tasks. Allows habits to be scanned and checked off as a unit before engaging with the task list.

---

## ADR Summary

| ADR | Title | Phase |
|-----|-------|-------|
| ADR-019 | Review Screen — derived read model | Phase 1 |
| ADR-020 | Habit Tracking — definition-based recurring entries | Phase 2 |
| ADR-021 | Push Notifications via FCM | Phase 3 |

Full ADR text to be added to `docs/architecture-decisions.md` when each phase is approved for implementation.
