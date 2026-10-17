# Week of 2026-09-28

**Continues from:** `docs/tracking/archive/2026-09-21/`, which now serves as historical reference only, not updated further. This directory carries forward only the still-active items, self-contained (no need to open the previous week to follow anything below).

## Priority order

1. Changing a habit's schedule changes its historical view
2. Habit history grid never marks relative habits as missed
3. Mobile keyboard hides the set-reminder option
4. Stale state on reload of an existing device
5. Inconsistent notifications
6. Snapshot fallback on invalid local snapshot
7. Google Calendar read-only integration
8. Daily-log sorting and calendar grouping use the UTC day

## Active items

| Item | Status | Next step |
|---|---|---|
| Changing a habit's schedule changes its historical view ([plan](../../../stories/habit-schedule-change-historical-view/plan.md)) | 2/3 slices done | Slice 3: schedule history survives snapshot restore |
| Mobile keyboard hides the set-reminder option | Not started. When adding an entry on mobile, the virtual keyboard covers the reminder option. | Fix with a regression test |
| Stale state on reload of an existing device | Not started. An existing device doesn't reflect current state on reload, even after clearing site data. Original ask: a settings option to redownload from server. | Check whether Force full sync (v1.21.x) already covers this, alongside the snapshot-fallback brainstorm |
| Inconsistent notifications | Not started. No repro yet. | Reproduce |
| Snapshot fallback on invalid local snapshot | Not started. A device with a non-empty local event log whose local snapshot was discarded (version mismatch after upgrade) takes the fast path and renders local events only, so remote-only state stays stale until background sync catches up. Proposed fix: `wasLocalSnapshotInvalid()` on `EntryListProjection`, and the cold-start sequencer tries remote snapshot restore when it's set. | `/brainstorm`. First question: does Force full sync (v1.21.x) already cover this? |
| Google Calendar read-only integration | Not started. Today's events as a read-only daily-log section above HabitsSection. Online-only, user picks calendars (stored in UserPreferences), incremental `calendar.readonly` scope via re-auth popup, client-side API calls only. | `/brainstorm` |
| Habit history grid never marks relative habits as missed | Not started. `buildHistory` marks every past day of a relative habit as not scheduled, so skipped days never count as misses. Since v1.21.3 the daily log shows those days as not done, so the grid and the log disagree. Also covers the last history dot on a skipped past day's log showing not scheduled, and that dot counting completions after the log's date (`isRelativeDueCountingAllCompletions`). Fixing it changes what counts as a miss and affects streaks. | `/plan` |
| Daily-log sorting and calendar grouping use the UTC day | Not started. `packages/client/src/utils/collectionSorting.ts:35-37` and `:231-235` derive today, yesterday, and tomorrow from `toISOString()`, so in the evening west of UTC entries land on the wrong day. Same class of bug as the habit creation-day fix in v1.21.3. | Fix with a regression test |

## Closed items (not carried forward — see previous directory for full history)
