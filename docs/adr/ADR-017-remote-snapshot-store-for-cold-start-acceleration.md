# ADR-017: Remote Snapshot Store for Cold-Start Acceleration

**Date**: 2026-02-28  
**Status**: Accepted

## Context

ADR-016 (Phase 1) established projection snapshots saved to IndexedDB. This eliminated
redundant full-replay reads on subsequent visits **on the same device**. However, a user
opening the app on a **new device or incognito session** had no local snapshot and no
local events: the full Firestore event log (~945 events for a heavy user) had to be
downloaded and replayed before any content appeared.

This produced two user-visible problems:
1. **Sync overlay blocking the UI** for several seconds while 900+ events downloaded.
2. **Visual churn** as collections updated ~945 times during the download loop.

ADR-010 had noted a `FirestoreSnapshotStore` as a future enhancement. The user base
has now reached a scale where the cold-start experience is materially degraded.

## Decision

Extend the snapshot system with a **remote snapshot store** backed by Firestore:

1. **`FirestoreSnapshotStore`** in `packages/infrastructure/` — implements `ISnapshotStore`
   against the Firestore path `users/{uid}/snapshots/{snapshotKey}`.
2. **`SnapshotManager` dual-store support** — accepts an optional `remoteStore`; on
   `saveSnapshot()`, saves to local first (synchronous path), then fire-and-forgets to
   remote (Firestore write failures do not block the UI or throw to callers).
3. **Cold-start restore in `App.tsx`** — on auth resolve, before starting `SyncManager`:
   - Fetch remote snapshot with a **5-second timeout** (fail fast on slow networks).
   - If remote snapshot is newer than local (or local is absent): save it to IndexedDB,
     call `entryProjection.hydrate()` — projection is populated before any sync begins.
   - Set `restoredFromRemoteRef = true` to skip the sync overlay on this path.
4. **Post-initial-sync snapshot seeding** — on the normal path (first-ever sign-in, no
   remote snapshot yet), `App.tsx` calls `saveSnapshot('post-initial-sync')` once after
   the initial `SyncManager` sync completes. This seeds Firestore without requiring a
   tab-close event.
5. **`isRemoteRestoring` gate** — `App.tsx` adds `isRemoteRestoring` state (starts `true`,
   cleared in `startSync()` finally block). `isAppReady` gates on `!isRemoteRestoring`
   so the tutorial and empty-state logic never fire before the remote check resolves.
6. **Firestore security rules** — `users/{userId}/snapshots/{snapshotKey}` read/write
   rules added and deployed.

## Rationale

**Why a 5-second timeout?**
The cold-start optimisation is a best-effort acceleration, not a hard requirement.
If Firestore is slow or unavailable, the app must fall back gracefully to the normal
sync path. A 5-second timeout is aggressive enough to fail fast on genuinely degraded
networks without penalising normal users.

**Why save remote-first then fire-and-forget?**
`SnapshotManager` already saves to IndexedDB first (which is the source of truth for
the local device). The Firestore write is speculative — it makes the snapshot available
for future cold-starts on other devices. A failed remote save is acceptable; the user's
data is safe in IndexedDB and Firestore's event log.

**Why gate `isAppReady` on `isRemoteRestoring`?**
On the cold-start path `isSyncing` is intentionally never set to `true` (the overlay
is bypassed). Without an explicit gate, `isAppReady` would become `true` the moment
`isLoading` cleared — before `hydrate()` ran — causing `CollectionIndexView` to see
`collections.length === 0` and fire `startTutorial()` on a returning user.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Keep sync overlay on cold-start | Defeats the purpose; returning users see a long spinner on new devices |
| Service Worker cache for events | Stale on new devices; adds significant complexity |
| Download snapshot in Service Worker | Out of scope; SW architecture not established |
| Per-collection remote snapshots | Over-engineered; full-projection snapshot is sufficient |

## Consequences

**Positive:**
- Cold-start on new device / incognito: entries appear immediately, no overlay, no churn
- Returning users are never shown the new-user tutorial on a new device
- Snapshot seeds automatically after first use without requiring tab close
- Graceful degradation: timeout / Firestore error → falls back to normal sync path
- Clean Architecture preserved: `ISnapshotStore` unchanged; `FirestoreSnapshotStore`
  is an infrastructure implementation detail

**Negative / Risks:**
- Remote snapshot may lag behind the event log by up to one `saveSnapshot` interval
  (50 events or tab close). `SyncManager` background sync closes the gap silently.
- Firestore read on every app open (mitigated: single document fetch, < 1KB)
- `isRemoteRestoring` adds one more boolean to the `isAppReady` formula

**Testing Impact:**
- `@squickr/client`: +6 tests (2 post-initial-sync snapshot tests, 3 `isRemoteRestoring`
  gate tests, 1 existing cold-start test updated to async assertion)
- `@squickr/infrastructure`: +13 `FirestoreSnapshotStore` tests

## Files Created / Modified

**Created:**
- `packages/infrastructure/src/firestore-snapshot-store.ts` — `FirestoreSnapshotStore`
- `firestore.rules` — snapshot read/write rules (deployed)

**Modified:**
- `packages/client/src/snapshot-manager.ts` — dual-store support, fire-and-forget remote
- `packages/client/src/App.tsx` — cold-start restore, `isRemoteRestoring` gate,
  post-initial-sync `saveSnapshot`
- `packages/client/src/App.test.tsx` — `MockFirestoreEventStore`, new tests
