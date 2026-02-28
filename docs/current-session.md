# Current Session Plan
**Date:** February 28, 2026  
**Status:** ✅ Complete  
**Version:** Post-v1.2.0 — Projection Snapshots (Learning Exercise)

---

## Session Goal

Implement projection snapshots with delta replay — a learning exercise in a core
event sourcing pattern. The app currently does full event replay on every `getEntries()`
call. This session introduces: `ISnapshotStore` interface, `IndexedDBSnapshotStore`,
in-memory cache in `EntryListProjection`, delta replay on startup, and `SnapshotManager`
(count trigger + tab-close trigger).

Full design in ADR-016. Not a performance emergency — implementing while the codebase
is small enough to learn from comfortably.

## If Interrupted

Stop at the end of whichever step is complete. Each step has its own passing test
suite and commit. Never commit a step with failing tests.

---

## Architecture & Design

**Designed by:** Architecture Alex (February 28, 2026)  
**ADR:** ADR-016 (see `docs/architecture-decisions.md`)  
**Key files:**
- New interface: `packages/domain/src/snapshot-store.ts`
- New stores: `packages/infrastructure/src/indexeddb-snapshot-store.ts`, `in-memory-snapshot-store.ts`
- Modified projection: `packages/domain/src/entry.projections.ts`
- New coordinator: `packages/client/src/snapshot-manager.ts`

---

## Implementation Steps (ordered — TDD throughout)

### Step 1 — `ISnapshotStore` Interface + Types (domain layer)
**Estimated time:** 30 minutes  
**Package:** `packages/domain/`  
**Status:** ⬜ Pending

1. Create `packages/domain/src/snapshot-store.ts`:
   - `ProjectionSnapshot` interface: `{ version, lastEventId, state: Entry[], savedAt }`
   - `ISnapshotStore` interface: `save(key, snapshot)`, `load(key)`, `clear(key)`
   - `SNAPSHOT_SCHEMA_VERSION = 1` constant
   - Full JSDoc on all fields

2. Export from `packages/domain/src/index.ts`:
   ```typescript
   export type { ISnapshotStore, ProjectionSnapshot } from './snapshot-store';
   export { SNAPSHOT_SCHEMA_VERSION } from './snapshot-store';
   ```

3. Write interface contract tests in `packages/domain/src/snapshot-store.test.ts`:
   - Test `SNAPSHOT_SCHEMA_VERSION` is a number
   - Test `ProjectionSnapshot` shape (TypeScript type tests using `satisfies`)
   - These tests are intentionally minimal — the interface itself has no logic

**Commit:** `feat(domain): add ISnapshotStore interface, ProjectionSnapshot type, SNAPSHOT_SCHEMA_VERSION`

---

### Step 2 — `InMemorySnapshotStore` (infrastructure layer)
**Estimated time:** 45 minutes  
**Package:** `packages/infrastructure/`  
**Status:** ⬜ Pending

1. Create `packages/infrastructure/src/in-memory-snapshot-store.ts`:
   - Implements `ISnapshotStore` using a `Map<string, ProjectionSnapshot>`
   - `save`: `this.store.set(key, snapshot)`
   - `load`: `return this.store.get(key) ?? null`
   - `clear`: `this.store.delete(key)`

2. Write tests in `packages/infrastructure/src/__tests__/in-memory-snapshot-store.test.ts`:
   - `load()` returns `null` when no snapshot exists
   - `save()` then `load()` returns the saved snapshot
   - `save()` twice with same key overwrites (not appends)
   - `clear()` makes subsequent `load()` return `null`
   - `clear()` on non-existent key is a no-op (doesn't throw)
   - Multiple keys are independent (saving 'key-a' doesn't affect 'key-b')

3. Export from `packages/infrastructure/src/index.ts`:
   ```typescript
   export { InMemorySnapshotStore } from './in-memory-snapshot-store';
   ```

**Commit:** `feat(infrastructure): add InMemorySnapshotStore implementing ISnapshotStore`

---

### Step 3 — `IndexedDBSnapshotStore` (infrastructure layer)
**Estimated time:** 1.5 hours  
**Package:** `packages/infrastructure/`  
**Status:** ⬜ Pending

1. Create `packages/infrastructure/src/indexeddb-snapshot-store.ts`:
   - Same initialize/open pattern as `IndexedDBEventStore`
   - Database name: `squickr-snapshots` (separate DB from events)
   - Object store: `snapshots`, keyPath: `'key'`
   - `save()`: `store.put({ key, ...snapshot })` (upsert)
   - `load()`: `store.get(key)`, destructure to remove `key` field before returning
   - `clear()`: `store.delete(key)`
   - `ensureInitialized()` guard on all methods

2. Write tests in `packages/infrastructure/src/__tests__/indexeddb-snapshot-store.test.ts`:
   - Use `fake-indexeddb` (already used by `indexeddb-event-store.test.ts`)
   - Mirror the `InMemorySnapshotStore` test cases (same contract, different implementation)
   - Add: throws if not initialized
   - Add: `initialize()` creates the `snapshots` object store

3. Export from `packages/infrastructure/src/index.ts`:
   ```typescript
   export { IndexedDBSnapshotStore } from './indexeddb-snapshot-store';
   ```

**Commit:** `feat(infrastructure): add IndexedDBSnapshotStore with IndexedDB persistence`

---

### Step 4 — In-Memory Cache in `EntryListProjection`
**Estimated time:** 1 hour  
**Package:** `packages/domain/`  
**Status:** ⬜ Pending

**Goal:** Add the cache *without* snapshot awareness yet. Get the performance win of
"serve from cache, invalidate on event" before introducing snapshot complexity.

1. Modify `packages/domain/src/entry.projections.ts`:
   - Add `private cachedEntries: Entry[] | null = null`
   - Add `private lastAppliedEventId: string | null = null`
   - Modify event store subscription callback: `this.cachedEntries = null; this.notifySubscribers();`
   - Add private `resolveCache(): Promise<Entry[]>`:
     - If `cachedEntries !== null`, return it
     - Else: `eventStore.getAll()` → `applicator.applyEvents()` → store in `cachedEntries`
   - Modify `getEntries()` to call `resolveCache()` instead of `eventStore.getAll()` directly

2. Add tests in `packages/domain/src/entry.projections.test.ts`:
   - Cache hit: `getEntries()` called twice → `eventStore.getAll()` called only once
   - Cache invalidation: after `eventStore.append()`, next `getEntries()` calls `getAll()` again
   - Cache works correctly with subscriptions (subscribers still fire)

   > **Testing tip:** Use `InMemoryEventStore`. To count `getAll()` calls, wrap it with
   > `vi.spyOn()`.

3. Verify all existing projection tests still pass without modification.

**Commit:** `feat(domain): add in-memory cache to EntryListProjection — cache invalidated on event append`

---

### Step 5 — `EntryListProjection.hydrate()` and `createSnapshot()`
**Estimated time:** 1.5 hours  
**Package:** `packages/domain/`  
**Status:** ⬜ Pending

1. Modify `EntryListProjection` constructor to accept optional `snapshotStore?: ISnapshotStore`

2. Implement `hydrate(): Promise<void>`:
   - If no `snapshotStore`, return early
   - `load('entry-list-projection')` from snapshot store
   - If null or `snapshot.version !== SNAPSHOT_SCHEMA_VERSION`: return (full replay on first `getEntries()`)
   - Else: `eventStore.getAll()` → find events after `snapshot.lastEventId` → apply all events → store in `cachedEntries`
   - (Phase 1: re-applies full event list for correctness — see ADR-016)

3. Implement `createSnapshot(): Promise<ProjectionSnapshot | null>`:
   - `eventStore.getAll()` to get `lastEvent`
   - If no events, return `null`
   - `getEntries('all')` to get current entry state (uses cache)
   - Return `ProjectionSnapshot { version: SNAPSHOT_SCHEMA_VERSION, lastEventId: lastEvent.id, state: entries, savedAt: ISO }`

4. Write tests (use `InMemorySnapshotStore` + `InMemoryEventStore`):

   **`hydrate()` tests:**
   - No snapshot store → `hydrate()` is a no-op (no throws)
   - No snapshot saved → after hydrate, first `getEntries()` does full replay
   - Snapshot with correct version → `cachedEntries` populated, `getAll()` called only once on hydrate
   - Snapshot with stale version (≠ `SNAPSHOT_SCHEMA_VERSION`) → fallback to full replay
   - Snapshot `lastEventId` present in event log → delta events applied
   - Snapshot `lastEventId` NOT in event log → fallback to full replay
   - After hydrate, `getEntries()` returns same result as full replay (correctness check)

   **`createSnapshot()` tests:**
   - No events → returns `null`
   - With events → returns snapshot with correct `lastEventId`, `version`, `state`
   - `state` matches current `getEntries('all')` result
   - `savedAt` is a valid ISO 8601 string

**Commit:** `feat(domain): add EntryListProjection.hydrate() and createSnapshot() with snapshot store support`

---

### Step 6 — `SnapshotManager` (client layer)
**Estimated time:** 1.5 hours  
**Package:** `packages/client/`  
**Status:** ⬜ Pending

1. Create `packages/client/src/snapshot-manager.ts`:
   - Constructor: `(projection, snapshotStore, eventStore, eventsBeforeSnapshot = 50)`
   - `start()`: subscribe to eventStore (count trigger) + add DOM listeners (lifecycle triggers)
   - `stop()`: unsubscribe + remove DOM listeners
   - `saveSnapshot(trigger)`: `projection.createSnapshot()` → `snapshotStore.save()` with try/catch
   - Count trigger: increment counter; reset to 0 after saving
   - Lifecycle: `visibilitychange === 'hidden'` → save; `beforeunload` → save

2. Write tests in `packages/client/src/__tests__/snapshot-manager.test.ts`:
   - Use `InMemorySnapshotStore`, mock `EntryListProjection` with `createSnapshot()` spy
   - Count trigger: 49 events → no save; 50th event → save called
   - Count trigger: resets after save (51st event alone doesn't trigger)
   - Lifecycle trigger: fire `visibilitychange` with `hidden` → save called
   - Lifecycle trigger: `visible` state → no save
   - Lifecycle trigger: `beforeunload` → save called
   - `stop()` removes all listeners (firing events after stop does nothing)
   - `saveSnapshot()` swallows errors gracefully (no throw propagation)
   - `createSnapshot()` returning `null` → `save()` not called

   > **Testing DOM events:** Vitest JSDOM — use `document.dispatchEvent(new Event('visibilitychange'))`
   > and mock `document.visibilityState`.

**Commit:** `feat(client): add SnapshotManager with count-based and lifecycle snapshot triggers`

---

### Step 7 — Wire Into `App.tsx`
**Estimated time:** 45 minutes  
**Package:** `packages/client/`  
**Status:** ⬜ Pending

1. In `App.tsx` (wherever `EntryListProjection` is instantiated):
   - Import `IndexedDBSnapshotStore` from `@squickr/infrastructure`
   - Import `SnapshotManager` from `./snapshot-manager`
   - Instantiate `snapshotStore = new IndexedDBSnapshotStore('squickr-snapshots')`
   - Initialize: `await snapshotStore.initialize()`
   - Pass to projection: `new EntryListProjection(eventStore, snapshotStore)`
   - Call `await projection.hydrate()` before first render
   - Instantiate `snapshotManager = new SnapshotManager(projection, snapshotStore, eventStore)`
   - `snapshotManager.start()` inside `useEffect`
   - Return `() => snapshotManager.stop()` from `useEffect` cleanup

2. Smoke test in `App.test.tsx`:
   - App renders without throwing when `IndexedDBSnapshotStore` is wired
   - Verify `hydrate()` is called during init sequence

3. Manual verification:
   - Add 50+ entries → DevTools → Application → IndexedDB → `squickr-snapshots` → `snapshots` object store should have a record
   - Close and reopen tab — entries render immediately
   - Add a temporary `console.log` in `hydrate()` to confirm delta count on reload

**Commit:** `feat(client): wire IndexedDBSnapshotStore and SnapshotManager into app init`

---

### Step 8 — Export Cleanup + Documentation
**Estimated time:** 20 minutes  
**Status:** ⬜ Pending

1. Verify `packages/domain/src/index.ts` exports `ISnapshotStore`, `ProjectionSnapshot`, `SNAPSHOT_SCHEMA_VERSION`

2. Verify `packages/infrastructure/src/index.ts` exports `IndexedDBSnapshotStore`, `InMemorySnapshotStore`

3. Add versioning warning to `entry.event-applicator.ts` file header:
   > ⚠️ SNAPSHOT VERSIONING: If you change the shape of `Entry[]` returned by `applyEvents()`
   > (add/rename/remove fields), increment `SNAPSHOT_SCHEMA_VERSION` in
   > `packages/domain/src/snapshot-store.ts` to invalidate stale snapshots.

4. Update `docs/roadmap.md` — mark projection snapshots as complete

**Commit:** `docs: add snapshot schema versioning warning to EntryEventApplicator`

---

## Architectural Decisions Made This Session

| Decision | Choice | Rationale |
|---|---|---|
| Snapshot storage | Separate IndexedDB DB (`squickr-snapshots`) | Independent from event log; can clear without affecting events |
| Snapshot state format | `Entry[]` (full projection output) | Directly usable; avoids re-serializing internal Maps |
| Schema versioning | `SNAPSHOT_SCHEMA_VERSION` constant | Version mismatch → graceful fallback to full replay |
| Delta application | Full `applyEvents(allEvents)` in Phase 1 | Correct; CPU cost negligible at current scale |
| Trigger strategy | Count (50 events) + visibilitychange + beforeunload | Reliable across platforms; bounds worst-case delta |
| SnapshotManager location | `packages/client/` | Uses browser APIs; domain is pure TS |
| ISnapshotStore location | `packages/domain/` | Follows IEventStore pattern; pure interface |

---

## Expected Test Count After Session

| Package | Before | Expected After | New Tests |
|---|---|---|---|
| domain | ~700 | ~740 | ~40 (projection hydrate, createSnapshot, cache) |
| infrastructure | ~120 | ~160 | ~40 (InMemorySnapshotStore, IndexedDBSnapshotStore) |
| client | ~1,103 | ~1,125 | ~22 (SnapshotManager, App wiring) |
| **Total** | **~1,800** | **~1,925** | **~125** |

---

## Workflow for This Session

Per `docs/opencode-workflow.md`:

1. **Plan** — Alex plans all items upfront ✅ (done)
2. **User approves plan** (pending)
3. **Execute one step at a time:** Sam implements → Casey reviews → commit
4. Steps are independently committable — each step passes its own tests

---

## Previous Session (v1.2.0 — February 27, 2026)

Three items: collection stats bug fix, recoverable deleted collections, recoverable deleted entries with visual distinction. See `CHANGELOG.md` and `docs/roadmap.md` for details.
