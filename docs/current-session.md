# Current Session Plan
**Date:** February 28, 2026  
**Status:** ✅ Complete  
**Version:** Post-v1.2.0 — Remote Snapshot Store for Cold-Start Acceleration (ADR-017)

---

## Session Goal

Eliminate the 60+ second cold-start delay on new devices and incognito sessions.
The root cause is that `SyncManager` downloads all ~900 events from Firestore before
the UI unblocks. The fix: persist the projection snapshot to Firestore so a new device
can restore its read model from a single document fetch instead of downloading every event.

Also completes ADR-016 Phase 2: fix `EntryListProjection.hydrate()` to apply delta events
on top of `snapshot.state` (currently it ignores snapshot state and does a full replay).

Full design in ADR-017. See `docs/architecture-decisions.md`.

## If Interrupted

Stop at the end of whichever step is complete. Each step has its own passing test
suite and commit. Never commit a step with failing tests.

---

## Architecture & Design

**Designed by:** Architecture Alex (February 28, 2026)  
**ADR:** ADR-017 (see `docs/architecture-decisions.md`)  
**Key files:**
- New store: `packages/infrastructure/src/firestore-snapshot-store.ts`
- New utility: `packages/infrastructure/src/firestore-utils.ts`
- Modified projection: `packages/domain/src/entry.projections.ts` (fix `hydrate()`)
- Modified applicator: `packages/domain/src/entry.event-applicator.ts` (add `applyEventsOnto()`)
- Modified coordinator: `packages/client/src/snapshot-manager.ts` (dual-store)
- Modified app init: `packages/client/src/App.tsx` (cold-start sequence)

---

## Implementation Steps (ordered — TDD throughout)

### Step 1 — `firestore-utils.ts` + refactor `FirestoreEventStore`
**Estimated time:** 20 minutes  
**Package:** `packages/infrastructure/`  
**Status:** ✅ Done — commit `2876099`

1. Create `packages/infrastructure/src/firestore-utils.ts`:
   - Extract `removeUndefinedDeep(obj: unknown): unknown` from `firestore-event-store.ts`
   - Export it

2. Update `packages/infrastructure/src/firestore-event-store.ts`:
   - Import `removeUndefinedDeep` from `./firestore-utils`
   - Remove the local `removeUndefined` function

3. No new tests needed (the existing `FirestoreEventStore` tests cover the behaviour).
   All existing infrastructure tests must continue passing.

**Commit:** `refactor(infrastructure): extract removeUndefinedDeep into firestore-utils`

---

### Step 2 — `EntryEventApplicator.applyEventsOnto()`
**Estimated time:** 45 minutes  
**Package:** `packages/domain/`  
**Status:** ✅ Done — commit `579f4a7`

1. Modify `packages/domain/src/entry.event-applicator.ts`:
   - Extract the core map-mutation logic from `applyEvents()` into a private method
     `applyEventsToMap(map: Map<string, Entry>, events: DomainEvent[]): void`
   - Rewrite `applyEvents(events)` to create an empty map, call `applyEventsToMap`, return values
   - Add new public method:
     ```typescript
     applyEventsOnto(seed: Entry[], deltaEvents: DomainEvent[]): Entry[]
     ```
     Implementation: build map from seed, call `applyEventsToMap(map, deltaEvents)`, return values

2. Write tests in `packages/domain/src/entry.event-applicator.test.ts` (or alongside
   existing applicator tests):
   - `applyEventsOnto([])` with no delta events returns the seed unchanged
   - `applyEventsOnto(seed)` with delta events applies them correctly
   - `applyEventsOnto` and `applyEvents` produce the same result for the same full event log
     (i.e., `applyEventsOnto([], allEvents) === applyEvents(allEvents)`)

3. All existing applicator and projection tests must continue passing.

**Commit:** `feat(domain): add EntryEventApplicator.applyEventsOnto() for delta application`

---

### Step 3 — Fix `EntryListProjection.hydrate()` (ADR-016 Phase 2)
**Estimated time:** 45 minutes  
**Package:** `packages/domain/`  
**Status:** ✅ Done — commit `dc53263`

**Goal:** `hydrate()` should use `snapshot.state` as the seed and apply only delta events,
instead of ignoring the snapshot and doing a full replay.

1. Modify `packages/domain/src/entry.projections.ts` — rewrite `hydrate()`:
   ```
   load snapshot → if null/stale version → return (full replay on first getEntries())
   getAll() → find snapshotEventIndex
   if snapshotEventIndex < 0 → return (full replay fallback)
   deltaEvents = allEvents.slice(snapshotEventIndex + 1)
   if deltaEvents.length === 0:
     cachedEntries = [...snapshot.state]   ← zero replay cost
     lastAppliedEventId = snapshot.lastEventId
   else:
     cachedEntries = applicator.applyEventsOnto([...snapshot.state], deltaEvents)
     lastAppliedEventId = allEvents[last].id
   ```

2. Update tests in `packages/domain/src/entry.projections.test.ts`:
   - Add: snapshot is fully current → `getAll()` called once (in hydrate), `applyEventsOnto`
     not called (or called with empty delta)
   - Add: delta events applied on top of snapshot state → correct result, fewer events replayed
   - Update: existing "Snapshot with correct version → `getAll()` called only once on hydrate"
     test should now also verify `cachedEntries` equals snapshot state (not full replay result)
   - All existing hydrate tests must still pass (they test the same correctness guarantee)

> **Note:** Do NOT modify existing tests — add new ones or clarify assertions only.

**Commit:** `feat(domain): fix hydrate() to apply delta events onto snapshot state (ADR-016 Phase 2)`

---

### Step 4 — `FirestoreSnapshotStore`
**Estimated time:** 1.5 hours  
**Package:** `packages/infrastructure/`  
**Status:** ✅ Done — commit `9cfd916`

1. Create `packages/infrastructure/src/firestore-snapshot-store.ts`:
   - Implements `ISnapshotStore`
   - Constructor: `(firestore: Firestore, userId: string)`
   - Firestore path: `users/{userId}/snapshots/{key}`
   - `save(key, snapshot)`: `setDoc(docRef, removeUndefinedDeep(snapshot))`
   - `load(key)`: `getDoc(docRef)` → if not exists return null → validate
     `data.version === SNAPSHOT_SCHEMA_VERSION` else return null → return snapshot
   - `clear(key)`: `deleteDoc(docRef)`
   - Import `removeUndefinedDeep` from `./firestore-utils`
   - Import `SNAPSHOT_SCHEMA_VERSION` from `@squickr/domain`

2. Write tests in `packages/infrastructure/src/__tests__/firestore-snapshot-store.test.ts`:
   - Mirror the `InMemorySnapshotStore` contract tests (load null, save/load, overwrite, clear,
     clear non-existent key, multiple keys independent)
   - Add: `load()` returns null when snapshot version doesn't match `SNAPSHOT_SCHEMA_VERSION`
   - Mock Firestore SDK (use `vi.mock('firebase/firestore')`) — same pattern as
     `firestore-event-store.test.ts`

3. Export from `packages/infrastructure/src/index.ts`:
   ```typescript
   export { FirestoreSnapshotStore } from './firestore-snapshot-store';
   ```

**Commit:** `feat(infrastructure): add FirestoreSnapshotStore for cloud snapshot persistence`

---

### Step 5 — `SnapshotManager` dual-store support
**Estimated time:** 30 minutes  
**Package:** `packages/client/`  
**Status:** ✅ Done — commit `82a32c5`

1. Modify `packages/client/src/snapshot-manager.ts`:
   - Change constructor signature:
     ```typescript
     constructor(
       private readonly projection: EntryListProjection,
       private readonly localStore: ISnapshotStore,
       private readonly remoteStore: ISnapshotStore | null,
       private readonly eventStore: IEventStore,
       private readonly eventsBeforeSnapshot: number = 50
     )
     ```
   - Update `saveSnapshot()`:
     - `await this.localStore.save(key, snapshot)` (reliable path)
     - `this.remoteStore?.save(key, snapshot).catch(err => console.warn(...))` (fire-and-forget)

2. Update tests in `packages/client/src/snapshot-manager.test.ts`:
   - Update constructor calls to pass `null` as `remoteStore` (backward-compatible — add new tests
     for the remote store path)
   - Add: remote store `save()` is called fire-and-forget after local save
   - Add: remote store failure does not throw / does not affect local save
   - Add: `remoteStore = null` → only local store called

**Commit:** `feat(client): add dual-store support to SnapshotManager (local + remote fire-and-forget)`

---

### Step 6 — Wire cold-start sequence in `App.tsx`
**Estimated time:** 1 hour  
**Package:** `packages/client/`  
**Status:** ✅ Done — commit `577ed42`

1. Modify `packages/client/src/App.tsx`:
   - Import `FirestoreSnapshotStore` from `@squickr/infrastructure`
   - In the `user` useEffect (where `SyncManager` is set up):
     - Instantiate `remoteSnapshotStore = new FirestoreSnapshotStore(firestore, user.uid)`
     - Reconstruct `SnapshotManager` with both stores:
       ```typescript
       new SnapshotManager(entryProjection, snapshotStore, remoteSnapshotStore, eventStore)
       ```
     - Before starting `SyncManager`, attempt remote snapshot restore:
       ```typescript
       const remoteSnapshot = await Promise.race([
         remoteSnapshotStore.load('entry-list-projection'),
         timeout(5_000),  // fail fast
       ]);
       if (remoteSnapshot) {
         const localSnapshot = await snapshotStore.load('entry-list-projection');
         const remoteIsNewer = !localSnapshot ||
           new Date(remoteSnapshot.savedAt) > new Date(localSnapshot.savedAt);
         if (remoteIsNewer) {
           await snapshotStore.save('entry-list-projection', remoteSnapshot);
           await entryProjection.hydrate();
           restoredFromRemote = true;
         }
       }
       ```
     - If `restoredFromRemote`: skip sync overlay, run `SyncManager` in background without
       blocking the UI (`onSyncStateChange` does not call `setIsSyncing`)
     - If not restored: existing behaviour (overlay shown until sync completes)

2. Update `packages/client/src/App.test.tsx`:
   - Add mock for `FirestoreSnapshotStore`
   - Add smoke test: `restoredFromRemote` path renders without overlay
   - Existing tests must pass

**Commit:** `feat(client): cold-start acceleration via remote snapshot restore before event sync`

---

### Step 7 — `firestore.rules` update + export cleanup
**Estimated time:** 10 minutes  
**Status:** ✅ Done

1. Add `snapshots` subcollection rule to `firestore.rules`:
   ```
   match /users/{userId}/snapshots/{snapshotKey} {
     allow read, write: if request.auth != null && request.auth.uid == userId;
   }
   ```

2. Verify `packages/infrastructure/src/index.ts` exports `FirestoreSnapshotStore`
   (should already be done in Step 4)

3. Update `docs/roadmap.md` and `docs/current-session.md`

**Commit:** `docs: add Firestore snapshots security rule and mark ADR-017 session complete`

---

## Architectural Decisions Made This Session

| Decision | Choice | Rationale |
|---|---|---|
| Remote snapshot storage | Firestore `users/{userId}/snapshots/{key}` | One document = one network round-trip; mirrors ISnapshotStore key contract |
| Remote save strategy | Fire-and-forget (no await) | Local save is the reliability path; remote is an optimisation |
| Remote fetch timeout | 5 seconds | Fail fast back to existing behaviour on slow/unavailable network |
| Staleness guard | `savedAt` timestamp comparison | Prevent overwriting a newer local snapshot with an older remote one |
| `hydrate()` fix | `applyEventsOnto(snapshot.state, deltaEvents)` | Complete ADR-016 Phase 2 in the same change |
| `removeUndefinedDeep` | Extracted to `firestore-utils.ts` | Shared by both `FirestoreEventStore` and `FirestoreSnapshotStore` |

---

## Expected Test Count After Session

| Package | Before | Expected After | New Tests |
|---|---|---|---|
| domain | 725 | ~740 | ~15 (applyEventsOnto, hydrate delta fix) |
| infrastructure | 38 | ~55 | ~17 (FirestoreSnapshotStore) |
| client | 1117 | ~1130 | ~13 (SnapshotManager dual-store, App wiring) |
| **Total** | **1880** | **~1925** | **~45** |

---

## Previous Session (Post-v1.2.0 — February 28, 2026)

Projection snapshots with delta replay (ADR-016): `ISnapshotStore`, `IndexedDBSnapshotStore`,
`InMemorySnapshotStore`, in-memory cache + `hydrate()` + `createSnapshot()` in
`EntryListProjection`, `SnapshotManager`, wired into `App.tsx`.
1880 tests passing across all packages.
