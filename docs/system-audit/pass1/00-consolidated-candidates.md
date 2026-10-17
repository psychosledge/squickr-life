# Pass 1 consolidated candidates

Baseline `41d7b2c`, 2026-10-17. Sources: `01-boundaries-variants.md` (A), `02-concurrency-data-cost.md` (B), `03-failure-ops-deps.md` (C), `04-untested-behavior.md` (D), `05-structure-frontend.md` (E), `06-event-sourcing-replication.md` (F).

Everything below is an unverified candidate. Agent agreement is a signal only.

## Verify first

Concrete claims that are cheap to check and that most themes depend on.

| # | Claim | Agents | Check |
|---|---|---|---|
| V1 | Upload sends only local events after the snapshot cursor, and `createSnapshot()` sets the cursor to the newest local event whether or not it was uploaded | A1 B1 C1 D1 F1 | Read `SyncManager.ts:114-171`, `entry.projections.ts:300-346`. Run `pass1/scratch/cursor.test.ts` |
| V2 | ADR-025 says upload compares the full local log against the full remote log | B1 | Read ADR-025 around lines 280-296 |
| V3 | Snapshots fire on tab hidden, beforeunload and every 50th append, while upload is debounced 5 s | A1 B1 C1 D1 F1 | Read `snapshot-manager.ts:40-131`, `SyncManager.ts:184-241`, `constants.ts:56` |
| V4 | On the fast path, habits and preferences hydrate from the snapshot with no delta, and collections use a client-timestamp delta | A2 B2 F8 | Read `App.tsx:380-410`. Run `pass1/scratch/habit-hydrate.test.ts` |
| V5 | After a remote snapshot restore, the local log holds only post-cursor events, and a later reload replays only those | F2 | Read `entry.projections.ts:180-250`, `useColdStartSequencer.ts:330-390` |
| V6 | `appendBatch` to Firestore gives every event in a batch one `serverTimestamp()`, and the delta orders by `serverReceivedAt` only | F3 F5 B4 | Read `firestore-event-store.ts:50-175` |
| V7 | `TaskReminderCleared` written by the function has no `serverReceivedAt` | A3 B5 C2 | Read `task-reminder-fanout.ts:150-172` |
| V8 | Only a timeout surfaces as a sync error, and the fast path ignores errors | C3 D3 E1 F6 | Read `SyncManager.ts:160-171`, `useColdStartSequencer.ts:290-305` |
| V9 | An unknown event type throws on the whole result set, and the fetch runs before upload in one try | A4 B6 C4 D3 E2 F7 | Read `firestore-event-validator.ts:190-210`, `firestore-event-store.ts:165-175` |
| V10 | The function counts every-n-days from 2020-01-01 and ignores relative mode | A5 B8 D5 | Read `habit-event-reader.ts:50-60,210-235`, `habit.projection.ts:115-135` |
| V11 | CI never builds or tests `functions/`, and nothing deploys rules or indexes | C7 D6 | Read `pnpm-workspace.yaml`, workflows, `.claude/commands/ship.md` |

## Themes

Ordered for the walkthrough: verification-backed tier 1 themes first, then the rest.

### T1. Sync watermark is the snapshot cursor (root)

- Candidates: A1, B1, C1, D1, F1, D7 (clock-skew variant), F1 S4
- Agreement: five agents, all tier 1. A, C and F report runs.
- Claim: the upload watermark is a read-model field. Any snapshot moves it past unuploaded events, which then never upload. A device clock that runs ahead on another device widens the gap.
- Related: the `?clearsnapshot` flag and Force full sync are the only recovery paths.
- Disagreement: none on mechanism. Frequency rated high to medium.

### T2. Snapshot restore and hydration lose or freeze state

- Candidates: F2 (partial local log after remote restore), A2, B2, F8 (habits, preferences and collections hydrate without full replay), F4, A8, B11, D2 (remote snapshot is last-writer-wins and trusted), B3 (second tab saves stale snapshot), E8 (offline cold start shows empty as synced), A10 (snapshot validation at call sites)
- Agreement: A2, B2 and F8 describe the same mechanism. F4, A8, B11 and D2 describe the same remote overwrite.
- Disagreement: tier for the remote overwrite. F says 1, A and B say 2, D says 1.
- In-flight overlap: "Stale state on reload of an existing device", "Snapshot fallback on invalid local snapshot", habit-schedule slice 3.
- Shared root with T1: the snapshot cursor carries three meanings (snapshot position, upload watermark, download anchor).

### T3. Ordering, causality and store semantics

- Candidates: F3 (live arrival order differs from replay order, same-batch ties), F5, B4, D2 scenario A (server-time cursor race), F10 (wall-clock conflict resolution), A7, F9, D4, D7 (three stores give `getAllAfter` three meanings, tests use the one that differs from production), A11 (non-idempotent append), A12 (Firestore fields leak into local log)
- Agreement: A7, F9 and D4 agree on store divergence (Liskov substitution).
- Disagreement: F3 tier 1, others tier 2.

### T4. Silent failure and no convergence check

- Candidates: C3, D3, E1, F6 (only timeouts surface, fast path ignores errors, no sync status UI), C5 (upload has no timeout and can latch `isSyncing`), D8 (boot test passes through swallowed sync error), A4, B6, C4, E2, F7 (an unknown event type halts both directions, no upcasting, PWA keeps old bundle), C9 (no remote error reporting, no error boundary)
- Agreement: six agents on unknown-type halt, four on silent errors.
- Disagreement: tier 1 (C, D, E) or tier 2 (A, B, F) for silence. Unknown-type halt split between 1 (E) and 2 (others).

### T5. Function-written events are invisible to delta sync

- Candidates: A3, B5, C2
- Agreement: three agents. Tier 1 (A, C) or 2 (B).

### T6. Extension cost and SOLID boundaries

- Candidates: A9, E7 (hand-maintained event-type lists, triplicated entry-type applicators and handlers that already disagree), E6 (`useColdStartSequencer` is the defect hotspot with four SyncManager construction sites and five error policies), A6 (reminder index writers are client-side read models using Firestore outside infrastructure), A10, A12
- Measured: `useColdStartSequencer.ts` 9 commits and 5 fixes in 6 months (E).

### T7. Reminder and notification correctness

- Candidates: A5, B8, D5 (epoch schedule), A6 (index writer drops completions, ignores restore, never retries), B7, C11 (fan-out window gaps, at-most-once steps), C10 (task delete leaves reminder armed), C6, E3 (two service workers share scope `/`)
- In-flight overlap: "Inconsistent notifications".

### T8. Sign-out and multi-user isolation

- Candidates: E4, B12, C8 (local stores, in-memory projections and FCM token survive sign-out)
- Known: backlog #21 covers IndexedDB. FCM token and in-memory projections are not listed there.

### T9. Delivery, ops and dependencies

- Candidates: C7, D6 (functions and rules ungated), C9 (no backups defined in repo), C12 (91 advisories, mostly build-time; react-router open redirect reachable; vitest and vite majors behind; client lint broken)

### T10. Other domain correctness and cost

- Candidates: E5 (two devices auto-create two daily logs for one date), B14 (today frozen at mount), B9 (Force full sync and missing anchor make every sync a full download), B10 (startup and download cost grows with history), B13 (no retention or deletion path, habit titles in function logs)

## Small findings carried forward

Collected from all six reports. Listed in the register only if they survive verification.

- `IEventStore` docs claim `appendBatch` notifies once and is atomic. Implementations notify per event, and Firestore chunks at 500 (A)
- `firestore.rules` comment claims a userId check that the rule does not perform. Event shape and `serverReceivedAt` are unchecked (A, B, C, F)
- `firestore.indexes.json` declares a single-field composite index (B, C)
- Two identical `InMemoryEventStore` copies (A)
- Dead code: `getActiveHabitsWithNotifications`, `SyncManager.initialSyncComplete`, `getCurrentUser` (A, B, E)
- Stale comments in `entry.projections.ts` and `collection.projections.ts` about seed invalidation (F)
- SyncManager timeout timer never cleared (D, E)
- Force full sync stops SnapshotManager for the session (E)
- Download appends trigger a follow-on sync (B)
- IndexedDB has no `onblocked` handler for version upgrades (B)
- 11 of 15 modals lack dialog roles; one 1.19 MB main chunk (E)
- Firebase SDK in the messaging worker is 12.8.0 while the package is 12.12.1 (C)
- `VITE_APP_VERSION` comes from a GitHub secret and drifts from `package.json` (C)
- Workflow actions pinned to floating majors (C)
