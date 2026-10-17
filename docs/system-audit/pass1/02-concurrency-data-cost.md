# Pass 1, agent B: concurrency, data and privacy, performance and cost

Lenses L12, L10, L4. Baseline `master` at `41d7b2c`. Evidence is from reading code. No suite was run for these findings and nothing touched Firebase. Line numbers refer to the files as they stand at the baseline.

## Ranked candidates

### B1. Upload skips local events once the snapshot cursor passes them

- Tier guess: 1
- Packages: client, domain
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:131-138`: upload set is local events after the cursor in local order, minus remote ids
  - `packages/domain/src/entry.projections.ts:309-314`: `createSnapshot` sets the cursor to the last local event by client timestamp, uploaded or not
  - `packages/client/src/snapshot-manager.ts:45-65`: snapshot on every 50 events, on tab hidden, on beforeunload
  - `packages/client/src/firebase/SyncManager.ts:102-106,184-195`, `packages/client/src/utils/constants.ts:56`: append triggers a sync only after a 5 s debounce, and a sync within 5 s of the last one returns early
  - `packages/client/src/firebase/SyncManager.ts:224-231`: going hidden stops the interval and does not sync
  - `packages/infrastructure/src/firestore-event-store.ts:139`: a cursor missing from Firestore falls back to a full download, which does not widen the upload set
  - `packages/client/src/hooks/useColdStartSequencer.ts:52-57`: `?clearsnapshot` exists to recover "events stuck behind a stale cursor"
  - `docs/adr/ADR-025-delta-only-sync-firestore-download-scoped-to-snapshot-cursor.md:280-296` says the upload path still compares the full local log against the full remote log. The code contradicts this.
- Claim: Any local event that sorts at or before the cursor and has not been uploaded is never uploaded. The cursor moves on every snapshot save, which happens on tab hide, so an entry captured and closed inside the debounce window becomes the cursor before it uploads. A device clock running ahead on another device has the same effect: a downloaded future-dated event becomes the cursor and this device's newer-in-real-time events sort before it.
- Failure scenario: Open the PWA on the phone, add a task, switch apps within 5 s. `visibilitychange` saves a snapshot with cursor = the new task. On resume, `syncNow` slices local events after that task, so the task is excluded. Firestore never receives it. The laptop never shows it. Both devices finish sync with no error, since non-timeout failures and empty uploads show nothing (`SyncManager.ts:163-167`).
- How verified: read. Traced end to end. No existing test covers a cursor that is local-only (`SyncManager.test.ts:731-760` checks only that the cursor is passed through). Confirm with a SyncManager test using in-memory stores: append X locally, set cursor to X, run `syncNow`, assert remote contains X.
- Confidence: high
- What would disprove it: another upload path that compares the full local log to Firestore. None found (`grep appendBatch` in client: only `SyncManager.ts:142` and the benchmark path).

### B2. Habit, preference and collection projections never fully replay on an existing device, and their staleness is re-saved

- Tier guess: 1
- Packages: client, domain
- Evidence:
  - `packages/client/src/App.tsx:395-408`: fast path seeds collections (with a delta), habits and preferences (no delta) from the local snapshot
  - `packages/domain/src/habit.projection.ts:603-620`: `hydrateFromSnapshot` replaces the cache. `:581-588` applies later events incrementally only.
  - `packages/domain/src/user-preferences.projections.ts:62-65`: same pattern
  - `packages/domain/src/collection.projections.ts:108-143`: seed plus `applyDeltaEvents`. The delta comes from `IndexedDBEventStore.getAllAfter`, a client-timestamp range (`packages/infrastructure/src/indexeddb-event-store.ts:313-319`)
  - `packages/domain/src/entry.projections.ts:235-249`: the entry projection already rejects this pattern because late-arriving events with earlier timestamps are dropped, and does a full replay instead
  - `packages/client/src/snapshot-manager.ts:96-131`: snapshot serializes the in-memory habit and preference caches and writes them to the local and remote snapshot. `saveInProgress` skips a second trigger. Both lifecycle saves are fire-and-forget async chains that may not finish before page teardown.
- Claim: Events in IndexedDB that are not reflected in the local snapshot are never applied to habits or preferences, and late-arriving collection events are skipped. The next snapshot saves the stale cache with a fresh cursor, so the error persists locally and is pushed to the remote snapshot that new devices restore from.
- Failure scenario: Sync downloads a habit completion from the laptop. The phone is closed before the hide-time snapshot write commits. On reload the phone seeds habits from the older snapshot and skips that completion. The next hide saves the stale habit state with a newer cursor. Clearing site data restores the same stale remote snapshot. This matches the tracker item "Stale state on reload of an existing device ... even after clearing site data".
- How verified: read. Confirm with a test: save snapshot S, append a `HabitCompleted` to the store without a new snapshot, construct fresh projections, run the App fast-path sequence, assert the completion is visible.
- Confidence: high on the mechanism. Medium on how often lifecycle saves fail to commit.
- What would disprove it: a later full replay of these projections on the fast path. None found.

### B3. A second tab or window never sees the first one's events and can overwrite snapshots with stale state

- Tier guess: 1
- Packages: infrastructure, client, domain
- Evidence:
  - `packages/infrastructure/src/indexeddb-event-store.ts:174-176,366-376`: subscribers are in-process only
  - no `BroadcastChannel`, `navigator.locks` or IndexedDB-change listener in client, domain or infrastructure (grep)
  - `packages/client/src/firebase/SyncManager.ts:154-155`: downloads are filtered by ids already in IndexedDB, so tab B skips events tab A wrote or downloaded
  - `packages/domain/src/entry.projections.ts:309-346`: `createSnapshot` takes the cursor from IndexedDB (fresh) and the state from the in-memory cache (stale)
  - `packages/client/src/snapshot-manager.ts:126-131`: writes local and remote snapshots
- Claim: Each tab keeps its own projections and SyncManager over one shared IndexedDB. Tab B never applies events that entered IndexedDB through tab A, and its next snapshot pairs a cursor past those events with state that lacks them.
- Failure scenario: The installed PWA and a browser tab are both open. An entry is edited in the browser tab. The PWA window keeps showing the old value. When it goes hidden it saves a snapshot with the new cursor and old state, locally and to Firestore. A new device restores that remote snapshot, downloads only events after the cursor, and never shows the edit.
- How verified: read. Confirm with two `IndexedDBEventStore` instances on one fake-indexeddb database, each with its own `EntryListProjection`: append through one, call `createSnapshot` on the other, assert the state contains the event.
- Confidence: high
- What would disprove it: a single-tab lock or cross-tab notification elsewhere (none found).

### B4. Server-time delta races with the device's own upload

- Tier guess: 2
- Packages: client, infrastructure
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:122-142`: fetch the remote delta, then upload
  - `packages/infrastructure/src/firestore-event-store.ts:143-150`: delta is `serverReceivedAt > anchor.serverReceivedAt`
  - `packages/domain/src/entry.projections.ts:313`: the anchor is chosen by client order
  - `packages/infrastructure/src/firestore-event-store.ts:85`: every event in one batch gets the same server timestamp, so `>` also excludes the anchor's batch siblings. `docs/adr/ADR-025-...md:160` says the value is unique.
- Claim: An event committed by another device between this device's fetch and its own upload commit gets a server time below this device's next anchor. The next delta skips it permanently.
- Failure scenario: Phone and laptop both active. The laptop's sync fetches the delta, the phone uploads E, then the laptop's upload of X commits. The laptop's next cursor is X, so E is never downloaded. Its next remote snapshot also omits E, so new devices miss it.
- How verified: read, plus Firestore server-timestamp semantics (inferred). Confirm with a fake remote store that assigns server times and interleaves a second writer between `getAllAfter` and `appendBatch`.
- Confidence: medium. The window is short.
- What would disprove it: download before upload, or an overlap margin on the cursor. Neither exists.

### B5. Events written by the Cloud Function are invisible to delta sync

- Tier guess: 2
- Packages: functions, infrastructure
- Evidence:
  - `functions/src/task-reminder-fanout.ts:158-169`: writes `TaskReminderCleared` without `serverReceivedAt`
  - `packages/infrastructure/src/firestore-event-store.ts:146-150`: delta filters and orders on `serverReceivedAt`. Firestore excludes documents missing that field from such queries.
  - `firestore.rules:11-13`: create rule does not require `serverReceivedAt == request.time`
- Claim: Function-written events reach a device only through a full download (no cursor, missing anchor, error fallback, force full sync). Devices on delta sync never receive them.
- Failure scenario: A reminder fires. A phone that later ran Force full sync shows the reminder cleared. The laptop on delta sync keeps showing it set. Both report up to date.
- How verified: read. Confirm with the field-presence rule in Firestore query docs, or an emulator query.
- Confidence: high
- What would disprove it: another path that writes `serverReceivedAt` on these docs (none found).

### B6. One unknown event type stops all sync on an older client, silently

- Tier guess: 2
- Packages: infrastructure, client
- Evidence:
  - `packages/infrastructure/src/firestore-event-validator.ts:54-76`: allow-list of known types
  - `packages/infrastructure/src/firestore-event-store.ts:168-172`: validation errors are rethrown
  - `packages/client/src/firebase/SyncManager.ts:122-142`: fetch runs before upload, so a throw also blocks upload. `:163-167` and `packages/client/src/hooks/useColdStartSequencer.ts:295-302` show no error on the fast path.
  - `packages/client/vite.config.ts:37`: `registerType: 'autoUpdate'`. An open page keeps old code until reload.
- Claim: After a release adds an event type, any device still running the previous bundle throws on every sync once it downloads one such event. Its own new events stop uploading, and nothing tells the user.
- Failure scenario: Deploy a version with a new habit event type and use it on the laptop. The phone PWA stays resident on the old bundle for a day. Everything typed on the phone that day stays local, with no error shown.
- How verified: read. Confirm with a `FirestoreEventStore` unit test that feeds a doc with an unlisted type into `getAllAfter`, and a SyncManager test asserting upload still happens.
- Confidence: high on the mechanism. Exposure depends on release cadence.
- What would disprove it: forced reload on service worker update. Not found.

### B7. Reminder fan-out windows have gaps and no catch-up

- Tier guess: 2
- Packages: functions
- Evidence:
  - `functions/src/task-reminder-fanout.ts:81,190,202`: window `[runStart - 15 min, runStart]` every 15 minutes
  - `functions/src/habit-reminder-fanout.ts:124,133`, `functions/src/time-utils.ts:49-67`: habit fires only if `HH:MM` is within 7 minutes of the run's local time
  - `functions/src/task-reminder-fanout.ts:81`: reminders older than the window are skipped and never deleted, so they are re-read every run
  - `functions/src/task-reminder-fanout.ts:103-109`, `functions/src/habit-reminder-fanout.ts:170-176`: idempotency log is written before send. A crash after the log loses that reminder and, for tasks, the cleared event.
- Claim: Any run that starts late relative to the previous one, fails, or times out leaves reminder times that no run covers, and nothing retries them.
- Failure scenario: One run starts 40 s late and the next on time. Task reminders in the 40 s gap and habit times exactly 8 minutes past the earlier slot never fire. This fits the tracker item "Inconsistent notifications" (no repro yet).
- How verified: read. Confirm with Cloud Scheduler execution timestamps from logs, or a unit test that runs `processUserTaskReminders` with consecutive `now` values 15 min 40 s apart.
- Confidence: medium. Scheduler jitter size is unknown.
- What would disprove it: scheduler start times that are always exactly aligned and never fail.

### B8. Every-n-days habit reminders fire on different days than the app schedules

- Tier guess: 2
- Packages: functions, domain
- Evidence:
  - `functions/src/habit-event-reader.ts:57,151-153`: day count from a fixed 2020-01-01 epoch
  - `packages/domain/src/habit.projection.ts:129-132`: day count from the habit's local creation day
- Claim: The two schedule rules differ unless the creation day happens to align with the epoch modulo n. The function also has no notion of relative habits or schedule history.
- Failure scenario: A habit every 3 days, created on a day not aligned to the epoch. The app lists it Monday. The reminder comes Tuesday.
- How verified: read
- Confidence: high
- What would disprove it: the reminder index carrying a creation date that the function uses. It does not (`HabitState` at `habit-event-reader.ts:18-25`).

### B9. Several paths turn delta sync into a full collection download on every trigger

- Tier guess: 2
- Packages: client, infrastructure
- Evidence:
  - `packages/client/src/hooks/useColdStartSequencer.ts:133-143,437-451`: Force full sync installs a SyncManager whose cursor is always null, and stops the SnapshotManager, for the rest of the session
  - `packages/infrastructure/src/firestore-event-store.ts:134,139,170-174`: null cursor, missing anchor (the B1 state) or any non-validation error falls back to `getAll()`
  - `packages/client/src/firebase/SyncManager.ts:58-70,222-241`: triggers are start, every 5 min, focus, visible, online, each local append, each download batch
- Claim: In these states every sync trigger reads the user's whole event collection. Metered reads scale with total events times triggers.
- Failure scenario: The owner taps Force full sync to recover B1 or B2 and keeps the app open all day. Each focus and each 5-minute tick downloads the full history.
- How verified: read
- Confidence: high
- What would disprove it: a cursor reset after the first full sync (none).

### B10. Startup and download cost grows with total history, and downloads write remote snapshots repeatedly

- Tier guess: 2
- Packages: domain, infrastructure, client
- Evidence:
  - `packages/infrastructure/src/indexeddb-event-store.ts:174-176`: download batch notifies per event
  - `packages/domain/src/entry.projections.ts:102-103`, `packages/domain/src/entry.event-applicator.ts:81-95`: each event rebuilds maps over every entry, then notifies the UI
  - `packages/domain/src/entry.event-applicator.ts:180-189`: `getEntries` sanitize does a linear search per migrated entry
  - `packages/client/src/snapshot-manager.ts:45-51,99-131`: every 50 downloaded events triggers `getAll()` plus a local and a remote full-state snapshot write
  - `packages/domain/src/entry.projections.ts:186,249`: full replay of all events on every fast-path start
  - `packages/client/src/firebase/SyncManager.ts:114`: full IndexedDB read on every sync. `packages/domain/src/collection.projections.ts:183-185`: full read on every `getDeletedCollections`
  - no pruning or compaction of events anywhere
- Claim: Cold start, each sync, and each downloaded event cost time proportional to total history, and a large delta produces a remote snapshot write per 50 events.
- Failure scenario: A device away for a while downloads a large delta. It re-renders once per event, runs many full IndexedDB scans, and writes the whole snapshot document to Firestore repeatedly during one download.
- How verified: read
- Confidence: medium on impact. No sizing from production.
- A load test would need to show: cold-start and sync wall time against seeded local stores of increasing event counts, UI render counts during a delta download, and remote snapshot writes per downloaded event. Measure locally with in-memory or fake-indexeddb stores.
- What would disprove it: measurements flat in event count.

### B11. Remote snapshot is one unbounded document, last writer wins, and failures are swallowed

- Tier guess: 2
- Packages: infrastructure, client, domain
- Evidence:
  - `packages/domain/src/entry.projections.ts:323-346`: state includes every entry ever, soft-deleted included
  - `packages/client/src/snapshot-manager.ts:110-131`: adds collections and habits with all completions, then remote save is fire-and-forget with `console.warn`
  - `packages/infrastructure/src/firestore-snapshot-store.ts:42-48`: one doc `users/{uid}/snapshots/entry-list-projection`, overwritten by any device
- Claim: The document grows without bound toward the Firestore per-document size limit. Once a save fails, the remote snapshot silently stops advancing. Any device, including one stale per B2 or B3, can overwrite it.
- Failure scenario: The remote snapshot stops updating. New devices restore an old snapshot and download an ever larger delta, or restore a stale device's state.
- How verified: inferred. Confirm by measuring the serialized size of the current local snapshot (read-only, in the browser) and comparing it with the documented limit.
- Confidence: medium
- What would disprove it: snapshot size far below the limit with slow growth, and a single snapshot writer.

### B12. Sign-out leaves the device registered for the previous account's notifications

- Tier guess: 2
- Packages: client
- Evidence:
  - `packages/client/src/firebase/auth.ts:30-38`: sign-out only calls Firebase sign-out
  - `packages/client/src/firebase/fcm.ts:115-125`: heartbeat `updateDoc` on `users/{newUid}/fcmTokens/{id}` fails when that doc does not exist, and the error is swallowed
  - `functions/src/task-reminder-fanout.ts:152-158`, `functions/src/habit-reminder-fanout.ts:190-197`: message body carries task text and habit title
- Claim: Backlog #21 covers the unscoped IndexedDB. The FCM part is not listed: the token stays under account A, so the device keeps receiving A's reminder text after sign-out. Account B on the same device never registers, because the localStorage flags send it down the heartbeat path.
- Failure scenario: Sign out of A and sign into B. A's reminders still appear on the lock screen. B gets none.
- How verified: read
- Confidence: high
- What would disprove it: token cleanup on auth change elsewhere (none found).

### B13. No retention or deletion path for personal data

- Tier guess: 3
- Packages: functions, firestore.rules
- Evidence:
  - `firestore.rules:16`: events cannot be deleted. No account-deletion code exists.
  - `functions/src/task-reminder-fanout.ts:100-109`, `functions/src/habit-reminder-fanout.ts:166-176`: `notificationLog` docs carry a `ttl` field. No TTL policy is defined in the repo.
  - `functions/src/habit-reminder-fanout.ts:134,140,146,202`: habit titles go to Cloud Logging on every run for every habit
- Claim: Event logs, notification logs and the snapshot grow forever and cannot be purged by the app. Function logs hold habit titles.
- Failure scenario: A second user asks for their data to be deleted. There is no path short of the console.
- How verified: read. TTL policy status is inferred. Confirm in the Firestore TTL settings.
- Confidence: medium
- What would disprove it: a TTL policy configured outside the repo.

### B14. "Now" is frozen at mount in navigation and hierarchy

- Tier guess: 3
- Packages: client
- Evidence: `packages/client/src/components/HierarchicalCollectionList.tsx:148`, `packages/client/src/hooks/useCollectionHierarchy.ts:331`, `packages/client/src/hooks/useCollectionNavigation.ts:72`
- Claim: `useMemo(() => new Date(), [])` feeds today and auto-favorite resolution. A PWA kept open past midnight resolves `/today` and temporal favorites to the previous day until remount. The UTC-day bug in `collectionSorting.ts` is already tracked.
- Failure scenario: Open the app at 23:50 and keep it open. At 00:10 the today link still opens yesterday's log.
- How verified: read
- Confidence: medium. Depends on how long these components stay mounted.
- What would disprove it: these components remounting on every navigation.

## Small findings

- `packages/infrastructure/src/indexeddb-event-store.ts:56-93`: version 1, no `onblocked` handler, no migration scaffold. A future version bump with an old tab open leaves `initialize()` pending and the app on "Loading...". The snapshot store is the same (`indexeddb-snapshot-store.ts:44-73`).
- `packages/infrastructure/src/indexeddb-event-store.ts:165`: `add()` aborts the whole download batch on one duplicate id. Two tabs downloading the same delta fail one tab's sync.
- `firestore.rules:16` with `packages/infrastructure/src/firestore-event-store.ts:85`: re-uploading an existing id is an update and is denied, which fails the whole batch. Two tabs uploading the same event hit this. Any future path where the remote delta misses an uploaded event would fail every sync.
- `firestore.indexes.json:2-10` declares a single-field index as a composite index. Firestore normally rejects that definition (inferred; confirm with a CLI deploy validation). `FirestoreEventStore.getById` (`firestore-event-store.ts:104-114`) needs an `aggregateId` plus `timestamp` composite index that is not declared. It is not called on the remote store today.
- `packages/client/src/firebase/SyncManager.ts:65-67`: download appends notify the SyncManager's own subscriber, so every download triggers a follow-on sync and another remote read.
- `packages/client/src/firebase/habitReminderIndexWriter.ts:98-100`: `HabitNotificationTimeSet` rewrites the index doc with `completedDates: []`, so changing a reminder time after completing the habit today re-sends today's reminder.
- `functions/src/habit-reminder-fanout.ts:117-125`: the first token's time zone is used for all of a user's devices. Device order decides the time zone when devices disagree.
- `functions/src/habit-event-reader.ts:79`: `getActiveHabitsWithNotifications` reads the full events collection and has no caller in `functions/src`.
- `packages/domain/src/entry.projections.ts:58-65`: the empty-store flag is computed once per page load. After sign-out and sign-in it is stale. Overlaps backlog #21.

## Did not examine

- Command handlers' read paths and validation under concurrent commands
- `packages/client/src/firebase/taskReminderIndexWriter.ts` and `bootstrapHabitReminderIndex.ts` beyond index field shapes
- Service worker (`firebase-messaging-sw.js`) and notification click handling
- `.github/workflows/` and deploy timing
- Review and daily-log projection costs, and React render profiling
- Functions and client test suites (not run for this pass)
- Event-sourcing semantics beyond sync ordering (agent F)
