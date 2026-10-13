# Changing a Habit's Schedule Changes Its Historical View

Past days should render against the schedule in effect on that day. Editing a habit's schedule currently re-renders every past day against the new schedule.

## Root Cause

`HabitState` in `packages/domain/src/habit.projection.ts:15-27` holds a single `frequency`. `applyHabitEvent` overwrites it on `HabitFrequencyChanged` (`habit.projection.ts:446-451`), so the projection keeps no record of earlier schedules. Every past-day evaluation reads that one field:

- History grid: `buildHistory` (`habit.projection.ts:137-178`) calls `isScheduledOn(state.frequency, dateKey, state.createdAt)` for every one of the 30 days and uses `state.frequency.mode` for the relative branch. This feeds the habit detail grid (`HabitDetailView.tsx:332`), the 7-dot strip on each daily-log row (`HabitRow.tsx:45`), and the review completion rate (`ReviewHabitSection.tsx:47`).
- Past daily log list: `getHabitsForDate` (`habit.projection.ts:676-690`) filters with `s.frequency.mode` and `isScheduledOn(s.frequency, date, ...)`. `CollectionDetailView.tsx:187` passes the log's own date as both `date` and `asOf`.
- Streaks (`computeCurrentStreak`, `computeLongestStreak`) and `isScheduledToday` also read the current frequency only.

The events allow reconstruction. `HabitFrequencyChanged` carries `payload.updatedAt` (set from the event `timestamp` in `UpdateHabitFrequencyHandler`, `habit.handlers.ts:157-179`), and `HabitCreated` carries the original frequency and `createdAt`. Replaying these yields the schedule in effect on any local date, retroactively for habits already edited.

The projection snapshot (`SerializableHabitState` in `habit.types.ts`, `SNAPSHOT_SCHEMA_VERSION = 10` in `snapshot-store.ts:20`) stores only the current frequency, so a snapshot-hydrated projection loses the schedule history unless the snapshot shape changes.

## Design Decisions

1. **Schedule history** is derived by the projection from `HabitCreated` and `HabitFrequencyChanged` events. No event schema change. Architect confirms in Slice 1.
2. **A change takes effect** on the local day of the change, inclusive.
3. **The every-n-days anchor** stays the local creation day across changes.
4. **Streaks** are out of scope. Tracked in `docs/backlog.md`.

## Deferred tech debt

- "Habit history grid never marks relative habits as missed" (current week's tracker). Days in a relative period keep their current behavior here. That story evaluates relative days per period using this story's schedule timeline.
- `habit.projection.ts` is over 700 lines and `applyHabitEvent` about 75. Split tracked in `docs/backlog.md` #5. Surfaced in Slice 1.

## Slice Plan

### Slice 1: History grid evaluates each past day against the schedule in effect that day
**Scope:** The 30-day history (habit detail grid, daily-log row dots, review completion rate) marks each past day scheduled, missed, or not scheduled by the schedule in effect on that local day. Covers fixed-to-fixed changes and changes into or out of relative mode. Days that fall in a relative period keep today's relative behavior (past days not scheduled), since that is the separate "relative habits never marked missed" item. Today's status, `isScheduledToday`, streaks, the daily-log habit list, and snapshots are unchanged. A habit hydrated from an existing snapshot behaves as it does today (one schedule for all days). Starts with a failing regression test.
**Status:** not started
**Commit:** —
**Acceptance Criteria:**
- [ ] Regression test written first and fails on current code: a daily habit created 20 days ago, changed to weekly (Mondays only) 5 days ago, has every uncompleted day before the change marked `missed`, not `not-scheduled`
- [ ] Same habit: days on or after the change are marked by the weekly schedule (non-Mondays `not-scheduled`, uncompleted Mondays `missed`)
- [ ] Weekly (Mon/Wed/Fri) changed to weekly (Tue/Thu): past Mon/Wed/Fri before the change stay `missed` when uncompleted, past Tue/Thu before the change stay `not-scheduled`
- [ ] Fixed every-n-days changed to daily: days before the change follow the every-n-days pattern
- [ ] Two changes in the history window produce three periods, each evaluated by its own schedule
- [ ] Two changes on the same local day: the later one applies to that day
- [ ] Relative changed to fixed: days before the change are `not-scheduled` (current relative behavior); days from the change on follow the fixed schedule
- [ ] Fixed changed to relative: days before the change follow the old fixed schedule
- [ ] Completed days stay `completed` and days before creation stay `not-scheduled` regardless of schedule
- [ ] A habit with no schedule changes produces the same history as before (existing tests pass)
- [ ] The change day counts toward the new schedule (local day of the change, inclusive)
- [ ] After an older `HabitFrequencyChanged` is applied after a newer one, the habit's current frequency is the newer one
- [ ] All existing habit projection, HabitDetailView, HabitRow, HabitHistoryGrid, and ReviewHabitSection tests pass
**Files:** packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts
**Needs Architect:** yes. Introduces time-varying projected state (a schedule timeline) where the projection held a single current value, and decides where schedule history lives (Design Question 1) and how the every-n-days anchor behaves (Design Question 3).
**Scaffolding for:** Slice 2: Past daily log lists habits by the schedule in effect that day, Slice 3: Schedule history survives snapshot restore. Slice 1 establishes the projection's answer to "which schedule was in effect on local date D".
**Interface contract:** The projection can answer, for any habit and local date on or after creation, which frequency (type, target days, n, mode) was in effect on that date. Slice 2 reuses that answer for list filtering, and Slice 3 must round-trip the underlying history through the snapshot without changing that answer.

### Slice 2: Past daily log lists habits by the schedule in effect that day
**Scope:** Opening a past daily log lists the habits that were scheduled (fixed) or due (relative) on that date under the schedule in effect then. A habit completed on that date is still listed regardless of schedule. Today's and future logs are unchanged. Starts with a failing regression test.
**Status:** not started
**Commit:** —
**Acceptance Criteria:**
- [ ] Regression test written first and fails on current code: a daily habit changed to weekly (Mondays only) 3 days ago is returned by `getHabitsForDate(D, { asOf: D })` for a non-Monday D before the change
- [ ] Same habit is not returned for a non-Monday D on or after the change
- [ ] A weekly (Tue only) habit changed to daily is not returned for a past Wednesday before the change
- [ ] A habit that was relative before the change is listed on a pre-change date by the relative due rule; a habit that was fixed before the change is listed on a pre-change date by the fixed rule
- [ ] A habit completed on a past date is listed on that date even when the schedule then did not include it
- [ ] Today's log reflects the current schedule (existing tests pass)
- [ ] In `buildHistory`, a relative today-cell on a past `asOf` uses the schedule in effect on that date
- [ ] Client-level test: in `CollectionDetailView`, a past daily log shows a habit that was scheduled that day under its old schedule
- [ ] All existing habit projection, HabitsSection, and CollectionDetailView tests pass
**Files:** packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts, packages/client/src/views/CollectionDetailView.test.tsx
**Needs Architect:** no. Reuses the schedule lookup decided in Slice 1 inside the existing `getHabitsForDate` filter.

### Slice 3: Schedule history survives snapshot restore
**Scope:** A habit's schedule history persists through a projection snapshot, so the Slice 1 and Slice 2 behavior holds after reload, cold start from a local snapshot, and cold start from a remote snapshot. Snapshots written by the previous schema are discarded and rebuilt by replay. Starts with a failing regression test.
**Status:** not started
**Commit:** —
**Acceptance Criteria:**
- [ ] Regression test written first and fails on current code: a habit with a schedule change, serialised with `getStatesForSnapshot` and restored with `hydrateFromSnapshot` into a fresh projection, produces the same history and `getHabitsForDate` results as the original projection
- [ ] Events applied after hydration (a further schedule change, a completion) extend the restored history correctly
- [ ] A snapshot from the previous schema version is rejected and the projection rebuilds from the event log with full schedule history
- [ ] Remote (Firestore) and IndexedDB snapshot stores round-trip the new shape
- [ ] All existing snapshot, projection, and cold-start tests pass
**Files:** packages/domain/src/habit.types.ts, packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts, packages/domain/src/snapshot-store.ts, packages/infrastructure/src/firestore-snapshot-store.ts, packages/infrastructure/src/indexeddb-snapshot-store.ts (tests alongside)
**Needs Architect:** no, provided the Slice 1 design covers the snapshot shape. Otherwise yes: it changes the ADR-026 snapshot contract and bumps `SNAPSHOT_SCHEMA_VERSION`.

## UAT Checklist
(Complete after all slices are implemented and committed)

- [ ] Take a daily habit with several days of history, some completed and some not. Change it to weekly on one day. Open the habit detail view. Days before the change still show uncompleted days as missed, and days after the change follow the weekly schedule.
- [ ] On today's daily log, the habit's 7-dot strip matches the detail grid for the same days.
- [ ] Open a past daily log from before the change on a day the new schedule excludes. The habit is still listed there.
- [ ] Open a past daily log from after the change on a day the new schedule excludes. The habit is not listed.
- [ ] Today's log lists the habit only if the new schedule includes today.
- [ ] Change a weekly habit's target days. Past weeks keep their original pattern of missed and not-scheduled days.
- [ ] Change a habit's schedule twice. The detail grid shows three periods, each following its own schedule.
- [ ] Change a relative habit to fixed. Days before the change keep their previous appearance, and days after follow the fixed schedule.
- [ ] Past days that were completed stay completed after any schedule change.
- [ ] Reload the app. The detail grid and past logs look the same as before the reload.
- [ ] Open the app on a second device, or after Force full sync. The detail grid and past logs match the first device.
- [ ] A habit that was never edited looks the same as before the release.
- [ ] Review screen completion rate for an edited habit reflects the schedule in effect on each day.
