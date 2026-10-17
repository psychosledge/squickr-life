# Pass 1, agent E: structure and change cost (L8), frontend quality (L11)

Master at `41d7b2c`, 2026-10-17. Measurements are from the local git history and the local working tree. Git history starts 2026-01-22. The 6-month window holds 72 commits, 22 of them `fix:`.

## Measurements (measured, local repo)

Largest non-test TS files: CollectionDetailView.tsx 974, entry.event-applicator.ts 947, task.handlers.ts 747, habit.projection.ts 698, collection.handlers.ts 645, entry.projections.ts 614, App.tsx 578, useEntryOperations.ts 540, useColdStartSequencer.ts 454.

Churn, 6 months, non-test (commits / fix commits): useColdStartSequencer.ts 9 / 5, habit.projection.ts 4 / 4, App.tsx 3 / 2, firestore-event-store.ts 3 / 1, taskReminderIndexWriter.ts 3 / 1.

Churn, all time (commits / fix commits): CollectionDetailView.tsx 66 / 17, App.tsx 59 / 8, EntryList.tsx 39 / 11, TaskEntryItem.tsx 37 / 11, entry.projections.ts 34 / 11.

There is no eslint complexity rule or dependency-cycle tool installed. Domain imports nothing from infrastructure, client, React or Firebase (read).

## Ranked candidates

### E1. Sync failures are invisible, and nothing in the UI reflects sync state
- Tier guess: 1
- Packages: client, infrastructure
- Evidence:
  - packages/client/src/firebase/SyncManager.ts:163-171. Only the read-timeout message becomes `syncError`. Every other exception (validation, permission-denied, write failure) reports `(false, undefined)`.
  - packages/client/src/hooks/useColdStartSequencer.ts:295-302. The fast path, which covers every launch on a device that already has data, ignores the error argument entirely.
  - packages/client/src/hooks/useColdStartSequencer.ts:226-229. The benchmark path does the same.
  - A grep for `onSyncStateChange|lastSync|isSyncing|syncStatus` across packages/client/src finds no component that shows sync state. SettingsModal.tsx:41 tracks only the manual Force full sync button.
  - Commit 9d27371 (2026-06-06) message: a missing validator entry made `assertValidDomainEvent` throw "on every sync ... silently blocking all syncs."
  - Commit 31278f9 (2026-06-06) removed the fast-path error surfacing on purpose, to stop the blocking overlay.
- Claim: A device whose sync is failing on every attempt looks the same as a device that is in sync. The remote read runs before the upload (SyncManager.ts:114-142), so a read failure blocks uploads too. The only error the UI can show is a timeout, and only on the first-launch path.
- Failure scenario: Firestore rejects a read or write on the phone, for example a validation error, a rules change or quota. The phone keeps accepting edits into IndexedDB. The laptop never receives them. Both devices show a normal UI with no warning, and this lasts until someone opens the console.
- How verified: read, plus git history.
- Confidence: high
- What would disprove it: a sync-status surface I missed, such as a header badge driven by SyncManager state.

### E2. A long-lived PWA on an old build stops syncing in both directions once a newer build writes an event type it does not know
- Tier guess: 1
- Packages: client, infrastructure
- Evidence:
  - packages/client/vite.config.ts:37 sets `registerType: 'autoUpdate'`.
  - packages/client/dist/registerSW.js only calls `register('/sw.js')` on `load`. No update polling runs, and no reload happens when a new worker takes control.
  - packages/infrastructure/src/firestore-event-validator.ts:201-203 throws on a type missing from `KNOWN_EVENT_TYPES`.
  - packages/infrastructure/src/firestore-event-store.ts:167-170 rethrows validation errors.
  - packages/client/src/firebase/SyncManager.ts:122-142. The remote read happens before the upload, so the throw also skips the upload.
  - packages/domain/src/entry.event-applicator.ts:221-222 shows the domain also ignores unknown types silently.
- Claim: An app instance that stays resident (an installed PWA resumed from the background) keeps running its old JS. Nothing forces an update check or a reload. When any release adds an event type and another device writes one, every later sync on the stale device throws inside the remote read. That stops downloads and uploads, and E1 hides it.
- Failure scenario: The phone PWA stays resumed for days on v1.21.x. A new release adds a habit-schedule event, and the laptop writes one. From then on the phone uploads nothing and downloads nothing. Both devices look current.
- How verified: read for the validator and sync path. Inferred for SW update timing. To confirm, keep an installed PWA open across a deploy that adds an event type, write that type from another device, and watch the stale device's console log `[SyncManager] Sync failed`.
- Confidence: medium-high
- What would disprove it: an app-version gate that forces a reload, or a browser that reliably reloads resumed standalone PWAs. I found neither in code.

### E3. The Workbox service worker and the FCM service worker register for the same scope
- Tier guess: 2
- Packages: client
- Evidence:
  - packages/client/dist/registerSW.js registers `/sw.js` with scope `/`.
  - packages/client/src/firebase/fcm.ts:68 and :160 call `navigator.serviceWorker.register('/firebase-messaging-sw.js')` with no scope. The default scope is the script's directory, `/`.
  - packages/client/public/firebase-messaging-sw.js:5-7 says the two workers are meant to be separate.
- Claim: Each scope has one registration. Under the service worker spec, registering a different script URL for an existing scope updates that registration to the new script. Each session therefore swaps the precache worker for the FCM worker about two seconds after ready (App.tsx:431-437), and the next load swaps it back.
- Failure scenario: Background reminders arrive only while the FCM script happens to be the active worker. Offline launch and asset precache work only while sw.js is active. App updates also flip between the two workers unpredictably.
- How verified: read. Spec behavior inferred. To confirm, open DevTools Application > Service Workers (or chrome://serviceworker-internals) on a production device and check whether the script URL for scope `/` alternates between sw.js and firebase-messaging-sw.js.
- Confidence: medium
- What would disprove it: Application panel showing two separate registrations.

### E4. Sign-out keeps all local state, so a second account on the same device inherits it and can upload it
- Tier guess: 2 (the system should support multiple users)
- Packages: client, infrastructure, firestore.rules
- Evidence:
  - packages/client/src/firebase/auth.ts:30-38 and views/CollectionIndexView.tsx:303-311. Sign-out only calls Firebase `signOut`.
  - packages/infrastructure/src/indexeddb-event-store.ts:40. The default database name `squickr-events` is the same for every user, and the snapshot store works the same way.
  - packages/client/src/App.tsx:259-264 and 449-451. Projections are `useState` singletons in `AppContent`, which stays mounted while it renders SignInView, so in-memory state survives sign-out.
  - packages/client/src/hooks/useColdStartSequencer.ts:257-303. The next sign-in takes the fast path because the local store is non-empty, then uploads local events not already in the new user's remote store.
  - firestore.rules:11-13 checks only the path uid, so nothing rejects those events.
  - packages/client/src/firebase/fcm.ts:22-24. The FCM localStorage keys are not scoped by user, and the old user's token document is never deleted.
- Claim: Local data and the device's push token belong to the device, with no link to the signed-in account.
- Failure scenario: User B signs in on a browser user A used. B sees A's journal, and the first sync copies A's events into `users/B/events`. A's reminders keep arriving on the device. B's FCM heartbeat calls `updateDoc` on a document that does not exist under B and fails silently, so B never gets reminders.
- How verified: read. Upload volume is inferred, because it depends on the cursor semantics in getAllAfter. A two-account manual test would confirm it.
- Confidence: high for leaked local state, medium for the upload.
- What would disprove it: a sign-out path that clears IndexedDB, or user-scoped database names, defined somewhere I did not search.

### E5. Opening /today on a device that has not synced yet creates a second daily log for the same date
- Tier guess: 2
- Packages: client, domain
- Evidence:
  - packages/client/src/views/CollectionDetailView.tsx:317-328 auto-creates today's log inside `loadData`.
  - packages/client/src/views/CollectionDetailView.tsx:268-285 (`ensureCollectionForDate`, also used at :475, :506, :554).
  - packages/domain/src/collection.handlers.ts:90-95 dedupes against the local projection only.
  - packages/client/src/hooks/useColdStartSequencer.ts:281. The fast path sets ready before the first sync finishes.
  - packages/client/src/App.tsx:502-559. Routes render underneath the cold-start overlay.
  - CollectionDetailView's subscription (:383-406) has no `isAppReady` gate. CollectionIndexView.tsx:104-105 has one.
  - packages/domain/src/collection.projections.ts:226-229 returns the first match by date.
- Claim: Uniqueness of the daily log for a date is checked against local state only. The UI triggers the create automatically before remote state has arrived. IDs are random UUIDs (collection.handlers.ts:113), so the two creates never merge.
- Failure scenario: The phone creates today's log at 08:00. At 09:00 the laptop resumes on /today, and the read finishes before the first sync. The laptop creates a second "today" collection. After sync, both devices list two logs for the date. Entries split between them, and /today shows whichever sorts first.
- How verified: read. Inferred end to end. To confirm, write a domain test with two in-memory stores that each run CreateCollection daily for the same date, merge the events, and assert one daily log per date.
- Confidence: medium-high
- What would disprove it: a projection-level merge of same-date daily logs. I found no such code (no "duplicate" handling in collection.projections.ts).

### E6. useColdStartSequencer is the defect hotspot and is the root cause of E1
- Tier guess: 2
- Packages: client
- Evidence:
  - Measured: 9 commits and 5 fixes in 6 months, the highest in the repo.
  - packages/client/src/hooks/useColdStartSequencer.ts has four SyncManager construction sites, each wiring both reminder index writers: :133-143, :214-225, :282-293, :371-382.
  - It has five different `onSyncStateChange` policies: :226, :295, :389, :397, :445.
  - Benchmark diagnostics sit inside the production effect: :59-71, :168-247.
  - `FORCE_FULL_REPLAY` is defined twice with different meanings: hook :48-50, App.tsx:248-253, where the App.tsx copy also includes clearsnapshot.
- Claim: Path selection, SyncManager construction, snapshot manager lifecycle, error policy and diagnostics share one 300-line effect. Any change to sync wiring needs four parallel edits. Each fix so far has patched one path, for example 31278f9, which changed only the fast path.
- Failure scenario: Adding a sync status indicator (the fix for E1) or a third index writer means editing four constructors and five callbacks. Missing one path ships a device-specific bug. One example already exists: a session that took the slow path still re-raises the blocking overlay on any later timeout (:397-399), which is the behavior 31278f9 removed from the fast path.
- How verified: read, plus measured.
- Confidence: high
- What would disprove it: none. This is a structural observation.

### E7. Each entry type has its own copy of the pipeline, so adding an entry or event type is a shotgun edit with no compile-time check
- Tier guess: 2
- Packages: domain, infrastructure, client
- Evidence:
  - Measured: 15 non-test files branch on entry type (`type === 'note'|'event'`).
  - Per-type handler files: collection-management.handlers.ts (180 lines), note-collection-management.handlers.ts (152), event-collection-management.handlers.ts (152).
  - Per-type applicators: entry.event-applicator.ts:313-603 (applyTaskEvent, about 290 lines), :604-766, :767-947.
  - Drift already exists. RemoveTaskFromCollectionHandler blocks removing a task's last collection (collection-management.handlers.ts:82). RemoveNoteFromCollectionHandler has no such guard (note-collection-management.handlers.ts:65-96).
  - Task Move emits Remove directly (collection-management.handlers.ts:156-171). Note and Event Move go through RemoveHandler (note-collection-management.handlers.ts:141-144).
  - The validator list has no add-direction check (firestore-event-validator.ts:63-74). Precedent 9d27371.
- Claim: Invariants that should hold for every entry type already differ by type. A new event type must be added to the domain union, the validator array, the applicator switch and the client branches. Missing the validator entry blocks sync. Missing the applicator case is silently ignored.
- Failure scenario: A note or event can end up with zero collections, while a task cannot. A new event type that is missing from the validator repeats the 9d27371 outage. Measured today: the validator list matches every event `type` literal in the domain.
- How verified: read, plus measured. The validator-to-domain diff ran locally.
- Confidence: high
- What would disprove it: the note or event zero-collection state being intended and documented in an ADR.

### E8. A fresh device that opens offline can show an empty journal as fully synced
- Tier guess: 2
- Packages: client, infrastructure
- Evidence:
  - packages/client/src/firebase/config.ts:57 uses `persistentLocalCache()`.
  - packages/infrastructure/src/firestore-event-store.ts:122 and :168 use `getDocs`, which can resolve from cache. An empty cache gives zero documents and no error.
  - packages/client/src/hooks/useColdStartSequencer.ts:397-405 sets ready with no error when the sync resolves.
  - packages/client/src/hooks/useColdStartSequencer.ts:253-255 suppresses the tutorial, so the empty state has no explanation.
- Claim: The cold-start overlay cannot tell "server returned nothing" apart from "served from an empty local cache."
- Failure scenario: A new phone signs in on a captive or flaky network. It shows an empty journal with no error, and the user starts writing there. Any snapshot saved from this partial state also goes to the remote store (snapshot-manager.ts:129). Agent F should check whether that can replace a fuller remote snapshot.
- How verified: inferred from Firestore SDK cache semantics. To confirm, run the slow path on a fresh profile with DevTools set to Offline after auth and check whether `getDocs` resolves with `fromCache=true` and zero documents.
- Confidence: medium
- What would disprove it: `getDocs` rejecting when offline on a cold cache in this SDK version.

## Small findings

1. 11 of 15 modal components have no `role="dialog"` or `aria-modal`, and there is no shared modal primitive (measured by grep in packages/client/src/components). ConfirmCompleteParentModal, ConfirmDeleteParentModal and TaskReminderModal have no Escape handling.
2. The local dist has one 1.19 MB uncompressed main chunk (packages/client/dist/assets/index-zxwGEgCd.js, built 2026-09-28; local artifact, not necessarily what is deployed). No route-level `lazy()` exists, and react-joyride and dnd-kit load every session.
3. The SyncManager timeout covers only the remote read (SyncManager.ts:119-125). Its timer is never cleared. `appendBatch` (:142) has no guard, so a hung commit holds `isSyncing` true and skips every later sync (:98).
4. forceFullSync stops SnapshotManager for the rest of the session (useColdStartSequencer.ts:441). No local or remote snapshot is saved until reload.
5. CollectionDetailView re-runs `loadData` on every projection notification during cold-start sync (:383-406). CollectionIndexView gates the same pattern on `isAppReady` (:104-105). These are twin subscribe patterns with different policies.
6. App.tsx is the composition root for 34 handlers (App.tsx:259-316, 454-490). Each new handler needs edits to App.tsx, the AppContext type and its consumer.
7. Dead code with no non-test callers: `SyncManager.initialSyncComplete` (SyncManager.ts:48) and `getCurrentUser` (firebase/auth.ts:54).
8. CreateCollection computes `order` from the last local collection (collection.handlers.ts:107-110). Two devices creating offline will produce the same order key. This is a pointer for agent B. Inferred.
9. habit.projection.ts has 4 fixes in 6 months, all part of the in-flight habit schedule history work. It is not promoted because it is in flight.
10. CollectionDetailView.tsx is the all-time size and churn leader (66 commits, 17 fixes). It mixes temporal route resolution, auto-create, selection, bulk migrate, habits and tutorial resume. Its 6-month churn is low (2).

## Did not examine

- functions/ and the Cloud Function code paths
- IndexedDB store internals and snapshot correctness (agent F)
- Color contrast measurement, keyboard use of dnd-kit drag reorder, screen-reader flow
- HabitsView, ReviewView and HabitDetailView loading, empty and error states
- `.github/workflows/` and the deploy path
- A production build or bundle analysis (not run, by instruction)
- Real service worker behavior on a device (E2, E3 inferred)
