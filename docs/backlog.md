# Backlog

Rolling capture of ideas not yet scheduled, in priority order. Items move to the current week's README when scheduled. Dates are approximate for items imported from the in-app "Squickr Life Ideas" collection on 2026-09-27.

Types: bug, feature, ux, debt.

## Habits

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 1 | Habit view allows month navigation | feature | habits | ~2026-06-30 |
| 2 | Habits can be toggled in the habit view on unscheduled days (e.g. showered a day ahead of schedule) | feature | habits | ~2026-06-30 |
| 3 | Habits have a per-habit setting for how long they stick when missed, or all stick for one day | feature | habits | ~2026-06-17 |
| 4 | Streaks use the schedule in effect on each day, so editing a habit's schedule doesn't rewrite its past streak | bug | habits | 2026-09-28 |
| 5 | Split `habit.projection.ts` (over 700 lines): schedule/date helpers and streak algorithms into their own modules; `applyHabitEvent` is over 70 lines. Split `habit.projection.test.ts` (over 1,500 lines) to match | debt | habits | 2026-10-13 |
| 6 | Reminder index writes the uploaded event's `payload.frequency` (`habitReminderIndexWriter.ts:137-145`), so an older schedule change uploaded after a newer one leaves the reminder on the stale schedule. Use the projection's `habit.frequency` | bug | habits | 2026-10-13 |
| 7 | `isScheduledToday` on the habit read model uses the current schedule and has no production consumer. Remove it, or compute it from the schedule in effect on `asOf` | debt | habits | 2026-10-13 |
| 8 | Fixed daily and weekly habits are listed on daily logs from before their creation: `isScheduledOn` checks creation only for every-n-days | bug | habits | 2026-10-13 |

## Migration polish

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 9 | When migrating parents, children auto-select | ux | migration | ~2026-06-10 |
| 10 | Migrate target list calendar order is newest to oldest | ux | migration | ~2026-09-26 |

## Bigger bets

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 11 | Sprint-planning feel: the daily log holds only completable things; multistep work is broken down and only the doable part reaches the daily level. Exploration via `/brainstorm` | feature | planning | ~2026-09-26 |
| 12 | Events and notes allow sub-entries. Blocked by #11 | feature | entries | ~2026-07-07 |
| 13 | Notes and events can have reminders | feature | entries | 2026-09-27 |
| 14 | Sub-entries are easier to add. Blocked by #11 | ux | entries | ~2026-07-07 |
| 15 | Journaling: daily wrap-up ritual prompts (what was fun, what was hard, what did you learn, what was important), with AI assistance based on [brag documents](https://jvns.ca/blog/brag-documents/) | feature | journaling | ~2026-03-03 |
| 16 | Search with type selection and date range | feature | search | ~2026-07-07 |

## Entry lists and history

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 17 | Completed and deleted entry lists show most recent first | ux | collections | 2026-10-13 |
| 18 | Entries and collections have a history view showing past versions (e.g. recover a task's name after an accidental rename) | feature | entries | 2026-10-13 |

## Tests and tooling

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 19 | Split `CollectionDetailView.test.tsx` (over 3,000 lines) by concern | debt | client | 2026-10-13 |
| 20 | Flaky test: `useCollectionNavigation.test.tsx` "should navigate when horizontal swipe is clearly intentional (diagonal)" waits on `setTimeout(100)` and fails under full-suite load | bug | client | 2026-10-13 |
