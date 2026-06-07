# Slice Plan — habit-reminder-index

Reduce Firestore read quota usage by replacing the full event-log scan in
`habitReminderFanOut` with a pre-built `habitReminders` index, mirroring the
pattern already used by `taskReminderFanOut`.

---

## Progress

| Slice | Name | Status | Commit |
|-------|------|--------|--------|
| 1 | `habitReminderIndexWriter` module | pending | — |
| 2 | Bootstrap on app startup | pending | — |
| 3 | Wire writer into SyncManager | pending | — |
| 4 | Update `habitReminderFanOut` Cloud Function | pending | — |

---

## Slice 1: `habitReminderIndexWriter` module

**Scope:** Create `packages/client/src/firebase/habitReminderIndexWriter.ts` and
its unit-test file. No wiring yet — the module is tested in isolation against a
mock Firestore.

**What changes:**
- New file: `packages/client/src/firebase/habitReminderIndexWriter.ts`
- New file: `packages/client/src/firebase/habitReminderIndexWriter.test.ts`

**What does not change:** `SyncManager`, `useColdStartSequencer`, the Cloud
Function, or any domain types.

**Acceptance Criteria:**
- [ ] `createHabitReminderIndexWriter(firestore, userId, habitProjection)` is
      exported and returns an `(events: DomainEvent[]) => Promise<void>` callback
- [ ] `HabitCreated` with `notificationTime` present → upserts
      `users/{userId}/habitReminders/{habitId}` with all required fields
      (`habitId`, `title`, `frequency`, `notificationTime`, `completedDates: []`,
      `userId`, `updatedAt`)
- [ ] `HabitCreated` without `notificationTime` → no write
- [ ] `HabitNotificationTimeSet` → upserts the doc; `title` and `frequency` are
      resolved from `habitProjection.getHabitById()`
- [ ] `HabitNotificationTimeCleared` → deletes the doc
- [ ] `HabitArchived` → deletes the doc
- [ ] `HabitRestored` → no-op (write happens on next `HabitNotificationTimeSet`)
- [ ] `HabitTitleChanged` → calls `setDoc` with `{ title }` and `{ merge: true }`
      only when the doc already exists (i.e. projection says habit has a
      `notificationTime`)
- [ ] `HabitFrequencyChanged` → calls `setDoc` with `{ frequency }` and
      `{ merge: true }` only when the doc already exists
- [ ] `HabitCompleted` → calls `updateDoc` with `arrayUnion(date)` on
      `completedDates`, only when doc exists
- [ ] `HabitCompletionReverted` → calls `updateDoc` with `arrayRemove(date)` on
      `completedDates`, only when doc exists
- [ ] All other event types → no Firestore call
- [ ] Per-event errors are caught and logged; remaining events continue processing
- [ ] All tests pass under `pnpm -r test`

**Needs Architect:** no — the pattern is a direct mirror of
`taskReminderIndexWriter.ts`; no new architectural decisions are required.

---

## Slice 2: Bootstrap on app startup

**Scope:** Add a one-time bootstrap function that reads `habitProjection` state
and writes any missing `habitReminders` index documents when the app starts (fast
path and slow path).

Rationale for option (a) over (b) and (c): a callable Cloud Function requires
the user to trigger it or a separate admin action; accepting a gap means existing
habits silently miss notifications until next edit. A client-side bootstrap that
runs once on cold start is the simplest zero-intervention approach.

**What changes:**
- New file: `packages/client/src/firebase/bootstrapHabitReminderIndex.ts`
- New file: `packages/client/src/firebase/bootstrapHabitReminderIndex.test.ts`

**What does not change:** `SyncManager`, `useColdStartSequencer`, the Cloud
Function.

**Acceptance Criteria:**
- [ ] `bootstrapHabitReminderIndex(firestore, userId, habitProjection)` is exported
      and returns `Promise<void>`
- [ ] For each habit returned by `habitProjection.getActiveHabits()` that has a
      `notificationTime`, the function checks whether a doc already exists in
      `users/{userId}/habitReminders/{habitId}`
- [ ] If the doc does not exist, it is created with the correct shape (same fields
      as slice 1 upsert; `completedDates` is populated from the habit's
      `isCompletedToday`/history or left as `[]` as a safe default — see note below)
- [ ] If the doc already exists, it is not overwritten (idempotent)
- [ ] Habits without a `notificationTime` are skipped
- [ ] Archived habits are skipped
- [ ] All errors are caught and logged per-habit; bootstrap does not throw and does
      not block app startup
- [ ] All tests pass under `pnpm -r test`

> **Note on `completedDates`:** `bootstrapHabitReminderIndex` will populate
> `completedDates: []` (empty). The writer (slice 1) keeps it accurate going
> forward. A one-day window where an already-completed habit could theoretically
> receive a duplicate notification is acceptable given the idempotency log in the
> Cloud Function guards against double-send.

**Needs Architect:** no.

---

## Slice 3: Wire `habitReminderIndexWriter` and bootstrap into app startup

**Scope:** Update `useColdStartSequencer.ts` to pass `habitReminderIndexWriter`
as a second `onEventsUploaded` callback to `SyncManager`, and call
`bootstrapHabitReminderIndex` once after the SyncManager starts.

**What changes:**
- `packages/client/src/hooks/useColdStartSequencer.ts` — import and wire both new
  modules; call bootstrap once after SyncManager starts on each cold-start path

**What does not change:** `SyncManager` itself (the constructor already accepts
one `onEventsUploaded` callback). Review whether SyncManager needs to accept two
callbacks or whether a wrapper combiner is the right approach — the coder must not
modify SyncManager constructor signature if it breaks existing tests.

> **SyncManager callback note:** `SyncManager` currently accepts a single
> `onEventsUploaded` callback. The wiring must compose both writers into one
> callback (e.g. a local async arrow that awaits both) rather than changing the
> SyncManager constructor. The coder should confirm this before writing code.

**Acceptance Criteria:**
- [ ] On cold-start fast path: both `taskReminderIndexWriter` and
      `habitReminderIndexWriter` are invoked (in sequence) for every uploaded batch
- [ ] On cold-start slow path (remote snapshot restore): same as fast path
- [ ] On cold-start benchmark path: same as fast path
- [ ] `bootstrapHabitReminderIndex` is called once after `manager.start()` on each
      cold-start path (fast, slow/snapshot-found, slow/no-snapshot)
- [ ] Bootstrap errors do not prevent the SyncManager from starting or the app from
      reaching 'ready'
- [ ] Existing `taskReminderIndexWriter` behavior is unchanged (regression: no test
      failures)
- [ ] All tests pass under `pnpm -r test`

**Needs Architect:** no.

---

## Slice 4: Update `habitReminderFanOut` Cloud Function

**Scope:** Replace `getActiveHabitsWithNotifications` (full event-log scan) with a
direct read of `users/{userId}/habitReminders`. This slice must not be deployed
until slice 3 is deployed and the index has been populated (at least one app
session has run with slice 3 active).

**What changes:**
- `functions/src/habit-reminder-fanout.ts` — replace the call to
  `getActiveHabitsWithNotifications` with a direct `.get()` of the
  `habitReminders` subcollection; map the resulting docs to the `HabitState`
  interface that the rest of `processUserHabitNotifications` already uses
- `functions/src/habit-reminder-fanout.test.ts` (or equivalent) — update/add
  tests to cover the new read path

**What does not change:** `habit-event-reader.ts` can remain (it is not deleted
here, just no longer called by the fan-out), token pruning logic, time-window
check, frequency/scheduling check, completion check, idempotency check, FCM send.

**Acceptance Criteria:**
- [ ] `processUserHabitNotifications` no longer calls `getActiveHabitsWithNotifications`
- [ ] Habits are loaded by reading `users/{userId}/habitReminders` collection
      (one `.get()` call, replacing the full event-log scan)
- [ ] Each `habitReminders` document is mapped to a `HabitState`-compatible object
      with `habitId`, `title`, `frequency`, `notificationTime`, `completedDates`
- [ ] Time-window, scheduling, completion, idempotency, and FCM-send logic is
      unchanged
- [ ] Unit tests cover: user with no `habitReminders` docs → no notifications sent;
      user with one eligible doc → notification sent; doc with no `notificationTime`
      field (malformed) → skipped gracefully
- [ ] All tests pass under `pnpm -r test`
- [ ] The Firestore read count per fan-out run drops from ~2,050 reads (full event
      log) to 1 read per user (habitReminders collection) — confirmed by inspection
      or a comment in the PR

**Needs Architect:** no — the shape of `habitReminders` docs matches `HabitState`
exactly; no schema changes or new Firestore security rules are needed.

---

## UAT Checklist
(Complete after all slices are implemented and committed)

### Index writer — new habits

- [ ] Create a new habit with a notification time set. Open the Firebase console,
      navigate to `users/{userId}/habitReminders` and verify a document exists with
      the correct `habitId`, `title`, `frequency`, `notificationTime`,
      `completedDates: []`, and `userId` fields.
- [ ] Create a new habit WITHOUT a notification time. Verify no document appears in
      `habitReminders` for that habit.

### Index writer — updates

- [ ] Set a notification time on an existing habit that had none. Verify a
      `habitReminders` document is created with the correct fields.
- [ ] Change the notification time on a habit that already has one. Verify the
      existing `habitReminders` document is updated with the new time.
- [ ] Clear the notification time on a habit. Verify the `habitReminders` document
      is deleted.
- [ ] Change the title of a habit that has a notification time set. Verify the
      `habitReminders` document's `title` field is updated.
- [ ] Change the title of a habit that has NO notification time. Verify no spurious
      `habitReminders` document is created.
- [ ] Change the frequency of a habit that has a notification time set. Verify the
      `habitReminders` document's `frequency` field is updated.
- [ ] Archive a habit that has a notification time set. Verify the `habitReminders`
      document is deleted.
- [ ] Restore an archived habit. Verify no `habitReminders` document is created
      (restore is a no-op until next `HabitNotificationTimeSet`).

### Index writer — completions

- [ ] Complete a habit that has a notification time set. Verify the `habitReminders`
      document's `completedDates` array gains today's YYYY-MM-DD date.
- [ ] Revert that completion. Verify today's date is removed from `completedDates`.

### Bootstrap

- [ ] In a fresh incognito window (or after clearing IndexedDB), sign in. Verify
      that `habitReminders` documents exist for all active habits that have a
      notification time, without needing to edit any habit first.
- [ ] Run the bootstrap a second time (reload the page). Verify that existing
      `habitReminders` documents are not overwritten or duplicated.

### Cloud Function (quota reduction)

- [ ] Wait for the next `habitReminderFanOut` scheduled run (or trigger it manually
      via the Firebase console). Verify in the Function logs that it reads from
      `habitReminders` and NOT from the `events` collection.
- [ ] Verify that a habit notification is still delivered at the correct time for a
      habit whose `notificationTime` falls within the next 15-minute window.
- [ ] Verify that a habit that is already completed today does NOT trigger a
      notification (completion check still works via `completedDates` in the index).
- [ ] Check the Firebase console's Firestore usage graph the day after deployment.
      Verify that daily read count has dropped significantly (target: below 50k/day
      free quota).

### Regression

- [ ] Verify that task reminders are still delivered correctly (no regression to
      `taskReminderFanOut` behavior).
- [ ] Verify that the app cold-start is not noticeably slower (bootstrap is
      non-blocking).
