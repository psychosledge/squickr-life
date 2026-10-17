# Pass 1, agent D: L5 untested behavior

Master at `41d7b2c`, 2026-10-17. Environment: local unit suites only (logic only, no real Firestore, no network, no multi-device).

## Test run

| Package | Command | Files | Tests | Result |
|---|---|---|---|---|
| domain | `pnpm -r test` | 44 | 1004 | pass |
| infrastructure | `pnpm -r test` | 6 | 139 | pass |
| client | `pnpm -r test` | 106 | 1721 | pass |
| functions | `npx jest` in `functions/` | 4 suites | 68 | pass |

Skips: none. Grep for `.skip`, `.todo`, `.only`, `xit`, `xdescribe` across `packages/*/src` and `functions/src` returned nothing (run).

What CI gates on: `.github/workflows/ci.yml:47-60` runs `pnpm build` and `pnpm test` on push and PR to master. `pnpm test` is `pnpm -r test` (`package.json`), and `pnpm-workspace.yaml` lists only `packages/*`, so functions are never built or tested in CI. No lint or type-check step. The Pages deploy (`.github/workflows/deploy.yml:115-128`) re-runs build and tests in its own job before upload, so the web deploy is test-gated independently of CI. Functions deploy is manual via `.claude/commands/ship.md:3-9,66-75` (runs `pnpm test` only, then `firebase deploy --only functions`). Pre-push hook runs `pnpm build` only (`.husky/pre-push`).

Real module graph: `packages/client/src/App.test.tsx` is the only test that boots `App`. It replaces all four store classes and `SnapshotManager` with stubs (`App.test.tsx:10-91`). No test runs `SyncManager` against a real store, and no test runs two local stores against one remote.

## Ranked candidates

### D1. Local events at or before the snapshot cursor are never uploaded

- Tier guess: 1
- Packages: domain, client
- Evidence:
  - `packages/domain/src/entry.projections.ts:309-314` `createSnapshot()` sets `lastSnapshotCursor` to the last local event, uploaded or not.
  - `packages/client/src/snapshot-manager.ts:45-65` snapshots fire on every 50th append, on tab hidden and on beforeunload, with no link to sync state.
  - `packages/client/src/firebase/SyncManager.ts:118,131-138` upload is limited to local events after the cursor's index.
  - `packages/client/src/firebase/SyncManager.ts:184-194` and `packages/client/src/utils/constants.ts:56` uploads after a local append wait for a 5 second debounce.
  - `packages/client/src/hooks/useColdStartSequencer.ts:52-57,259-266` the `?clearsnapshot` escape hatch exists to recover "events stuck behind the cursor".
  - `packages/client/src/firebase/SyncManager.test.ts:731-777` the only cursor tests assert the argument passed to `getAllAfter`. None gives a cursor plus local events and checks what gets uploaded.
- Claim: The cursor that scopes uploads comes from local snapshot creation, which knows nothing about upload state. Any local event appended before a snapshot and not yet uploaded falls at or before the cursor and is filtered out of every later upload. Because the cursor event is missing remotely, `getAllAfter` falls back to `getAll` (`firestore-event-store.ts:139`), so the device downloads normally and looks healthy.
- Failure scenario: On a phone, the user adds a task and switches apps within 5 seconds. The visibility handler saves a snapshot whose cursor is the new event. The debounced or resumed sync uploads only events after that cursor, which is none. The task stays on the phone and never reaches the laptop. Both devices show sync completed.
- How verified: read. The end-to-end effect is inferred from the trace. To confirm, write a test with two `InMemoryEventStore` instances as local and remote: append an event locally, call `projection.createSnapshot()`, run `syncNow()` with `getSnapshotCursor = () => projection.getLastSnapshotCursor()`, then assert the remote holds the event.
- Confidence: high
- What would disprove it: a code path that only advances `lastSnapshotCursor` after a confirmed upload, or a guarantee that every local append is uploaded before any snapshot can run. I found neither.

### D2. Remote snapshot restore on a new device can permanently miss or double-apply events

- Tier guess: 1
- Packages: client, domain, infrastructure
- Evidence:
  - `packages/client/src/snapshot-manager.ts:126-131` the local snapshot, cursor included, is pushed to Firestore as the remote snapshot. Last writer wins.
  - `packages/client/src/hooks/useColdStartSequencer.ts:334-361,371-382` a new device seeds from that snapshot and syncs with its cursor.
  - `packages/infrastructure/src/firestore-event-store.ts:143-150` the delta query is ordered by the anchor's `serverReceivedAt`, which is server arrival order. The snapshot content reflects what the saving device had applied locally.
  - `packages/domain/src/entry.projections.ts:93-103` when the store started empty, each downloaded event is applied incrementally onto the snapshot state with no absorption set. The comment at :96-97 claims the cursor guarantees no double application.
  - `packages/infrastructure/src/firestore-event-store.ts:139` when the anchor is missing remotely (see D1), the fallback is the full log.
  - Tests: `packages/client/src/hooks/useColdStartSequencer.test.ts:23-70,285` mocks SyncManager, SnapshotManager and both stores. `packages/domain/src/entry.projections.test.ts:2644-2735` covers seeding plus one genuinely new event only.
- Claim: The remote snapshot and the remote delta use different notions of "after". If the saving device's snapshot lacks an event that reached the server earlier than the cursor event, the new device never downloads that event. If the cursor event was never uploaded (D1), the new device downloads the whole log and applies all of it on top of a state that already contains it.
- Failure scenario A: Device A goes offline and creates X. While A is offline, device B uploads Y. A comes back, saves a snapshot (state lacks Y, cursor X), then uploads X, so X gets a later `serverReceivedAt` than Y. Device C restores A's snapshot and asks for events after X, so it never receives Y. On later reloads `hydrate` takes the anchor-not-found branch (`entry.projections.ts:214-229`) and moves the cursor to C's last local event, so Y is never fetched.
- Failure scenario B: A's remote snapshot cursor is an event that was never uploaded. C downloads the full log and replays every event onto the seeded state.
- How verified: read, effect inferred. To confirm, write a three-replica test with three local `InMemoryEventStore`s and one shared remote (an `InMemoryEventStore` whose `getAllAfter` mimics server arrival order), then compare C's `getEntries('all')` against a full replay of the remote.
- Confidence: medium. Scenario B's visible damage depends on whether `applyEventsOnto` is idempotent for each event type, which I did not check.
- What would disprove it: a guard that rejects a remote snapshot whose cursor is missing from the remote log, or projection application that is idempotent for every event type with a forced reconcile after restore.

### D3. Any persistent sync error silently stops both directions on an existing device

- Tier guess: 1
- Packages: client, infrastructure
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:141-160` upload runs before download in one try block, so an upload failure skips the download.
  - `packages/client/src/firebase/SyncManager.ts:163-167` only a timeout produces a `syncError` string. All other errors are logged.
  - `packages/client/src/hooks/useColdStartSequencer.ts:295-302` the fast path (every returning device) ignores errors entirely.
  - `firestore.rules:16` updates are forbidden, so a batch that includes an event already on the server is rejected whole.
  - `packages/infrastructure/src/firestore-event-validator.ts:201-206` an unknown event type throws, and `firestore-event-store.ts:124,169-173` rethrows it from `getAll` and `getAllAfter`.
  - Tests: `SyncManager.test.ts:325-339` asserts only that errors are swallowed. `useColdStartSequencer.test.ts:407` asserts that the fast path hides sync errors. Nothing tests repeated failure or any user-visible signal.
- Claim: A single bad remote document, an event type from a newer client, or one already-uploaded event in the upload set makes every sync fail the same way forever. The device keeps rendering local state with no indication.
- Failure scenario: The laptop runs a new build that emits a new event type. The phone still runs the old service worker. Every phone sync throws a validation error on download, and the phone uploads nothing because both steps share one try. Each device shows only its own changes.
- How verified: read. Persistence is inferred, since no retry logic or error surface exists in the read code. To confirm, write a SyncManager test with a remote whose `getAllAfter` throws `FirestoreValidationError`, append locally, run two syncs, and assert the local event never reaches the remote.
- Confidence: high on the mechanism. Medium on frequency, since the upgrade window depends on service-worker update behavior, which I did not examine.
- What would disprove it: an error surface on the fast path elsewhere, such as a status indicator reading SyncManager logs, or tolerant validation that skips unknown types.

### D4. No two-replica test, and no sync test against real store semantics

- Tier guess: 2
- Packages: client, infrastructure, domain
- Evidence:
  - `packages/client/src/firebase/SyncManager.test.ts:20-40,792-808` both stores are `vi.fn()` stubs in every test.
  - `packages/infrastructure/src/__tests__/firestore-event-store.test.ts:31-43,229-256,840-869` the Firestore SDK is mocked. Tests assert `orderBy`/`where` arguments and return the fixtures they were handed.
  - Grep across `packages/infrastructure/src` found no test that imports `SyncManager` or `EntryListProjection`. Grep across all test files found no test with a second device or replica (run).
  - Ordering differs per implementation: `in-memory-event-store.ts:39-49` uses insertion order, `indexeddb-event-store.ts:246-247,312-321` sorts by client `timestamp` with an inclusive lower bound, and `firestore-event-store.ts:143-165` uses `serverReceivedAt` with a client-timestamp fallback.
  - 40 test files use `InMemoryEventStore` (run). The production local store is `IndexedDBEventStore` (`App.tsx:259`).
- Claim: The property that defines "ready" (two replicas that both report success hold the same state) has no test at any level. Sync logic that slices by cursor index (`SyncManager.ts:133`) depends on local store ordering, and the domain tests use the one implementation whose order differs from production.
- Failure scenario: D1 and D2 both pass the full suite today. Any future change to cursor, snapshot or ordering logic would also pass.
- How verified: read and run (grep).
- Confidence: high
- What would disprove it: an integration suite outside the paths I searched (for example under `scripts/`). I found none.

### D5. Functions reminder scheduling diverges from domain scheduling, and each copy is tested alone

- Tier guess: 2
- Packages: functions, domain, client
- Evidence:
  - `functions/src/habit-event-reader.ts:5,57,213-233` has local types with no domain import. Every-n-days is anchored to `2020-01-01`, and `mode` is ignored.
  - `packages/domain/src/habit.projection.ts:118-133` anchors every-n-days to the habit's local creation date, and returns false for `mode === 'relative'` with relative due logic at :70-95.
  - `packages/client/src/firebase/habitReminderIndexWriter.ts:73-100,137-145` the index carries `frequency` but no `createdAt`, so functions cannot compute the domain anchor.
  - `functions/src/habit-event-reader.test.ts:351-365` encodes the epoch anchor as expected behavior.
  - `docs/tracking/2026-10-16-habits-and-sync/README.md` "Inconsistent notifications. No repro yet."
- Claim: The server decides reminder days with rules different from what the app shows as scheduled. No contract test runs both against the same habit.
- Failure scenario: A habit is created as every 2 days on an odd epoch day. The app shows it due on days the reminder never fires, and the reminder fires on days the app shows as not scheduled. A relative-mode habit gets fixed-cadence reminders.
- How verified: read
- Confidence: high
- What would disprove it: none found. The code paths are short and both were read in full.

### D6. Functions and rules ship without any automated gate

- Tier guess: 2
- Packages: functions, rules, CI
- Evidence:
  - `pnpm-workspace.yaml` lists only `packages/*`.
  - `.github/workflows/ci.yml:47-60` runs no functions build or test.
  - `.claude/commands/ship.md:3-9,66-75` runs `pnpm test` and then `firebase deploy --only functions`.
  - `firebase.json` predeploy builds functions but does not test them.
  - The repo has no `@firebase/rules-unit-testing` and no rules tests (run, grep).
  - `firestore.rules` is not part of `--only functions`, and nothing in the ship flow deploys it.
- Claim: The 68 functions tests pass locally but gate nothing. Rules behavior that sync depends on (immutable events at `firestore.rules:16`, the reason for ADR-025 upload scoping) is untested, and rules deployment is outside the release flow.
- Failure scenario: A functions change that breaks fan-out passes `/ship` and deploys. A rules edit merged to master is never deployed, or is deployed by hand without verification.
- How verified: read and run
- Confidence: high
- What would disprove it: a functions test step in some other workflow or hook. None found in `.github/workflows/` or `.husky/`.

### D7. Hydrate's late-arrival rationale is not exercised under production ordering

- Tier guess: 2
- Packages: domain, infrastructure
- Evidence:
  - `packages/domain/src/entry.projections.ts:235-250` full replay exists to handle events that arrive late with earlier timestamps.
  - `packages/domain/src/entry.projections.ts:313` the cursor is the last event of `getAll()`, which in IndexedDB is the maximum client timestamp, not the most recent append.
  - `packages/domain/src/entry.projections.test.ts:67` hydrate tests run on `InMemoryEventStore` (insertion order).
  - A grep for late-arrival tests returned nothing (run).
- Claim: The late-arrival case only appears when the store sorts by timestamp, and no test runs the projection on such a store. The cursor-is-max-timestamp property also widens D1: a local event whose timestamp is earlier than a downloaded event's, because of clock skew between devices, sorts before the cursor and is never uploaded.
- Failure scenario: Device B's clock runs ahead. Device A downloads B's event, snapshots (cursor = B's event), and then creates a task whose timestamp is earlier. The task sorts before the cursor and is excluded from upload.
- How verified: read, effect inferred. To confirm, run the D1 test with an `IndexedDBEventStore` on fake-indexeddb and a downloaded event timestamped ahead.
- Confidence: medium. The skew scenario needs skew larger than the gap between download and the next local write.
- What would disprove it: an upload set derived from remote membership instead of local position.

### D8. The only full-app boot test passes through the sync error path

- Tier guess: 3
- Packages: client
- Evidence:
  - `packages/client/src/App.test.tsx:58-71` `MockFirestoreEventStore` lacks `getAllAfter` and `appendBatch`.
  - `App.test.tsx:12-28` `MockIndexedDBEventStore` lacks `appendBatch` and `getAllAfter`.
  - The test does not mock `SyncManager`. `SyncManager.ts:123` then throws a TypeError, which `SyncManager.ts:163` swallows.
- Claim: The boot test reaches "ready" only because sync failures are silent. It would stay green if sync were broken.
- Failure scenario: A regression that makes every sync throw at startup passes the App suite.
- How verified: read, effect inferred. To confirm, spy on `logger.error` in `App.test.tsx` and assert it is not called with `[SyncManager] Sync failed:`.
- Confidence: medium-high
- What would disprove it: the mocks are replaced elsewhere in the test file before the sync starts.

## Small findings

- `SyncManager.ts:119-121` creates a timeout timer that is never cleared after the race settles. Every sync leaves a 15 second timer pending. Read.
- `SyncManager.ts:142` upload is not time-bounded. With `persistentLocalCache` (`firebase/config.ts:56-57`), `batch.commit` waits for server acknowledgement, so while offline `isSyncing` stays true and every trigger is dropped until the commit resolves. Not tested. Read, effect inferred.
- `entry.projections.test.ts:2494,2519` test names say "no applyEventsOnto call" and "applies delta events onto snapshot state", but the code now does a full replay (`entry.projections.ts:249`). The assertions still hold. Read.
- `SyncManager.test.ts:758` and `:854` are "backward compatible" tests that assert constructor arity, not behavior. Read.
- `useColdStartSequencer.test.ts:813-828` calls `vi.mock` inside a test body. Vitest hoists these calls, so they re-register module mocks file-wide. Read, effect inferred.

## Did not examine

- `applyEventsOnto` idempotency per event type (needed to size D2 scenario B).
- Service-worker update behavior and how long an old client can run (sizes D3).
- `habitReminderIndexWriter` and `taskReminderIndexWriter` behavior when `updateDoc` targets a missing doc, and `bootstrapHabitReminderIndex` correctness.
- Collection, habit and user-preference projection snapshot restore paths beyond reading call sites.
- `forceFullSync` end to end. Its test mocks SyncManager.
- Firestore composite index coverage for `getById` (`firestore.indexes.json`).
- UI component tests (the bulk of the client's 106 files).
