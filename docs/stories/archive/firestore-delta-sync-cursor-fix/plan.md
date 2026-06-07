# Story: Fix the Firestore delta-sync cursor to eliminate timestamp collision and clock-skew bugs

## Progress

| Slice | Status | Commit |
|-------|--------|--------|
| Slice 1: Stamp `serverReceivedAt` on every write | done | ff7fedd |
| Slice 2: Hybrid cursor in `getAllAfter` | done | f863893 |
| Slice 3: Snapshot version bump (9 → 10) | done | c71857c |
| Slice 4: Firestore composite index | done | d0afaca |
| Slice 5: Update ADR-025 | done | 9feecf6 |
| Slice 6 (hotfix): Fix hydrate() to use full local replay | done | a940c51 |
| Slice 7 (benchmark): Track getDeletedCollections() as true UI-ready signal | done | a4c73ba |

---

## Slice Plan

### Slice 1: Stamp `serverReceivedAt` on every write

**Scope:**
Modify `FirestoreEventStore.append()` and `appendBatch()` in
`packages/infrastructure/src/firestore-event-store.ts` to merge a
`serverReceivedAt: serverTimestamp()` sentinel into the document payload
before writing.  The field is Firestore-server-generated: the client sends
the sentinel value; Firestore replaces it with the actual server time at
commit.  No changes to domain types, domain handlers, IndexedDB, or the
snapshot structure.

**Acceptance Criteria:**
- [ ] `append()` calls `setDoc` with a payload that includes
  `serverReceivedAt: serverTimestamp()` merged alongside the cleaned event
  fields.
- [ ] `appendBatch()` calls `batch.set()` with a payload that includes
  `serverReceivedAt: serverTimestamp()` for every event in the batch.
- [ ] The `serverTimestamp()` sentinel is imported from `firebase/firestore`
  and is not set to a client-side date value.
- [ ] Existing tests for `append()` and `appendBatch()` continue to pass
  (mocked `serverTimestamp` returns a stable value in tests).
- [ ] New tests assert that the document passed to `setDoc` / `batch.set`
  contains `serverReceivedAt` equal to the mock `serverTimestamp()` return
  value.
- [ ] All tests in `pnpm -r test` pass (red → green).

**Needs Architect:** no — the write path is straightforward; no design
decisions beyond what the story already specifies.

---

### Slice 2: Hybrid cursor in `getAllAfter`

**Scope:**
Update `FirestoreEventStore.getAllAfter(lastEventId)` in
`packages/infrastructure/src/firestore-event-store.ts` to use a hybrid
cursor strategy:

- After fetching the anchor document, check whether `serverReceivedAt` is
  present on it (it will be a Firestore `Timestamp` object, not a string).
- If present: query `WHERE serverReceivedAt > anchor.serverReceivedAt ORDER
  BY serverReceivedAt ASC`.
- If absent (legacy event with no `serverReceivedAt`): fall back to the
  existing `WHERE timestamp > anchor.timestamp ORDER BY timestamp ASC`
  behaviour.
- The existing `FirestoreValidationError` guard on the `timestamp` field
  must only fire when `serverReceivedAt` is absent (i.e. when the legacy
  path is taken).

No changes to `getAll()`, `getById()`, `append()`, `appendBatch()`,
`subscribe()`, or any domain / infrastructure files outside
`firestore-event-store.ts` and its test file.

**Acceptance Criteria:**
- [ ] When the anchor document has `serverReceivedAt` (a Firestore
  `Timestamp`), `getAllAfter` issues `where('serverReceivedAt', '>',
  anchor.serverReceivedAt)` and `orderBy('serverReceivedAt', 'asc')`.
- [ ] When the anchor document has no `serverReceivedAt` field, `getAllAfter`
  falls back to `where('timestamp', '>', anchor.timestamp)` and
  `orderBy('timestamp', 'asc')` — identical to pre-slice behaviour.
- [ ] `FirestoreValidationError` is thrown when the legacy path is taken and
  the `timestamp` field is not a string (regression guard for the existing
  corruption detection).
- [ ] `getAllAfter(null)` still calls `getAll()` unchanged.
- [ ] `getAllAfter(nonexistentId)` still falls back to `getAll()` unchanged.
- [ ] `getAllAfter(id)` still falls back to `getAll()` when `getDoc` throws
  an unexpected error.
- [ ] New tests cover: anchor with `serverReceivedAt` present (happy path),
  anchor without `serverReceivedAt` (legacy fallback), and the
  `FirestoreValidationError` guard still fires on legacy path with a
  corrupt `timestamp`.
- [ ] All tests in `pnpm -r test` pass (red → green).

**Needs Architect:** no — the hybrid-cursor logic and type-handling rules are
fully specified in the story; no open design decisions.

---

### Slice 3: Snapshot version bump (9 → 10)

**Scope:**
Increment `SNAPSHOT_SCHEMA_VERSION` from `9` to `10` in
`packages/domain/src/snapshot-store.ts`.  Update the JSDoc comment on that
constant to record the reason (serverReceivedAt cursor introduced; all
existing snapshots must be discarded so devices perform a full `getAll()` to
catch events that the old timestamp cursor may have missed).  No other
changes.

**Acceptance Criteria:**
- [ ] `SNAPSHOT_SCHEMA_VERSION` equals `10` in `snapshot-store.ts`.
- [ ] The JSDoc comment on `SNAPSHOT_SCHEMA_VERSION` references the
  `serverReceivedAt` hybrid cursor as the reason for the bump.
- [ ] Any existing test that hard-codes or compares against the version
  number is updated to expect `10` (search for `SNAPSHOT_SCHEMA_VERSION`
  and version assertions across the test suite).
- [ ] All tests in `pnpm -r test` pass (red → green).

**Needs Architect:** no — mechanical constant increment; no design decisions.

---

### Slice 4: Firestore composite index for `serverReceivedAt`

**Scope:**
Add a composite index entry to `firestore.indexes.json` so the
`WHERE serverReceivedAt > X ORDER BY serverReceivedAt ASC` query issued by
Slice 2 does not fail in production.  The index covers the
`users/{userId}/events` collection group with `serverReceivedAt` ascending.

**Acceptance Criteria:**
- [ ] `firestore.indexes.json` contains a composite index on the `events`
  collection group with `serverReceivedAt` ascending.
- [ ] The JSON file remains valid (parseable) and the existing
  `fieldOverrides` entry for `fcmTokens` is untouched.
- [ ] The index is scoped to `COLLECTION` query scope (not
  `COLLECTION_GROUP`) since queries target a specific user sub-collection.
- [ ] All tests in `pnpm -r test` pass (no test regressions from this
  config-only change).

**Needs Architect:** no — the index structure is directly specified by the
Firestore query shape added in Slice 2; no design ambiguity.

---

### Slice 5: Update ADR-025 — timestamp collision risk section

**Scope:**
Edit `docs/architecture-decisions.md` in the ADR-025 body to update the two
"timestamp collision" risk paragraphs (at approximately line 3847 and line
4320) and any related "Negative/Risks" or "Rationale" text to reflect that
new events are no longer at risk of timestamp-cursor collisions once
`serverReceivedAt` is stamped server-side.  Record that a `serverReceivedAt`
hybrid cursor is now in production (Slice 2), that the snapshot version was
bumped to force a clean transition (Slice 3), and that a Firestore composite
index was added for the new query (Slice 4).  Existing events written before
this deployment remain on the legacy cursor path.

No code changes in this slice.

**Acceptance Criteria:**
- [ ] The ADR-025 "Timestamp collision risk" paragraph is updated to
  distinguish old events (legacy cursor, negligible collision risk) from new
  events (server-side `serverReceivedAt`, zero collision risk).
- [ ] The "Negative / Risks" section under ADR-025 notes that `serverReceivedAt`
  is present on all events written after deployment.
- [ ] The update records the snapshot version bump (9 → 10) and the reason
  (forced full-sync transition).
- [ ] The update records the composite index addition.
- [ ] No other ADR text is modified.
- [ ] All tests in `pnpm -r test` pass (docs-only change; zero regressions).

**Needs Architect:** no — documentation update to reflect already-approved
and implemented decisions.

---

## UAT Checklist
(Complete after all slices are implemented and committed)

### Write path — `serverReceivedAt` stamped

- [ ] Sign in and create a new task. In the Firebase console (or Firestore
  emulator UI), open the `users/{uid}/events` collection and confirm the
  newly written document has a `serverReceivedAt` field of type Timestamp
  (not a string, not absent).
- [ ] Create a second task in quick succession. Confirm both new documents
  each have their own distinct `serverReceivedAt` Timestamp values.
- [ ] Perform a bulk import or any action that triggers `appendBatch`. Confirm
  all resulting Firestore documents carry `serverReceivedAt`.

### Hybrid cursor — `serverReceivedAt` path

- [ ] With two devices (or two browser profiles) signed in as the same user:
  - On device A, create an event and wait for it to sync to Firestore.
  - On device B (which has a snapshot whose `lastEventId` is the event just
    created), reload the page and confirm device B's delta-sync fetches only
    the events created after the anchor using `serverReceivedAt` (visible in
    the Network tab as a Firestore REST query containing `serverReceivedAt`).
- [ ] Confirm that events appearing on device B are the correct incremental
  events and no events are duplicated in the UI.

### Hybrid cursor — legacy fallback path

- [ ] Identify (or manually create in the emulator) an event document in
  Firestore that has no `serverReceivedAt` field (a legacy event).  Set this
  as the snapshot's `lastEventId`.  Reload the app and confirm it falls back
  to the `timestamp`-based cursor and correctly loads subsequent events
  without errors.

### Snapshot version bump — forced full-sync on upgrade

- [ ] On a device that has a saved snapshot from before this deployment
  (version 9 or lower), reload the app.  Confirm the snapshot is discarded
  (version mismatch) and a full `getAll()` runs (all events re-downloaded and
  projection rebuilt correctly).  The UI should render all existing tasks
  correctly with no missing data.
- [ ] After the full sync completes, confirm a new snapshot is saved with
  `version: 10`.

### Firestore index — no missing index errors in production

- [ ] After deploying `firestore.indexes.json` with `firebase deploy
  --only firestore:indexes`, confirm the index build completes successfully
  in the Firebase console.
- [ ] Trigger a `getAllAfter` call that uses the `serverReceivedAt` path
  (reload a device that has a v10 snapshot with a `serverReceivedAt`-stamped
  anchor event) and confirm no "missing index" error appears in the Firebase
  console logs or client error reporting.

### Regression — existing behaviour preserved

- [ ] Create, complete, and reschedule tasks normally on a single device.
  Confirm the app behaves identically to before (no functional regressions).
- [ ] With no snapshot present (clear IndexedDB), reload the app. Confirm
  `getAll()` runs and all events are restored correctly.
- [ ] Confirm that `getAll()` (no snapshot path) is not broken by the index
  addition or cursor change.
