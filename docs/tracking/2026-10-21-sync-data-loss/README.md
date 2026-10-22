# Release 2026-10-21-sync-data-loss

**Continues from:** `docs/tracking/archive/v1.21.4-2026-10-16-habits-and-sync/`, which now serves as historical reference only, not updated further. This directory carries forward only the still-active items, self-contained (no need to open the previous directory to follow anything below).

## Priority order

1. Snapshots strand unuploaded events (audit 1, 9)
2. Sync convergence check (audit 5, part)
3. Unknown event type halts sync (audit 6, 13)
4. Downloads applied in arrival order drop updates (audit 4)

Audit numbers refer to `docs/system-audit/register.md`, the single list of audit findings.

## Active items

| Item | Status | Next step |
|---|---|---|
| Snapshots strand unuploaded events (audit 1, 9) | Not started. The upload watermark is the snapshot cursor, so a snapshot taken before upload strands events for good, and the download cursor can skip another device's events. A remote-restored device holds a partial local log (backlog #29), which matters if the upload set is derived from remote membership. | `/plan` |
| Sync convergence check (audit 5, part) | Not started. Nothing compares a device with the server. A periodic event count or id-set hash against the server flags divergence and offers repair, and confirms the audit 1, 9 and 4 fixes in production. Sync status UI is backlog #28. | `/plan` |
| Unknown event type halts sync (audit 6, 13) | Not started. One unknown or unlisted event type stops sync both ways (outage v1.20.0 to v1.20.8). Audit 13 derives every type list from the domain union. Must land before any release that adds event types. | `/plan` |
| Downloads applied in arrival order drop updates (audit 4) | Not started. A same-batch update that arrives before its create is dropped from the live projection, permanently for habits and preferences. Touches the same download batch code as audit 9. | Fix with a regression test |

## Closed items (not carried forward — see previous directory for full history)
