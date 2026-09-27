# Week of 2026-09-21

## Priority order

1. Switching entry types clears the text
2. Habits disappear on the day you complete them
3. Changing a habit's schedule changes its historical view
4. Mobile keyboard hides the set-reminder option
5. Stale state on reload of an existing device
6. Inconsistent notifications
7. Snapshot fallback on invalid local snapshot
8. Google Calendar read-only integration

## Active items

| Item | Status | Next step |
|---|---|---|
| Switching entry types clears the text | Not started. Changing an entry's type discards the text already typed. | Fix with a regression test |
| Habits disappear on the day you complete them | Not started. A completed habit should stay visible for the rest of that day. | Fix with a regression test |
| Changing a habit's schedule changes its historical view | Not started. Past days should render against the schedule in effect at the time. | Fix with a regression test |
| Mobile keyboard hides the set-reminder option | Not started. When adding an entry on mobile, the virtual keyboard covers the reminder option. | Fix with a regression test |
| Stale state on reload of an existing device | Not started. An existing device doesn't reflect current state on reload, even after clearing site data. Original ask: a settings option to redownload from server. | Check whether Force full sync (v1.21.x) already covers this, alongside the snapshot-fallback brainstorm |
| Inconsistent notifications | Not started. No repro yet. | Reproduce |
| Snapshot fallback on invalid local snapshot | Not started. A device with a non-empty local event log whose local snapshot was discarded (version mismatch after upgrade) takes the fast path and renders local events only, so remote-only state stays stale until background sync catches up. Proposed fix: `wasLocalSnapshotInvalid()` on `EntryListProjection`, and the cold-start sequencer tries remote snapshot restore when it's set. | `/brainstorm`. First question: does Force full sync (v1.21.x) already cover this? |
| Google Calendar read-only integration | Not started. Today's events as a read-only daily-log section above HabitsSection. Online-only, user picks calendars (stored in UserPreferences), incremental `calendar.readonly` scope via re-auth popup, client-side API calls only. | `/brainstorm` |

## Closed items (not carried forward — see previous directory for full history)

- [CHANGELOG gap](changelog-gap.md): deleted `CHANGELOG.md`, no backfill. Git tags plus conventional commit subjects are the release record.
