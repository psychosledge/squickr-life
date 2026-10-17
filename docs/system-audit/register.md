# Squickr Life audit

Scope: squickr-life repo (`packages/domain`, `packages/infrastructure`, `packages/client`, `functions/`, Firestore rules and indexes, CI workflows), reviewed 2026-10-17 against `master` at `41d7b2c`.

## How to read this

- **Tier 1** breaks "ready": two devices that both look up to date can hold different state. **Tier 2** bites soon or makes the system hard to change. **Tier 3** is real and low impact. **Small findings** are one line each.
- **Effort** describes scope, with no time estimate. Low is a small change with an obvious fix. Med spans several modules or needs a design choice or new tests. High needs a cross-package redesign of a core flow.
- **(assumed)** marks a rating that depends on in-flight work whose design is not known.
- **Evidence**: read (traced in code), measured (run), inferred (reasoned from verified parts, with what would confirm it).
- Measurements ran against local unit test suites with in-memory stores, fake-indexeddb and a fake remote that mimics the Firestore query. They are not production figures. Nothing touched the production Firebase project.

## Summary

- Tier 1: 6. Tier 2: 15. Tier 3: 9. Small findings: 13.
- The replication watermark is the entry projection's snapshot cursor, so snapshots strand unuploaded events (1) and the download cursor can skip other devices' events (9).
- After a remote snapshot restore the local event log is partial, and each projection restores by its own rule, so reloads lose or freeze state (2, 3), and any device can overwrite the shared snapshot with its degraded view (7).
- Live projections apply downloads in arrival order and drop updates that arrive before their create (4).
- Every one of these is silent: only a read timeout surfaces, nothing checks convergence, and one unknown event type halts sync in both directions, which already caused one outage (5, 6).
- The defects sit in the sync and snapshot layer around the event log. The Firestore log itself is intact for client uploads, and a full-compare sync repairs 1 to 3 on any device.

## Tier 1

| # | Finding | Fix direction | Effort | Evidence |
|---|---|---|---|---|
| 1 | Upload skips local events that a snapshot captured before they were uploaded. `createSnapshot()` moves the cursor to the newest local event, and SyncManager uploads only events after it. Triggers: an app switch within 5 s of an edit, beforeunload, every 50th append, offline edits, a downloaded event with a later timestamp. Download keeps working, so the device looks current. | Give replication its own watermark (per-event synced flag or outbox in IndexedDB, or an upload set derived from remote membership). Run one full-compare upload to recover stranded events. Correct ADR-025 Design Point 6, which says upload compares full logs. | Med | measured, read. `entry.projections.ts:313-314`, `SyncManager.ts:131-138`, `snapshot-manager.ts:45-65`, `firestore-event-store.ts:139` |
| 2 | A device restored from the remote snapshot loses pre-snapshot entries on its next reload. The local log holds only post-snapshot events and nothing backfills it. Once a local snapshot is saved, reload replays the partial log and ignores the snapshot state. Habit commands on older habits fail with "not found". Introduced by `a940c51`. | Backfill full history into IndexedDB after a remote restore and treat the local log as complete everywhere. Until backfilled, mark the log partial and seed from the snapshot. | Med | measured, read. `entry.projections.ts:186-208,233-251`, `useColdStartSequencer.ts:335-337`, `habit.handlers.ts:59-76` |
| 3 | Habits, preferences and collections restore by different rules and skip events already in the local log. Habits and preferences trust the snapshot and never apply later local events. Collections apply a client-timestamp delta that skips late arrivals. The next snapshot saves the stale state locally and remotely. | One restore contract for every projection (snapshot plus replay of every local event it does not cover, keyed by event id), owned by one component. Depends on 2. | Med (assumed) | measured, read. `App.tsx:396-408`, `habit.projection.ts:581-588,603-620`, `user-preferences.projections.ts:24-35,62-65`, `indexeddb-event-store.ts:312-322` |
| 4 | Downloaded events are applied in arrival order, and an update that arrives before its create is lost. One upload batch shares a server timestamp, so a burst of edits arrives in random document-id order. The applicator drops updates for unknown entries silently. Entries correct on reload. Habits and preferences do not (3). | Sort each downloaded batch by client timestamp and id before appending. Give the applicator an explicit policy for updates to unknown aggregates. | Low | measured, read. `firestore-event-store.ts:85,146-150`, `SyncManager.ts:153-160`, `entry.projections.ts:93-103`, `entry.event-applicator.ts:354-363` |
| 5 | Sync failures are invisible and nothing checks that replicas converge. Only a read timeout becomes a visible error, and the fast path ignores even that. No UI shows last successful sync or pending uploads. | Non-blocking sync status (last success, pending uploads, last error) from one sync service. A periodic convergence check (event count or id-set hash against the server) that flags divergence and offers repair. | Med | read. `SyncManager.ts:162-171`, `useColdStartSequencer.ts:294-302`, `App.tsx:510-514`, commit `31278f9` |
| 6 | One unknown event type stops a device's sync in both directions. The validator rejects the whole result on one unknown type, and the shared try block stops the upload too. An old PWA bundle or a type missing from the hand-kept list halts sync with no signal. This happened from v1.20.0 (2026-04-26) to v1.20.8 (2026-06-06). | Quarantine unknown or malformed documents and continue. Separate error scopes for upload and download. Derive the known-type list from the domain union. An app-version gate that prompts a reload. | Med | read, git history. `firestore-event-validator.ts:200-207`, `firestore-event-store.ts:172`, `SyncManager.ts:122-142`, `vite.config.ts:37,71`, commit `9d27371` |

## Tier 2

### Replication and snapshots

| # | Finding | Fix direction | Effort | Evidence |
|---|---|---|---|---|
| 7 | Any device overwrites the remote snapshot unconditionally. A degraded device's state (1 to 4) becomes the starting state of every new device. | Write the remote snapshot only from a device whose local log is complete and fully uploaded, guarded by a transaction on the cursor's server position, or build it server-side from the event log. | Med | read. `firestore-snapshot-store.ts:42-48`, `snapshot-manager.ts:126-131`, `useColdStartSequencer.ts:334-350` |
| 8 | A second tab or window never sees the first one's events and saves snapshots that pair a current cursor with stale state. | Web Locks for a single sync and snapshot writer, plus a BroadcastChannel to invalidate other tabs' caches. | Low | read. `entry.projections.ts:112-120,309-321`, `indexeddb-event-store.ts:366-376` |
| 9 | The download cursor skips events another device commits during this device's sync. The anchor is the newest local event by client time, queried by its server time. | A download high-water mark (largest `serverReceivedAt` received) separate from the snapshot cursor, with a small overlap and id dedupe. Part of the fix for 1. | Med | read. `SyncManager.ts:114-142`, `firestore-event-store.ts:143-150`, `entry.projections.ts:313-314` |
| 10 | Events written by the reminder function never reach devices on delta sync. `TaskReminderCleared` has no `serverReceivedAt`, so the delta query excludes it, and a device that takes one as its cursor drops into client-timestamp mode. | Give function-written events the client shape, backfill existing ones with an Admin SDK script, and require `serverReceivedAt == request.time` in rules. | Low | read, inferred (Firestore missing-field exclusion). `functions/src/task-reminder-fanout.ts:158-169`, `firestore-event-store.ts:146-166` |
| 11 | Upload has no timeout and can hold the sync lock for the session. Every later trigger returns early while the commit is pending. | Bound the commit with a timeout that releases the lock and reports an error. Clear the timer when the race settles. | Low | read, inferred (SDK offline commit). `SyncManager.ts:98-100,119-121,142` |

### Architecture

| # | Finding | Fix direction | Effort | Evidence |
|---|---|---|---|---|
| 12 | The event store contract has three meanings, and the test double matches none of the production stores. `IEventStore` promises atomic batches, one notification per batch and timestamp-ordered `getAllAfter`. The stores differ on ordering and on "after", and none notifies once. Most tests use the in-memory store, which hides 1, 3 and 4. | Restate the contract precisely, add one shared contract suite run against all three stores (Firestore through a fake that models server time), and make the in-memory store match IndexedDB. | Med | read. `event-store.ts:26-61`, `in-memory-event-store.ts:39-49`, `indexeddb-event-store.ts:247,316-322`, `firestore-event-store.ts:77-90,143-150` |
| 13 | Adding an event or entry type means editing unlinked lists and parallel copies that already disagree. Nothing ties the validator, guards, applicators, function readers and index writers to the domain union (the cause of 6). A task cannot lose its last collection. A note can. | Derive every type list from the domain union with a compile-time exhaustiveness check. Collapse shared entry behavior (membership, move, remove) into one implementation. | Med | read, git history. `firestore-event-validator.ts:63-76`, `collection-management.handlers.ts:82-86`, `note-collection-management.handlers.ts:65-91` |
| 14 | The cold-start sequencer is the defect hotspot and owns too many responsibilities. It has 9 commits and 5 fixes in six months, builds SyncManager four times and sets five error policies, so fixes land on one path at a time (the cause of 5's inconsistency). | Extract one sync service with one status and error policy, a small start-path selector, and move benchmark code out. Pairs with 1, 2 and 5. | Med | measured (git churn), read. `useColdStartSequencer.ts:136,216,284,373` and `:226,295,389,397,445` |

### Reminders

| # | Finding | Fix direction | Effort | Evidence |
|---|---|---|---|---|
| 15 | The reminder function schedules habits by a different rule from the app. Every-n-days counts from 2020-01-01 instead of the creation day, and relative habits get fixed-cadence reminders. | Carry `createdAt`, `mode` and schedule history in the index, share one scheduling module between domain and functions, and add a contract test. | Med | read. `functions/src/habit-event-reader.ts:53-57,229-232`, `habit.projection.ts:118-133` |
| 16 | The Workbox and FCM service workers share one registration at scope `/` and replace each other each session. On load `sw.js` is active, and 2 s later the FCM worker installs into the same registration and waits, since it never calls `skipWaiting`. The next load installs `sw.js` again. Pushes reach whichever script is active, and while the app is open that is `sw.js`, which has no push handler. | One service worker that imports the messaging handler, or the FCM worker at its own scope. | Low | measured (owner's desktop Chrome, 2026-10-17: one registration at `https://squickr.com/`, active #1783 `sw.js`, #1784 `firebase-messaging-sw.js` received 2 s later and waiting), read. `fcm.ts:68,160`, `App.tsx:431-437`, `registerSW.js`, `public/firebase-messaging-sw.js` |
| 17 | Reminder indexes are client-maintained read models with no reconciliation. Setting a reminder time clears that day's completion, failed writes are never retried, and deleting or completing a task leaves its reminder armed. Events stranded by 1 never update the index. | Derive the indexes from the event log in one place (a Firestore trigger on event create, or a startup reconcile) behind an infrastructure port. | Med | read. `habitReminderIndexWriter.ts:94-102`, `taskReminderIndexWriter.ts:37-69`, `SyncManager.ts:144-150`, `useEntryOperations.ts:326` |

### Accounts, delivery and data

| # | Finding | Fix direction | Effort | Evidence |
|---|---|---|---|---|
| 18 | Local data, projections and the push token survive sign-out. A second account in the same browser sees and can upload the first account's events, the first account's reminders keep arriving, and the second account never registers for push. | Per-uid local database names, projections rebuilt on auth change, and token doc deletion plus FCM key cleanup on sign-out. | Med | read. `auth.ts:30-38`, `indexeddb-event-store.ts:39`, `App.tsx:259-264`, `fcm.ts:22-24,115-128` |
| 19 | Functions, rules and indexes ship with no automated gate. CI never builds or tests `functions/`, `/ship` deploys functions without their tests, and nothing deploys or tests rules and indexes. | A CI job for functions, a rules and indexes deploy step in `/ship`, and rules unit tests for event immutability and owner checks. | Low | read. `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.claude/commands/ship.md:6,75` |
| 20 | The event log has no backup. The Firestore log is the only source of truth, point-in-time recovery is disabled and no backup schedule exists. | Enable Firestore PITR or a backup schedule, and restore once to prove it. | Low | read (repo), measured (owner checked the production console 2026-10-17: PITR disabled, no backup schedules) |
| 21 | Two devices can each auto-create a log for the same date. Uniqueness is checked against local state only, `/today` creates the log before the first sync, and random ids never merge. Monthly logs share the gap. Yearly logs, reserved for future use, have no check. | Deterministic ids for every date-based collection, so concurrent creates are one aggregate, and a projection-level merge of existing duplicates. | Med | read, inferred. `collection.handlers.ts:89-105,113`, `CollectionDetailView.tsx:318-328`, `collection.projections.ts:226-229` |

## Tier 3

- 22. Append is not idempotent in either persistent store. A re-uploaded id rejects the whole Firestore batch, and a duplicate aborts a whole IndexedDB batch. Fix: treat an existing id as success. Low. read. `firestore.rules:16`, `indexeddb-event-store.ts:164-166`
- 23. Concurrent edits resolve by each device's wall clock, with no causal metadata. Fix: a per-device sequence or hybrid logical clock as a tie-break. Med. read. `event-helpers.ts:19-25`
- 24. No error boundary and no remote error reporting. Fix: a top-level boundary with reload, and a lightweight remote error sink. Low. read. `main.tsx`, `utils/logger.ts`
- 25. Command handlers validate against concrete read models in two styles (projections in most handlers, event-store replay in habit handlers), so validation depends on replica state. Fix: one aggregate-loading port used by all handlers. Med. read. `collection-management.handlers.ts:60-72`, `habit.handlers.ts:59-76`
- 26. Reminder fan-out is at-most-once and depends on scheduler timing. Each run's window is anchored to its own start, and the log is written before the send. Fix: per-user last-processed time, and log after a successful send. Low. read, timing inferred. `task-reminder-fanout.ts:80-81,98-109,201-202`, `time-utils.ts:49-67`
- 27. Dependency and toolchain debt: 91 workspace advisories (mostly build and test tooling), 22 in `functions/` through firebase-admin, react-router 7.14.2 below the fixed 7.18.2 with low reach in this SPA, and a client lint script that fails because eslint is not installed. Fix: upgrade, then gate lint and type-check in CI. Med. measured.
- 28. "Today" is frozen at mount in navigation and hierarchy, so an app left open past midnight points at yesterday. Fix: a shared `useToday()`. Low. read. `HierarchicalCollectionList.tsx:148`, `useCollectionHierarchy.ts:331`, `useCollectionNavigation.ts:72`
- 29. Sync and startup cost grow with total history. Force full sync makes every later sync in the session a full download, and nothing compacts the log. Fix: reset the cursor after the first full sync, then measure against seeded stores before deciding on compaction. Low. read, not measured. `useColdStartSequencer.ts:133-143,437-451`, `entry.projections.ts:249`
- 30. No deletion path for a user's data, and reminder runs log habit titles to Cloud Logging. Fix: an Admin SDK account deletion function, and log ids only. Low. read. `firestore.rules:16`, `functions/src/habit-reminder-fanout.ts:134,140,146`

## Tracked gaps

- Backlog #21 (sign-out leaves IndexedDB unscoped) is part of 18. The in-memory projections and push token in 18 are not tracked.
- Backlog #22 (testing data namespace so local dev does not touch real data) remains open. No non-production environment exists.
- Release tracker "Stale state on reload of an existing device" is likely explained by 1, 2, 3 and 7.
- Release tracker "Inconsistent notifications" has candidate causes in 15, 16, 17 and 26.

## Small findings

- ADR-025 Design Point 6 says upload compares full logs. The code scopes upload to the cursor (see 1).
- `IEventStore` says `appendBatch` notifies once and is atomic. Every store notifies per event, and Firestore chunks at 500.
- `firestore.rules` comment claims a userId check the rule does not perform. Event shape and `serverReceivedAt` are unchecked.
- The validator returns raw Firestore documents, so downloaded events carry a Firestore Timestamp into IndexedDB.
- The only full-app boot test reaches ready through a swallowed sync TypeError, so it stays green if sync breaks at startup.
- Force full sync stops SnapshotManager for the rest of the session.
- Download appends notify SyncManager's own subscriber, so every download triggers another sync.
- IndexedDB stores have no `onblocked` handler for a future version upgrade.
- `firestore.indexes.json` declares a single-field index as a composite index (inferred rejected by the CLI).
- Two identical `InMemoryEventStore` implementations exist (domain tests and infrastructure).
- Dead code: `getActiveHabitsWithNotifications`, `SyncManager.initialSyncComplete`, `getCurrentUser`.
- 11 of 15 modal components lack dialog roles, and the main bundle is one chunk with no route-level splitting.
- The messaging service worker loads Firebase SDK 12.8.0 while the app uses 12.12.1.

## What is in good shape

- `packages/domain` imports no Firebase or infrastructure code, and handlers depend on the `IEventStore` interface.
- Every suite passes with no skipped or focused tests: domain 1004, infrastructure 139, client 1721, functions 68.
- Firestore rules make events immutable, and the Firestore log is complete for client-uploaded events, so a full-compare sync can repair 1 to 3.
- The client production deploy reruns build and tests, and installs use `--frozen-lockfile`.
- Git history holds no private keys, service-account files or tokens. The only key is the public Firebase web API key.

## Not examined

- Anything in the production Firebase project other than backup settings: deployed rules and indexes, alerting, Cloud Scheduler timing, function logs.
- Real browser and device behavior other than desktop service worker registration: PWA update timing (6), service workers on Android, offline Firestore cache behavior, `visibilitychange` timing (1).
- An offline cold start on an empty Firestore cache, which may show an empty journal as synced.
- Per-event-type idempotency of the entry applicator.
- Color contrast, keyboard and screen-reader use, and a production bundle analysis.
- Load or growth measurements for 29.

## Depends on work in flight

- 3 depends on habit-schedule slice 3 (schedule history survives snapshot restore), which changes the habit snapshot shape. Re-verify 3 after it lands.
- The tracker's "Snapshot fallback on invalid local snapshot" builds on the remote restore path that 2 shows is partial. Design it together with 2.
- The tracker's Google Calendar integration adds preference data and likely event types, which re-open 6 on old bundles and hit 3. Land 6 and 13 first, or add the new types to every list.
- The tracker's "Daily-log sorting uses the UTC day" shares the local-day class with 28.
