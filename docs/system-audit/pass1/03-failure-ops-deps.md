# Pass 1, agent C: failure modes, observability and deploy, dependencies

Lenses L3, L6, L9. Repo at `41d7b2c`. Evidence levels: read, run, inferred. "Run" means local only: a scratch vite-node script outside the repo, `pnpm audit`, `npm audit`, `pnpm lint`. None of it touches Firebase.

## Ranked candidates

### C1. Local events at or before the snapshot cursor are never uploaded

- Tier guess: 1
- Packages: client, domain
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:131-138` uploads only local events after the cursor's index in the local log
  - `packages/domain/src/entry.projections.ts:309-314` `createSnapshot()` sets `lastSnapshotCursor` to the last local event, uploaded or not
  - `packages/infrastructure/src/indexeddb-event-store.ts:242-248` local log is sorted by client timestamp
  - `packages/client/src/snapshot-manager.ts:45-65` snapshot saves fire on every 50th append, on tab hidden, and on beforeunload
  - `packages/client/src/utils/constants.ts:56` sync after an append is debounced 5000 ms
  - `packages/client/src/hooks/useColdStartSequencer.ts:295-301` fast path saves a snapshot after the first sync attempt ends, success or failure
  - `packages/client/src/hooks/useColdStartSequencer.ts:259-260` comment on `?clearsnapshot` already describes "events stuck behind a stale cursor"
- Claim: The upload set is the local events that sort after the cursor. Saving a snapshot moves the cursor to the newest local event without checking whether it reached Firestore. Any event appended locally and snapshotted before a successful upload stays on that device for good.
- Failure scenario: The owner adds a task on the phone and switches apps within 5 seconds. The visibility snapshot moves the cursor to the new task. The debounced sync then uploads nothing. The same happens to the 50th append, which triggers a count snapshot at once, and to everything written while offline or while a sync is failing. The laptop never receives the task. Both devices show no error. Only Force full sync or `?clearsnapshot` recovers it.
- How verified: run. A scratch vite-node script imported the real `SyncManager` and `InMemoryEventStore`, appended `a` to both stores and `b` to local only, then synced with cursor `b`. Output: `Uploading 0 new events`, remote ids `['a']`. The timing of the snapshot triggers is read.
- Confidence: high for the mechanism. Medium for how often it happens in real use.
- What would disprove it: a path that uploads events at or before the cursor. None found in `SyncManager`, the sequencer or the projection.

### C2. Events written by the task reminder function never reach devices that use the delta cursor

- Tier guess: 1
- Packages: functions, infrastructure
- Evidence:
  - `functions/src/task-reminder-fanout.ts:158-169` writes `TaskReminderCleared` straight to `users/{uid}/events` with no `serverReceivedAt`
  - `packages/infrastructure/src/firestore-event-store.ts:143-150` the delta query is `where('serverReceivedAt', '>', anchor)` ordered by `serverReceivedAt`
  - `packages/infrastructure/src/firestore-event-store.ts:54,85` only client writes add `serverReceivedAt`
- Claim: Firestore leaves out documents that lack the field used in an inequality filter or orderBy. A device with a snapshot cursor never downloads function-written events. Only a device that runs `getAll()` gets them: a new device, a missing anchor, a query error, or Force full sync.
- Failure scenario: A task reminder fires. The laptop does a full download and shows the reminder cleared. The phone, which syncs by cursor, keeps the reminder set indefinitely. Both report up to date. Replays then disagree on the task's reminder state.
- How verified: inferred, from the code read plus Firestore's documented query semantics. Confirm in an emulator, or by checking whether a cursor-syncing device's IndexedDB holds the `TaskReminderCleared` event for a reminder that has fired.
- Confidence: high.
- What would disprove it: Firestore including documents that lack the field in a `serverReceivedAt >` query, or the function setting the field somewhere else.

### C3. Sync failures do not show on a returning device, and nothing shows when the last sync succeeded

- Tier guess: 1
- Packages: client
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:163-171` only the timeout produces an error string. Every other error is logged and reported as `error: undefined`
  - `packages/client/src/hooks/useColdStartSequencer.ts:295-302` fast path (any device with local data) ignores the error argument entirely
  - `packages/client/src/hooks/useColdStartSequencer.ts:226-229` benchmark path is silent too
  - `packages/client/src/App.tsx:502-524` the only sync UI is the cold-start overlay
  - `packages/client/src/utils/logger.ts:143-146,191-195` production logs go to the browser console only
  - grep found no "last synced" or offline indicator in `components/` or `views/`
- Claim: On the normal path every sync failure is silent. A failure can be permission-denied, a validation error (C4), a quota error or a rejected batch. The app looks identical whether sync works or has failed for weeks.
- Failure scenario: One upload batch hits `permission-denied`. `firestore.rules:15` forbids updates, and a `set` on an existing event id counts as an update, which can happen when the cursor slice and the remote delta disagree because of clock skew. Every sync after that fails the same way, and the phone keeps showing its local state as current.
- How verified: read. Whether the permission-denied trigger occurs in practice is inferred. Confirm by forcing a rejected batch in a unit test with the fast-path callback wired in.
- Confidence: high.
- What would disprove it: another UI surface that reads the sync error or last success time. None found.

### C4. One malformed or unknown-type event in Firestore stops sync, upload included, on every client that rejects it

- Tier guess: 2
- Packages: infrastructure, client, firestore.rules
- Evidence:
  - `packages/infrastructure/src/firestore-event-validator.ts:200-208` throws on any type missing from `KNOWN_EVENT_TYPES`
  - `packages/infrastructure/src/firestore-event-validator.ts:63-73` the list is maintained by hand, with no compile-time check in the add direction
  - `packages/infrastructure/src/firestore-event-store.ts:113,124,169,172` the whole query result fails, and validation errors are rethrown
  - `packages/client/src/firebase/SyncManager.ts:122-142` download fetch runs before upload, so a fetch failure also blocks the upload
  - `firestore.rules:9-15` create checks only owner and id. No shape or type check, and no delete, so a bad event cannot be removed without the Admin SDK
  - `packages/client/vite.config.ts:37` `registerType: 'autoUpdate'`, so an open PWA keeps running its old bundle until reload
- Claim: Clients validate fail-loud on the full result set. Rules accept any event shape and events are immutable. One unexpected document halts sync for every client version that does not know its type, and with C3 nothing shows it.
- Failure scenario: A release adds a new event type, and the laptop writes one. The phone PWA has been open on the old bundle, or the type was left out of `KNOWN_EVENT_TYPES`. Every phone sync throws, so the phone uploads nothing and downloads nothing until it reloads the new bundle. If the type was missing from the list, it never recovers.
- How verified: read.
- Confidence: high.
- What would disprove it: per-document skip or quarantine logic somewhere in the read path. None found.

### C5. Sync has no bound on upload and can latch in "syncing" while offline or on a degraded network

- Tier guess: 2
- Packages: client, infrastructure
- Evidence:
  - `packages/client/src/firebase/SyncManager.ts:119-125` timeout wraps only `getAllAfter`. The timer is never cleared and the raced call is not cancelled
  - `packages/client/src/firebase/SyncManager.ts:142` `appendBatch` is awaited with no timeout
  - `packages/client/src/firebase/SyncManager.ts:98-100` every trigger returns early while `isSyncing`
  - Firestore SDK `WriteBatch.commit` doc (firebase 12.12.1 `index.d.ts:3291-3301`): "it won't resolve while you're offline"
  - Firestore SDK `getDocs` doc (`index.d.ts:1405-1410`): may return cached data when the server is unreachable
  - `packages/client/src/firebase/config.ts:56-58` `persistentLocalCache()` is enabled
- Claim: When the server cannot be reached, `getDocs` can return Firestore's cached results as if fresh. The commit then hangs, and all later triggers become no-ops until it resolves. No retry or backoff exists, and no state shows the stall.
- Failure scenario: On a captive portal or a flaky connection the browser reports online. The phone's download "succeeds" from cache with nothing new, the upload hangs, and focus, online and interval triggers all return early. Edits pile up locally, and C1 then strands them at the next snapshot.
- How verified: read for the code. The SDK behavior comes from SDK doc comments, so inferred for this app. Confirm with a unit test where `appendBatch` never resolves, then check that a later `syncNow()` returns early.
- Confidence: medium-high.
- What would disprove it: Firestore rejecting the commit promptly on network loss with this cache configuration.

### C6. The FCM worker and the Workbox worker register for the same scope

- Tier guess: 2
- Packages: client
- Evidence:
  - `packages/client/src/firebase/fcm.ts:160` `navigator.serviceWorker.register('/firebase-messaging-sw.js')`, default scope `/`
  - `packages/client/dist/registerSW.js` (local build) `register('/sw.js', { scope: '/' })`
  - `packages/client/vite.config.ts:36-72` VitePWA injects that registration
  - `packages/client/public/firebase-messaging-sw.js:26-34` only this worker handles background messages
- Claim: Browsers keep one registration per scope, and registering a different script URL for that scope replaces the worker. The two workers can displace each other on each load. Either the offline precache is lost, or background pushes arrive at `sw.js`, which has no `onBackgroundMessage` handler.
- Failure scenario: Reminders show as a generic "site updated in the background" notice, or not at all, depending on which worker registered last. Offline launch can fail after an FCM registration.
- How verified: inferred, from the read and the Service Worker spec. Confirm in `chrome://serviceworker-internals` on the installed PWA after a token registration and a reload.
- Confidence: medium.
- What would disprove it: the deployed site showing two separate registrations, or `sw.js` importing the messaging handler.

### C7. Functions, rules and indexes deploy outside CI, and functions tests never run in CI or ship

- Tier guess: 2
- Packages: functions, firestore.rules, firestore.indexes.json, workflows
- Evidence:
  - `pnpm-workspace.yaml:2` workspace is `packages/*` only. `functions/` uses npm and `package-lock.json`
  - `.github/workflows/ci.yml` and `deploy.yml` run `pnpm build` and `pnpm test`, which never reach `functions/`
  - `.claude/commands/ship.md:5-9,64-78` ship runs `pnpm test`, then `firebase deploy --only functions` from the local machine
  - Ship has no step for `firestore:rules` or `firestore:indexes`
  - `firebase.json:20-22` predeploy builds functions and does not test them
- Claim: The jest suite and tsc for functions have no automated gate. Rules and indexes reach production only by hand, so the repo's `firestore.rules` may not match production. Rollback for functions is a manual redeploy of older code.
- Failure scenario: A rules change like `987040c` (habitReminders) is committed and the app shipped, but nobody runs `firebase deploy --only firestore`. Index writes then fail in production, and `SyncManager.ts:144-150` logs them to the console only. A functions change with a failing jest test ships via `/ship` with no stop.
- How verified: read.
- Confidence: high.
- What would disprove it: a separate CI job or hook that runs functions tests and deploys rules. None found in `.github`, `.husky` or `firebase.json`.

### C8. Sign-out leaves the device bound to the account

- Tier guess: 2
- Packages: client, functions
- Evidence:
  - `packages/client/src/views/CollectionIndexView.tsx:302-310` sign-out calls `firebaseSignOut` only
  - `packages/client/src/firebase/fcm.ts:131-138` the FCM token doc and the localStorage token keys stay. The next sign-in takes the heartbeat path
  - `functions/src/task-reminder-fanout.ts:120-127` the notification body holds the task text
  - `functions/src/habit-reminder-fanout.ts:39-51` stale tokens are pruned only after 60 days
  - IndexedDB stores are not cleared or scoped per user (backlog #21, consistent with `App.tsx:259-260`)
- Claim: A signed-out browser keeps receiving the account's reminder text until the token is pruned, and it keeps the account's events locally. A second account in the same browser inherits the FCM localStorage state and, per backlog #21, the local events.
- Failure scenario: The owner signs out of an old tablet. Task reminder text keeps appearing on that tablet for up to 60 days. With a second user, their reminders can go to a browser keyed to the first user's token state.
- How verified: read. The 60-day exposure is inferred from the prune query.
- Confidence: high for the token. The local-store part is already known as backlog #21.
- What would disprove it: an auth-state listener that deletes the token doc on sign-out. None found.

### C9. Nothing reports failures to the owner, and no backup is defined in the repo

- Tier guess: 2
- Packages: client, functions, ops
- Evidence:
  - `packages/client/src/utils/logger.ts:143-146` production logs warn and above to the console, with no remote sink
  - No error boundary: grep for `ErrorBoundary` and `componentDidCatch` returns nothing. `packages/client/src/main.tsx:6-10`
  - `packages/client/src/firebase/config.ts:46-64` throws at import if config is missing, so the page renders blank
  - Functions log with `console.*` only. No alerting is defined in the repo
  - No Firestore export, backup schedule or PITR config in the repo
- Claim: Divergence (C1, C2), stalled sync (C5), rejected writes and function errors all leave traces only in a device console or Cloud Logging. Nobody watches either. The event log is the source of truth, and the repo defines no backup for it.
- Failure scenario: The phone stops syncing for a month and nobody learns of it until data is missing. An Admin-SDK mistake or project loss has no restore path defined here.
- How verified: read for the repo. Firebase-side alerting or backups may exist outside the repo. Confirm with the Firebase console or `gcloud firestore backups schedules list` (production, so the owner runs it).
- Confidence: high for the repo. Unknown outside it.
- What would disprove it: alerting or backups configured in the Firebase or GCP project.

### C10. The task reminder index is best-effort and ignores task deletion and completion

- Tier guess: 3
- Packages: client, domain, functions
- Evidence:
  - `packages/client/src/firebase/taskReminderIndexWriter.ts:34-93` handles only `TaskReminderSet`, `TaskTitleChanged` and `TaskReminderCleared`, and a failed write is only logged
  - Only `packages/domain/src/task-reminder.handlers.ts` emits `TaskReminderCleared` (grep)
  - `packages/client/src/firebase/SyncManager.ts:144-150` the callback runs once per uploaded batch and is never retried
  - Habits have `bootstrapHabitReminderIndex`. Tasks have no reconciliation
  - `functions/src/task-reminder-fanout.ts:62-172` does not check task state
- Claim: The index is a side effect of one upload and nothing reconciles it with the projection. A failed write loses the reminder for good, and deleting or completing a task leaves its reminder armed.
- Failure scenario: Delete a task that has a reminder. The notification still fires, and the function appends `TaskReminderCleared` for a deleted task.
- How verified: read.
- Confidence: medium-high. A UI flow might clear the reminder before deleting. That was not checked.
- What would disprove it: delete and complete flows that dispatch `ClearTaskReminderCommand` first.

### C11. Reminder fan-out partial failures drop reminders without a trace in app state

- Tier guess: 3
- Packages: functions
- Evidence:
  - `functions/src/task-reminder-fanout.ts:98-109` the idempotency log is written before the send
  - `:134-151` a non-token send error is logged and still counts as sent
  - `:155-172` if the event append or the delete fails after the log write, later runs skip the doc through the log, and the index doc lingers
  - `:201-202,81` the window is `[now-15m, now]` from each run's own start, so a failed or skipped run loses its window
  - `functions/src/index.ts:29` sets `maxInstances: 10`, and no retry is configured on the schedules
- Claim: Each step is at-most-once with no compensation. Transient FCM or Firestore errors drop the reminder and can leave index state inconsistent with the event log.
- Failure scenario: An FCM error while sending means no notification, yet the reminder counts as fired. A failed run during a deploy means every reminder due in that 15-minute slot is silently skipped.
- How verified: read.
- Confidence: high.
- What would disprove it: scheduler retries plus a catch-up window. Neither is in code.

### C12. Dependency and toolchain debt: majors behind, an unreachable lint, split toolchains

- Tier guess: 3
- Packages: all
- Evidence (run):
  - `pnpm audit` at the root: 91 advisories (5 critical, 54 high, 28 moderate, 4 low), almost all in build and test tooling: vite-plugin-pwa to workbox-build (lodash, serialize-javascript, minimatch, brace-expansion, fast-uri), vitest 1.6.1 and tinypool (critical, fixed in vitest 3.x), vite 5.4.21, postcss, jsdom 23.2.0
  - Runtime-reachable in the browser bundle: react-router-dom 7.14.2. Most of its advisories cover SSR, RSC and framework mode. The open redirect via backslash in `<Link>` and `useNavigate` (below 7.18.0, moderate) applies to an SPA
  - The firebase 12.12.1 advisories (protobufjs, grpc-js, websocket-driver) sit under Node-only transports. Inferred to be absent from the browser bundle. Confirm with a bundle analysis
  - `npm audit --omit=dev` in `functions/`: 22 (3 critical, 6 high, 11 moderate, 2 low), all transitive through firebase-admin 13.7.0 (protobufjs, websocket-driver, node-forge, proxy-addr). The functions are scheduled and take no inbound HTTP, so reach is limited (inferred)
  - Including dev dependencies: 43
  - Majors behind: vitest 1.6.1, vite 5, @testing-library/react 14, jsdom 23. In functions: eslint 8 with typescript-eslint 5, plus jest 30 with ts-jest 29
  - `pnpm lint` in `packages/client` fails with "'eslint' is not recognized". eslint is not installed and has no config. `useColdStartSequencer.ts:428` holds an eslint-disable for a rule that never runs
  - Two package managers and two test runners: pnpm and vitest in the workspace, npm and jest in `functions/`
  - The CDN Firebase SDK in `public/firebase-messaging-sw.js:9-10` is 12.8.0, while the package is 12.12.1
- Claim: The audit counts are mostly build-time. The real cost is that each major upgrade grows harder, and type-aware lint is absent. CI uses `--frozen-lockfile` (`ci.yml`), which keeps installs reproducible.
- How verified: run (audits, lint, installed versions).
- Confidence: high.
- What would disprove it: none for the counts. Reachability claims are inferred.

## Small findings

- `packages/client/src/hooks/useColdStartSequencer.ts:389-391,433` and `App.tsx:502`: on a device restored from a remote snapshot, any later sync timeout sets `syncError`. That makes `isAppReady` false and covers the whole app with the overlay mid-session. Read.
- `packages/client/src/firebase/fcm.ts:126-128,187-189`, `App.tsx:434`: every FCM registration failure is silent, so reminders can stop on a device with no signal. Read.
- `packages/client/src/snapshot-manager.ts:129-131`: remote snapshot save failures go to `console.warn` only, so new devices restore an older snapshot. Read.
- `.github/workflows/ci.yml`, `deploy.yml`: `VITE_APP_VERSION` comes from a GitHub secret, while the shown version comes from `package.json` (`vite.config.ts:8-9,31`). Token docs record a hand-maintained value (`fcm.ts:178`). Read.
- `firestore.rules:9-12`: `serverReceivedAt` is not bound to `request.time`, so a client with a bug can write any cursor value. Read.
- `firestore.indexes.json:3-9`: a single-field entry under `indexes`. Commit `f140a10` removed such entries earlier because the CLI rejects them. Inferred. Confirm from the next `firebase deploy --only firestore:indexes` output.
- `packages/client/src/firebase/config.ts:18-39`: config is validated only at runtime. A missing GitHub secret yields a green build that serves a blank page. Read.
- `packages/client/public/firebase-messaging-sw.js:14-21`: a hardcoded Firebase web config (public by design) duplicates the env config and can drift from it. Read.
- Git history scan (pattern grep; gitleaks not installed): no private keys, service-account JSON, tokens or `.env` files. The one hit is the public Firebase web API key in `packages/client/public/firebase-messaging-sw.js`, first added in `d10b554`. `packages/client/.env.example` holds placeholders only. Run.
- Workflows use floating major tags (`actions/cache@v3`, `pnpm/action-setup@v2`) and do not pin SHAs. Read.
- The deploy on a `v*` tag reruns build and tests and does not depend on the `master` CI run. That gate is adequate for the client. Read.

## Did not examine

- `functions/src/habit-reminder-fanout.ts` and `habit-event-reader.ts` beyond a grep for event writes and token pruning
- `FirestoreSnapshotStore`, `IndexedDBSnapshotStore`, and the domain handlers' input validation
- Deployed rules, indexes, function config, Cloud Scheduler retry settings, alerting, backups and PITR (production, out of bounds)
- GitHub repo settings: branch protection, environment protection on `github-pages`, secret scope
- The real browser outcome of C6 and the bundle reachability of firebase transitive advisories
- Running the functions jest suite (the charter baseline records it passing)
