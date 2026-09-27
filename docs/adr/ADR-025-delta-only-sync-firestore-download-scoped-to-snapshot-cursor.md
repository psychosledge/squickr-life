# ADR-025: Delta-Only Sync — Firestore Download Scoped to Snapshot Cursor

**Date**: 2026-04-03
**Status**: Accepted

## Context

`SyncManager.syncNow()` currently downloads the **entire** Firestore event log on every
cold start:

```typescript
const remoteEvents = await this.remoteStore.getAll(); // ALL 1593 events
const eventsToDownload = remoteEvents.filter(e => !localIds.has(e.id));
await this.localStore.appendBatch(eventsToDownload);
```

With 1593 events in Firestore this produces several cascading problems:

1. **Download cost**: Every cold start transfers the full event log over the network,
   even when the local projection has already been restored from a remote snapshot (ADR-017)
   that encodes state through all but the last handful of events.

2. **SnapshotManager storm**: The 1593-event `appendBatch()` notifies the
   `SnapshotManager`'s event counter 1593 times. The `isSaving` guard (introduced as a
   tactical fix) suppresses re-entrant saves, but the guard is needed only because the
   root problem — redundant download — is still present.

3. **Stale projection flash**: Delta events (including deletions and migrations) arrive
   inside the large batch. The projection absorbs the pre-snapshot events silently
   (ADR-018), but any event _after_ the snapshot cursor is genuinely new and triggers a
   cache rebuild. When deletion events are buried near the end of a 1593-event batch,
   "Uncategorized" entries appear briefly and then disappear as the later events are
   applied.

4. **Redundant work**: The ADR-016 / ADR-018 snapshot + absorption machinery exists
   precisely so that the projection can resume from a snapshot without replaying every
   event. The download path undermines this: it populates IndexedDB with events the
   projection has already accounted for in its snapshot state, forcing another full-log
   read when the projection next hydrates.

**Why this is the right time to fix it**: ADR-024 completed the cold-start sequencer.
The system now reliably restores state from a snapshot before `SyncManager` starts. The
missing piece is teaching `SyncManager` to ask Firestore "give me only events after the
snapshot cursor" rather than "give me everything."

**Key insight from existing architecture**: The `ProjectionSnapshot` interface
(ADR-016) already records `lastEventId` — the ID of the last event folded into snapshot
state. The `FirestoreEventStore.getAll()` method already queries by `orderBy('timestamp',
'asc')`. The `DomainEvent` interface already has a `timestamp: string` field (ISO 8601)
on every event. The data needed to scope the query is already present in both Firestore
and the local snapshot.

---

## Decision

### Design Point 1 — `IEventStore` interface: add `getAllAfter()`

Add a new optional method to the `IEventStore` interface in
`packages/domain/src/event-store.ts`:

```typescript
/**
 * Get all events that were appended after the event with the given ID.
 *
 * Implementations use the timestamp of the anchor event as a cursor:
 * return all events whose timestamp is strictly greater than the anchor
 * event's timestamp, ordered ascending.
 *
 * When `lastEventId` is null or the anchor event cannot be found,
 * implementations MUST fall back to returning all events (equivalent to
 * `getAll()`). This preserves correct behaviour on first-ever sync (no
 * snapshot exists) and when the anchor event has been pruned.
 *
 * @param lastEventId - The `id` field of the last known event (i.e.
 *   `ProjectionSnapshot.lastEventId`), or null for a full download.
 * @returns Events after the anchor, in ascending timestamp order.
 */
getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>;
```

The method is added as a **required** member of the interface (not optional). All
three implementations — `FirestoreEventStore`, `IndexedDBEventStore`, and
`InMemoryEventStore` — must be updated simultaneously. Making it required ensures the
type-checker catches any future implementation that omits it. The interface currently has
five methods; adding a sixth remains well within Interface Segregation boundaries because
all callers that need delta fetching will use this method.

**Why not a cursor object instead of a single ID?** The only cursor value that exists
in the current data model is `lastEventId` from `ProjectionSnapshot`. There is no
monotonic sequence number and no server-assigned cursor token. A plain `string | null`
is the simplest contract that satisfies the requirement without over-engineering.

**Why not rename `getAll()` to `getAllAfter(null)`?** `getAll()` is called in over a
dozen places in the test suite and in projection `hydrate()` paths. Renaming it would
require widespread changes for no gain. `getAllAfter(null)` falls back to `getAll()`
semantics, so callers that do not care about the cursor continue to call `getAll()`.

---

### Design Point 2 — `FirestoreEventStore.getAllAfter()`: timestamp cursor query

**The Firestore data model constraint**: Firestore document IDs are UUIDs (the event's
`id` field). Firestore has no native "cursor by document ID" for non-sequential IDs.
A query `where('id', '>', lastEventId)` would be a lexicographic UUID comparison, which
is meaningless for event ordering.

**The available anchor**: Every `DomainEvent` already has a `timestamp: string` field
(ISO 8601, UTC). Firestore already stores this field on every document. The existing
`getAll()` query uses `orderBy('timestamp', 'asc')`. Timestamps are therefore already
indexed and orderable.

**Chosen approach — two-phase lookup**:

1. Fetch the anchor event's timestamp from Firestore by its document ID:
   ```
   getDoc(doc(eventsRef, lastEventId))
   ```
   This is a single-document point read (cheap: 1 Firestore read unit).

2. Query all events with timestamp strictly greater than the anchor:
   ```
   query(eventsRef, where('timestamp', '>', anchorTimestamp), orderBy('timestamp', 'asc'))
   ```

**Fallback cases**:

- `lastEventId` is `null`: skip the lookup, call `getAll()` directly.
- The anchor document does not exist in Firestore (e.g. the event was written by an
  older client that did not upload it, or the Firestore retention window has elapsed):
  fall back to `getAll()`. This is the safe path — it downloads more than strictly
  necessary but never loses data.
- The anchor document fetch throws (network error, permission error): fall back to
  `getAll()`. Same rationale.

**Why not store `savedAt` from the snapshot and query `timestamp > savedAt`?**

`ProjectionSnapshot.savedAt` records when the snapshot was _written_, not when the last
event in it occurred. There can be a gap between the last-event timestamp and the
snapshot write time during which no new events occurred. Using `savedAt` as the cursor
would re-download events that are already baked into the snapshot (events between the
last-event timestamp and `savedAt`). The anchor event's own timestamp is the correct
boundary.

**Why not a monotonic sequence number?**

Adding a server-assigned `seq` field would require a Cloud Function or Firestore
transaction on every event write to maintain the sequence counter atomically. This
fundamentally changes the write path (currently a simple `setDoc`) and introduces
server-side coordination that does not exist today. The timestamp approach requires
zero changes to the write path and zero schema migration for existing 1593 events.

**Timestamp collision risk — addressed post-deployment**: The original design relied
solely on the client-set `timestamp` (ISO 8601) field as the Firestore cursor, which was
susceptible to client clock skew and same-millisecond collisions. This risk has been
resolved by the following measures shipped after initial ADR-025 deployment:

- **`serverReceivedAt` field**: New events written after this deployment carry a
  `serverReceivedAt: serverTimestamp()` field set by Firestore's server-side clock.
  This is immune to client clock skew and guaranteed unique within a Firestore
  write operation.
- **Hybrid cursor in `getAllAfter()`**: `FirestoreEventStore.getAllAfter()` now checks
  whether the anchor event has a `serverReceivedAt` field. If present, it uses
  `serverReceivedAt` as the cursor (`where('serverReceivedAt', '>', anchorServerReceivedAt)`);
  if absent (pre-deployment event), it falls back to the legacy `timestamp` cursor. Old
  events are handled transparently — no migration required.
- **`SNAPSHOT_SCHEMA_VERSION` bumped 9 → 10**: Every device discards its existing
  snapshot on next load and performs a full `getAll()`, ensuring no events are missed
  during the transition from the legacy timestamp cursor to the hybrid cursor.
- **Firestore composite index**: A composite index on `serverReceivedAt ASC` was added
  to `firestore.indexes.json` to support the new cursor query efficiently.

---

### Design Point 3 — `IndexedDBEventStore.getAllAfter()`: in-memory filter

IndexedDB already loads all events from the `events` object store in `getAll()`. The
`timestamp` index exists (created in `onupgradeneeded`) but an IDBKeyRange filter on
timestamp would require knowing the anchor timestamp, which requires a separate
`getById(lastEventId)` call first — the same two-phase pattern as Firestore.

Since IndexedDB reads are local and fast (the full set for a heavy user fits in memory
in well under 10ms), the implementation filters in-memory after `getAll()`:

```typescript
async getAllAfter(lastEventId: string | null): Promise<DomainEvent[]> {
  const all = await this.getAll(); // sorted ascending by timestamp
  if (lastEventId === null) return all;

  const anchorIndex = all.findIndex(e => e.id === lastEventId);
  if (anchorIndex === -1) return all; // anchor not found: full fallback

  return all.slice(anchorIndex + 1);
}
```

This is O(n) but n is bounded by the local event log, which is always smaller than the
Firestore log (because we are not yet downloading the full history). The implementation
is correct, testable, and requires no IndexedDB schema migration.

**Alternative rejected — IDBKeyRange on timestamp index**: Requires looking up the
anchor timestamp first (`getById`), then issuing a range query. More code, same
asymptotic cost for local reads, and introduces a second IndexedDB transaction. The
in-memory filter is preferable.

**Future consideration**: If the local event log grows to tens of thousands of events
(unlikely given the snapshot + delta model), an IDBKeyRange approach could be adopted.
The `getAllAfter` API contract is stable; the implementation can change without affecting
callers.

---

### Design Point 4 — `SyncManager`: cursor passed as a callback

`SyncManager` needs to know the snapshot cursor (`lastEventId`) at the moment
`syncNow()` executes, not at construction time. The snapshot evolves: on the first run
there may be no snapshot; after the first `SnapshotManager` save trigger there will be
one; on subsequent runs the cursor advances.

**Three options evaluated**:

| Option | Description | Assessment |
|---|---|---|
| A | Pass `lastEventId: string \| null` to constructor | Stale: cursor is captured at construction and never updates |
| B | Pass `getSnapshotCursor: () => string \| null` callback | Correct: evaluated lazily at sync time; zero coupling to snapshot internals |
| C | Pass `ISnapshotStore` directly; `SyncManager` loads snapshot | Violates SRP: `SyncManager` should not know how snapshots are stored |

**Decision: Option B — callback**.

```typescript
export class SyncManager {
  constructor(
    private localStore: IEventStore,
    private remoteStore: IEventStore,
    public onSyncStateChange?: (syncing: boolean, error?: string) => void,
    private getSnapshotCursor?: () => string | null,  // NEW (optional)
  ) {}
}
```

The callback is optional and defaults to `undefined`. When `undefined`, `syncNow()`
behaves identically to today — it calls `remoteStore.getAll()`. When provided, it calls
`remoteStore.getAllAfter(this.getSnapshotCursor())`.

**Wiring in `App.tsx`**:

```typescript
const syncManager = new SyncManager(
  localStore,
  remoteStore,
  onSyncStateChange,
  () => entryProjection.getLastSnapshotCursor(),  // lazily evaluated
);
```

`EntryListProjection.getLastSnapshotCursor()` is a new accessor (see Interface Changes
below) that returns the `lastEventId` from the most recently loaded or created snapshot,
or `null` if no snapshot has been applied.

**Why a callback over `ISnapshotStore` (Option C)?** If `SyncManager` held a reference
to `ISnapshotStore`, it would call `snapshotStore.load('entry-list-projection')` on
every `syncNow()` — an async IndexedDB read per sync cycle. The callback is synchronous
and free: `EntryListProjection` already holds the `lastEventId` in memory from
`hydrate()` and `createSnapshot()`. No additional I/O is needed.

**Why optional?** Backward compatibility with existing tests. All existing `SyncManager`
tests construct it with two or three arguments. Making the callback optional means they
continue to pass and exercise the full-download path correctly.

---

### Design Point 5 — First-time sync (no snapshot)

When `getSnapshotCursor()` returns `null` (no snapshot has been saved), `getAllAfter(null)`
falls back to `getAll()`. This is the existing behaviour. No special-case logic is
needed in `SyncManager`.

---

### Design Point 6 — Upload path

The upload path is unchanged:

```typescript
const localEvents = await this.localStore.getAll();
// ... compute newEvents = localEvents not in remoteIds ...
for (const event of newEvents) {
  await this.remoteStore.append(event);
}
```

Local events are still uploaded by comparing the full local log against the full remote
log. The download optimisation does not change this; upload correctness requires
knowing what Firestore already has. At current scale (uploading a handful of local-only
events per sync) this is acceptable. A future ADR could scope the upload similarly if
the local log grows large.

---

### Design Point 7 — Projection correctness after delta-only download

After a delta-only download, `SyncManager` calls `localStore.appendBatch(deltaEvents)`.
The `EntryListProjection` subscriber fires (ADR-018 `appendBatch` path). The subscriber
checks `absorbedEventIds`:

- Events already in the snapshot are in `absorbedEventIds` and are silently absorbed.
- Events between the snapshot and the current Firestore tail (the "delta") are genuinely
  new. They clear absorption mode and trigger a cache rebuild.
- With a recent snapshot the delta is 0–20 events. The rebuild is O(delta), not O(all).

`CollectionListProjection` follows the same pattern via its own `hydrate()` and snapshot
seeding (ADR-024: `collections` field on `ProjectionSnapshot`). The same
`absorbedEventIds` mechanism applies.

No changes to the projection layer are needed for correctness.

---

### Design Point 8 — Local log truncation (deferred)

The local IndexedDB log accumulates every event ever downloaded. With delta-only sync,
the log will no longer receive the pre-snapshot history on subsequent cold starts.
However, the history already in IndexedDB from previous full downloads remains and is
never cleaned up by this ADR.

A future ADR could implement log truncation: after a snapshot is taken, delete local
events older than `snapshot.lastEventId` from IndexedDB (since the snapshot renders
them redundant). This design does not preclude that: `getAllAfter()` already works
correctly when the local log is truncated — events before the anchor simply do not
exist, and `slice(anchorIndex + 1)` returns the correct delta.

This is explicitly out of scope for ADR-025.

---

## Interface Changes

### `IEventStore` (`packages/domain/src/event-store.ts`)

```typescript
/**
 * Get all events that were appended after the event with the given ID.
 * Falls back to getAll() when lastEventId is null or the anchor is not found.
 *
 * @param lastEventId - The id of the last known event, or null for full download.
 * @returns Events after the anchor, ascending by timestamp.
 */
getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>;
```

### `EntryListProjection` (`packages/domain/src/entry.projections.ts`)

```typescript
/**
 * Returns the lastEventId from the most recently hydrated or created snapshot,
 * or null if no snapshot has been applied to this projection instance.
 *
 * Used by SyncManager as a cursor for delta-only Firestore downloads.
 * The value is valid from the moment hydrate() completes and is updated
 * each time createSnapshot() is called.
 */
getLastSnapshotCursor(): string | null;
```

This requires a new private field `lastSnapshotCursor: string | null = null` set in:
- `hydrate()`: after loading the snapshot, `this.lastSnapshotCursor = snapshot?.lastEventId ?? null`
- `createSnapshot()`: after computing the snapshot, `this.lastSnapshotCursor = lastEventId`

### `SyncManager` (`packages/client/src/firebase/SyncManager.ts`)

```typescript
constructor(
  private localStore: IEventStore,
  private remoteStore: IEventStore,
  public onSyncStateChange?: (syncing: boolean, error?: string) => void,
  private getSnapshotCursor?: () => string | null,  // NEW — optional
) {}
```

`syncNow()` download block changes from:

```typescript
const remoteEvents = await Promise.race([this.remoteStore.getAll(), timeoutPromise]);
```

to:

```typescript
const cursor = this.getSnapshotCursor?.() ?? null;
const remoteEvents = await Promise.race([
  this.remoteStore.getAllAfter(cursor),
  timeoutPromise,
]);
```

The upload block is unchanged (still uses `this.localStore.getAll()` for the full
local set to compute what needs uploading).

---

## SyncManager Changes — How the Cursor Is Passed and Used

At construction time in `App.tsx`, the `SyncManager` receives a callback that reads
`entryProjection.getLastSnapshotCursor()` lazily. On each `syncNow()` call:

1. The callback is evaluated: if the projection has never been hydrated with a snapshot
   (first-ever session), it returns `null` and the full download runs.
2. If it returns a non-null cursor, `remoteStore.getAllAfter(cursor)` is called.
3. The result — a small delta — is compared against the local event IDs (from the upload
   path's `localEvents`) and appended via `appendBatch`.

After a `SnapshotManager` save trigger (e.g. 50 events appended), `createSnapshot()` is
called and `lastSnapshotCursor` advances. The next `syncNow()` uses the new cursor
automatically — no coordination needed between `SnapshotManager` and `SyncManager`.

---

## Firestore Query Strategy

The download query in `FirestoreEventStore.getAllAfter(lastEventId)` proceeds as:

**Step 1 — Anchor lookup** (1 read unit):
```
GET users/{userId}/events/{lastEventId}
→ anchorDoc.data().timestamp  (ISO 8601 string)
```

If the document does not exist or the read fails, skip to step 3 (full fallback).

**Step 2 — Delta query** (N read units, where N = number of new events):

For events with a `serverReceivedAt` field (post-deployment):
```
SELECT * FROM users/{userId}/events
WHERE serverReceivedAt > anchorServerReceivedAt
ORDER BY serverReceivedAt ASC
```
A Firestore composite index on `serverReceivedAt ASC` was added to
`firestore.indexes.json` to support this query.

For events without `serverReceivedAt` (pre-deployment, legacy fallback):
```
SELECT * FROM users/{userId}/events
WHERE timestamp > anchorTimestamp
ORDER BY timestamp ASC
```
This reuses the existing composite index implied by `orderBy('timestamp', 'asc')` in
`getAll()`.

**Step 3 — Full fallback**:
If step 1 fails for any reason, call `getAll()` as before. The system degrades
gracefully to the pre-ADR-025 behaviour.

**Firestore billing impact**: On a typical re-open after a few hours, the delta is
0–20 events. Instead of reading 1593 documents, the system reads 1 (anchor lookup) +
0–20 (delta). Cost reduction: ~98% for returning users with a recent snapshot.

---

## Tradeoffs

**What we gain:**
- Cold-start sync cost drops from O(all events) to O(delta) for users with a snapshot.
  For a user with 1593 events and a snapshot taken 2 hours ago, this is 1593 reads → ~5
  reads.
- SnapshotManager is no longer triggered by absorbed events (there are none to absorb).
  The `isSaving` guard remains as belt-and-suspenders but is no longer load-bearing.
- The "Uncategorized appears then disappears" flash is eliminated because the deletion
  event arrives in the first (and only) delta batch, not buried in a 1593-event storm.

**What we give up / risks:**
- The local IndexedDB event log is no longer a complete replica of Firestore. Events
  that pre-date the snapshot cursor are in Firestore but may not be in IndexedDB (on
  devices that first open after ADR-025 is deployed with a mature snapshot). This is
  acceptable: projections rebuild from `snapshot.state + delta events`, not from the
  full local log.
- The upload path still reads the full local log to compute what to upload. On a device
  that has used the app for months, this is still a full IndexedDB scan. This is a known
  limitation and does not block ADR-025; it can be addressed in a future ADR alongside
  log truncation.
- If a user's Firestore snapshot is significantly ahead of their IndexedDB log (e.g.
  they have two devices and device B has events that device A has never seen), the
  anchor lookup on device A may find its `lastEventId` in Firestore and return a correct
  delta. This is the happy path. If device A's cursor pre-dates Firestore's retention
  window (hypothetical — Firestore does not prune by default), the anchor lookup returns
  no document and the full fallback fires. Correctness is preserved.
- Timestamp collision for old (pre-deployment) events: the legacy `timestamp` cursor
  path remains for events that predate `serverReceivedAt`. The risk is negligible (single
  user, single device), and the worst outcome remains correct (duplicate append is a
  no-op at the IndexedDB keyPath level). New events use `serverReceivedAt` and are not
  affected.

---

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Store a monotonic `seq` field on each event and query `where seq > snapshot.lastSeq` | Requires server-side coordination (Cloud Function or transaction) on every event write. Changes the write path fundamentally. Existing 1593 events have no `seq` field — migration is expensive. |
| Use `snapshot.savedAt` as the Firestore timestamp cursor | `savedAt` is the snapshot write time, not the last-event time. Events between the last event and `savedAt` would be re-downloaded unnecessarily. |
| Fetch all remote events, filter client-side | Defeats the purpose. Transfers 1593+ documents over the network on every cold start. |
| Pass `ISnapshotStore` to `SyncManager` and load snapshot in `syncNow()` | Adds an async IndexedDB read per sync cycle. Violates SRP: `SyncManager` should not load snapshots. The callback pattern is simpler, synchronous, and keeps concerns separated. |
| Make `getAllAfter` optional on `IEventStore` | Would allow implementations to silently omit it. TypeScript would not catch the omission. All implementations are updated together, so the required contract is correct. |
| `getAll()` with client-side filter by timestamp after anchor | Same network cost as full download from Firestore (transfers all documents). Acceptable for IndexedDB (local), rejected for Firestore (remote). |
| Firestore `startAfter(anchorDoc)` cursor pagination | `startAfter` requires a `DocumentSnapshot`, not an ID string. We would still need to fetch the anchor document first. `where('timestamp', '>', anchorTimestamp)` achieves the same result with a simpler query. |

---

## Implementation Plan (for Sam)

All steps follow Red-Green-Refactor. No step introduces a breaking change to the
running application.

**Step 1 — `IEventStore.getAllAfter()` (domain package)**

Add `getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>` to
`packages/domain/src/event-store.ts`. This will cause TypeScript compile errors in all
three implementations — leave them failing until steps 2–4.

Tests: none yet (interface only).

**Step 2 — `InMemoryEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/in-memory-event-store.ts` (or wherever the
in-memory store lives). Logic: if `lastEventId` is null, return all events; otherwise
find the anchor index and return everything after it; if anchor not found, return all.

Tests: write first in `packages/infrastructure/src/__tests__/`:
- `getAllAfter(null)` returns all events
- `getAllAfter(id)` where id is the last event returns `[]`
- `getAllAfter(id)` where id is a middle event returns only later events
- `getAllAfter('nonexistent')` returns all events (fallback)

**Step 3 — `IndexedDBEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/indexeddb-event-store.ts`. Logic: call
`this.getAll()`, find anchor by `id`, return `slice(anchorIndex + 1)`. If anchor not
found, return full result.

Tests in `packages/infrastructure/src/__tests__/indexeddb-event-store.test.ts`
(using the existing fake-IDB test setup):
- Same four cases as InMemoryEventStore

**Step 4 — `FirestoreEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/firestore-event-store.ts`. Logic:
1. If `lastEventId` is null, delegate to `getAll()`.
2. `getDoc(doc(eventsRef, lastEventId))`.
3. If doc exists, extract `anchorTimestamp = doc.data().timestamp`.
4. Query `where('timestamp', '>', anchorTimestamp), orderBy('timestamp', 'asc')`.
5. If doc does not exist or any step throws, fall back to `getAll()`.

Tests in `packages/infrastructure/src/__tests__/firestore-event-store.test.ts`
(mocking the Firestore SDK as existing tests do):
- `getAllAfter(null)` calls `getAll()` path (no `getDoc` call)
- `getAllAfter(existingId)` calls `getDoc`, then issues the timestamp-range query
- `getAllAfter(nonexistentId)` falls back to `getAll()` when `getDoc` returns no document
- `getAllAfter(id)` falls back to `getAll()` when `getDoc` throws

**Step 5 — `EntryListProjection.getLastSnapshotCursor()` (domain package)**

Add private field `lastSnapshotCursor: string | null = null` to `EntryListProjection`.
Set it in `hydrate()` after loading the snapshot, and in `createSnapshot()` after
computing the snapshot. Add public accessor `getLastSnapshotCursor(): string | null`.

Tests in `packages/domain/src/entry.projections.test.ts`:
- Returns `null` before `hydrate()` is called
- Returns `null` after `hydrate()` when no snapshot exists
- Returns the `lastEventId` from the snapshot after `hydrate()` with a snapshot
- Returns the new `lastEventId` after `createSnapshot()` is called

**Step 6 — `SyncManager` constructor and `syncNow()` (client package)**

Add optional `getSnapshotCursor?: () => string | null` as the fourth constructor
parameter. In `syncNow()` replace `this.remoteStore.getAll()` with
`this.remoteStore.getAllAfter(this.getSnapshotCursor?.() ?? null)`.

Tests in `packages/client/src/firebase/SyncManager.test.ts`:
- When `getSnapshotCursor` is not provided, `remoteStore.getAllAfter` is called with
  `null` (equivalent to full download — verify via mock)
- When `getSnapshotCursor` returns a cursor string, `remoteStore.getAllAfter` is called
  with that string
- When `getSnapshotCursor` returns `null`, `remoteStore.getAllAfter` is called with
  `null`
- Existing tests continue to pass (no fourth argument provided — backward compatible)

**Step 7 — Wire cursor in `App.tsx` (client package)**

In `App.tsx`, update the `SyncManager` constructor call to pass the cursor callback:

```typescript
const syncManager = new SyncManager(
  localStore,
  remoteStore,
  onSyncStateChange,
  () => entryProjection.getLastSnapshotCursor(),
);
```

Tests in `packages/client/src/App.test.tsx`:
- Verify that the mock `remoteStore.getAllAfter` is called (not `getAll`) when a cursor
  is available
- Verify that on first sync (no snapshot), `getAllAfter(null)` is called and the full
  download proceeds correctly

**Step 8 — Run full test suite and confirm green**

```bash
pnpm test run
```

All existing tests must pass.

---

## Event Model

No new domain events are introduced. The `lastEventId` field already present on
`ProjectionSnapshot` is the cursor; it is merely read from a new location (`SyncManager`
via callback) rather than only from the projection internals.

**Post-deployment addendum**: `SNAPSHOT_SCHEMA_VERSION` was bumped **9 → 10** to force
every device to discard its existing snapshot on next load and perform a full `getAll()`.
This ensures no events are missed during the transition from the legacy `timestamp`
cursor to the hybrid `serverReceivedAt` / `timestamp` cursor. The `ProjectionSnapshot`
shape itself is unchanged; only the schema version constant changed.

---

## Consequences

**Positive:**
- Cold-start Firestore download cost drops from O(all events) to O(delta) for any
  session where the local snapshot is recent. For a user with 1593 events this is a
  ~98% reduction in Firestore reads on every re-open.
- SnapshotManager count trigger no longer fires on absorbed-event batches because the
  absorbed events are never downloaded. The `isSaving` guard remains but is no longer
  needed for correctness.
- "Uncategorized flash" caused by late-arriving deletion events is eliminated: delta
  events arrive in order and are applied correctly.
- No breaking changes to the Firestore data model. Existing 1593 events remain
  queryable. The timestamp field already exists on all documents.
- The design does not preclude future log truncation (ADR deferred). The local event
  log can be pruned behind the snapshot cursor without affecting `getAllAfter` semantics.

**Negative / Risks:**
- The local IndexedDB event log is no longer a complete replica of Firestore on devices
  that open the app for the first time after ADR-025 is deployed and have a mature
  snapshot. This is an intentional design choice consistent with the snapshot model
  (ADR-016: "snapshots are cache, not source of truth").
- Upload path still scans the full local log. On devices with large logs, this is
  unchanged from today. Addressing it requires log truncation (future ADR).
- Timestamp collision for old (pre-deployment) events remains theoretically possible on
  the legacy `timestamp` cursor path, but the risk is negligible and the worst outcome
  is correct (duplicate append is a no-op at the IndexedDB keyPath level). New events
  written after deployment use `serverReceivedAt` (server-generated) and are not
  susceptible to this issue.
- `FirestoreEventStore.getAllAfter()` makes one extra Firestore point-read (the anchor
  lookup) compared to the current full-scan path. The trade-off is 1 extra read for a
  ~1592-read saving.

## SOLID Principles

- **Single Responsibility**: `SyncManager` owns sync orchestration; it does not load
  snapshots. `EntryListProjection` owns projection state; it exposes the cursor via
  accessor. `FirestoreEventStore` owns Firestore queries; it encapsulates the two-phase
  timestamp lookup.
- **Open/Closed**: The delta-only behaviour is additive. `SyncManager` with no callback
  is unchanged. Existing tests require no modification.
- **Liskov Substitution**: `InMemoryEventStore`, `IndexedDBEventStore`, and
  `FirestoreEventStore` all implement `getAllAfter` with the same contract. Any caller
  can swap implementations without changing behaviour.
- **Interface Segregation**: `IEventStore.getAllAfter()` is a natural extension of the
  existing query surface. It does not bloat the interface with unrelated concerns.
- **Dependency Inversion**: `SyncManager` depends on `IEventStore` (abstraction) and
  receives a plain `() => string | null` callback — not a snapshot store or projection
  concrete class. The callback is the thinnest possible coupling between the sync and
  snapshot subsystems.
