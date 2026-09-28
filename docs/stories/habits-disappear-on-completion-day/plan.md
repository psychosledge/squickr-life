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
**Status:** not started
**Commit:** —
**Acceptance Criteria:**
- [ ] Regression test written first and fails on current code: a relative every-n-days habit (n=3) completed today is returned by `getHabitsForDate(today, { asOf: today })`
- [ ] Same case passes for a relative weekly habit completed today
- [ ] A relative habit completed today, then reverted today, is still returned (it is due again)
- [ ] A relative habit completed yesterday (n=3) is not returned for today (existing test still passes)
- [ ] A relative habit completed on a past date is returned by `getHabitsForDate(pastDate, { asOf: pastDate })`, matching how `CollectionDetailView` queries past logs
- [ ] Returned habit has `isCompletedToday === true` so the row renders as completed
- [ ] Client-level test: in the daily log's Habits section, marking a relative habit complete leaves its row visible and shown as completed
- [ ] All existing habit projection, HabitsSection, HabitRow, and CollectionDetailView tests pass
**Files:** packages/domain/src/habit.projection.ts, packages/domain/src/habit.projection.test.ts, packages/client/src/views/CollectionDetailView.test.tsx (or packages/client/src/hooks/useHabitsForDate.test.ts)
**Needs Architect:** no. The fix stays inside the existing projection filter that already owns visibility.

### Slice 2: Relative habit skipped on a past day stays on that day's log
**Scope:** Whether a relative habit is due on date D is judged from non-reverted completions before D (or `createdAt` when there are none). `getHabitsForDate` includes a relative habit when it is completed on D or due on D by that rule, which removes the `date === today` gating. Today's and future dates behave as before. Fixed-mode habits, `isScheduledToday`, history, and streaks are unchanged. Starts with a failing regression test that reproduces the bug.
**Status:** not started
**Commit:** —
**Acceptance Criteria:**
- [ ] Regression test written first and fails on current code: every-n-days (n=3) relative habit completed Sep 1 and Sep 4, then Sep 10. `getHabitsForDate` for Sep 7, 8, and 9 (each with `asOf` equal to the date) returns it, not completed
- [ ] Same habit is not returned for Sep 5 or Sep 6 (not yet due)
- [ ] A completion reverted before D does not count toward D's due date
- [ ] A relative habit is not returned for dates before its `createdAt`
- [ ] Today and future-date results are unchanged (existing tests pass)
- [ ] All existing habit projection, HabitsSection, HabitRow, and CollectionDetailView tests pass
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
- [ ] Fixed-schedule habits (daily, weekly on set days, every-n-days fixed) still appear on their scheduled days before and after completion, and not on other days.
- [ ] Archived habits do not appear on any daily log.
