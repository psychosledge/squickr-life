# ADR-016: Projection Snapshots with Delta Replay

**Date**: 2026-02-28  
**Status**: Accepted

## Context

The application currently performs a full event replay on every `getEntries()` call:

```
getEntries() → IEventStore.getAll() → EntryEventApplicator.applyEvents(allEvents)
```

Each call scans the entire IndexedDB event store and reprocesses every event from
the beginning of time. At current scale (~500 events) this is sub-millisecond and
not a user-facing concern. However:

1. **Learning goal**: Implementing snapshots is a core event sourcing concept to
   internalise while the codebase is manageable.
2. **Future-proofing**: A heavy user accumulating entries daily will reach 5,000+
   events within a year; snapshots prevent linear degradation.
3. **Redundant IndexedDB reads**: Every navigation to a collection view triggers
   a full `getAll()` scan, even when no events have changed since the last read.
4. **ADR-010 future note**: "Event compaction: Snapshot aggregates periodically to
   reduce event log size" — this ADR implements the read-model variant.

**Open design questions resolved:**
- Per-collection vs. full-projection snapshots? → **Full-projection snapshot only**
  (Phase 1). Per-collection adds complexity for marginal gain at current scale.
- Firestore snapshot sync for new-device cold start? → **Future concern** (Phase 2).
  Phase 1 is IndexedDB-local only.

## Decision

Implement **projection snapshots with delta replay** and an **in-memory read cache**:

1. **`ISnapshotStore` interface** in `packages/domain/` — mirrors `IEventStore` pattern
2. **`IndexedDBSnapshotStore`** in `packages/infrastructure/` — persists snapshots to
   a dedicated `squickr-snapshots` IndexedDB database
3. **`InMemorySnapshotStore`** in `packages/infrastructure/` — for test environments
4. **`EntryListProjection.hydrate()`** — startup method that loads snapshot + applies
   delta events, populating an in-memory `cachedEntries` array
5. **`EntryListProjection.createSnapshot()`** — returns a `ProjectionSnapshot` for the
   current state; called by `SnapshotManager`
6. **In-memory cache** in `EntryListProjection` — `getEntries()` serves from cache;
   cache invalidated by event store subscription callback
7. **`SnapshotManager`** in `packages/client/` — coordinates two save triggers:
   - **Count trigger**: every 50 appended events since last snapshot
   - **Lifecycle trigger**: `visibilitychange === 'hidden'` (tab close) + `beforeunload`
8. **`SNAPSHOT_SCHEMA_VERSION`** constant — detects stale snapshots after code
   changes that alter `EntryEventApplicator` output shape

## Rationale

**Why full-projection snapshot (not per-aggregate)?**
Event sourcing snapshots commonly operate at the aggregate level. However, Squickr's
domain aggregates (Task, Note, Event) have no individual identity in the read model —
they're unified into `Entry` objects by `EntryListProjection`. The projection is the
aggregate boundary for reads. Snapshotting the projection output directly is the
correct granularity.

**Why `ISnapshotStore` in domain?**
The domain package defines interface contracts. `ISnapshotStore` is a pure TypeScript
interface with no implementation details. It belongs alongside `IEventStore` in the
domain layer. Concrete implementations (IndexedDB, InMemory) belong in infrastructure.

**Why a separate IndexedDB database (`squickr-snapshots`)?**
Keeping snapshots in a separate database:
- Allows clearing snapshots without touching the event log (safety)
- Independent versioning (snapshot schema can evolve independently of event schema)
- Explicit separation of concerns: events are truth, snapshots are cache

**Why `SnapshotManager` in client?**
`SnapshotManager` uses `document.addEventListener` and `window.addEventListener` —
browser APIs unavailable in the domain package (which has zero external dependencies).
Browser lifecycle management is inherently a delivery-mechanism concern.

**Why not use `beforeunload` alone?**
On mobile browsers, `beforeunload` is unreliable (may not fire). `visibilitychange`
fires reliably across platforms when a tab is hidden or the browser is backgrounded.

**Why 50 events per snapshot?**
Bounds the maximum delta replay to 50 events — well under the threshold where replay
latency becomes perceptible (~500+ events). Configurable via `SnapshotManager`
constructor parameter.

**Why invalidate the cache (set `cachedEntries = null`) rather than applying the new event incrementally?**
The `EntryEventApplicator.applyEvents()` method is a pure function over the full event
log. Applying a single event incrementally would require making `EntryEventApplicator`
stateful and accepting a pre-seeded map — a larger refactor. The cache invalidation +
lazy rebuild pattern (null = "rebuild on next read") is correct, testable, and
consistent with the existing reactive subscription pattern.

**Why Phase 1 doesn't implement true incremental delta application in `EntryEventApplicator`?**
The performance win from snapshots comes primarily from **not scanning IndexedDB on
every `getEntries()` call** (the cache hit path). The CPU cost of `applyEvents()` is
negligible at current scale. True incremental application (feeding a pre-seeded map
to the applicator) is a meaningful architectural change that should be deferred to
when profiling shows it's needed.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Per-collection snapshots | More complex, marginal gain at current scale |
| Firestore snapshot sync (Phase 1) | Over-engineered for current need; adds network layer to startup path |
| `sessionStorage` for snapshot | Limited to single tab; doesn't persist across cold starts |
| `localStorage` for snapshot | Size limit too small for large entry datasets |
| Service Worker cache | Adds significant complexity; not warranted at current scale |

## Consequences

**Positive:**
- Eliminates redundant IndexedDB full-scans on every `getEntries()` call
- Cold-start replay bounded to O(delta) not O(all events)
- Pattern extensible to `CollectionListProjection` (same `ISnapshotStore` key mechanism)
- Clean Architecture preserved: domain interface, infrastructure implementation, client coordination
- Graceful degradation: missing or stale snapshot → full replay (no data loss risk)
- Learning exercise completed: demonstrates snapshot, delta replay, schema versioning

**Negative / Risks:**
- `SNAPSHOT_SCHEMA_VERSION` must be manually incremented when `EntryEventApplicator`
  output shape changes — risk of forgotten increment leaving users on stale snapshots
  - *Mitigation*: Warning comment in `entry.event-applicator.ts` file header
- Snapshot save on `visibilitychange` is async — tab may close before write completes
  - *Mitigation*: `visibilitychange` typically has ~0.5–1s before actual unload; IndexedDB
    writes are fast; count trigger (every 50 events) is the reliable path
- `beforeunload` may not complete on mobile browsers
  - *Mitigation*: `visibilitychange` is the primary mobile trigger; `beforeunload` is belt-and-suspenders
- Adds `ISnapshotStore` as optional constructor argument to `EntryListProjection`
  - *Mitigation*: Optional parameter with `?`; existing tests unaffected

**Testing Impact:**
- All existing ~1,800 tests continue to pass (no breaking changes to existing interfaces)
- New tests: ~125 covering `IndexedDBSnapshotStore`, `InMemorySnapshotStore`,
  `EntryListProjection.hydrate()`, `EntryListProjection.createSnapshot()`, `SnapshotManager` triggers

## SOLID Principles

**Single Responsibility:**
- `ISnapshotStore` / `IndexedDBSnapshotStore` — snapshot persistence only
- `EntryListProjection` — read model; snapshot-aware hydration is a natural extension of its existing role
- `SnapshotManager` — trigger coordination only (doesn't persist, doesn't project)
- `EntryEventApplicator` — event application only (unchanged)

**Open/Closed:**
- `ISnapshotStore` allows new implementations (Firestore, OPFS) without modifying `EntryListProjection`
- Snapshot key mechanism allows snapshotting additional projections without modifying existing code

**Liskov Substitution:**
- `IndexedDBSnapshotStore` and `InMemorySnapshotStore` are fully interchangeable via `ISnapshotStore`

**Interface Segregation:**
- `ISnapshotStore` is minimal: `save`, `load`, `clear` — no bloat

**Dependency Inversion:**
- `EntryListProjection` depends on `ISnapshotStore` (domain abstraction), not `IndexedDBSnapshotStore`
- `SnapshotManager` depends on `EntryListProjection` and `ISnapshotStore` (abstractions)

## Files to Create / Modify

**Create:**
- `packages/domain/src/snapshot-store.ts` — `ISnapshotStore`, `ProjectionSnapshot`, `SNAPSHOT_SCHEMA_VERSION`
- `packages/infrastructure/src/indexeddb-snapshot-store.ts` — `IndexedDBSnapshotStore`
- `packages/infrastructure/src/in-memory-snapshot-store.ts` — `InMemorySnapshotStore`
- `packages/client/src/snapshot-manager.ts` — `SnapshotManager`

**Modify:**
- `packages/domain/src/entry.projections.ts` — add `hydrate()`, `createSnapshot()`, cache
- `packages/domain/src/index.ts` — export new snapshot types
- `packages/infrastructure/src/index.ts` — export new snapshot stores
- `packages/client/src/App.tsx` — wire `IndexedDBSnapshotStore` + `SnapshotManager`

## Future Enhancements

- **Phase 2**: True incremental delta application in `EntryEventApplicator`
  (accept pre-seeded entry map, apply delta events only)
- **Phase 3**: `FirestoreSnapshotStore` — sync snapshot to Firestore for new-device
  cold start (avoid full event log download on first open) → **Implemented in ADR-017**
- **Phase 4**: Snapshot `CollectionListProjection` and `UserPreferencesProjection`
