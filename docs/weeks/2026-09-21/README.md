# Week of 2026-09-21

## Priority order

1. Habits disappear on the day you complete them
2. Changing a habit's schedule changes its historical view
3. Mobile keyboard hides the set-reminder option
4. Stale state on reload of an existing device
5. Inconsistent notifications
6. Snapshot fallback on invalid local snapshot
7. Google Calendar read-only integration
8. Habit history grid never marks relative habits as missed
9. Daily-log sorting and calendar grouping use the UTC day

## Active items

| Item | Status | Next step |
|---|---|---|
| [Habits disappear on the day you complete them](../../stories/habits-disappear-on-completion-day/plan.md) | 2/2 slices done | UAT |
| Changing a habit's schedule changes its historical view | Not started. Past days should render against the schedule in effect at the time. | Fix with a regression test |
| Mobile keyboard hides the set-reminder option | Not started. When adding an entry on mobile, the virtual keyboard covers the reminder option. | Fix with a regression test |
| Stale state on reload of an existing device | Not started. An existing device doesn't reflect current state on reload, even after clearing site data. Original ask: a settings option to redownload from server. | Check whether Force full sync (v1.21.x) already covers this, alongside the snapshot-fallback brainstorm |
| Inconsistent notifications | Not started. No repro yet. | Reproduce |
| Snapshot fallback on invalid local snapshot | Not started. A device with a non-empty local event log whose local snapshot was discarded (version mismatch after upgrade) takes the fast path and renders local events only, so remote-only state stays stale until background sync catches up. Proposed fix: `wasLocalSnapshotInvalid()` on `EntryListProjection`, and the cold-start sequencer tries remote snapshot restore when it's set. | `/brainstorm`. First question: does Force full sync (v1.21.x) already cover this? |
| Google Calendar read-only integration | Not started. Today's events as a read-only daily-log section above HabitsSection. Online-only, user picks calendars (stored in UserPreferences), incremental `calendar.readonly` scope via re-auth popup, client-side API calls only. | `/brainstorm` |
| Habit history grid never marks relative habits as missed | Not started. `buildHistory` marks every past day of a relative habit as not scheduled, so skipped days never count as misses. Once Slice 2 of the habits-disappear story lands, the daily log shows those days as not done. Also covers the last history dot on a skipped past day's log showing not scheduled. Fixing it changes what counts as a miss and affects streaks. | `/plan` |
| Daily-log sorting and calendar grouping use the UTC day | Not started. `packages/client/src/utils/collectionSorting.ts:35-37` and `:231-235` derive today, yesterday, and tomorrow from `toISOString()`, so in the evening west of UTC entries land on the wrong day. Same class of bug as the habit creation-day fix in the habits-disappear story. | Fix with a regression test |

## Closed items (not carried forward — see previous directory for full history)

- [CHANGELOG gap](changelog-gap.md): deleted `CHANGELOG.md`, no backfill. Git tags plus conventional commit subjects are the release record.
- Switching entry types clears the text: typed text now survives a type change. Reminder fields still reset when leaving Task, since reminders are task-only (reminders for notes and events is backlog #8).
