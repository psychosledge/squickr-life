# Pass 1, agent F: L14 event sourcing and replication

Repo at `41d7b2c`. Evidence levels: `read`, `run`, `inferred`.

Experiments ran as scratch vitest files outside the repo (since deleted). They used the real `IndexedDBEventStore` on fake-indexeddb, the real `EntryListProjection`, the real `SyncManager`, and a fake remote store that mimics the Firestore query (`serverReceivedAt` assigned once per batch commit, `getAllAfter` as `srv > anchor.srv`, ties broken by document id, full fallback when the anchor is missing). Representativeness: local logic only. Real Firestore, real browsers and real devices were not exercised.

Event path traced: handler `generateEventMetadata()` (client wall clock, `version: 1`) → `IndexedDBEventStore.append` → subscriber fan-out to projections, `SnapshotManager` counter and `SyncManager` debounce (5 s) → `SyncManager.syncNow`: local `getAll`, remote `getAllAfter(snapshotCursor)`, upload of local events after the cursor, download of remote events not local → `appendBatch` locally → projections apply each downloaded event incrementally → `SnapshotManager` saves a snapshot (entries, collections, habits, prefs) locally and to Firestore → on reload `hydrate()` plus fast-path seeding in `App.tsx`, or on an empty store the remote snapshot restore in `useColdStartSequencer`.

The sync cursor and the snapshot cursor are the same value: the id of the last local event by client timestamp. Most findings below come from that one coupling.

## Ranked candidates

### F1. Local events at or before the snapshot cursor are never uploaded

- Tier guess: 1
- Packages: client, domain
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:131-138` uploads only `localEvents.slice(cursorIndex + 1)`
  - `packages/domain/src/entry.projections.ts:309-314` sets the cursor to the last local event by client timestamp, uploaded or not
  - `packages/client/src/snapshot-manager.ts:45-65` saves a snapshot on every 50th event, on tab hidden and on beforeunload
  - `packages/client/src/utils/constants.ts:56` sets the sync debounce to 5000 ms
  - `packages/infrastructure/src/indexeddb-event-store.ts:244-248` sorts local events by client timestamp
  - `packages/client/src/hooks/useColdStartSequencer.ts:52-57` shows a `?clearsnapshot` URL flag described as "recovering any events stuck behind the cursor"
- Claim: The upload step treats every local event up to and including the snapshot cursor as already uploaded. A snapshot taken before the debounced sync runs makes not-yet-uploaded events the cursor, or puts them before it. Those events stay local-only for good. Later snapshots move the cursor further past them.
- Failure scenario: On the phone the user adds two entries and switches apps within 5 seconds. Tab-hidden saves a snapshot with cursor = the second entry. The next sync finds the anchor missing in Firestore, downloads everything, and uploads nothing. The phone shows both entries. The desktop never gets them. Both devices look up to date. A second variant: a device with a slow clock creates an event whose timestamp sorts before a downloaded event that is already the cursor. That event is skipped the same way.
- How verified: `run`. S1: the cursor event is not uploaded, a later event is, and the first stays local after another snapshot and sync. S4: the clock-skew variant is not uploaded either.
- Confidence: high
- Would disprove it: a production path that guarantees a snapshot is never saved while local events are unuploaded. None found.
- Repair today: Force full sync (`useColdStartSequencer.ts:437-451`) uses a null cursor, so it does upload stuck events. Nothing tells the user to run it.

### F2. A device restored from a remote snapshot keeps a partial local log, and a later reload drops all pre-snapshot entries

- Tier guess: 1
- Packages: domain, client
- Evidence:
  - `packages/domain/src/entry.projections.ts:186-207` seeds from the snapshot when the local log is empty
  - `packages/domain/src/entry.projections.ts:233-249` rebuilds from local `allEvents` alone when the anchor is found, and ignores `snapshot.state`
  - `packages/client/src/firebase/SyncManager.ts:118-125` downloads only the delta after the cursor. Nothing backfills the earlier history.
  - `packages/domain/src/habit.handlers.ts:59-76` handlers load habit state from local `getById`, so a habit created before the snapshot fails with "Habit not found"
  - `packages/domain/src/collection.projections.ts:202-215` `getCollectionById` reads the local log. It is used for validation at `packages/domain/src/collection.handlers.ts:172,237,315,370,448,506,564,623`.
  - `packages/domain/src/collection.projections.ts:83-87,175-184` `CollectionRestored` nulls the cache, and the rebuild uses the partial log
- Claim: ADR-024/025 cold start leaves IndexedDB holding only events after the remote snapshot cursor, with no backfill. After the first local snapshot, the anchor is in the local log, so `hydrate()` takes the "anchor found" branch. That branch replays only local events, so every entry created before the remote snapshot disappears. Habit and collection command handlers validate against the same partial log. They reject commands on aggregates the UI still shows from seeded caches.
- Failure scenario: The user clears site data, which is the in-flight "stale state on reload" item, or opens a new browser. The cold start restores the remote snapshot and everything shows. The tab is hidden, so a local snapshot is saved. On the next reload most entries are gone, and collections still show because the fast path seeds them. Completing a pre-existing habit throws. Renaming a pre-existing collection throws. A `SNAPSHOT_SCHEMA_VERSION` bump on this device discards the snapshot, and the full replay of the partial log loses the same data.
- How verified: entry loss is `run` (S2: after reload `getEntries()` returns only the delta entry). The habit and collection rejections are `read`. Confirm with a test that runs `CompleteHabitHandler` against a store seeded only with post-snapshot events.
- Confidence: high for entries, medium-high for handlers
- Would disprove it: a backfill of the full history to IndexedDB after a remote restore. None found.
- Overlap: in-flight items "Stale state on reload of an existing device" and "Snapshot fallback on invalid local snapshot" likely share this root cause.

### F3. Projections apply downloaded events in arrival order, which can differ from replay order. Same-batch events reach other devices in random order.

- Tier guess: 1
- Packages: infrastructure, domain, client
- Evidence:
  - `packages/infrastructure/src/firestore-event-store.ts:82-89` gives every event in one batch the same `serverTimestamp()`
  - `packages/infrastructure/src/firestore-event-store.ts:146-150` orders the delta by `serverReceivedAt` only, so ties fall to document id (random UUID)
  - `packages/client/src/firebase/SyncManager.ts:154-160` appends downloads in that order without sorting
  - `packages/domain/src/entry.projections.ts:77-104` applies each event onto the cache as it arrives
  - `packages/domain/src/entry.event-applicator.ts:354-363` drops a `TaskCompleted` for an unknown task without any signal (the other update cases follow the same pattern)
  - `packages/domain/src/habit.projection.ts:581-588` and `packages/domain/src/collection.projections.ts:74-94` apply incrementally too
  - `packages/infrastructure/src/indexeddb-event-store.ts:244-248` replays in client timestamp order
- Claim: Live state is "events in the order they arrived". Replayed state is "events in client timestamp order". These differ whenever downloads arrive out of timestamp order. The debounced upload batches a burst of edits into one commit, so a create and a follow-up update share a `serverReceivedAt`, and the receiving device sees them in id order. An update applied before its create is lost from the live cache. The snapshot then saves that cache.
- Failure scenario: On the phone the user creates a task and completes it within 5 seconds. The desktop downloads `TaskCompleted` first in about half of cases, drops it, then applies `TaskCreated`. The desktop shows the task open while the phone shows it completed. Both look synced. The desktop's next snapshot stores the open task (locally and remotely, see F4). A reload fixes the desktop only on the full-replay branch. A device seeded from that remote snapshot keeps the wrong state.
- How verified: `run`. S3: the delta came back as `[TaskCompleted, TaskCreated]`. The live projection showed `open` and a fresh replay of the same log showed `completed`. The tie behavior of real Firestore `serverTimestamp()` within one batch is `inferred`. Confirm with an emulator or by reading `serverReceivedAt` on two docs from one production batch.
- Confidence: high for the projection behavior, medium-high for the Firestore tie
- Would disprove it: Firestore assigning distinct, ordered `serverReceivedAt` within one batch, and no other out-of-order arrival path. Force full sync, which downloads in client timestamp order onto a newer cache, is another out-of-order path.

### F4. The remote snapshot is an unconditional last-writer-wins document that new devices trust without checking it

- Tier guess: 1
- Packages: infrastructure, client, rules
- Evidence:
  - `packages/infrastructure/src/firestore-snapshot-store.ts:42-48` writes with a plain `setDoc`, with no check that it is newer or covers more events
  - `packages/client/src/snapshot-manager.ts:126-131` saves to remote fire-and-forget on every local save, from any device in any state
  - `firestore.rules:20-22` allows any write by the owner
  - `packages/client/src/hooks/useColdStartSequencer.ts:334-350` restores it as the base state, and the cursor limits downloads to events after it
- Claim: Any device can replace the shared snapshot, whatever state its in-memory projection is in. That includes the partial state from F2, the misordered state from F3, or a device that has been offline for days. A cold-starting device takes that state as the truth for everything before the cursor and never replays those events. One wrong replica therefore becomes the starting state of every future device.
- Failure scenario: The F2 device reloads with most entries missing and hides the tab. Its snapshot, missing those entries, overwrites the remote one. A week later a new laptop cold-starts from it and is missing the same entries. The event log in Firestore is intact, but nothing reads it.
- How verified: `read` and `inferred`, built on the `run` results for F2 and F3. Confirm with a test that chains S2, a remote save and a fresh cold start.
- Confidence: medium-high
- Would disprove it: a guard rejecting snapshots that cover fewer events or have an older cursor, or a cold start that checks the snapshot against the log. Neither exists.

### F5. The download cursor skips events another device commits during this device's sync

- Tier guess: 2
- Packages: infrastructure, client
- Evidence:
  - `packages/infrastructure/src/firestore-event-store.ts:133-150` filters on `serverReceivedAt > anchor.serverReceivedAt`
  - `packages/client/src/firebase/SyncManager.ts:114-142` fetches remote first, then uploads, so the device's own events get a later `serverReceivedAt` than events others commit in between
  - `packages/domain/src/entry.projections.ts:309-314` the cursor is the last event by client timestamp, often the device's own fresh event
  - `docs/adr/ADR-025-delta-only-sync-firestore-download-scoped-to-snapshot-cursor.md` (Design Point 2, "Timestamp collision risk") claims `serverReceivedAt` is "guaranteed unique within a Firestore write operation"
- Claim: The cursor is neither a high-water mark of what this device has downloaded nor a server sequence. An event committed by device B between A's fetch and A's upload has a smaller `serverReceivedAt` than A's own event. Once A's event becomes the cursor, every later delta query excludes B's event, permanently. The ADR's uniqueness claim does not hold for batch writes (see F3).
- Failure scenario: Both devices are in use and sync within the same second, for example a habit ticked on the phone while the desktop saves an edit. The desktop never receives the phone's tick. The desktop looks synced.
- How verified: `run` against the fake remote (S5: the other device's event stays in remote and never reaches local after three more syncs). Real Firestore commit timing is `inferred`.
- Confidence: medium. The window is about one round trip.
- Would disprove it: a cursor taken from the maximum `serverReceivedAt` actually downloaded, or a re-fetch overlap. Neither exists.

### F6. Nothing detects divergence, and sync failures are silent on the common path

- Tier guess: 2
- Packages: client
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:163-171` surfaces only the timeout error. Other errors are logged and swallowed.
  - `packages/client/src/hooks/useColdStartSequencer.ts:295-302` ignores errors entirely on the fast path
  - No sync status indicator in the UI (grep of `packages/client/src` for sync state consumers finds only the sequencer)
  - `packages/client/src/hooks/useColdStartSequencer.ts:437-451` Force full sync does not rebuild projections, applies downloads onto the current cache (F3), and stops `SnapshotManager` for the rest of the session
- Claim: No count, hash or cursor comparison between replica and server exists, so F1 to F5 and F7 produce no signal. "Appears up to date" just means no visible error. The only repair is a manual Force full sync. It fixes the event logs but leaves the live projection built in arrival order until reload.
- Failure scenario: Any of F1 to F5 or F7. The user notices only by comparing screens.
- How verified: `read`
- Confidence: high
- Would disprove it: a convergence check anywhere in the client or functions. None found.

### F7. One event of an unknown type stops all sync, both directions, on an older client

- Tier guess: 2
- Packages: infrastructure, client, domain
- Evidence:
  - `packages/infrastructure/src/firestore-event-validator.ts:136-137,198-210` rejects any type not in `KNOWN_EVENT_TYPES`
  - `packages/infrastructure/src/firestore-event-store.ts:170-173` rethrows validation errors
  - `packages/client/src/firebase/SyncManager.ts:122-125,163-167` the fetch runs before the upload, so the throw aborts the upload too, and no error is shown
  - `packages/domain/src/event-helpers.ts:119` every event is `version: 1`, with no upcaster anywhere (grep for upcast and `event.version` finds none)
- Claim: Adding an event type, as the in-flight habit schedule work may do, makes every client still on the old bundle fail every sync. Its local events also stop uploading. Schema evolution relies on optional payload fields read inline (for example `content ?? title` at `entry.event-applicator.ts:333`), with no versioned upcasting.
- Failure scenario: The owner ships a release with a new event type and uses it on the desktop. The installed phone PWA still runs the cached old bundle. From then on it neither downloads nor uploads, silently, until the service worker updates.
- How verified: `read`. Confirm with a unit test feeding `FirestoreEventStore.getAllAfter` a doc with an unknown type through `SyncManager`.
- Confidence: high on the mechanism, medium on how often it happens (depends on PWA update behavior)
- Would disprove it: a forced update gate before sync runs on old bundles

### F8. Fast-path startup seeds habits and preferences from the snapshot and skips post-snapshot events

- Tier guess: 2
- Packages: client, domain
- Evidence:
  - `packages/client/src/App.tsx:386-401` applies delta events to collections only. Habits and preferences are hydrated with no delta.
  - `packages/infrastructure/src/indexeddb-event-store.ts:312-322` the collections delta is a client-timestamp range, so late-arriving older-timestamp events are skipped. This is the bug `entry.projections.ts:236-249` documents and fixes for entries only.
  - `packages/client/src/snapshot-manager.ts:99-124` reads entries at one cursor, then collections, habits and prefs after further awaits, so the parts can reflect different points
  - `packages/domain/src/habit.projection.ts:603-614` restoring from a snapshot collapses the schedule history to one frequency
- Claim: Startup restores four projections from one snapshot by three different rules. Habit and preference events in the local log after the cursor are never applied, and later snapshots keep the omission. Collections miss late-arriving events. Habit schedule history does not survive the snapshot, which is the known in-flight slice 3.
- Failure scenario: A background sync downloads a habit completion from the phone. The desktop tab is then discarded before a later snapshot completes. On restart the completion is in IndexedDB but absent from the habit view, and the next snapshot drops it from the snapshot state for good.
- How verified: `read`. Confirm with a test that seeds a snapshot, appends a `HabitCompleted` after its cursor, and runs the `App.tsx` init sequence.
- Confidence: medium-high
- Would disprove it: a habit and preference delta replay elsewhere at startup. None found.

### F9. The in-memory event stores do not behave like IndexedDB, so the suite cannot catch ordering bugs

- Tier guess: 2
- Packages: infrastructure, domain
- Evidence:
  - `packages/infrastructure/src/in-memory-event-store.ts:39-49` returns insertion order and slices `getAllAfter` by index
  - `packages/infrastructure/src/indexeddb-event-store.ts:244-248,312-322` sorts by timestamp and uses a timestamp range
  - `packages/domain/src/__tests__/in-memory-event-store.ts` is a second in-memory implementation
  - ADR-025 Design Point 3 describes the in-memory index-slice behavior for IndexedDB, which no longer matches
- Claim: The substitutes break Liskov substitution on the properties that matter for replication: ordering and the meaning of "after". Tests on them pass for the late-arrival and arrival-order cases that fail on the real store. Firestore is mocked, so no test models `serverReceivedAt`.
- Failure scenario: Fixes for F1 to F5 pass unit tests on in-memory stores and fail on devices.
- How verified: `read`
- Confidence: high
- Would disprove it: replication tests that run on the IndexedDB store and model the remote cursor. None found for these cases.

### F10. Conflicting edits resolve by each device's wall clock

- Tier guess: 3
- Packages: domain
- Evidence:
  - `packages/domain/src/event-helpers.ts:115-120` timestamps come from the client clock, and the event has no causal metadata such as a device id, sequence or parent
  - `packages/infrastructure/src/indexeddb-event-store.ts:244-248` replay order is client timestamp
  - Handlers check against the local replica, for example `packages/domain/src/habit.handlers.ts:192-206` "future date" uses the local clock and local events
- Claim: Replay order, and so the winner of concurrent edits, comes from device clocks. A device with a skewed clock can order its event before an event it already saw, so the replayed history can contradict what the user did. Validation is per replica, so two offline devices can both pass checks that together break an invariant. The applicator ignores the result without any signal.
- Failure scenario: The phone clock runs a minute slow. The user sees a task the desktop created, completes it on the phone, and the completion sorts before the creation on replay. It is dropped on every device after reload.
- How verified: `inferred` from `read`. Confirm with a replay test using skewed timestamps.
- Confidence: medium
- Would disprove it: a causal tie-break or per-aggregate sequence

## Small findings

- Each tab holds its own in-memory projections and subscribers, with no cross-tab notification (no BroadcastChannel or storage listener found). A second tab never sees the first tab's appends or downloads until reload. `packages/infrastructure/src/indexeddb-event-store.ts:366-376`. `read`.
- Two tabs downloading the same events: `objectStore.add` hits a `ConstraintError` and the whole batch aborts. This heals on the next sync. `packages/infrastructure/src/indexeddb-event-store.ts:164-166`. `inferred`.
- `firestore.rules:11-13` checks the event id only. Payload `userId`, `type` and `timestamp` are not validated, so a buggy client can write a doc that fails `assertValidDomainEvent` and triggers F7 on every client. `read`.
- `FirestoreEventStore.getAllAfter` falls back to a full `getAll()` on any non-validation error. This affects cost, not correctness, and a full download happens whenever the cursor is unuploaded (F1). `packages/infrastructure/src/firestore-event-store.ts:139,170-174`. `read`.
- Stale comments: `entry.projections.ts:41-49` says the seed is invalidated on the first event, while `:95-100` keeps it. `collection.projections.ts:99-104` makes the same claim. `read`.
- `IEventStore` doc `packages/domain/src/event-store.ts:51-61` says "timestamp strictly greater". The IndexedDB implementation is inclusive with an id filter, the in-memory one slices by index, and the Firestore one uses `serverReceivedAt`. Three meanings sit behind one contract. `read`.

## Did not examine

- `functions/` and the task and habit reminder index writers (they depend on F1 because they run only on this device's uploads, but their correctness was not traced)
- `IndexedDBSnapshotStore` internals and `validateProjectionSnapshot`
- Semantics of migration, sub-task and bulk-migrate handlers under out-of-order replay
- `review.projection.ts` wall-clock use (`Date.now()` at `:137`)
- Real Firestore `serverTimestamp()` behavior inside batches and offline write queuing (no emulator)
- `firestore.indexes.json`
