# Verification log

Baseline `41d7b2c`, 2026-10-17. Environment for every run: local vitest in `packages/client` with in-memory stores and a fake remote. Logic only. No Firestore, no browser lifecycle, no real devices.

## T1. Sync watermark is the snapshot cursor

### Method

- Read `packages/client/src/firebase/SyncManager.ts:97-171` (syncNow), `:184-195` (debounce), `:222-241` (listeners).
- Read `packages/domain/src/entry.projections.ts:309-314` (createSnapshot) and the other cursor writes at `:206`, `:224`, `:233`.
- Read `packages/client/src/snapshot-manager.ts:40-131` (triggers and save).
- Read cursor wiring at `packages/client/src/hooks/useColdStartSequencer.ts:288`, `:377`, and Force full sync at `:133-143`, `:437-451`.
- Read `packages/infrastructure/src/firestore-event-store.ts:130-139` (missing anchor falls back to `getAll()`) and `packages/infrastructure/src/indexeddb-event-store.ts:244-248` (local `getAll` sorted by client timestamp).
- Read ADR-025 Design Point 6.
- Ran `pass1/scratch/cursor.test.ts` (agent A) and `pass1/scratch/cursor-lead.test.ts` (lead).

### Evidence

- `createSnapshot()` sets `lastSnapshotCursor` to the last event of `getAll()` with no reference to upload state (`entry.projections.ts:313-314`).
- SyncManager reads that cursor live (`useColdStartSequencer.ts:288`, `:377`) and uploads only `localEvents.slice(i + 1)` when the cursor is found locally (`SyncManager.ts:131-138`).
- Snapshots save on tab hidden, beforeunload and every 50th append (`snapshot-manager.ts:45-65`). Upload after an append waits 5000 ms (`SyncManager.ts:184-195`, `constants.ts:56`). Going hidden stops the interval without syncing (`SyncManager.ts:224-227`). `syncNow` also returns early within 5000 ms of the last sync (`:103-106`).
- When the cursor event is absent remotely, Firestore `getAllAfter` returns the full log (`firestore-event-store.ts:139`), so download works and the device looks healthy.
- Lead probe, measured: sync e1, append e2, snapshot, sync, append e3, sync. Output `cursor= e2 remoteIds= [ 'e1', 'e3' ]`. e2 never uploads. Later events do.
- Agent A probe, measured: append e1, snapshot, sync. Output `cursor= e1 remoteIds= []`.
- IndexedDB orders the local log by client timestamp (`indexeddb-event-store.ts:247`). A downloaded event with a later timestamp than a not-yet-uploaded local event becomes the cursor at the next snapshot, and the local event sorts before it. Read, not run.
- Force full sync builds a SyncManager with `() => null` as the cursor (`useColdStartSequencer.ts:133-143`), so it compares full logs and uploads stranded events. `?clearsnapshot` does the same on the fast path (`:258-266`).

### Corrections to agent reports

- ADR-025 Design Point 6 states that upload compares the full local log against the full remote log. The code scopes upload to the cursor, and the comment at `SyncManager.ts:127-130` cites ADR-025 for that scoping. The ADR is stale on this point (B1 was correct).
- Agent D rated its D1 evidence as read only. Two runs now confirm it.
- Agent A's line citation for `createSnapshot` (`entry.projections.ts:331-343`) is off. The cursor assignment is at `:313-314`.

### Not verified

- Frequency on real devices. Whether mobile browsers fire `visibilitychange` before the 5 s debounce elapses in the add-then-switch flow is inferred from the code and platform behavior.
- How many events are stranded in production today. That would need a read of the owner's IndexedDB on each device against Firestore, which this audit does not do.

## T2. Snapshot restore and hydration

### Method

- Read `packages/domain/src/entry.projections.ts:135-252` (hydrate) and `:112-120` (resolveCache).
- Read `packages/client/src/App.tsx:378-410` (fast-path seeding) and `packages/client/src/hooks/useColdStartSequencer.ts:311-400` (remote restore).
- Read `packages/domain/src/habit.projection.ts:575-620`, `packages/domain/src/user-preferences.projections.ts:20-35,58-65`, `packages/domain/src/habit.handlers.ts:59-76`.
- Read `packages/infrastructure/src/firestore-snapshot-store.ts:42-48`, `packages/client/src/snapshot-manager.ts:95-131`.
- `git log -L236,250:packages/domain/src/entry.projections.ts`.
- Grep for cross-tab coordination (BroadcastChannel, navigator.locks, storage listeners).
- Ran `pass1/scratch/restore-reload-lead.test.ts` (lead) and `pass1/scratch/habit-hydrate.test.ts` (agent A).

### Evidence

- Remote restore: the slow path saves the remote snapshot locally and hydrates (`useColdStartSequencer.ts:335-337`). The local log is empty, so `hydrate()` seeds the cache and sets the cursor to the remote `lastEventId` (`entry.projections.ts:186-208`). SyncManager then downloads only events after that cursor. Nothing backfills older history.
- The next local snapshot records a `lastEventId` that exists in the partial local log. On reload `hydrate()` finds the anchor and runs `applyEvents(allEvents)` over the partial log (`:233-251`), ignoring `snapshot.state`.
- Lead probe, measured: restored device shows `['new', 'old']`, then after one local snapshot and a reload shows `['new']`.
- The full-replay branch came from `a940c51` (2026-04-27, "hydrate() uses full local replay to prevent late-arriving events being silently dropped"). It assumes a complete local log.
- Habit and preference projections replace their cache from the snapshot and apply only new appends (`habit.projection.ts:581-588,603-620`, `user-preferences.projections.ts:24-35,62-65`). Their comment states the local store can be incomplete on new devices. Events already in IndexedDB after the snapshot cursor are never applied to them. Agent A probe, measured: hydrated completions empty, full replay holds the completion.
- Collections seed from the snapshot and apply `eventStore.getAllAfter(lastEventId)` (`App.tsx:396-399`), which on IndexedDB is a client-timestamp range, so late arrivals are skipped. Read.
- Three projection families use three restore rules: entries replay the local log, habits and preferences trust the snapshot, collections use snapshot plus a timestamp delta.
- Habit handlers load aggregates from the local log (`habit.handlers.ts:59-76`). On a partial log a pre-snapshot habit throws "Habit not found". Read.
- Remote snapshot save is an unconditional `setDoc` (`firestore-snapshot-store.ts:42-48`), pushed after every local save (`snapshot-manager.ts:126-131`). A device in the degraded state above overwrites the shared snapshot that new devices restore from. Read.
- Cross-tab: no coordination exists (the only storage listener is `useFcmRegistrationStatus.ts:39`). `createSnapshot()` takes the cursor from a fresh `getAll()` and the state from the tab's cache (`entry.projections.ts:309-321`, `:112-120`). Read.

### Corrections to agent reports

- Agent D scenario B (full log replayed onto seeded state when the remote cursor was never uploaded) was not checked. `applyEventsOnto` idempotency per event type remains open.
- Agent E8 (offline cold start on an empty Firestore cache shows an empty journal as synced) depends on SDK cache behavior in a browser. Not verified.

### Not verified

- Real-device frequency of app termination before a hide-time snapshot commits (sizes the habit and preference gap).
- Whether the owner's devices are currently in the restored-then-reloaded state.

## T3. Ordering, causality and store semantics

### Method

- Read `packages/infrastructure/src/firestore-event-store.ts:44-176` (append, appendBatch, getAll, getAllAfter).
- Read `packages/domain/src/entry.projections.ts:76-106` (incremental apply) and `packages/domain/src/entry.event-applicator.ts:76-96,350-366`.
- Read `packages/infrastructure/src/indexeddb-event-store.ts:150-178,244-248,305-325` and `packages/infrastructure/src/in-memory-event-store.ts:28-50`.
- Read `packages/domain/src/event-store.ts:20-62` (IEventStore contract), `firestore.rules`, `packages/infrastructure/src/firestore-event-validator.ts:232-244`, `packages/domain/src/event-helpers.ts:19-25`.
- Ran `pass1/scratch/arrival-order-lead.test.ts` (lead).

### Evidence

- Every write in one Firestore batch carries `serverTimestamp()` (`firestore-event-store.ts:85`), which resolves to one commit time for the batch (Firestore documented behavior, inferred for this app). The delta query orders only by `serverReceivedAt` (`:146-150`), so ties fall to document id, a random UUID.
- SyncManager appends downloads in remote order without sorting (`SyncManager.ts:153-160`). IndexedDB notifies subscribers per event in that order (`indexeddb-event-store.ts:170-176`). The entry projection applies each one onto its cache (`entry.projections.ts:93-103`).
- An update for an entry not in the cache is dropped silently (`entry.event-applicator.ts:354-363` for TaskCompleted; other update cases follow the same pattern).
- Lead probe, measured: a batch downloaded as `[TaskCompleted, TaskCreated]` leaves the live cache `open`. A replay of the same log in client-timestamp order gives `completed`.
- Reload replays in client-timestamp order (`indexeddb-event-store.ts:247`), so the live and replayed states differ until reload. Habits and preferences do not replay on reload (W3), so their difference persists.
- Download race: SyncManager fetches the remote delta, then uploads (`SyncManager.ts:122-142`). The next delta uses `serverReceivedAt > anchor.serverReceivedAt` (`firestore-event-store.ts:143-150`), and the anchor is the newest local event by client timestamp. An event another device commits between this device's fetch and its upload commit has an earlier server time than this device's own event, so once that own event is the cursor the other event is never downloaded. Read. Agent F reproduced it against a fake remote.
- IEventStore contract (`event-store.ts:26-61`) promises atomic `appendBatch`, one subscriber notification per batch, and `getAllAfter` by "timestamp strictly greater". Actual behavior: Firestore chunks at 500 and is not atomic across chunks (`firestore-event-store.ts:77-90`). All stores notify per event. In-memory `getAll` is insertion order and `getAllAfter` slices by index (`in-memory-event-store.ts:39-49`). IndexedDB sorts by client timestamp with an inclusive bound (`indexeddb-event-store.ts:247,316-322`). Firestore uses server time (`firestore-event-store.ts:143-150`).
- Firestore rules forbid updates (`firestore.rules:16`), so re-uploading an existing id rejects the whole batch. IndexedDB `add()` aborts a batch on a duplicate id (`indexeddb-event-store.ts:164-166`). Read.
- The validator returns the raw Firestore document, `serverReceivedAt` Timestamp included, cast as a domain event (`firestore-event-validator.ts:242-243`). Downloaded events go into IndexedDB with that field. Read.
- Event timestamps come from the device clock (`event-helpers.ts:19-25`). There is no causal metadata (no device id, sequence or parent). Read.

### Corrections to agent reports

- Agent F cited `event-helpers.ts:115-120` and `:119` for event metadata. The function is at `:19-25`.
- Agent C's permission-denied scenario (re-upload of an existing id latches every sync) is reachable only while a downloaded event sorts after the cursor in client order but before it in server order. The state clears at the next snapshot. Read, not run.

### Not verified

- Real Firestore tie behavior within one batch commit (no emulator).
- Real-device frequency of the download race.

## T4. Silent failure and no convergence check

### Method

- Read `packages/client/src/firebase/SyncManager.ts:110-171` (already read in T1), `packages/client/src/hooks/useColdStartSequencer.ts:280-302`, `packages/infrastructure/src/firestore-event-validator.ts:196-212`, `packages/client/vite.config.ts:30-72`.
- Grep for error boundaries and sync-state consumers in `packages/client/src`.
- Read `packages/client/src/App.test.tsx` store mocks.
- `git show` for `9d27371` and `31278f9`.

### Evidence

- SyncManager turns only the timeout into a `syncError`. Every other error is logged and reported as `(false, undefined)` (`SyncManager.ts:162-171`).
- The fast path, which every launch on a device with local data takes, ignores the error argument (`useColdStartSequencer.ts:294-302`). `31278f9` (2026-06-06) made this deliberate to stop a blocking resume overlay.
- The only UI that reads `syncError` is the cold-start overlay (`App.tsx:510-514`). No component shows last successful sync time, pending uploads or sync state.
- No check compares a replica's contents with the server (count, hash or cursor position).
- The validator throws on an unknown event type (`firestore-event-validator.ts:200-207`). The store rethrows validation errors (`firestore-event-store.ts:172`). The fetch runs before the upload in one try (`SyncManager.ts:122-142`), so the throw also stops uploads.
- `9d27371` (2026-06-06): two event types missing from `KNOWN_EVENT_TYPES` made `assertValidDomainEvent` throw "on every sync that encountered a task reminder event, silently blocking all syncs". The mechanism has caused one outage already. Window: `TaskReminderSet` and `TaskReminderCleared` shipped in v1.20.0 (2026-04-26, `631033f`) without validator entries, and the validator existed since `39c2cf8` (2026-04-05). The fix shipped in v1.20.8 (2026-06-06). Every sync that downloaded one of those events failed from the first reminder set after 2026-04-26 until 2026-06-06 (start date inferred).
- PWA: `registerType: 'autoUpdate'` with `clientsClaim: true` (`vite.config.ts:37,71`). No `useRegisterSW` or update polling in `src`. A resident page keeps its loaded JS until reload. How long an installed PWA stays on an old bundle is inferred.
- `appendBatch` to Firestore is awaited without a timeout (`SyncManager.ts:142`). The timeout timer is never cleared (`:119-121`). While a commit is pending, every trigger returns early on `isSyncing` (`:98-100`). The SDK's offline commit behavior is inferred from its docs.
- No `ErrorBoundary` or `componentDidCatch` in `packages/client/src`. Production logs go to the console only (`utils/logger.ts`).
- `App.test.tsx` mocks lack `getAllAfter` and `appendBatch` and do not mock SyncManager, so the boot test's sync throws a TypeError that `SyncManager.ts:163` swallows. Read.

### Corrections to agent reports

- None of substance. Agents C, D, E and F agree, and the citations checked hold.

### Not verified

- How long an installed PWA on the owner's phone stays on an old bundle.
- Firestore `WriteBatch.commit` behavior offline with `persistentLocalCache` in this SDK version.

## T5. Function-written events and delta sync

### Method

- Read `functions/src/task-reminder-fanout.ts:150-175`, grep for event writes in `functions/src`.
- Read `packages/infrastructure/src/firestore-event-store.ts:130-176` (delta query and legacy branch), `packages/domain/src/entry.event-applicator.ts:590-597`.

### Evidence

- The only event write in functions is `TaskReminderCleared` at `task-reminder-fanout.ts:158-169`. The document has no `serverReceivedAt` and no `userId`.
- The delta query is `where('serverReceivedAt', '>', anchor)` with `orderBy('serverReceivedAt')` (`firestore-event-store.ts:146-150`). Firestore excludes documents that lack the filtered or ordered field (documented behavior, inferred for this app). Only `getAll()` (ordered by `timestamp`) returns these events: on a null cursor, a missing anchor, a query error, or Force full sync.
- A device that misses the event keeps `reminderAt` on the task (`entry.event-applicator.ts:590-597`).
- If a function-written event becomes a device's cursor (it is the newest by client timestamp after a full download), the anchor has no `serverReceivedAt`, so `getAllAfter` switches to the legacy branch that filters on client `timestamp` (`firestore-event-store.ts:152-166`). That branch skips events uploaded later with earlier client timestamps. Read, not run.

### Corrections to agent reports

- None. Agents A, B and C agree, and the citations hold.

### Not verified

- Firestore missing-field exclusion against this project (no emulator).

## T6. Extension cost and SOLID boundaries

### Method

- Measured 6-month churn and fix commits per non-test file with `git log --since=2026-04-17` (local repo).
- Read `packages/infrastructure/src/firestore-event-validator.ts:59-137`, `packages/domain/src/collection-management.handlers.ts:60-100`, `packages/domain/src/note-collection-management.handlers.ts:60-100`.
- Grep for Firebase SDK imports outside `packages/infrastructure`, for infrastructure or Firebase imports in `packages/domain`, for SyncManager construction and `onSyncStateChange` assignments in `useColdStartSequencer.ts`, and for handler read styles.

### Evidence

- Churn, measured: `useColdStartSequencer.ts` 9 commits and 5 fixes, 454 lines. `habit.projection.ts` 4 and 4 (in-flight habit schedule work). `App.tsx` 3 and 2. Others 3 or fewer.
- `useColdStartSequencer.ts` constructs SyncManager at `:136`, `:216`, `:284`, `:373` and assigns five different `onSyncStateChange` policies at `:226`, `:295`, `:389`, `:397`, `:445`. Path selection, sync wiring, snapshot manager lifecycle, error policy and benchmark diagnostics share one effect. `31278f9` changed the error policy on one path only.
- The validator comment states there is no compile-time check when a domain event type is added (`firestore-event-validator.ts:63-75`). `9d27371` is the outage that resulted.
- Per-entry-type copies drift: `RemoveTaskFromCollectionHandler` blocks removing a task's only collection (`collection-management.handlers.ts:82-86`). `RemoveNoteFromCollectionHandler` has no such guard (`note-collection-management.handlers.ts:65-91`). Agent A's `movedFrom` drift in the applicator was not re-read.
- `packages/domain/src` imports nothing from Firebase or infrastructure (grep).
- Command handlers take `IEventStore` but validate against concrete projection classes (37 projection reads across handler files). Habit handlers load from `eventStore.getById` instead. Two validation styles exist.
- Firebase SDK is imported directly in client files outside infrastructure: `firebase/habitReminderIndexWriter.ts`, `firebase/taskReminderIndexWriter.ts`, `firebase/bootstrapHabitReminderIndex.ts`, `hooks/useColdStartSequencer.ts`, plus auth and config.

### Corrections to agent reports

- None of substance. Agent E's churn figures reproduced exactly.

### Not verified

- Agent A's claim that only the task applicator branch sets `movedFrom`.

## T7. Reminder and notification correctness

### Method

- Read `functions/src/habit-event-reader.ts:50-58,210-236`, `packages/domain/src/habit.projection.ts:112-135`.
- Read `packages/client/src/firebase/habitReminderIndexWriter.ts:88-125`, `packages/client/src/firebase/taskReminderIndexWriter.ts:37-69`.
- Read `functions/src/task-reminder-fanout.ts:76-84,186-204`, `functions/src/time-utils.ts:45-70`.
- Read `packages/client/src/firebase/fcm.ts:60-75,150-166`, `packages/client/dist/registerSW.js` (local build), `packages/client/vite.config.ts:36-75`.
- Grep for `ClearTaskReminder` callers.

### Evidence

- Every-n-days: the function counts from a fixed `2020-01-01` epoch (`habit-event-reader.ts:53-57,229-232`). The domain counts from the habit's local creation day (`habit.projection.ts:129-132`). The function never checks `mode`, while the domain never schedules relative habits (`habit.projection.ts:119`). Read. Agent A computed an example (every 3 days from 2026-10-01: app due 10-01, 10-04, 10-07; function 10-02, 10-05).
- Habit index: `HabitNotificationTimeSet` rewrites the doc with `completedDates: []` (`habitReminderIndexWriter.ts:94-102`), so changing a reminder time after completing the habit that day re-arms that day's reminder. Archive deletes the doc (`:115-120`). Restore was not re-read.
- Index writers run once per upload batch through `onEventsUploaded` and only log failures (`SyncManager.ts:144-150`). No reconciliation for tasks. Habits re-seed missing docs at startup only.
- Task reminders: only an explicit user clear dispatches `ClearTaskReminderHandler` (`useEntryOperations.ts:326`). The task index writer handles only Set, TitleChanged and Cleared (`taskReminderIndexWriter.ts:37-69`). Deleting or completing a task leaves its reminder armed.
- Fan-out windows: task reminders fire if `reminderAt` is in `[runStart - 15 min, runStart]` (`task-reminder-fanout.ts:80-81,201-202`), so a run that starts later than the previous one leaves a gap. Habit reminders fire within 7 minutes of the run's local time (`time-utils.ts:49-67`). Scheduler jitter is unknown. Inferred.
- Service workers: the app registers `/sw.js` at scope `/` on load (`registerSW.js`) and `/firebase-messaging-sw.js` at default scope `/` on every session (`fcm.ts:68,160`). Workbox does not import the messaging handler (`vite.config.ts:68-72`). Under the Service Worker spec one scope has one registration and registering a different script updates it, so the workers replace each other. Pushes reach whichever script is active. Inferred from the spec, not observed on a device.

### Corrections to agent reports

- None of substance.

### Not verified

- Service worker behavior on the owner's devices (check DevTools Application > Service Workers or `chrome://serviceworker-internals`).
- Cloud Scheduler start-time jitter.
- Habit restore handling in the index writer.

## T8. Sign-out and multi-user isolation

### Method

- Read `packages/client/src/firebase/auth.ts:28-40`, `packages/infrastructure/src/indexeddb-event-store.ts:36-42`, `packages/client/src/App.tsx:255-265`, `packages/client/src/firebase/fcm.ts:18-26,110-140`, `docs/backlog.md` #21.

### Evidence

- Sign-out calls only Firebase `signOut` (`auth.ts:30-38`).
- IndexedDB database name defaults to `squickr-events` for every user (`indexeddb-event-store.ts:39`). Projections are `useState` singletons in `AppContent` (`App.tsx:259-264`), so in-memory state survives sign-out.
- FCM localStorage keys are not user-scoped (`fcm.ts:22-24`). With both keys present, the next sign-in takes the heartbeat path, an `updateDoc` on `users/{newUid}/fcmTokens/{id}` that does not exist and fails silently (`fcm.ts:115-128`). The old account's token doc is never deleted, so its reminders keep reaching the browser.
- Backlog #21 records the IndexedDB part. The in-memory projections and the FCM token are not in it.

### Corrections to agent reports

- None.

### Not verified

- Upload volume when a second account signs in (depends on W1 cursor state).

## T9. Delivery, ops and dependencies

### Method

- Read `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.husky/pre-push`, `firebase.json` (preflight), `.claude/commands/ship.md`.
- Ran `pnpm audit --json` at the root and `npm audit --omit=dev --json` in `functions/` (local, read-only advisory queries).
- Ran `pnpm lint` in `packages/client`.
- Listed react-router advisories and the installed version.

### Evidence

- The workspace is `packages/*` only, and CI runs `pnpm build` and `pnpm test`, so `functions/` is never built or tested in CI. The Pages deploy reruns build and tests before upload, so the client deploy is test-gated.
- `/ship` runs `pnpm test` (`ship.md:6`) and deploys `--only functions` (`:75`). Nothing deploys `firestore.rules` or `firestore.indexes.json`, and no rules tests exist.
- No Firestore export, backup schedule or point-in-time recovery is defined in the repo. Production configuration was not examined.
- Measured: root advisories 91 (critical 5, high 54, moderate 28, low 4). `functions/` production advisories 22 (critical 3, high 6, moderate 11, low 2).
- Measured: react-router 7.14.2 installed. Advisories up to 7.18.2 cover SSR, RSC, the `__manifest` endpoint and an open redirect in `<Link>` and `useNavigate`. Only the last applies to an SPA, and it needs an attacker-controlled path.
- Measured: `pnpm lint` in `packages/client` fails with "'eslint' is not recognized". No eslint config exists. CI runs no lint or type-check.

### Corrections to agent reports

- None. Agent C's audit counts reproduced exactly.

### Not verified

- Production backup, PITR and alerting settings in the Firebase or GCP console.
- Whether deployed rules match `firestore.rules`.

## T10. Other domain correctness and cost

### Method

- Read `packages/domain/src/collection.handlers.ts:84-115`, `packages/domain/src/collection.projections.ts:224-229`, `packages/client/src/views/CollectionDetailView.tsx:312-330`, `packages/client/src/hooks/useColdStartSequencer.ts:280-281`.
- Grep for `useMemo(() => new Date(), [])` and `isAppReady` gates, and habit titles in function logs.

### Evidence

- Daily log dedupe checks only the local projection (`collection.handlers.ts:89-96`). Collection ids are random UUIDs (`:113`). The view auto-creates today's log when missing (`CollectionDetailView.tsx:318-328`), with no `isAppReady` gate. The fast path sets ready before its first sync starts (`useColdStartSequencer.ts:281`), so a gate would not prevent it. `getDailyLogByDate` returns the first match (`collection.projections.ts:226-229`). Two devices that each open `/today` before syncing create two daily logs for one date, and entries split between them. Read, effect inferred.
- "Now" is fixed at mount in `HierarchicalCollectionList.tsx:148`, `useCollectionHierarchy.ts:331`, `useCollectionNavigation.ts:72`. Read.
- Force full sync installs a null-cursor SyncManager for the rest of the session (`useColdStartSequencer.ts:133-143,437-451`), so every trigger downloads the full event log. Startup replays the full local log for entries (`entry.projections.ts:249`). No pruning or compaction exists. Impact not sized.
- Habit titles are written to Cloud Logging on each run (`functions/src/habit-reminder-fanout.ts:134,140,146`). Rules forbid event deletes (`firestore.rules:16`) and no account deletion path exists. Read.

### Corrections to agent reports

- None.

### Not verified

- Cost growth with event count (no load measurement run).

## Owner checks after close-out (2026-10-17)

- Finding 16, measured by the owner in desktop Chrome DevTools at `https://squickr.com`: one registration at scope `/`, source `sw.js`, active worker #1783 received 11:51:21, worker #1784 received 11:51:23 and waiting to activate. No separate `firebase-messaging-sw.js` registration. The 2 s gap matches the delayed `registerFcmToken` call (`App.tsx:431-437`). `public/firebase-messaging-sw.js` has no `skipWaiting`, so it waits behind the active `sw.js`. The version counter near 1800 shows the registration has been replaced many times. The owner confirmed in DevTools that #1784 runs `firebase-messaging-sw.js`.
- Finding 20, checked by the owner in the production Firestore console: point-in-time recovery disabled, no backup schedules.
