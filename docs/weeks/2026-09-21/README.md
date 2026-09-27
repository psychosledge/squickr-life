# Week of 2026-09-21

## Priority order

1. Snapshot fallback on invalid local snapshot
2. Google Calendar read-only integration

## Active items

| Item | Status | Next step |
|---|---|---|
| Snapshot fallback on invalid local snapshot | Not started. A device with a non-empty local event log whose local snapshot was discarded (version mismatch after upgrade) takes the fast path and renders local events only, so remote-only state stays stale until background sync catches up. Proposed fix: `wasLocalSnapshotInvalid()` on `EntryListProjection`, and the cold-start sequencer tries remote snapshot restore when it's set. | `/brainstorm`. First question: does Force full sync (v1.21.x) already cover this? |
| Google Calendar read-only integration | Not started. Today's events as a read-only daily-log section above HabitsSection. Online-only, user picks calendars (stored in UserPreferences), incremental `calendar.readonly` scope via re-auth popup, client-side API calls only. | `/brainstorm` |

## Closed items (not carried forward — see previous directory for full history)

- [CHANGELOG gap](changelog-gap.md): deleted `CHANGELOG.md`, no backfill. Git tags plus conventional commit subjects are the release record.
