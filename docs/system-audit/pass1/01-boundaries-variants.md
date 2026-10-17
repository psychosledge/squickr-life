# Pass 1, agent A: boundaries and variant divergence (L1, L2)

Master at `41d7b2c`, 2026-10-17. Evidence levels: `read`, `run`, `inferred`. Runs are local vitest with in-memory stores (logic only, not representative of Firestore or multi-device timing). Scratch probes live in `docs/system-audit/pass1/scratch/` and run with `cd packages/client && npx vitest run --config ../../docs/system-audit/pass1/scratch/vitest.config.mts`.

## Ranked candidates

### A1. Taking a snapshot moves the upload cursor past local events that were never uploaded

- Tier guess: 1
- Packages: domain, client
- Evidence:
  - `packages/domain/src/entry.projections.ts:331-343`: `createSnapshot()` sets `lastSnapshotCursor` to the last event of `getAll()`, uploaded or not.
  - `packages/client/src/hooks/useColdStartSequencer.ts:288` and `:377`: SyncManager reads its cursor live from `entryProjection.getLastSnapshotCursor()`.
  - `packages/client/src/firebase/SyncManager.ts:131-138`: upload set is `localEvents.slice(cursorIndex + 1)`. Everything at or before the cursor is never considered for upload.
  - `packages/client/src/snapshot-manager.ts:44-62`: snapshots fire on every 50th append, on tab hidden and on beforeunload.
  - `packages/client/src/firebase/SyncManager.ts:184-195` with `packages/client/src/utils/constants.ts:56`: upload after an append is debounced 5 s.
  - `packages/client/src/hooks/useColdStartSequencer.ts:52-54`, `:258-260`: the `?clearsnapshot` flag exists to recover "events stuck behind the cursor".
- Claim: the sync cursor lives inside the entry read model, and any snapshot moves it to the newest local event. SyncManager then uploads only events after that cursor in client-timestamp order. A local event that is the cursor, or sorts before it, is skipped for good. The cursor is a read-model concern being used as a replication watermark (SRP).
- Failure scenario: user adds a task and switches apps within 5 s. The hidden-tab snapshot sets the cursor to that task's event. The debounced sync uploads nothing. Device A shows the task forever. Device B never gets it, and both show synced. The same happens offline, on the 50th append, or when a downloaded event from a device with a fast clock becomes the cursor and local events sort before it.
- How verified: run. `scratch/cursor.test.ts` appends one event, calls `createSnapshot()`, runs `syncNow()` with the production cursor wiring: output `cursor= e1 remoteIds= []`, the test fails. The reachability of the hidden-tab path is from reading the code.
- Confidence: high
- What would disprove it: a code path that uploads events at or before the cursor (none found in `SyncManager.ts`), or a guarantee that snapshots run only after the cursor event is confirmed in Firestore.

### A2. Reload seeds habit, preference and collection projections from the snapshot without correctly replaying later local events, and the stale state is re-saved

- Tier guess: 1
- Packages: domain, client
- Evidence:
  - `packages/client/src/App.tsx:396-408`: on a normal reload, collections get `seedFromSnapshot` plus `eventStore.getAllAfter(lastEventId)`. Habits and preferences get `hydrateFromSnapshot` with no delta at all.
  - `packages/domain/src/habit.projection.ts:603-619` and `packages/domain/src/user-preferences.projections.ts:62-65`: hydration replaces the cache. Neither cache is invalidated afterward (`habit.projection.ts:581-588`, `user-preferences.projections.ts:28-35` apply new appends only).
  - `packages/domain/src/entry.projections.ts:235-251`: the entry projection takes the opposite approach. It fully replays every local event because a timestamp delta "silently drops late-arriving events".
  - `packages/infrastructure/src/indexeddb-event-store.ts:312-322`: the IndexedDB `getAllAfter` used for the collection delta is exactly that client-timestamp delta.
  - `packages/client/src/snapshot-manager.ts:107-126`: the next snapshot serializes the stale habit and preference caches and pushes them to Firestore too (`:129`).
- Claim: one snapshot is consumed by four projections in three different ways. Entries are correct. Collections miss events whose client timestamp sorts before the cursor. Habits and preferences miss every event that reached IndexedDB after the snapshot was saved. Since nothing invalidates those caches, the next snapshot preserves the omission locally and remotely.
- Failure scenario: the 5-minute background sync downloads a habit completion from device B. The app is closed before a later snapshot finishes (the hidden and beforeunload saves are fire-and-forget, and `saveInProgress` drops overlapping saves at `snapshot-manager.ts:96`). On reload the completion is in IndexedDB, the entry list is correct, the habit grid is not. The next hidden-tab snapshot writes the stale habits to the remote snapshot, so a fresh device restores them as well. This matches the in-flight "Stale state on reload of an existing device" item, including "even after clearing site data".
- How verified: run for the projection behavior. `scratch/habit-hydrate.test.ts` shows hydrated `completions={}` and full replay `completions={'2026-10-02':...}` over the same store. The App.tsx wiring and the re-save path were read.
- Confidence: high for the mechanism, medium for how often the window is hit in production (inferred; device logs comparing snapshot `savedAt` with the newest IndexedDB event at reload would confirm).
- What would disprove it: a later step on the fast path that replays habit and preference events after hydration (none found in `App.tsx` or `useColdStartSequencer.ts`).

### A3. The Cloud Function writes events without `serverReceivedAt`, so delta sync never downloads them

- Tier guess: 1 (low-impact field, but two devices that both look synced disagree)
- Packages: functions, infrastructure, client
- Evidence:
  - `functions/src/task-reminder-fanout.ts:155-168`: writes `TaskReminderCleared` straight into `users/{uid}/events` with no `serverReceivedAt` and no `userId`.
  - `packages/infrastructure/src/firestore-event-store.ts:54`, `:85`: client writes always add `serverReceivedAt`.
  - `packages/infrastructure/src/firestore-event-store.ts:143-150`: delta download is `where('serverReceivedAt', '>', anchor)`. Firestore range filters exclude documents that lack the field.
  - `packages/infrastructure/src/firestore-event-store.ts:119-124`: full `getAll()` orders by `timestamp` and does include it.
- Claim: the event log has two writers with different document shapes. Events written by the function are visible only to devices that do a full download (cold start without snapshot, missing anchor, Force full sync). Every device on the normal delta path skips them permanently.
- Failure scenario: a reminder fires. Device A did a Force full sync last week and shows the reminder cleared. Device B, on delta sync, keeps showing a past-due reminder bell on the task. Both report synced. The projection keeps `reminderAt` (`packages/domain/src/entry.event-applicator.ts:580-598`).
- How verified: read. Firestore's missing-field exclusion is documented behavior, but no test was run against Firestore here. A Firestore emulator query with one doc lacking `serverReceivedAt`, or a functions test asserting the written fields, would confirm it.
- Confidence: high
- What would disprove it: the function's written document including `serverReceivedAt` through some other path (for example a Firestore trigger that backfills it). None found in `functions/src`.

### A4. One event type unknown to an older client stops that device syncing, with no visible error

- Tier guess: 2
- Packages: infrastructure, client, domain
- Evidence:
  - `packages/infrastructure/src/firestore-event-validator.ts:63-75`, `:201-208`: hand-maintained `KNOWN_EVENT_TYPES`. An unknown `type` throws.
  - `packages/infrastructure/src/firestore-event-store.ts:113`, `:124`, `:169-172`: every read maps all docs through the validator and rethrows validation errors.
  - `packages/client/src/firebase/SyncManager.ts:163-168`: only a timeout produces a user-facing `syncError`. Any other failure is logged and swallowed.
  - `packages/client/src/hooks/useColdStartSequencer.ts:296-301`: the fast path ignores sync errors by design.
- Claim: event-type acceptance is a versioned contract, and it is enforced per document on the whole result set. A newer client that writes a new event type makes every older client's download throw. Upload and download both stop, and the device keeps looking current.
- Failure scenario: the phone runs a cached older PWA build. The laptop ships a version with a new event type and writes one event. From then on every sync on the phone fails silently until it updates. Nothing new arrives and nothing local is uploaded.
- How verified: read. A validator test with an unknown type fed through `FirestoreEventStore.getAllAfter` and `SyncManager.syncNow` would confirm the end-to-end silence.
- Confidence: high for the mechanism, medium for likelihood (depends on how fast the service worker updates installed clients, not examined).
- What would disprove it: a forced-update gate that blocks old clients from syncing, or skip-and-log handling of unknown types.

### A5. The Cloud Function's habit schedule rule differs from the domain's

- Tier guess: 2
- Packages: functions, domain, client
- Evidence:
  - `functions/src/habit-event-reader.ts:53-57`, `:230-233`: every-n-days counts from a fixed epoch of 2020-01-01. The comment says createdAt is not available.
  - `packages/domain/src/habit.projection.ts:129-133`: the domain counts from the habit's local creation date.
  - `packages/domain/src/habit.projection.ts:119-120`, `:539-541`: `mode: 'relative'` habits are never "scheduled", they are "due" from the last completion. `functions/src/habit-event-reader.ts:13-16` has no `mode`, and the function treats relative habits as fixed.
  - `packages/client/src/firebase/habitReminderIndexWriter.ts:73-81`: the index doc carries `frequency` but no `createdAt`, so the function cannot match the domain rule.
- Claim: the function reimplements scheduling with a local copy of the types ("do NOT import from @squickr/domain", `habit-event-reader.ts:5`), and the two copies disagree. Weekly fixed habits agree. Every-n-days and all relative habits do not.
- Failure scenario: an every-3-days habit created 2026-10-01 is due 10-01, 10-04, 10-07 in the app. The function notifies on 10-02 and 10-05 and stays silent on the due days.
- How verified: run. Both formulas were replicated in a node one-liner for that habit: domain true on 10-01, 10-04, 10-07; function true on 10-02, 10-05. The rules themselves were read.
- Confidence: high
- What would disprove it: the index doc gaining `createdAt` and `mode` and the function using them (not present).

### A6. The habit reminder index is a second read model maintained by lossy client callbacks

- Tier guess: 2
- Packages: client, functions, firestore.rules
- Evidence:
  - `packages/client/src/firebase/habitReminderIndexWriter.ts:95-103`: `HabitNotificationTimeSet` rewrites the doc with `completedDates: []`, discarding today's completion.
  - `packages/client/src/firebase/bootstrapHabitReminderIndex.ts:325-333`: re-seeding also writes `completedDates: []`.
  - `packages/client/src/firebase/habitReminderIndexWriter.ts:16`, `:114-121`: archive deletes the doc. Restore is a no-op. The domain keeps `notificationTime` across archive and restore (`packages/domain/src/habit.projection.ts:484-495`).
  - `packages/client/src/firebase/SyncManager.ts:144-150`: the callback runs once after upload. A failure is logged and never retried. Per-event errors are swallowed too (`habitReminderIndexWriter.ts:172-174`).
  - `functions/src/habit-reminder-fanout.ts:92-103`, `:145`: the function trusts the index's `completedDates` to suppress notifications.
- Claim: notification state is derived from events by a hand-written incremental writer in the client, separate from `HabitProjection`, and it has no rebuild path beyond seeding missing docs. Its rules already disagree with the projection, and any missed write is permanent. Firestore SDK calls for it live in `packages/client/src/firebase/`, outside the infrastructure boundary.
- Failure scenario: user completes a habit at 07:00, then moves its reminder to 20:00. The index now says not completed, so the 20:00 notification fires for a done habit. A restored habit gets no reminder until the next app load re-seeds it, and then with empty completions. This is a plausible mechanism for the in-flight "Inconsistent notifications" item, which has no repro yet.
- How verified: read. A unit test of `createHabitReminderIndexWriter` with HabitCompleted followed by HabitNotificationTimeSet, checking `completedDates`, would confirm the first case.
- Confidence: high
- What would disprove it: a server-side rebuild of `habitReminders` from events (none in `functions/src`).

### A7. `getAllAfter` means something different in each event store, and only the in-memory semantics are exercised by most tests

- Tier guess: 2
- Packages: domain, infrastructure, client
- Evidence:
  - `packages/domain/src/event-store.ts:51-61`: contract says "timestamp strictly greater than the anchor's".
  - `packages/infrastructure/src/in-memory-event-store.ts:32-38` and `packages/domain/src/__tests__/in-memory-event-store.ts:44-50`: insertion-order index slice. `getAll` is unsorted insertion order.
  - `packages/infrastructure/src/indexeddb-event-store.ts:312-322`: inclusive lower bound on client `timestamp`, anchor removed by id. `getAll` is sorted by client timestamp (`:247`).
  - `packages/infrastructure/src/firestore-event-store.ts:143-165`: exclusive `serverReceivedAt` when present, exclusive client `timestamp` in the legacy branch.
  - Domain projection tests and client tests construct `InMemoryEventStore` (for example `packages/domain/src/collection.projections.test.ts`, `packages/client/src/hooks/useCollectionHandlers.test.ts`). Snapshot stores have shared contract tests (`packages/infrastructure/src/__tests__/in-memory-snapshot-store.test.ts:4`). Event stores have none.
- Claim: the same interface call returns different sets: arrival order in memory, client-clock order in IndexedDB, server-arrival order in Firestore. Code above the interface (SyncManager slicing, collection delta, snapshot cursor) is written as if one meaning held. In-memory-backed tests cannot see the clock-order bugs in A1 and A2.
- Failure scenario: any device with a skewed clock. Its events sort out of arrival order in IndexedDB, so local deltas and upload slices drop them, while tests on insertion order pass.
- How verified: read
- Confidence: high
- What would disprove it: a shared contract suite run against all three stores that pins one ordering and cursor meaning.

### A8. The remote snapshot is last-writer-wins from any device, including stale ones

- Tier guess: 2
- Packages: client, infrastructure
- Evidence:
  - `packages/client/src/snapshot-manager.ts:129`: every local save is also pushed to `users/{uid}/snapshots/entry-list-projection`.
  - `packages/infrastructure/src/firestore-snapshot-store.ts:234-240`: unconditional `setDoc`, with no comparison against the stored cursor.
  - `packages/client/src/hooks/useColdStartSequencer.ts:337-354`: a new or cleared device seeds every projection from that document and downloads only events after its cursor.
- Claim: the cold-start seed for every new device is whatever the most recent device to hide a tab believed. Snapshots carrying the A1 or A2 omissions, or from a device that has not synced for a while, replace a better one. Delta download from that cursor does not refill what the snapshot lacks.
- Failure scenario: an old tablet that has not synced is opened briefly, then hidden. Its snapshot overwrites the remote one. A phone cleared that day restores the tablet's view and shows it as current.
- How verified: inferred from read. A test that saves two snapshots with different cursors from two SnapshotManagers, then loads, would confirm. So would a Firestore rule or transaction check on `lastEventId`, if one were present.
- Confidence: medium
- What would disprove it: an upload guard that only writes when the local log is a superset of the remote cursor's log (none found).

### A9. Adding an event or entry type means editing many unchecked lists, and the task, note and event branches already drift

- Tier guess: 2
- Packages: domain, infrastructure, functions, client
- Evidence:
  - Hand-maintained event-type lists: `packages/infrastructure/src/firestore-event-validator.ts:76-134` ("no compile-time enforcement in the add direction", `:74-75`), `packages/domain/src/entry.event-applicator.ts:234-295`, `packages/domain/src/collection.projections.ts:398-411`, `packages/domain/src/habit.projection.ts:421-432`, `packages/domain/src/user-preferences.projections.ts` `isUserPreferencesEvent`, `functions/src/habit-event-reader.ts:94-188`, the two index writers.
  - Triplicated per-entry-type logic: `entry.event-applicator.ts:414-561` (task), `:665-777` (note), `:848-945` (event). The add-to-collection move logic is copied three times. Only the task copy sets `movedFrom` and `movedFromCollectionId` (`:536-540`). Separate handler files per entry type: `collection-management.handlers.ts`, `note-collection-management.handlers.ts`, `event-collection-management.handlers.ts`.
  - The domain `SquickrDomainEvent` union (`packages/domain/src/base-entry.types.ts:128`) and the validator list match today (run: diffed the literal sets, 50 types each).
- Claim: the design is closed to extension. A new event type must be added by hand in the validator, a type guard, the applicator or projection, and sometimes the function and an index writer, with no exhaustiveness check linking them. Forgetting the validator entry triggers A4 on every device. The three entry-type branches are parallel copies that already disagree on one field.
- Failure scenario: a habit-schedule event is added in the domain and applicator but not in `KNOWN_EVENT_TYPES`. Every device's Firestore read throws on the first such event.
- How verified: read, plus run for the union-versus-validator diff.
- Confidence: high
- What would disprove it: a derived type list (for example a `Record<SquickrDomainEvent['type'], true>`) that would fail compilation on omission (not present).

### A10. Snapshot store variants validate differently, so validation is repeated at call sites

- Tier guess: 3
- Packages: infrastructure, domain, client
- Evidence:
  - `packages/infrastructure/src/firestore-snapshot-store.ts:259` with `firestore-event-validator.ts:263-290`: Firestore load checks version and the core fields, but not `habits` or `userPreferences`.
  - `packages/infrastructure/src/indexeddb-snapshot-store.ts:483-493`: IndexedDB load casts with no version check, contrary to the contract note at `packages/domain/src/snapshot-store.ts:7-12` and `:30-33`.
  - Version and completeness checks repeated at `packages/domain/src/entry.projections.ts:145-160` and `packages/client/src/App.tsx:396-401`.
- Claim: what counts as a usable snapshot is decided by each consumer, not by the store. A third consumer that forgets the guard would seed projections from a stale-schema IndexedDB snapshot.
- Failure scenario: a new projection hydrates from `snapshotStore.load()` directly and reads a v9 shape after an upgrade.
- How verified: read
- Confidence: high
- What would disprove it: none expected. This is a structural observation.

### A11. Duplicate-append behavior differs by store, and an IndexedDB duplicate aborts a whole download batch

- Tier guess: 3
- Packages: infrastructure, client
- Evidence:
  - `packages/infrastructure/src/indexeddb-event-store.ts:119`, `:164-166`: `add()` rejects an existing id, and one rejection aborts the batch transaction.
  - `packages/infrastructure/src/firestore-event-store.ts:54`, `:85` with `firestore.rules:16`: `setDoc` on an existing id is an update and is denied, so the whole 500-chunk fails.
  - `packages/infrastructure/src/in-memory-event-store.ts:9-11`, `:20`: duplicates accepted silently.
  - `packages/client/src/hooks/useColdStartSequencer.ts:437-449`: Force full sync starts a second SyncManager while the first one's in-flight `syncNow` may still complete. `isSyncing` is per instance.
- Claim: append is not idempotent in either persistent store. Correctness depends on callers deduplicating by id, which SyncManager does only within one instance.
- Failure scenario: Force full sync is pressed while a background sync is downloading. Both instances append the same events, the second `appendBatch` throws, and that sync is lost (retried later).
- How verified: read for store semantics. The overlap is inferred. A test with two SyncManagers sharing stores and a delayed remote would confirm it.
- Confidence: medium
- What would disprove it: `stop()` awaiting the in-flight sync (it does not, `SyncManager.ts:76-88`).

### A12. Firestore-only fields leak into domain events and the local log

- Tier guess: 3
- Packages: infrastructure, client
- Evidence:
  - `packages/infrastructure/src/firestore-event-validator.ts:240-241`: returns the raw document, including the Firestore `Timestamp` in `serverReceivedAt`, cast as a domain event.
  - `packages/client/src/firebase/SyncManager.ts:159`: downloaded events go into IndexedDB unchanged.
  - `packages/infrastructure/src/firestore-utils.ts:9-11`, `:18`: `undefined` array elements become `null` on write, so round-tripped events can differ from the originals.
- Claim: the Firestore adapter does not map documents back to the domain shape. Locally created events and downloaded events have different shapes in the same IndexedDB store.
- Failure scenario: any future code that hashes, compares or re-serializes events (for example a log integrity check) sees two shapes for one event.
- How verified: read
- Confidence: medium
- What would disprove it: none expected. This is a structural observation.

## Small findings

- `packages/domain/src/event-store.ts:30-31` says `appendBatch` notifies subscribers once. All three implementations notify once per event (`in-memory-event-store.ts:26-28`, `indexeddb-event-store.ts:174-176`, `firestore-event-store.ts:96-98`). read.
- `packages/infrastructure/src/firestore-event-store.ts:74-90`: batches over 500 commit in separate chunks, so `appendBatch` is not atomic as `event-store.ts:26-28` promises. read.
- `packages/infrastructure/src/firestore-event-store.ts:161-165`: the legacy cursor uses a strict `>` on timestamp, which drops same-millisecond siblings. The IndexedDB store uses an inclusive bound to keep them (`indexeddb-event-store.ts:265-266`). read.
- `packages/infrastructure/src/firestore-event-store.ts:104-110`: `getById` needs an `aggregateId` plus `timestamp` composite index that is not in `firestore.indexes.json`. Inferred unused in production, since SyncManager never calls it.
- `firestore.rules:9-13`: the comment says the userId match is enforced, but the rule checks only `id == eventId`. Event shape and `serverReceivedAt == request.time` are not checked. read.
- `functions/src/habit-event-reader.ts:79-207`: `getActiveHabitsWithNotifications` is called only by tests. Production reads the `habitReminders` index (`habit-reminder-fanout.ts:92`). read.
- Two identical `InMemoryEventStore` copies: `packages/domain/src/__tests__/in-memory-event-store.ts` and `packages/infrastructure/src/in-memory-event-store.ts`. read.
- `movedFrom` and `movedFromCollectionId` (`packages/domain/src/task.types.ts:98-103`) are written only for tasks (`entry.event-applicator.ts:539-540`) and read nowhere outside the applicator. read.
- `packages/client/src/firebase/taskReminderIndexWriter.ts:215`, `:233`, `:247`: payloads are cast with `as unknown as` inline shapes instead of the domain event types. The `TaskTitleChanged` cast names a `newContent` field. read.
- `packages/domain/src/habit.projection.ts:622-634`: `getStatesForSnapshot` saves only the current frequency, so schedule history is lost on snapshot restore. This overlaps the in-flight habit-schedule slice 3. read.

## Did not examine

- Command handlers' validation in depth (task, note, event, collection, habit, bulk migrate, sub-task)
- Review, sub-task, daily-log and collection-view projections
- `packages/client/src/firebase/fcm.ts` token doc shape and its match with `functions/src/habit-reminder-fanout.ts:296-322`
- `functions/src/index.ts`, `functions/src/time-utils.ts`, `firebase.json`, `.github/workflows/`
- Service worker and PWA update behavior (it decides how likely A4 is)
- UI components and how they surface sync state
- ADR texts beyond using them as claims where cited
