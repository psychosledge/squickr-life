# Release 2026-10-16-habits-and-sync

**Continues from:** `docs/tracking/archive/2026-09-28/`, which now serves as historical reference only, not updated further. This directory carries forward only the still-active items, self-contained (no need to open the previous directory to follow anything below).

## Priority order

1. Mobile keyboard hides the set-reminder option
2. Daily-log sorting and calendar grouping use the UTC day
3. Habit history grid never marks relative habits as missed
4. Snapshots strand unuploaded events (audit 1, 9)
5. Sync status and convergence check (audit 5)
6. Unknown event type halts sync (audit 6, 13)
7. Restored devices lose state on reload (audit 2, 3, 7)
8. Downloads applied in arrival order drop updates (audit 4)
9. Service workers share one registration (audit 16)
10. Google Calendar read-only integration

Audit numbers refer to `docs/system-audit/register.md`, the single list of audit findings.

## Active items

| Item | Status | Next step |
|---|---|---|
| Mobile keyboard hides the set-reminder option | Not started. When adding an entry on mobile, the virtual keyboard covers the reminder option. | Fix with a regression test |
| Daily-log sorting and calendar grouping use the UTC day | Not started. `packages/client/src/utils/collectionSorting.ts:35-37` and `:231-235` derive today, yesterday, and tomorrow from `toISOString()`, so in the evening west of UTC entries land on the wrong day. Same class of bug as the habit creation-day fix in v1.21.3, and as audit 28. | Fix with a regression test |
| Habit history grid never marks relative habits as missed | Not started. `buildHistory` marks every past day of a relative habit as not scheduled, so skipped days never count as misses. Since v1.21.3 the daily log shows those days as not done, so the grid and the log disagree. Also covers the last history dot on a skipped past day's log showing not scheduled, and that dot counting completions after the log's date (`isRelativeDueCountingAllCompletions`). Fixing it changes what counts as a miss and affects streaks. | `/plan` |
| Snapshots strand unuploaded events (audit 1, 9) | Not started. The upload watermark is the snapshot cursor, so a snapshot taken before upload strands events for good, and the download cursor can skip another device's events. Replaces "Stale state on reload of an existing device" together with audit 2, 3, 7. | `/plan` |
| Sync status and convergence check (audit 5) | Not started. Only a read timeout surfaces, and nothing compares a device with the server. Pairs with audit 14 (sequencer refactor). | `/plan` |
| Unknown event type halts sync (audit 6, 13) | Not started. One unknown or unlisted event type stops sync both ways (outage v1.20.0 to v1.20.8). Must land before any release that adds event types. | `/plan` |
| Restored devices lose state on reload (audit 2, 3, 7) | Not started. After a remote snapshot restore the local log is partial, projections restore by three rules, and any device overwrites the remote snapshot. Replaces "Snapshot fallback on invalid local snapshot", whose remote-restore approach builds on the partial log. Re-verify audit 3, since habit schedule history now persists in snapshots (v1.21.4). | `/brainstorm` |
| Downloads applied in arrival order drop updates (audit 4) | Not started. A same-batch update that arrives before its create is dropped from the live projection. | Fix with a regression test |
| Service workers share one registration (audit 16) | Not started. Confirmed in desktop Chrome: `firebase-messaging-sw.js` installs into the `sw.js` registration and waits, so pushes usually reach a worker with no push handler. Replaces "Inconsistent notifications". Other candidate causes: audit 15, 17, 26. | Fix with a regression test, then confirm on a device |
| Google Calendar read-only integration | Not started. Today's events as a read-only daily-log section above HabitsSection. Online-only, user picks calendars (stored in UserPreferences), incremental `calendar.readonly` scope via re-auth popup, client-side API calls only. Wait for audit 6 and 13, since new preference data or event types reopen audit 6 on old bundles. | `/brainstorm` after audit 6 and 13 land |

## Closed items (not carried forward — see previous directory for full history)

- Data safety before sync work. Firestore point-in-time recovery enabled and Force full sync run on every device, 2026-10-17. Audit 20's restore drill not yet run.
- Changing a habit's schedule changes its historical view ([plan](../../stories/habit-schedule-change-historical-view/plan.md)). Released v1.21.4.
