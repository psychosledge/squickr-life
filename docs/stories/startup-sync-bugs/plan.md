# Plan: startup-sync-bugs

Two independent bugs in the startup and sync pipeline.

---

## Slice Plan

### Slice 1: CollectionListProjection delta replay on fast path
**Scope:** After `collectionProjection.seedFromSnapshot(localSnapshot.collections)` in `App.tsx:initializeApp()`, fetch all events after `localSnapshot.lastEventId` from the local IndexedDB event store and apply any collection events incrementally to the projection. No UI changes. No changes to the slow path (remote snapshot restore) in `useColdStartSequencer.ts` — that path already seeds from a snapshot but has the same gap; fix only the fast path in `initializeApp()` for this slice.
**Status:** ✅ done
**Commit:** 2496416
**Acceptance Criteria:**
- [x] A unit/integration test exists that: seeds `CollectionListProjection` from a snapshot (no `CollectionCreated` event in that seed), appends a `CollectionCreated` event after the snapshot's `lastEventId` to a fake IndexedDB event store, runs the fast-path delta replay logic, and asserts the new collection is present in `getCollections()`.
- [x] A test exists that: verifies when there are no events after `lastEventId`, `getCollections()` returns exactly the seeded snapshot state (no regression for the normal case).
- [x] A test exists that: verifies when `localSnapshot` is null or lacks `lastEventId`, the existing seed-only path is preserved unchanged (guard against null-deref).
- [x] `App.tsx:initializeApp()` calls `eventStore.getAllAfter(localSnapshot.lastEventId)` after seeding `collectionProjection`, iterates the results, and calls the projection's incremental-apply mechanism for collection events.
- [x] All existing tests pass (`pnpm -r test`).
**Needs Architect:** no — the pattern is already established by `EntryListProjection.hydrate()` and `getAllAfter` exists on `IEventStore`; this is a straightforward delta replay using existing infrastructure.

---

### Slice 2: Force full sync button in SettingsModal
**Scope:** Add a "Developer" section at the bottom of `SettingsModal` containing a "Force full sync" button. The button must: (1) clear the local snapshot, (2) stop the current `SyncManager`, (3) restart sync with cursor = null. A `forceFullSync()` callback must be threaded from `useColdStartSequencer` through `AppContext` to `SettingsModal`. This slice includes all layers: hook plumbing, context wire-up, and UI.
**Status:** ✅ done
**Commit:** b410d1a
**Acceptance Criteria:**
- [x] `useColdStartSequencer` exposes a stable `forceFullSync: () => Promise<void>` function in its return type.
- [x] `forceFullSync()` performs these steps in order: clears the local snapshot (`snapshotStore.clear('entry-list-projection')`), stops the current `SyncManager`, creates and starts a new `SyncManager` with `() => null` as the cursor factory.
- [x] `AppContext` / `AppContextValue` includes `forceFullSync: () => Promise<void>`.
- [x] `App.tsx` passes `forceFullSync` from the sequencer result into `AppContext`.
- [x] `SettingsModal` renders a visually distinct "Developer" section below all existing settings, containing a button labelled "Force full sync".
- [x] While `forceFullSync()` is in progress, the button is disabled and shows a loading label (e.g. "Syncing…").
- [x] After `forceFullSync()` resolves, the button returns to its enabled state and a brief confirmation message is shown (e.g. "Full sync started").
- [x] A unit test for `useColdStartSequencer` (or a focused test of the `forceFullSync` function) verifies that calling it: calls `snapshotStore.clear`, stops the old `SyncManager`, and starts a new one with a null cursor.
- [x] A React Testing Library test for `SettingsModal` verifies the button is rendered, shows the loading state while the async call is pending, and shows the confirmation text when resolved.
- [x] All existing tests pass (`pnpm -r test`).
**Needs Architect:** no — the sync lifecycle pattern (stop/restart `SyncManager`) mirrors what `useColdStartSequencer` already does on sign-in; the only design question is threading `forceFullSync` through context, which is a standard pattern already used in this codebase.

---

## UAT Checklist
(Complete after all slices are implemented and committed)

**Bug 1 — CollectionListProjection delta replay**

- [ ] Create a new daily log collection (e.g. today's date). Verify it appears in the nav sidebar immediately.
- [ ] Without reloading, verify the new collection is visible in the nav and navigable.
- [ ] Close and reopen the app (or do a hard reload). Verify the newly created collection is still visible in the nav sidebar on restart — it should not disappear or show as "unknown collection".
- [ ] Navigate to a task that was migrated to the new collection before the reload. Verify its collection label is correct (not "unknown collection").
- [ ] Repeat the above with a sequence of events: create a collection, rename it, close the app, reopen — verify the renamed name survives the restart (rename event was replayed).
- [ ] Open DevTools → Application → IndexedDB and confirm the collection's `CollectionCreated` event is present in the local store, then verify the UI shows it on reload (confirms the fix is not masking the bug in another layer).

**Bug 2 — Force full sync**

- [ ] Open Settings (gear icon or menu). Scroll to the bottom. Verify a "Developer" section is visible with a "Force full sync" button.
- [ ] Tap "Force full sync". Verify the button immediately becomes disabled and shows "Syncing…" (or equivalent loading label).
- [ ] After the button resolves, verify a confirmation message appears (e.g. "Full sync started") and the button re-enables.
- [ ] On a device where recent events are not in Firestore (simulate by clearing Firestore for a test user and keeping local IndexedDB): tap "Force full sync" and verify the missing events are uploaded to Firestore.
- [ ] Verify that "Force full sync" works on an installed PWA (no address bar) — the button replaces the `?clearsnapshot` URL workaround.
- [ ] Verify that tapping "Force full sync" does not crash or leave the app in a broken state: navigate away from settings, create a new task, and confirm it syncs normally afterwards.
- [ ] Verify that a second tap of "Force full sync" (if the user taps again after the first completes) also works without error.
