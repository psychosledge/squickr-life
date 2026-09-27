# ADR-018: Snapshot-Aware Background Sync Absorption

**Date**: 2026-02-28  
**Status**: Accepted

## Context

After ADR-017, the cold-start path correctly served entries from the hydrated snapshot
and skipped the sync overlay. However, `SyncManager.syncNow()` then downloaded the full
event log (~945 events) in the background. Two compounding issues caused visible churn:

**Issue 1 — `SyncManager` used `append()` in a loop:**
```typescript
// Before ADR-018
for (const event of eventsToDownload) {
  await this.localStore.append(event); // fires subscriber notification 945 times
}
```
Each `append()` call notified all `IEventStore` subscribers. `appendBatch()` already
existed (ADR-013) for exactly this scenario but was not used in the download path.

**Issue 2 — `EntryListProjection` subscriber ignored the event parameter:**
The constructor subscriber always nulled `cachedEntries` and called `notifySubscribers()`
on every event notification, even for events already baked into the hydrated snapshot.
The `IEventStore.subscribe()` callback receives a `DomainEvent` but it was ignored.

**Combined effect:** 945 subscriber notifications → 945 cache invalidations → 945
React re-renders → collections visually flickering ~945 times during background sync.

## Decision

**Fix 1 — `SyncManager.syncNow()` uses `appendBatch()`:**
```typescript
// After ADR-018
if (eventsToDownload.length > 0) {
  await this.localStore.appendBatch(eventsToDownload);
  // Single subscriber notification with the last event as sentinel
}
```
Reduces 945 notifications to 1, regardless of download size.

**Fix 2 — `EntryListProjection` absorbs pre-snapshot events silently:**
```typescript
// After ADR-018 (constructor subscriber)
this.eventStore.subscribe((event: DomainEvent) => {
  if (this.absorbedEventIds?.has(event.id)) {
    this.absorbedEventIds.delete(event.id); // drain for GC
    return; // silently absorbed — no cache invalidation, no re-render
  }
  this.absorbedEventIds = null; // first genuinely new event clears absorption mode
  this.cachedEntries = null;
  this.notifySubscribers();
});
```

`hydrate()` populates `absorbedEventIds` with all event IDs present at hydration time
(both snapshot events and delta events). The first genuinely new event — one whose ID
is not in the set — clears absorption mode and resumes normal reactive behaviour.

**Why all event IDs (not just `lastEventId`)?**
`appendBatch` notifies with the last event as sentinel — so only the last event ID is
checked in the `appendBatch` path. However, `append()` (called one-by-one) could present
any event ID. Including all IDs in the set protects against any call path, current or
future. The set is drained as events are absorbed, so GC cost is equivalent.

**Why delta event IDs are included:**
`SyncManager` may re-deliver delta events on a subsequent `syncNow()` pass if the
batch download window overlaps with what `hydrate()` already applied (e.g. a retry).
Including delta IDs ensures those re-deliveries are silently absorbed.

## Rationale

**Why `appendBatch` over `append` in a loop?**
`appendBatch` already existed with the correct semantics (single notification after
atomic batch write). The loop was an oversight — the download path pre-dated `appendBatch`.

**Why absorption in the projection, not in SyncManager?**
The projection is the correct location for this logic: it has the snapshot state
and knows which events are already reflected in its cache. SyncManager should not need
to know about projection internals. The `absorbedEventIds` set is an implementation
detail of `EntryListProjection.hydrate()`.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Debounce subscriber notifications | Hides the root cause; adds latency to genuine updates |
| SyncManager checks local store before append | Requires N individual lookups instead of one batch check |
| Rebuild cache once after appendBatch completes | Would require a public `rebuildCache()` API on the projection — leaks internals |

## Consequences

**Positive:**
- Background sync of 945 events produces at most 1 subscriber notification (not 945)
- Events already baked into the snapshot produce 0 re-renders
- First genuinely new event triggers exactly 1 re-render as expected
- Fully backward-compatible: projections with no snapshot behave identically to before

**Negative / Risks:**
- `absorbedEventIds` set holds N UUID strings in memory until drained (negligible: ~50KB
  for 1,000 events; drained lazily as events arrive)
- `SNAPSHOT_SCHEMA_VERSION` bump is needed if `ProjectionSnapshot.state` shape changes —
  same risk as ADR-016, same mitigation (warning comment in `entry.event-applicator.ts`)

**Testing Impact:**
- `@squickr/client`: +1 `SyncManager` test (download path uses `appendBatch`)
- `@squickr/domain`: +6 `EntryListProjection` absorption tests (4 single-event, 2
  `appendBatch`-path covering all-pre-snapshot and mixed batches)

## Files Modified

- `packages/client/src/firebase/SyncManager.ts` — download loop → `appendBatch()`
- `packages/client/src/firebase/SyncManager.test.ts` — `appendBatch` mock, new test
- `packages/domain/src/entry.projections.ts` — `absorbedEventIds` field, updated
  constructor subscriber, `hydrate()` populates set, `resolveCache()` clears set,
  comments explaining set-size rationale and delta-ID inclusion
- `packages/domain/src/entry.projections.test.ts` — 6 new absorption tests
- `packages/domain/src/logger.ts` — created: minimal `{ warn }` wrapper for domain pkg
