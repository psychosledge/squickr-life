# Habits Disappear on the Day You Complete Them

A completed habit should stay visible in the daily log for the rest of the day it was completed.

## Root Cause

`HabitProjection.getHabitsForDate` (`packages/domain/src/habit.projection.ts:696-704`) decides visibility for relative-mode habits (`frequency.mode === 'relative'`, weekly or every-n-days) from `computeNextDueDateRelative(s) <= today`. Completing the habit today moves the next due date to `today + interval` (`habit.projection.ts:82-92`), so the filter drops the habit immediately after `HabitCompleted` is appended. `useHabitsForDate` re-fetches on the projection notification and the row vanishes.

Fixed-mode habits are unaffected: they go through `isScheduledOn`, which ignores completions.

`CollectionDetailView` calls `useHabitsForDate(habitDate, { asOf: habitDate })` (`packages/client/src/views/CollectionDetailView.tsx:187`), so `date === today` on every daily log, including past ones. The "historical date" branch (`habit.projection.ts:698-700`) is never reached from the UI. A relative habit completed on a past date is therefore also missing from that past day's log whenever its next due date (computed from its latest completion) is after that date.

`isScheduledToday` for relative habits (`habit.projection.ts:527-531`) also turns false after completion. An existing test asserts this (`habit.projection.test.ts:824`). Visibility is decided by the filter, so this field does not need to change.

## Slice Plan

### Slice 1: Relative habit completed on a day stays visible on that day's log
**Scope:** A relative-mode habit that has a non-reverted completion on the requested date is included in that date's habit list, alongside habits that are due. Due/not-due behavior for dates without a completion is unchanged. Fixed-mode habits, `isScheduledToday`, history, and streaks are unchanged. Starts with a failing regression test that reproduces the bug.
**Status:** ✅ done
**Commit:** c647077
**Acceptance Criteria:**
- [x] Regression test written first and fails on current code: a relative every-n-days habit (n=3) completed today is returned by `getHabitsForDate(today, { asOf: today })`
- [x] Same case passes for a relative weekly habit completed today
- [x] A relative habit completed today, then reverted today, is still returned (it is due again)
- [x] A relative habit completed yesterday (n=3) is not returned for today (existing test still passes)
- [x] A relative habit completed on a past date is returned by `getHabitsForDate(pastDate, { asOf: pastDate })`, matching how `CollectionDetailView` queries past logs
- [x] Returned habit has `isCompletedToday === true` so the row renders as completed
- [x] Client-level test: in the daily log's Habits section, marking a relative habit complete leaves its row visible and shown as completed
- [x] All existing habit projection, HabitsSection, HabitRow, and CollectionDetailView tests pass
**Files:** packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts, packages/client/src/views/CollectionDetailView.test.tsx (or packages/client/src/hooks/useHabitsForDate.test.ts)
**Needs Architect:** no. The fix stays inside the existing projection filter that already owns visibility.

### Slice 2: Relative habit skipped on a past day stays on that day's log
**Scope:** Whether a relative habit is due on date D is judged from non-reverted completions before D (or `createdAt` when there are none). `getHabitsForDate` includes a relative habit when it is completed on D or due on D by that rule, which removes the `date === today` gating. Today's and future dates behave as before. `isScheduledToday` is unchanged. Also derives a habit's creation day with `isoToLocalDateKey(createdAt)` in place of `createdAt.slice(0, 10)` at every site in `habit.projection.ts` (relative first due date, fixed every-n-days anchor, history before-creation check, every-n-days longest-streak window), so a habit created in the evening west of UTC starts on the local day. Starts with failing regression tests that reproduce both bugs.
**Status:** ✅ done
**Commit:** 89d1761
**Acceptance Criteria:**
- [x] Regression test written first and fails on current code: every-n-days (n=3) relative habit completed Sep 1 and Sep 4, then Sep 10. `getHabitsForDate` for Sep 7, 8, and 9 (each with `asOf` equal to the date) returns it, not completed
- [x] Same habit is not returned for Sep 5 or Sep 6 (not yet due)
- [x] A completion reverted before D does not count toward D's due date
- [x] A relative habit is not returned for dates before its `createdAt`
- [x] Today and future-date results are unchanged (existing tests pass)
- [x] The existing test at `habit.projection.test.ts:784` is updated: a never-completed relative habit is returned on past dates after its creation (overdue since creation)
- [x] Regression test written first and fails on current code: with the clock pinned to an evening time west of UTC, a relative habit created then is returned by `getHabitsForDate` for the local day
- [x] With the same pinned clock, a fixed every-n-days habit is anchored on the local creation day, and the history grid treats the local creation day as scheduled
- [x] The Slice 1 client test in `CollectionDetailView.test.tsx` passes regardless of time of day
- [x] All existing habit projection, HabitsSection, HabitRow, and CollectionDetailView tests pass
**Files:** packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts
**Needs Architect:** no. Same filter as Slice 1.

## UAT Checklist
(Complete after all slices are implemented and committed)

- [ ] Create a relative every-n-days habit (for example every 3 days, relative). Open today's daily log, mark it complete. The habit stays in the Habits section, shown as completed.
- [ ] Create a relative weekly habit. On a day it is due, mark it complete in today's log. It stays visible and completed.
- [ ] Navigate away from today's log and back. The completed habit is still listed.
- [ ] Reload the app. The completed habit is still listed on today's log.
- [ ] Tap the completed habit to revert it. It stays visible, shown as not completed.
- [ ] Open tomorrow's log (or wait until the next day). A relative habit completed today with an interval greater than 1 day is not listed.
- [ ] Open a past daily log on which a relative habit was completed. The habit is listed as completed.
- [ ] Skip a relative habit past its due date for a few days, then complete it. The skipped days' logs still list it as not completed.
- [ ] In the evening (after 8 PM local), create a new relative habit. It appears on today's log right away.
- [ ] Fixed-schedule habits (daily, weekly on set days, every-n-days fixed) still appear on their scheduled days before and after completion, and not on other days.
- [ ] Archived habits do not appear on any daily log.

## Deferred tech debt

- `packages/domain/src/habit.projection.ts:165`: on a skipped past day's log, the habit row's last history dot shows `not-scheduled` instead of `missed`, because `buildHistory` uses `isRelativeDueCountingAllCompletions`. Tracked on the weekly tracker under "Habit history grid never marks relative habits as missed", which decides what counts as a miss. Surfaced in Slice 2.
