# ADR-024: Cold-Start Restoration Sequence for Returning Users on Empty Local Store

**Date**: 2026-04-01
**Status**: Accepted

## Context

ADR-017 introduced a remote snapshot fetch at the start of `startSync()` and gated
`isAppReady` on `!isRemoteRestoring` to prevent the tutorial from firing before the
Firestore check resolved. That ADR was designed around the **happy path**: Firestore
responds within 5 seconds, the snapshot is newer than the local snapshot, `hydrate()` is
called, and the overlay is skipped.

Three distinct failure modes remain, each producing a broken user experience for returning
users opening the app on a device with empty IndexedDB:

---

### Failure Mode 1 — Tutorial fires on slow or unavailable networks

The existing cold-start path races the Firestore snapshot fetch against a 5-second
timeout. When the network is slow or Firestore is temporarily unavailable, the race
resolves to `null` and the `finally` block clears `isRemoteRestoring` immediately. At
that point:

- Local IndexedDB is empty (no events, no local snapshot).
- `isLoading` is already `false` (set by `initializeApp()`).
- `isSyncing` is `false` until `SyncManager.start()` fires — but `SyncManager` is
  constructed **after** the `finally` block.
- There is a React render cycle between `setIsRemoteRestoring(false)` and the
  `SyncManager.start()` call that sets `isSyncing = true`.

During that render cycle, `isAppReady` is `true`, `collections.length === 0`, and
`CollectionIndexView.useEffect` fires `startTutorial()` — even though the user has years
of data in Firestore that the background sync is about to download.

---

### Failure Mode 2 — Empty state shown before background sync populates the projection

On the same slow-network path, the user sees a blank `CollectionIndexView` between when
`isRemoteRestoring` clears and when the background `SyncManager` sync completes. The
sync overlay is never shown (because `restoredFromRemoteRef.current` is `false` only when
the remote snapshot was actually applied; the timeout path leaves it `false` and
`isSyncing` is set to `true`, which should show the overlay — but see the timing gap
above). The net result: a flash of empty state, then tutorial, then the sync overlay
finally appears.

Specifically, because `SyncManager` on the non-restore path sets `isSyncing = true`
synchronously inside `startSync()`, and `isAppReady` gates on
`!isSyncing || syncManager?.initialSyncComplete`, the overlay should eventually appear.
However the race between `setIsRemoteRestoring(false)` and the `SyncManager`
instantiation means there is at minimum one render where the app is "ready" but empty.

---

### Failure Mode 3 — Remote snapshot is never fetched on cold start when local IndexedDB
is non-empty but stale

The current cold-start logic always attempts the remote snapshot fetch, regardless of
local store state. This means every app open — including frequent daily users with a
warm local store — incurs a Firestore read on startup. ADR-017 accepted this as an
acceptable cost ("single document fetch, < 1KB"). However, the fetch is only beneficial
when the local store is empty or significantly behind. The comparison currently uses
`savedAt` timestamps on the snapshots, which correctly skips the seed when the local
snapshot is newer — but it still awaits the Firestore round-trip before clearing
`isRemoteRestoring` on every open. On slow networks this delays `isAppReady` by up to
5 seconds for users who do not need the remote restore at all.

This is a performance regression introduced by ADR-017 that is only observable on slow
networks, but it affects all users, not just those on new devices.

---

## Root Cause Analysis

The three failures share a common root cause: **the decision of whether to show the
tutorial, show empty state, or show a loading indicator is determined by `isAppReady`,
but `isAppReady` does not encode the full picture of whether a cold-start restore is
actually needed**.

Specifically:

1. `isRemoteRestoring` starts `true` (conservative) but is cleared by the timeout race
   rather than by the result of a local-store emptiness check. This means the gate
   applies the same latency cost to all users and still fails when the timeout fires.

2. There is no single boolean that answers "is this device definitively a new device
   (no local events, no remote snapshot) versus a returning user that just needs data
   downloaded?"

3. The tutorial trigger in `CollectionIndexView` gates only on `isAppReady` and
   `collections.length === 0`. It has no way to distinguish "empty because truly new"
   from "empty because background sync hasn't completed yet".

---

## Decision

Implement a **three-phase cold-start sequencer** that runs immediately after auth
resolves and drives `isAppReady` with a more precise state machine than the current
pair of booleans (`isRemoteRestoring`, `isSyncing`).

### Phase 0 — Local store emptiness check (synchronous, free)

Before initiating any network request, call `eventStore.getAll()` to determine whether
the local IndexedDB has any events. This call is already made by `entryProjection.hydrate()`
during `initializeApp()`; the result is available via the in-memory cache.

Introduce a new exported helper on `EntryListProjection`:

```typescript
/** Returns true if the local event store contains zero events at hydration time. */
isLocalStoreEmpty(): boolean
```

This is a pure accessor over the `absorbedEventIds` set populated by `hydrate()`:
if the set is empty after `hydrate()`, the local store had no events at startup.
No new IndexedDB call is needed.

### Phase 1 — Determine restoration intent (immediately after auth resolves)

Introduce a new `ColdStartPhase` type in `App.tsx`:

```typescript
type ColdStartPhase =
  | 'checking'       // Auth resolved; determining what to do
  | 'restoring'      // Fetching remote snapshot and/or seeding local store
  | 'syncing'        // Normal SyncManager initial sync in progress
  | 'ready';         // App ready for user interaction
```

Replace the pair of `isRemoteRestoring` + `isSyncing` booleans with a single
`coldStartPhase` state value. `isAppReady` becomes:

```typescript
const isAppReady = coldStartPhase === 'ready';
```

The sync overlay and loading state are driven by `coldStartPhase`:

```
'checking'  → spinner, "Loading…"
'restoring' → spinner, "Restoring your journal…"
'syncing'   → spinner, "Syncing your journal…"
'ready'     → no overlay
```

### Phase 2 — Local-emptiness-gated remote snapshot fetch

When the user is authenticated and `initializeApp()` completes, the sequencer runs:

```
if localStoreEmpty:
  coldStartPhase = 'checking'  (already set)
  attempt remoteSnapshot = FirestoreSnapshotStore.load('entry-list-projection')
    with 10-second timeout (increased from 5s — see Rationale)

  if remoteSnapshot !== null:
    coldStartPhase = 'restoring'
    save remoteSnapshot to local IndexedDBSnapshotStore
    call entryProjection.hydrate()   ← re-hydrate with the seeded snapshot
    coldStartPhase = 'syncing'       ← SyncManager starts, but skip overlay
    start SyncManager (no overlay — restoredFromRemoteRef = true)
    coldStartPhase = 'ready' after SyncManager.initialSyncComplete

  else if remoteSnapshot === null (truly new user OR snapshot not yet written):
    coldStartPhase = 'syncing'
    start SyncManager with overlay
    coldStartPhase = 'ready' after SyncManager.initialSyncComplete

else (localStoreNonEmpty):
  skip remote snapshot fetch entirely — do NOT await Firestore
  coldStartPhase = 'ready'  ← set synchronously before SyncManager starts
  start SyncManager in background (no overlay, ADR-017 restored-from-remote path)
```

This eliminates Failure Mode 3: users with a non-empty local store never wait for a
Firestore round-trip before `isAppReady` becomes `true`.

### Phase 3 — Tutorial suppression by phase, not by collection count

Change `CollectionIndexView`'s tutorial trigger to gate on both `isAppReady` AND
`collections.length === 0` AND a new condition: `coldStartPhase` was never `'restoring'`
or `'syncing'` during this session.

Concretely: introduce a `sessionStorage` flag `squickr_cold_start_restored` that is
written when `coldStartPhase` transitions through `'restoring'` or `'syncing'`. The
tutorial trigger checks:

```typescript
const wasRestoredThisSession =
  sessionStorage.getItem('squickr_cold_start_restored') === 'true';

if (
  realCollections.length === 0 &&
  !hasSeenThisSession &&
  !hasCompletedTutorial &&
  !wasRestoredThisSession  // ← NEW
) {
  startTutorial();
}
```

The flag is set in `App.tsx` whenever `coldStartPhase` transitions to `'syncing'` (i.e.
whenever a SyncManager sync was needed — whether or not the remote snapshot was found).
It is cleared by `TutorialContext.resetTutorial()` (developer convenience only).

This eliminates Failure Mode 1 entirely: even if the background sync has not yet
populated any collections, the tutorial will not fire during a session where a sync was
in progress.

### Phase 4 — Eliminating the empty-state flash (Failure Mode 2)

The flash occurs because `isAppReady` becomes `true` before the SyncManager overlay
appears. With the new state machine this cannot happen:

- If `localStoreEmpty && remoteSnapshot !== null`: `coldStartPhase` transitions directly
  from `'restoring'` to `'syncing'` to `'ready'`. The overlay shows `'restoring'` then
  `'syncing'` text. `isAppReady` is `false` throughout. No flash.

- If `localStoreEmpty && remoteSnapshot === null`: `coldStartPhase` is `'syncing'` from
  the moment `SyncManager` starts. `isAppReady` is `false`. No flash.

- If `localStoreNonEmpty`: `coldStartPhase` is `'ready'` immediately. The store is
  already populated. No empty state to flash.

### Handling the timeout case (slow network, empty local store)

When `localStoreEmpty` is `true` and the Firestore fetch times out:

- `coldStartPhase` transitions from `'checking'` to `'syncing'` (the null-snapshot branch).
- `SyncManager` starts with the full overlay: `isSyncing = true`, overlay shown.
- `wasRestoredThisSession` is set to `'true'` in sessionStorage.
- When `SyncManager.initialSyncComplete` fires, `coldStartPhase` = `'ready'`.
- `isAppReady` becomes `true` with collections now populated. Tutorial does not fire
  because `wasRestoredThisSession` is set.

This is the correct behaviour: the user waits behind the sync overlay (as they would
have on any pre-ADR-017 cold start), but they do not see the tutorial afterward.

### Increasing the remote snapshot timeout from 5 to 10 seconds

ADR-017 used 5 seconds on the basis that the remote restore is "best-effort". With the
new state machine, the remote snapshot fetch only runs when local IndexedDB is empty —
i.e. the user is on a new device and has no data locally. On such a device, a 5-second
timeout failure falls back to a full event-log download via `SyncManager`, which may
itself take 10–30 seconds for a heavy user. The 5-second timeout is not protecting
the user from a long wait; it is merely choosing a slightly slower recovery path
(full sync vs snapshot + delta sync) with no user-visible benefit.

10 seconds is chosen as a timeout that covers typical mobile network round-trip times
to Firestore without being long enough to feel like a hang. If the fetch fails at 10
seconds, the fallback to full sync is transparent to the user (they see "Syncing your
journal…" either way).

---

## Event Model

No new domain events, event types, or aggregates are introduced. The cold-start
restoration is a read-side optimisation — it populates the local store from a remote
snapshot and then lets the existing `SyncManager` + `EntryListProjection` machinery
handle everything from that point.

The new `isLocalStoreEmpty(): boolean` method on `EntryListProjection` is a pure
read-model accessor. It is implemented as:

```typescript
isLocalStoreEmpty(): boolean {
  // absorbedEventIds is populated by hydrate() from all event IDs in the local store.
  // If it is null, hydrate() has not been called — treat as empty (safe default: may
  // trigger unnecessary remote fetch, but never incorrectly suppresses tutorial for a
  // new user).
  // If it is an empty Set, the local store had zero events at hydration time.
  return this.absorbedEventIds === null || this.absorbedEventIds.size === 0;
}
```

Note: `absorbedEventIds` is `null` before `hydrate()` runs and is drained to empty as
events are absorbed. After the cold-start sync completes and genuine new events arrive,
`absorbedEventIds` is set to `null` (absorption mode cleared). This means
`isLocalStoreEmpty()` is only meaningful between `hydrate()` completing and the first
new event being appended — exactly the window in which the cold-start sequencer needs it.
If called after that window it may return `false` (from the `null` branch — safe, treats
as non-empty) or `true` (if the Set has been drained to size 0 but not yet nulled). To
avoid this ambiguity, the sequencer must call `isLocalStoreEmpty()` exactly once,
immediately after `initializeApp()` completes, and store the result in a local constant.

Alternatively, a simpler implementation: add a separate `localStoreWasEmpty: boolean`
field to `EntryListProjection`, set once in `hydrate()` before applying any events, and
never mutated afterward. This is the preferred implementation as it avoids the
`absorbedEventIds` timing ambiguity:

```typescript
// In EntryListProjection.hydrate():
private localStoreWasEmptyAtHydration = false;

async hydrate(): Promise<void> {
  const snapshot = await this.snapshotStore?.load('entry-list-projection') ?? null;
  // ... existing logic ...
  const allEvents = await this.eventStore.getAll();
  this.localStoreWasEmptyAtHydration = allEvents.length === 0;
  // ... rest of hydration ...
}

/** True if the local event store contained zero events when hydrate() last ran. */
wasLocalStoreEmptyAtHydration(): boolean {
  return this.localStoreWasEmptyAtHydration;
}
```

---

## State Machine Diagram

```
Auth resolves
      │
      ▼
[initializeApp()] ──► coldStartPhase = 'checking'
      │
      ▼
isLocalStoreEmpty()?
      │
   YES │                          NO
      ▼                            ▼
Fetch remote snapshot         coldStartPhase = 'ready'
(10s timeout)                 SyncManager starts (background)
      │
   ┌──┴──────────────┐
   │ snapshot found  │  timeout / null
   ▼                 ▼
coldStartPhase    coldStartPhase
= 'restoring'     = 'syncing'
seed local store  SyncManager starts
hydrate()         (with overlay)
   │              wasRestoredThisSession = 'true'
   ▼                 │
coldStartPhase        │
= 'syncing'           │
SyncManager starts    │
(no overlay)          │
wasRestoredThisSession│
= 'true'              │
   │                  │
   └──────────────────┘
           │
           ▼
   SyncManager.initialSyncComplete
           │
           ▼
   coldStartPhase = 'ready'
   isAppReady = true
```

---

## Rationale

**Why a phase enum instead of two booleans?**

The existing `isRemoteRestoring` + `isSyncing` pair has three meaningful states
(`restoring`, `syncing`, `ready`) but four representable states (including the
transitional "both false, neither complete" state that produces the flash). A named
enum makes the illegal state unrepresentable and makes overlay copy (`"Restoring…"` vs
`"Syncing…"`) trivially derivable from a single value.

**Why gate the remote snapshot fetch on `localStoreWasEmptyAtHydration`?**

Fetching the remote snapshot unconditionally (ADR-017 behaviour) adds a Firestore read
on every startup for every user. For users who use the app daily on the same device,
this fetch is never useful — their local snapshot is always newer than the remote one.
The `savedAt` comparison correctly skips the seed in this case, but the round-trip
latency still delays `isAppReady` by up to 5 seconds on slow networks. Gating the fetch
on `localStoreWasEmptyAtHydration` makes the fast path (local store non-empty) free of
any network dependency, restoring the original offline-first startup time for the
overwhelming majority of sessions.

The remote snapshot fetch is a new-device optimisation. It should only run when a new
device is detected.

**Why `wasLocalStoreEmptyAtHydration()` rather than checking `IEventStore.getAll().length`?**

`entryProjection.hydrate()` already calls `eventStore.getAll()` internally. A second
`getAll()` call in `App.tsx` would duplicate the IndexedDB read. Capturing the result as
a field during `hydrate()` is free — it costs one integer comparison and one boolean
assignment at the time the data is already in memory.

**Why `sessionStorage` for `wasRestoredThisSession` rather than a React ref?**

`CollectionIndexView` is not a child of the component that owns `coldStartPhase` state.
Threading a prop or context value through to `CollectionIndexView` would require either
adding `coldStartPhase` to `AppContext` (polluting a domain-oriented context with startup
infrastructure state) or creating a new context for it. `sessionStorage` is a simpler,
zero-coupling solution: it is written by `App.tsx` once and read by `CollectionIndexView`
once. It is correctly scoped to the session — if the user reloads the page, the sequencer
re-runs and re-sets the flag if needed.

**Why not fix the tutorial logic to check for an active `SyncManager.isSyncing` state?**

This is the most targeted fix for Failure Mode 1, but it introduces coupling between the
tutorial trigger and the sync infrastructure. The tutorial trigger should answer one
question: "is this a brand-new user?" The `wasRestoredThisSession` flag answers that
question correctly and durably across React re-renders and component re-mounts, without
coupling `CollectionIndexView` to `SyncManager`.

**Why 10 seconds instead of 5 for the snapshot timeout?**

See the analysis above. The cold-start path only runs when local IndexedDB is empty,
meaning the user is on a new device. On a new device, the fallback from snapshot failure
is full event log download — a much slower operation. The 5-second timeout does not
meaningfully protect the user from a slow experience; it just swaps "slow snapshot fetch"
for "full sync" with no UX gain. 10 seconds covers P95 mobile Firestore latency.

**What if the user is authenticated but Firebase is down?**

If `FirestoreSnapshotStore.load()` throws (not times out), the `catch` block in
`startSync()` clears `coldStartPhase` to `'syncing'` and starts `SyncManager`. The
`SyncManager` will fail its initial sync, set `syncError`, and show the "Show local
data" button — the existing error recovery path (ADR-017). No change needed here.

**What if `hydrate()` is called twice?**

`hydrate()` is already called once in `initializeApp()`. The cold-start path calls it a
second time after seeding the local snapshot from Firestore. The second call re-reads the
local snapshot (which now contains the seeded remote snapshot) and the event log (which
is still empty — the delta between snapshot and now is fetched by `SyncManager`). This
is safe: `hydrate()` replaces `cachedEntries` and resets `absorbedEventIds`. The
`isInitialized` ref in `App.tsx` prevents double-init of `initializeApp()`, but it must
not prevent the second `hydrate()` call. The second call must be made explicitly by the
cold-start sequencer in `startSync()`, not by `initializeApp()`.

---

## Interaction with Existing Systems

**`isRemoteRestoring` (ADR-017):**
Superseded. The `isRemoteRestoring` state variable is removed and replaced with
`coldStartPhase`. The `isAppReady` formula becomes `coldStartPhase === 'ready'`.

**`restoredFromRemoteRef` (ADR-017):**
Retained. It continues to suppress the `isSyncing` overlay on the snapshot-restored path.
Under the new model, the overlay copy changes to `"Restoring your journal…"` during
`'restoring'` phase and `"Syncing…"` during `'syncing'` phase, but the existing
`restoredFromRemoteRef` still correctly suppresses the sync overlay after restoration.

**`SnapshotManager` (ADR-016):**
Unchanged. The `SnapshotManager` continues to write snapshots to both local IndexedDB
and Firestore on the save triggers (count, visibility, unload). The cold-start sequencer
only reads from Firestore; it does not write. No coordination is needed.

**`SyncManager.initialSyncComplete` (ADR-017):**
Unchanged. The transition from `coldStartPhase = 'syncing'` to `coldStartPhase = 'ready'`
is triggered by the existing `onSyncStateChange` callback when `syncing` transitions from
`true` to `false` and `initialSyncComplete` is true.

**`appendBatch` absorption (ADR-018):**
Unchanged. The second `hydrate()` call (if it runs) re-populates `absorbedEventIds` with
the snapshot's event IDs plus any delta events. The subsequent `SyncManager` download
will deliver the events between the snapshot's `lastEventId` and the current Firestore
tail; these will be absorbed correctly.

**Tutorial context (ADRs pre-017):**
`TutorialContext` is unchanged. `TutorialProvider.resetTutorial()` should additionally
call `sessionStorage.removeItem('squickr_cold_start_restored')` so that developers using
the tutorial reset feature see a clean state. This is a minor addition to the reset
method.

---

## Alternatives Considered

| Option | Rejected Because |
|---|---|
| Keep `isRemoteRestoring`, fix the timing race with `useLayoutEffect` | The race is between a state setter and a class method call; `useLayoutEffect` cannot prevent it. Does not fix Failure Mode 3. |
| Add `coldStartPhase` to `AppContext` | Pollutes the domain-oriented context with startup infrastructure state. `CollectionIndexView` should not need to know about restoration phases. |
| Check `SyncManager.isSyncing` in the tutorial trigger | Couples `CollectionIndexView` to sync infrastructure. `SyncManager` may be null (no user). Fragile. |
| Keep unconditional remote snapshot fetch, increase timeout to 10s | Penalises all returning users on slow networks with a 10s delay before `isAppReady`. Worse than the current 5s regression. |
| Add `EventStore.count()` to `IEventStore` | Adds a method to the core domain interface solely for startup heuristics. Violates Interface Segregation — count is never needed at runtime. Adding a field to `EntryListProjection.hydrate()` is the correct, zero-interface-change approach. |
| Service Worker — intercept Firestore snapshot on install | Adds significant complexity; no established SW architecture. Over-engineered for this problem. |
| Store "user has data" flag in localStorage after first sync | Breaks when the user clears site data on the same device — the flag would incorrectly suppress remote restore on what is effectively a new-device start. `localStoreWasEmptyAtHydration` cannot lie: it reads the actual IndexedDB state. |

---

## Consequences

**Positive:**
- Tutorial never fires for returning users, regardless of network speed.
- Empty state never shown to returning users on new devices.
- No Firestore round-trip on startup for users with a non-empty local store.
  Startup time for daily users on slow networks drops from up to 5 seconds to zero.
- Single, testable state machine replaces two loosely-coordinated booleans.
- Overlay copy ("Restoring…" vs "Syncing…") gives users a clearer signal about what
  is happening.

**Negative / Risks:**
- `coldStartPhase` must be threaded into the overlay JSX (minor refactor of the overlay
  conditional in `App.tsx`).
- The second `hydrate()` call (on the snapshot-restore path) adds a second IndexedDB
  `getAll()` read on cold start for new-device users. At the time of the second call,
  the local event log is still empty, so `getAll()` returns `[]` immediately. Cost is
  negligible.
- `wasLocalStoreEmptyAtHydration()` is only valid in the window between `hydrate()` and
  the first new event. The sequencer must call it once and cache the result. If a future
  refactor calls it lazily, it may return incorrect results. A warning comment in
  `EntryListProjection` documents this constraint.
- Introducing `squickr_cold_start_restored` into `sessionStorage` adds one more key to
  the set of storage keys the app manages. It is session-scoped (cleared on tab close)
  and has no persistence risk.

---

## SOLID Principles

- **Single Responsibility**: `EntryListProjection.hydrate()` acquires a new field
  (`localStoreWasEmptyAtHydration`) that is a natural output of an operation it already
  performs (`eventStore.getAll()`). The cold-start sequencer in `App.tsx` owns the phase
  transitions. `CollectionIndexView` owns the tutorial trigger. Each component has one
  reason to change.
- **Open/Closed**: The `ISnapshotStore` and `IEventStore` interfaces are unchanged.
  `EntryListProjection` is extended with one field and one accessor — existing behaviour
  is unmodified. `CollectionIndexView`'s tutorial effect is extended with one additional
  guard condition — the existing conditions are unchanged.
- **Liskov Substitution**: The `wasLocalStoreEmptyAtHydration()` method has the same
  contract regardless of which `IEventStore` or `ISnapshotStore` implementation backs
  the projection. Tests use `InMemoryEventStore` as before.
- **Interface Segregation**: No new methods are added to `IEventStore` or `ISnapshotStore`.
  The new method lives on `EntryListProjection` (a concrete class) — it is not surfaced
  through any interface, keeping interfaces minimal.
- **Dependency Inversion**: `App.tsx` (delivery layer) depends on `EntryListProjection`
  (domain layer) through the existing accessor pattern. The cold-start sequencer depends
  on `ISnapshotStore` (domain abstraction) for the remote fetch — not on
  `FirestoreSnapshotStore` directly. The `FirestoreSnapshotStore` instance is constructed
  in `App.tsx` and passed downward, preserving the existing Dependency Injection pattern.

---

## Files to Create / Modify

**Modify:**

- `packages/domain/src/entry.projections.ts`
  - Add private `localStoreWasEmptyAtHydration: boolean = false` field
  - Set it in `hydrate()` before applying events: `this.localStoreWasEmptyAtHydration = allEvents.length === 0`
  - Add public `wasLocalStoreEmptyAtHydration(): boolean` accessor
  - Add corresponding JSDoc comment warning about the valid-window constraint

- `packages/domain/src/entry.projections.test.ts`
  - Add 3 tests: returns `true` when store is empty at hydration, returns `false` when
    store has events, returns `false` after re-hydration with events present

- `packages/client/src/App.tsx`
  - Replace `isRemoteRestoring: boolean` state with `coldStartPhase: ColdStartPhase`
    (type defined inline)
  - Replace `isSyncing: boolean` state — the sync overlay is now driven by
    `coldStartPhase === 'syncing'` for the initial sync path (ongoing background syncs
    continue to not block `isAppReady`)
  - Remove the `useEffect` that clears `isRemoteRestoring` when `!user`; replace with
    `coldStartPhase = 'ready'` in the `!user` branch of the existing `useEffect`
  - Rewrite `startSync()`:
    - Read `const isEmptyLocalStore = entryProjection.wasLocalStoreEmptyAtHydration()`
    - If `!isEmptyLocalStore`: set `coldStartPhase = 'ready'`, start `SyncManager`
      background (no overlay), return
    - If `isEmptyLocalStore`: set `coldStartPhase = 'checking'`, fetch remote snapshot
      with 10s timeout, branch as described in Phase 2 above
    - Set `sessionStorage.setItem('squickr_cold_start_restored', 'true')` whenever
      transitioning through `'syncing'` phase
  - Update overlay JSX to render phase-appropriate copy:
    - `'checking'` and `'restoring'`: "Restoring your journal…"
    - `'syncing'`: existing "Syncing your journal…"

- `packages/client/src/context/TutorialContext.tsx`
  - In `resetTutorial()`, add:
    `sessionStorage.removeItem('squickr_cold_start_restored')`

- `packages/client/src/views/CollectionIndexView.tsx`
  - Add `wasRestoredThisSession` check to the tutorial trigger `useEffect`:
    ```typescript
    const wasRestoredThisSession =
      sessionStorage.getItem('squickr_cold_start_restored') === 'true';
    if (
      realCollections.length === 0 &&
      !hasSeenThisSession &&
      !hasCompletedTutorial &&
      !wasRestoredThisSession
    ) {
      startTutorial();
    }
    ```

- `packages/client/src/App.test.tsx`
  - Update existing `isRemoteRestoring` tests to use `coldStartPhase`
  - Add tests for the three failure modes:
    - Empty local store + timeout: `coldStartPhase` transitions to `'syncing'`, tutorial
      suppressed, overlay shown
    - Empty local store + remote snapshot found: `coldStartPhase` transitions through
      `'restoring'` → `'syncing'` → `'ready'`, `wasRestoredThisSession` set
    - Non-empty local store: `coldStartPhase` goes directly to `'ready'`, no Firestore
      read initiated

- `packages/client/src/views/CollectionIndexView.test.tsx`
  - Add test: tutorial does NOT fire when `wasRestoredThisSession` is set in
    `sessionStorage`, even when `collections.length === 0` and `isAppReady` is true
  - Add test: tutorial fires when `wasRestoredThisSession` is absent AND all other
    conditions met (regression guard)
