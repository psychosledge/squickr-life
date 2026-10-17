# Working register

Baseline `41d7b2c`. Numbers are working numbers and are renumbered in `register.md`.

## Agreed

### W1. Upload skips local events that a snapshot captured before they were uploaded

- Theme: T1 (root of several T2 and T3 findings)
- Tier: 1
- Evidence level: measured (local vitest, fake remote), read
- Citations: `packages/domain/src/entry.projections.ts:313-314`, `packages/client/src/firebase/SyncManager.ts:131-138`, `packages/client/src/snapshot-manager.ts:45-65`, `packages/infrastructure/src/firestore-event-store.ts:139`
- Finding: the upload watermark is the entry projection's snapshot cursor. Any snapshot moves it to the newest local event, uploaded or not. Events at or before the cursor are never uploaded, while download keeps working, so the device looks current.
- Triggers: tab hidden or app switch within 5 s of an edit, beforeunload, every 50th append, any edit made offline followed by a snapshot, a downloaded event whose client timestamp is later than an unuploaded local event.
- Repair today: Force full sync or `?clearsnapshot` (both use a null cursor).
- Fix direction: give replication its own watermark, separate from the read-model snapshot. Track upload state per event (a synced flag or an outbox in IndexedDB) or derive the upload set from remote membership. Run one full-compare upload after the fix to recover stranded events. Correct ADR-025 Design Point 6.
- Effort: Med
- Also: ADR-025 Design Point 6 contradicts the code.
- Decision 2026-10-17: owner agreed Tier 1, Effort Med.


T2 root: the local event log is not guaranteed complete after a remote restore, and each projection compensates with its own restore rule.

### W2. A device restored from the remote snapshot loses pre-snapshot entries on its next reload

- Theme: T2
- Tier: 1
- Evidence level: measured (local vitest), read
- Citations: `packages/domain/src/entry.projections.ts:186-208,233-251`, `packages/client/src/hooks/useColdStartSequencer.ts:335-337`, `packages/domain/src/habit.handlers.ts:59-76`
- Finding: after a remote restore the local log holds only post-snapshot events and nothing backfills it. Once a local snapshot is saved, reload replays that partial log and drops every entry the restored snapshot carried. Habit commands on pre-snapshot habits fail because handlers read the same partial log. Introduced by `a940c51`.
- In-flight overlap: "Stale state on reload of an existing device", "Snapshot fallback on invalid local snapshot".
- Fix direction: backfill the full event history into IndexedDB after a remote restore, then treat the local log as complete everywhere. Until backfilled, mark the log partial and seed from the snapshot.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W3. Habits, preferences and collections hydrate by different rules and skip events already in the local log

- Theme: T2
- Tier: 1
- Evidence level: measured (agent A probe), read
- Citations: `packages/client/src/App.tsx:396-408`, `packages/domain/src/habit.projection.ts:581-588,603-620`, `packages/domain/src/user-preferences.projections.ts:24-35,62-65`, `packages/infrastructure/src/indexeddb-event-store.ts:312-322`
- Finding: habit and preference projections trust the snapshot and never apply events that reached IndexedDB after its cursor. Collections apply a client-timestamp delta that skips late arrivals. The next snapshot saves the stale state locally and remotely.
- Fix direction: one restore contract for every projection (snapshot plus replay of every local event not covered by it, keyed by event id), owned by one component. Depends on W2's complete-log guarantee.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W4. The remote snapshot is overwritten unconditionally by any device

- Theme: T2 (amplifier of W1 to W3)
- Tier: 2
- Evidence level: read
- Citations: `packages/infrastructure/src/firestore-snapshot-store.ts:42-48`, `packages/client/src/snapshot-manager.ts:126-131`, `packages/client/src/hooks/useColdStartSequencer.ts:334-350`
- Finding: every local save replaces `users/{uid}/snapshots/entry-list-projection`, with no check of cursor or coverage. A degraded device's state becomes the starting state of every new device, while the Firestore event log stays intact.
- Fix direction: write the remote snapshot only from a device whose local log is complete and fully uploaded, guarded by a transaction on the cursor's server position. Or build it server-side from the event log.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W5. A second tab or window saves snapshots that pair a current cursor with stale state

- Theme: T2
- Tier: 2
- Evidence level: read
- Citations: `packages/domain/src/entry.projections.ts:112-120,309-321`, `packages/infrastructure/src/indexeddb-event-store.ts:366-376`
- Finding: each tab keeps its own projections over one shared IndexedDB with no cross-tab notification. The other tab never shows the first tab's events and can save a snapshot whose cursor covers events its state lacks, locally and remotely.
- Fix direction: single-writer lock (Web Locks) for sync and snapshots, plus a BroadcastChannel to invalidate other tabs' caches.
- Effort: Low
- Decision 2026-10-17: owner agreed.


### W6. Downloaded events are applied in arrival order, and an update that arrives before its create is lost

- Theme: T3
- Tier: 1
- Evidence level: measured (local vitest), read
- Citations: `packages/infrastructure/src/firestore-event-store.ts:85,146-150`, `packages/client/src/firebase/SyncManager.ts:153-160`, `packages/domain/src/entry.projections.ts:93-103`, `packages/domain/src/entry.event-applicator.ts:354-363`
- Finding: one upload batch shares a server timestamp, so a burst of edits reaches other devices in random document-id order. Live projections apply events as they arrive and silently drop updates for entries they have not seen. The receiving device shows a different state from the sender until reload, and for habits and preferences the difference persists (W3).
- Fix direction: sort each downloaded batch by client timestamp and id before appending, and give the applicator an explicit policy for updates to unknown aggregates (buffer or flag, not drop).
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W7. The download cursor skips events another device commits during this device's sync

- Theme: T3 (same root as W1: one cursor used for three jobs)
- Tier: 2
- Evidence level: read (agent F reproduced against a fake remote)
- Citations: `packages/client/src/firebase/SyncManager.ts:114-142`, `packages/infrastructure/src/firestore-event-store.ts:143-150`, `packages/domain/src/entry.projections.ts:313-314`
- Finding: the download anchor is the newest local event by client time, queried by its server time. An event committed elsewhere between this device's fetch and upload has an earlier server time than this device's own event and is excluded from every later delta.
- Fix direction: track a download high-water mark as the largest `serverReceivedAt` actually received, separate from the snapshot cursor, with a small overlap window and id-based dedupe. Belongs to the W1 watermark redesign.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W8. The event store contract has three meanings, and the test double matches none of the production stores

- Theme: T3 (SOLID: Liskov substitution)
- Tier: 2
- Evidence level: read
- Citations: `packages/domain/src/event-store.ts:26-61`, `packages/infrastructure/src/in-memory-event-store.ts:39-49`, `packages/infrastructure/src/indexeddb-event-store.ts:247,316-322`, `packages/infrastructure/src/firestore-event-store.ts:77-90,143-150`
- Finding: `IEventStore` promises atomic batches, one notification per batch and timestamp-ordered `getAllAfter`. Each implementation differs on ordering and on what "after" means, and none notifies once. Domain and client tests mostly run on the in-memory store, whose insertion order hides W1, W3 and W6.
- Fix direction: rewrite the contract to state ordering, cursor and notification semantics precisely, add one shared contract suite run against all three stores (Firestore through a fake that models server time), and make the in-memory store match IndexedDB.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W9. Append is not idempotent in either persistent store

- Theme: T3
- Tier: 3
- Evidence level: read
- Citations: `firestore.rules:16`, `packages/infrastructure/src/firestore-event-store.ts:85`, `packages/infrastructure/src/indexeddb-event-store.ts:164-166`
- Finding: re-uploading an existing event id is a denied update that rejects the whole Firestore batch. A duplicate id aborts a whole IndexedDB download batch. Callers must dedupe perfectly, and with silent errors (T4) a failing batch shows nothing.
- Fix direction: treat an existing id as success in both stores (IndexedDB `put` after an existence check, Firestore create-only writes that tolerate already-exists).
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W10. Concurrent edits resolve by each device's wall clock

- Theme: T3
- Tier: 3
- Evidence level: read
- Citations: `packages/domain/src/event-helpers.ts:19-25`, `packages/infrastructure/src/indexeddb-event-store.ts:247`
- Finding: replay order, and so the winner of concurrent edits, is the client timestamp. A skewed clock can order a completion before its creation on replay. No causal metadata exists to detect it.
- Fix direction: add a per-device sequence or hybrid logical clock to event metadata and tie-break on it.
- Effort: Med
- Decision 2026-10-17: owner agreed.

Small findings from T3: the validator returns raw Firestore documents, so downloaded events carry a Firestore `serverReceivedAt` Timestamp into IndexedDB (`firestore-event-validator.ts:242-243`). The contract's "notifies once" and "atomic" wording is false for every store.


### W11. Sync failures are invisible, and nothing checks that replicas converge

- Theme: T4 (makes every T1 to T3 finding silent)
- Tier: 1
- Evidence level: read, git history
- Citations: `packages/client/src/firebase/SyncManager.ts:162-171`, `packages/client/src/hooks/useColdStartSequencer.ts:294-302`, `packages/client/src/App.tsx:510-514`
- Finding: only a read timeout becomes a user-visible error, and the fast path ignores even that. No UI shows last successful sync or pending uploads, and no check compares a replica with the server. A device whose sync has failed for weeks looks the same as one in sync.
- Fix direction: a non-blocking sync status (last success time, pending upload count, last error) driven by SyncManager, plus a periodic convergence check (event count or id-set hash per device against the server) that flags divergence and offers repair.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W12. One unknown event type stops a device's sync in both directions

- Theme: T4
- Tier: 1
- Evidence level: read, git history (`9d27371` outage, v1.20.0 to v1.20.8, 2026-04-26 to 2026-06-06)
- Citations: `packages/infrastructure/src/firestore-event-validator.ts:200-207`, `packages/infrastructure/src/firestore-event-store.ts:172`, `packages/client/src/firebase/SyncManager.ts:122-142`, `packages/client/vite.config.ts:37,71`
- Finding: the validator rejects the whole query result on one unknown type, and the shared try block stops the upload too. An old PWA bundle that stays resident, or a type missing from the hand-kept list, halts sync with no signal. This happened once already (`9d27371`).
- Fix direction: quarantine unknown or malformed documents and continue, run upload and download in separate error scopes, derive the known-type list from the domain union at compile time, and add an app-version gate that prompts a reload when the server has newer event types.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W13. Upload has no timeout and can hold the sync lock indefinitely

- Theme: T4
- Tier: 2
- Evidence level: read, SDK behavior inferred
- Citations: `packages/client/src/firebase/SyncManager.ts:98-100,119-121,142`
- Finding: the Firestore commit is awaited without a bound. While it is pending, every later trigger returns early, so a degraded network can stall sync for the session. The timeout timer is never cleared.
- Fix direction: bound the commit with a timeout that releases the lock and reports an error, and clear the timer when the race settles.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W14. No error boundary and no remote error reporting

- Theme: T4
- Tier: 3
- Evidence level: read
- Citations: `packages/client/src/main.tsx`, `packages/client/src/utils/logger.ts`
- Finding: a render error blanks the app, and every client and function error stays in a device console or Cloud Logging.
- Fix direction: a top-level error boundary with a reload action, and a lightweight remote error sink.
- Effort: Low
- Decision 2026-10-17: owner agreed.

Small finding from T4: the only full-app boot test (`App.test.tsx`) reaches ready through a swallowed sync TypeError, so it would stay green if sync broke at startup.


### W15. Events written by the reminder function never reach devices on delta sync

- Theme: T5
- Tier: 2
- Evidence level: read, Firestore query semantics inferred
- Citations: `functions/src/task-reminder-fanout.ts:158-169`, `packages/infrastructure/src/firestore-event-store.ts:146-166`, `packages/domain/src/entry.event-applicator.ts:590-597`
- Finding: the event log has two writers with different document shapes. `TaskReminderCleared` from the function has no `serverReceivedAt`, so the delta query never returns it, and only devices that do a full download see the reminder cleared. When such an event becomes a cursor, the delta silently switches to client-timestamp mode.
- Fix direction: write the function's events through the same shape as clients (`serverReceivedAt: FieldValue.serverTimestamp()`, `userId`), backfill existing function-written documents with an Admin SDK script, and have Firestore rules require `serverReceivedAt == request.time` on client creates.
- Effort: Low
- Decision 2026-10-17: owner agreed.


### W16. Adding an event or entry type means editing unlinked lists and parallel copies that already disagree

- Theme: T6 (SOLID: open/closed; root of W12's outage)
- Tier: 2
- Evidence level: read, git history
- Citations: `packages/infrastructure/src/firestore-event-validator.ts:63-76`, `packages/domain/src/collection-management.handlers.ts:82-86`, `packages/domain/src/note-collection-management.handlers.ts:65-91`
- Finding: the validator list, type guards, applicator switches, function readers and index writers each list event types by hand, with no exhaustiveness check linking them to the domain union. Task, note and event pipelines are separate copies, and a task cannot lose its last collection while a note can.
- Fix direction: derive every type list from the domain union (a `Record<SquickrDomainEvent['type'], ...>` that fails compilation on omission), and collapse shared entry behavior (collection membership, move, remove) into one implementation parameterized by entry type.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W17. The cold-start sequencer is the defect hotspot and owns too many responsibilities

- Theme: T6 (SOLID: single responsibility; root of W11's inconsistent error policy)
- Tier: 2
- Evidence level: measured (git churn), read
- Citations: `packages/client/src/hooks/useColdStartSequencer.ts:136,216,284,373` (SyncManager construction), `:226,295,389,397,445` (error policies)
- Finding: one effect selects the start path, builds SyncManager four times, sets five error policies, manages the snapshot manager and runs benchmark diagnostics. It has the most fixes of any file in six months, and fixes land on one path at a time.
- Fix direction: extract a single sync service (constructed once, one error and status policy) and a small start-path selector, and move benchmark code out of the production effect. Pairs with W1, W2 and W11.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W18. Command handlers validate against concrete read models, in two styles

- Theme: T6 (SOLID: dependency inversion)
- Tier: 3
- Evidence level: read
- Citations: `packages/domain/src/collection-management.handlers.ts:60-72`, `packages/domain/src/habit.handlers.ts:59-76`
- Finding: most handlers depend on concrete projection classes for existence and invariant checks, while habit handlers replay from the event store. Validation therefore depends on replica state (W2's "Habit not found"), and handlers cannot be tested or reused without the full projection.
- Fix direction: pick one aggregate-loading approach behind an interface (an aggregate repository over `IEventStore`, or a narrow read-model port) and use it in all handlers.
- Effort: Med
- Decision 2026-10-17: owner agreed.


In-flight overlap for T7: "Inconsistent notifications" (no repro yet). W20 and W21 are candidate causes.

### W19. The reminder function schedules habits by a different rule from the app

- Theme: T7
- Tier: 2
- Evidence level: read
- Citations: `functions/src/habit-event-reader.ts:53-57,229-232`, `packages/domain/src/habit.projection.ts:118-133`
- Finding: every-n-days reminders count from 2020-01-01 while the app counts from the creation day, and relative habits get fixed-cadence reminders. Reminders fire on days the app shows as not scheduled and stay silent on due days.
- Fix direction: carry `createdAt`, `mode` and schedule history in the reminder index and share one pure scheduling module between domain and functions, with a contract test that runs both on the same habits.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W20. The Workbox and FCM service workers share scope `/` and replace each other

- Theme: T7
- Tier: 2
- Evidence level: inferred (read plus Service Worker spec)
- Citations: `packages/client/src/firebase/fcm.ts:68,160`, `packages/client/dist/registerSW.js`, `packages/client/vite.config.ts:68-72`
- Finding: each session registers the FCM worker over the precache worker at the same scope, and each load registers it back. Background pushes are handled only while the FCM script is active, and offline precache only while `sw.js` is.
- Fix direction: one service worker (import the messaging handler into the Workbox worker via `importScripts` or an injectManifest build), or register the FCM worker at its own scope.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W21. Reminder indexes are client-maintained read models with no reconciliation

- Theme: T7 (also a boundary leak: Firebase SDK in client code)
- Tier: 2
- Evidence level: read
- Citations: `packages/client/src/firebase/habitReminderIndexWriter.ts:94-102`, `packages/client/src/firebase/taskReminderIndexWriter.ts:37-69`, `packages/client/src/firebase/SyncManager.ts:144-150`, `packages/client/src/hooks/useEntryOperations.ts:326`
- Finding: index documents are written once per upload by hand-written callbacks. Setting a reminder time clears that day's completion, failures are never retried, and deleting or completing a task leaves its reminder armed. Inherits W1: an event that never uploads never updates the index.
- Fix direction: derive the indexes from the event log in one place (a Firestore trigger on event create, or a client reconcile against the projection at startup), and move the writers behind an infrastructure port.
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W22. Reminder fan-out is at-most-once and depends on scheduler timing

- Theme: T7
- Tier: 3
- Evidence level: read, timing inferred
- Citations: `functions/src/task-reminder-fanout.ts:80-81,98-109,201-202`, `functions/src/time-utils.ts:49-67`
- Finding: each run covers a window anchored to its own start time, and the idempotency log is written before the send, so a late, failed or crashed run drops reminders with no retry.
- Fix direction: track the last processed time per user and process everything due since then, and write the log after a successful send.
- Effort: Low
- Decision 2026-10-17: owner agreed.


### W23. Local data, projections and the push token survive sign-out

- Theme: T8
- Tier: 2
- Evidence level: read
- Citations: `packages/client/src/firebase/auth.ts:30-38`, `packages/infrastructure/src/indexeddb-event-store.ts:39`, `packages/client/src/App.tsx:259-264`, `packages/client/src/firebase/fcm.ts:22-24,115-128`
- Finding: device state is not tied to the signed-in account. A second account in the same browser sees and can upload the first account's events, the first account's reminders keep arriving, and the second account never registers for push.
- Tracked: backlog #21 covers the IndexedDB part. The in-memory projections and FCM token are not tracked.
- Fix direction: name local databases per uid, rebuild projections on auth change, and on sign-out delete the token doc and clear the FCM keys.
- Effort: Med
- Decision 2026-10-17: owner agreed.


### W24. Functions, rules and indexes ship with no automated gate

- Theme: T9
- Tier: 2
- Evidence level: read
- Citations: `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.claude/commands/ship.md:6,75`, `firebase.json`
- Finding: CI never builds or tests `functions/`, `/ship` deploys functions without running their tests, and nothing deploys or tests `firestore.rules` and `firestore.indexes.json`. Deployed rules can differ from the repo with no signal.
- Fix direction: a CI job for functions build and jest, a rules and indexes deploy step in `/ship`, and rules unit tests for the event immutability and owner checks that sync depends on.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W25. No backup of the event log is defined

- Theme: T9
- Tier: 2
- Evidence level: read (repo only; production settings unknown)
- Citations: `firebase.json`, `.github/workflows/`
- Finding: the Firestore event log is the only source of truth, and the repo defines no export schedule or point-in-time recovery. An Admin SDK mistake or project loss has no restore path here.
- Fix direction: enable Firestore PITR or a scheduled export to Cloud Storage, and restore once to prove it.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W26. Dependency and toolchain debt

- Theme: T9
- Tier: 3
- Evidence level: measured (local audits and lint)
- Citations: `packages/client/package.json` (`lint` script, vitest 1.x, vite 5), `functions/package.json`
- Finding: 91 workspace advisories, mostly in build and test tooling, and 22 in `functions/` through firebase-admin. react-router 7.14.2 is below the fixed 7.18.2, with low reach in this SPA. The client lint script fails because eslint is not installed, and CI runs no lint or type-check.
- Fix direction: upgrade react-router and firebase-admin, plan vitest and vite majors, and install eslint with a type-aware config gated in CI.
- Effort: Med
- Decision 2026-10-17: owner agreed.


### W27. Two devices can each auto-create a daily log for the same date

- Theme: T10
- Tier: 2
- Evidence level: read, effect inferred
- Citations: `packages/domain/src/collection.handlers.ts:89-96,113`, `packages/client/src/views/CollectionDetailView.tsx:318-328`, `packages/domain/src/collection.projections.ts:226-229`
- Finding: uniqueness of a date's daily log is checked against local state only, and opening `/today` creates the log automatically before the first sync. Random ids mean the two logs never merge, so entries split between them.
- Fix direction: derive the daily log id deterministically from the date (and user), so concurrent creates are the same aggregate, and make the projection merge any existing duplicates.
- Owner requirement (pass 3): date-based collections must never duplicate, and duplicates created offline must be recovered gracefully. Apply one rule to every date-based type. Monthly logs share the local-only check (`collection.handlers.ts:99-105`). Yearly logs are reserved for future use and have no dedupe check at all (`collection.handlers.ts:90-105`, `collection.types.ts:11,16`).
- Effort: Med
- Decision 2026-10-17: owner agreed.

### W28. "Today" is frozen at mount in navigation and hierarchy

- Theme: T10
- Tier: 3
- Evidence level: read
- Citations: `packages/client/src/components/HierarchicalCollectionList.tsx:148`, `packages/client/src/hooks/useCollectionHierarchy.ts:331`, `packages/client/src/hooks/useCollectionNavigation.ts:72`
- Finding: an app left open past midnight resolves today and temporal favorites to the previous day until remount.
- Fix direction: a shared `useToday()` hook that updates at local midnight and on visibility change.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W29. Sync and startup cost grow with total history

- Theme: T10
- Tier: 3
- Evidence level: read, impact not measured
- Citations: `packages/client/src/hooks/useColdStartSequencer.ts:133-143,437-451`, `packages/domain/src/entry.projections.ts:249`, `packages/client/src/firebase/SyncManager.ts:114`
- Finding: Force full sync turns every later sync in the session into a full download, each sync reads the full local log, and startup replays every entry event. Nothing compacts the log.
- Fix direction: reset to a normal cursor after the first full sync, and measure startup and sync time against seeded stores of increasing size before deciding on compaction.
- Effort: Low
- Decision 2026-10-17: owner agreed.

### W30. No deletion path, and habit titles go to function logs

- Theme: T10
- Tier: 3
- Evidence level: read
- Citations: `firestore.rules:16`, `functions/src/habit-reminder-fanout.ts:134,140,146`
- Finding: a user's events, snapshot and logs cannot be deleted through the app, and every reminder run writes habit titles to Cloud Logging.
- Fix direction: an Admin SDK account deletion function, and log habit ids only.
- Effort: Low
- Decision 2026-10-17: owner agreed.

## Proposed, awaiting decision

(none)

## In-flight overlap (pass 3)

Source: `docs/tracking/2026-10-16-habits-and-sync/README.md`. No open PRs, no branches other than `master`, no commits after `41d7b2c`.

| Tracker item | Findings | Dependency |
|---|---|---|
| Habit schedule history, slice 3 (schedule history survives snapshot restore) | W3 | Slice 3 changes `HabitProjection` snapshot shape and hydration. Re-verify W3 after it lands. Slice 3 alone does not apply post-snapshot events. |
| Stale state on reload of an existing device | W1, W2, W3, W4 | Likely explained by these findings. Fixing W1 to W4 should close it. "Force full sync" repairs event logs but not live projections (W6) and stops snapshots for the session (W29). |
| Snapshot fallback on invalid local snapshot | W2, W3 | The proposed fix (remote restore when the local snapshot is invalid) builds on the partial-log restore that W2 breaks. Design it together with W2. |
| Inconsistent notifications | W19, W20, W21, W22 | Candidate causes. Check W20 on a device first. |
| Google Calendar read-only integration | W12, W16, W3 | New `UserPreferences` fields or event types re-open W12 on old bundles and hit W3's preference hydration. Land W12 and W16 first or add the type to every list. |
| Daily-log sorting uses the UTC day | W28 | Same class (local day boundaries). Fix together with a shared `useToday()`. |
| Habit history grid relative misses, mobile keyboard | none | No overlap. |
| Owner idea, not in tracker or backlog: date-based collections never duplicate and recover from offline duplicates | W27 | Same fix. Recorded on W27. |

Re-verify after landing: W3 after slice 3. W2 if the snapshot-fallback work lands first.

## In good shape (for the register)

- `packages/domain` has no Firebase or infrastructure imports. Handlers depend on the `IEventStore` interface.
- Every suite passes with no skipped or focused tests (domain 1004, infrastructure 139, client 1721, functions 68).
- Events are immutable in Firestore by rule, and the Firestore event log is complete for client-uploaded events, so a full-compare sync can repair W1 to W3 on any device.
- The client production deploy reruns build and tests before upload, and installs use `--frozen-lockfile`.
- Git history holds no private keys, service-account files or tokens. The only key found is the public Firebase web API key.

## Open questions

- Resolved at register drafting: owner asked whether to move away from event sourcing. Every verified defect sits in the sync and snapshot layer around the event log, and the intact Firestore log is what makes repair possible. Recorded as the last summary line of `register.md`, approved by the owner.
- E8 (offline cold start on an empty Firestore cache shows empty as synced) is unverified. Needs a browser check on a fresh profile.
