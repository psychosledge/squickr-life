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
| 5 | Split `habit.projection.ts` (over 700 lines): schedule/date helpers and streak algorithms into their own modules; `applyHabitEvent` is about 75 lines. Split `habit.projection.test.ts` (about 1,470 lines) to match | debt | habits | 2026-10-13 |
| 6 | Reminder index writes the uploaded event's `payload.frequency` (`habitReminderIndexWriter.ts:137-145`), so an older schedule change uploaded after a newer one leaves the reminder on the stale schedule. Use the projection's `habit.frequency` | bug | habits | 2026-10-13 |

## Migration polish

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 7 | When migrating parents, children auto-select | ux | migration | ~2026-06-10 |
| 8 | Migrate target list calendar order is newest to oldest | ux | migration | ~2026-09-26 |

## Bigger bets

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 9 | Sprint-planning feel: the daily log holds only completable things; multistep work is broken down and only the doable part reaches the daily level. Exploration via `/brainstorm` | feature | planning | ~2026-09-26 |
| 10 | Events and notes allow sub-entries. Blocked by #9 | feature | entries | ~2026-07-07 |
| 11 | Notes and events can have reminders | feature | entries | 2026-09-27 |
| 12 | Sub-entries are easier to add. Blocked by #9 | ux | entries | ~2026-07-07 |
| 13 | Journaling: daily wrap-up ritual prompts (what was fun, what was hard, what did you learn, what was important), with AI assistance based on [brag documents](https://jvns.ca/blog/brag-documents/) | feature | journaling | ~2026-03-03 |
| 14 | Search with type selection and date range | feature | search | ~2026-07-07 |

## Entry lists and history

| # | Item | Type | Area | Added |
|---|---|---|---|---|
| 15 | Completed and deleted entry lists show most recent first | ux | collections | 2026-10-13 |
| 16 | Entries and collections have a history view showing past versions (e.g. recover a task's name after an accidental rename) | feature | entries | 2026-10-13 |
