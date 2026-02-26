# Current Session Plan
**Date:** February 25, 2026  
**Status:** ✅ Complete — shipped as v1.1.0  
**Version bumped:** v1.0.3 → v1.1.0

---

## Next Session

**Topic:** Projection snapshots (learning exercise)  
**Start with:** Alex planning as usual  
**Carry-over UAT:** Item 6 offline test — load app, block Firestore in DevTools (not full offline), hard-reload, verify 15s timeout overlay appears

---

## Session Goal

Six items: five deferred post-v1.0.0 refactors + one new UX feature (last-hop goto links). Full architectural plan produced and approved by user. Snapshots deferred to roadmap.

## If Interrupted

Resume here. The plan is fully approved. Pick up at the first incomplete item in the sequence below. Each item follows: Sam implements → Casey reviews → OpenCode commits. UAT at end of session.

---

## Approved Implementation Sequence

### Item 1 — Error Toast Tests in `CollectionDetailView` ✅
**Status:** Pending  
**Type:** Tests only (no production code changes expected)  
**Scope:** Add `describe('error handling')` block to `CollectionDetailView.test.tsx`  
**Tests to add:**
- Load failure shows `ErrorToast` with the error message
- Bulk migration failure shows `ErrorToast`
- Dismiss clears the toast

**Files:** `packages/client/src/views/CollectionDetailView.test.tsx`  
**Tutorial impact:** None

---

### Item 2 — `parentTaskId` → `parentEntryId` Migration ✅
**Status:** Pending  
**Type:** Refactor (TypeScript-guided sweep)  
**Key constraint:** Event payloads (`TaskCreated.payload.parentTaskId`, `SubTaskCreated.payload.parentTaskId`) are **immutable — do not rename them**. The projection already maps them to `parentEntryId` at lines 724–725 of `entry.projections.ts`. Only the **projected `Task` entity field** and call sites are being removed.

**Phase A:** Remove `readonly parentTaskId?: string` from `Task` interface in `task.types.ts`. Let TypeScript identify all error sites.  
**Phase B:** Fix domain layer errors (`entry.projections.ts`, `sub-task.handlers.ts`, parent task handlers).  
**Phase C:** Fix client layer errors (all `.tsx` files).  
**Phase D:** Update tests — entity-level assertions `task.parentTaskId` → `task.parentEntryId`. Event payload assertions stay as-is.

**Files:** `task.types.ts`, `entry.projections.ts`, `sub-task.handlers.ts`, `complete-parent-task.handler.ts`, `delete-parent-task.handler.ts`, `move-parent-task.handler.ts`, `CollectionDetailView.tsx`, `EntryList.tsx`, plus any other TypeScript error sites  
**Tutorial impact:** None

---

### Item 3 — Last-Hop Ghost "Goto Collection" Links ✅
**Status:** Pending  
**Type:** New UX behaviour (user-requested)  
**Files:** `collectionNavigation.ts`, `collectionNavigation.test.ts`

**Current behaviour:** All `collectionHistory` entries with `removedAt` are shown as grey ghost goto links.  
**New behaviour:** Only the single most-recent predecessor ("last hop") is shown as a ghost link.

**Confirmed algorithm:**
```
given: currentCollectionId = C
let currentHistoryEntry = collectionHistory.find(h => h.collectionId === C && !h.removedAt)
let arrivedAtCurrentAt = currentHistoryEntry?.addedAt ?? entry.createdAt

// All removed-from collections before the entry arrived at C
let candidates = collectionHistory.filter(h =>
  h.removedAt !== undefined &&
  h.collectionId !== C &&
  h.removedAt <= arrivedAtCurrentAt
)

// The most recent one is the "last hop"
let lastHop = candidates.sort(by removedAt desc)[0]
```

- No predecessor → zero ghost links (entry was created in current collection)
- Active links: all `entry.collections` excluding current collection — always shown, all of them
- Legacy `migratedFrom`/`migratedFromCollectionId` fallback: unchanged

**Mental model confirmed by user:**
- Created A → moved B → moved C → moved D (active)
- Viewing D: active none (D is current), ghost = C
- Viewing C: active = D, ghost = B
- Viewing B: active = D, ghost = A
- Viewing A: active = D, ghost = none

**Tutorial impact:** None

---

### Item 4 — SRP Split of `entry.projections.ts` ✅
**Status:** Pending  
**Type:** Pure refactor (no behaviour change, no public API change)

**Split:**
- `entry.projections.ts` → keeps all public query methods (~350 lines after split)
- `entry.event-applicator.ts` → new file, contains `EntryEventApplicator` class: `applyEvents()`, `applyTaskEvent()`, `applyNoteEvent()`, `applyEventEvent()`, `sanitizeMigrationPointers()`, `filterEntries()`, all type guards (~700 lines)

**Sub-task methods stay on `EntryListProjection`** — they all delegate to `getTasks()`/`getTaskById()` and moving them would add boilerplate with no benefit.

**`EntryListProjection` uses `EntryEventApplicator` internally** (private field, instantiated in constructor). No `App.tsx` wiring changes. No public API changes. All existing tests pass without modification.

**Files:**
- `packages/domain/src/entry.projections.ts` (shrinks)
- `packages/domain/src/entry.event-applicator.ts` (new)
- `packages/domain/src/index.ts` (export `EntryEventApplicator` if needed for testing)

**Tutorial impact:** None

---

### Item 5 — Multi-Collection Pattern for Notes and Events ✅
**Status:** Pending  
**Type:** New feature (feature parity with Tasks)  
**Architectural decision:** Extract `BaseEntry` interface (Option C, approved by user)

**`BaseEntry` interface (to add to `task.types.ts`):**
```typescript
interface BaseEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly order?: string;
  readonly collectionId?: string;
  readonly collections: string[];
  readonly collectionHistory?: CollectionHistoryEntry[];
  readonly userId?: string;
  readonly migratedTo?: string;
  readonly migratedFrom?: string;
  readonly migratedToCollectionId?: string;
  readonly migratedFromCollectionId?: string;
}
// Task, Note, Event all extend BaseEntry
```

**New domain events needed:**
- `NoteAddedToCollection`, `NoteRemovedFromCollection`
- `EventAddedToCollection`, `EventRemovedFromCollection`

**New handlers needed:**
- `packages/domain/src/note-collection-management.handlers.ts` (`AddNoteToCollectionHandler`, `RemoveNoteFromCollectionHandler`, `MoveNoteToCollectionHandler`)
- `packages/domain/src/event-collection-management.handlers.ts` (`AddEventToCollectionHandler`, `RemoveEventToCollectionHandler`, `MoveEventToCollectionHandler`)

**Projection changes (`entry.projections.ts` / `entry.event-applicator.ts` after Item 4):**
- `applyNoteEvent` / `applyEventEvent`: initialize `collections[]` and `collectionHistory` on `NoteCreated` / `EventCreated`
- Handle the 4 new collection events for notes and events
- `getEntriesForCollectionView`: remove `entry.type === 'task'` guard — use `entry.collections.includes(collectionId)` for all types
- Remove `.filter(entry => entry.type === 'task')` ghost entries guard

**Navigation changes:**
- `collectionNavigation.ts`: remove `entry.type === 'task'` guard at line 28 (Notes/Events now have `collections[]`)
- `buildEntriesByCollectionMap.ts`: update type guard at line 25

**Bulk migrate handler:**
- `bulk-migrate-entries.handler.ts`: update `case 'note'` and `case 'event'` branches to use `NoteRemovedFromCollection` + `NoteAddedToCollection` (ID-preserving, like Tasks) instead of creating new IDs

**Wiring:** `App.tsx` — wire new handlers

**Tutorial impact:** None

---

### Item 6 — Replay Loading State + Firestore Timeout Guard ✅
**Status:** Pending  
**Type:** New feature (UX + reliability)  
**UI choice:** Full-screen overlay (Option A, approved by user)

**The gap:** `SyncManager.start()` is fire-and-forget in `App.tsx`. The existing `isLoading` spinner clears before Firestore sync completes. On a new device with 900+ events, the app appears empty while events download. The `onSyncStateChange` callback already exists on `SyncManager` but is not wired up.

**Additional gap fixed as side effect:** Tutorial auto-triggers on `collections.length === 0`, which is briefly true on a new device while sync is in progress. Loading gate fixes this.

**Implementation plan:**
1. Add `hasCompletedInitialSync: boolean` to `SyncManager`; set to `true` after first `syncNow()` completes (success **or** failure)
2. Wire `onSyncStateChange` in `App.tsx` → `isSyncing` state + `syncError` flag
3. **Timeout safeguard in `syncNow()`:** wrap Firestore `getAll()` in `Promise.race()` against a 15-second timeout. On timeout, throw — the existing `finally` block handles clearing the loading state
4. Derive `isAppReady = !isLoading && (!isSyncing || hasCompletedInitialSync)`
5. Full-screen overlay while `!isAppReady`, with two states:
   - Default: "Syncing your journal..." spinner
   - On timeout/error: "Couldn't reach the server — showing local data" + dismiss button
6. Gate `startTutorial()` auto-trigger in `CollectionIndexView` behind `isAppReady`

**Files:**
- `packages/infrastructure/src/sync-manager.ts` (add `hasCompletedInitialSync`, timeout in `syncNow()`)
- `packages/client/src/App.tsx` (wire `onSyncStateChange`, derive `isAppReady`)
- `packages/client/src/views/CollectionIndexView.tsx` (gate tutorial trigger)
- New or updated loading overlay component

**Tutorial impact:** Bug fix — tutorial no longer fires prematurely on new device

---

## Deferred Item — Snapshots

**Incremental projection snapshots** — deferred, stays on roadmap as a learning exercise.

**Planned approach (for future session):**
- `ISnapshotStore` interface in infrastructure layer (IndexedDB implementation)
- `ProjectionSnapshot` type: full serialized projection state at event N
- Delta replay on startup: load snapshot → replay only events after `snapshot.takenAtEventId`
- Snapshot taken silently on `visibilitychange → hidden` and after every 50 new events
- ADR required before implementing (format versioning, invalidation, Firestore interaction)

**Open design questions for that session:**
- Per-collection snapshots vs. full-projection snapshots?
- Should snapshots sync to Firestore (solves new-device cold start entirely)?
- Snapshot format versioning/migration story?

**Revisit when:** Replay time on main device exceeds ~500ms, or event count crosses ~5,000.

---

## Architectural Decisions Made This Session

| Decision | Choice | Rationale |
|---|---|---|
| Notes/Events base type | `BaseEntry` interface (Option C) | Eliminates `entry.type === 'task'` guards without rewriting events |
| SRP split approach | New `EntryEventApplicator` class (delegation) | Lower blast radius than extracting shared base; no `App.tsx` wiring changes |
| Sub-task methods | Stay on `EntryListProjection` | All delegate to `getTasks()`/`getTaskById()`; moving them adds boilerplate |
| Loading overlay UI | Full-screen (Option A) | Simpler; new devices have no local data to show anyway |
| Firestore timeout | 15-second `Promise.race()` | Guards against silent hangs on captive portals / flaky networks |
| Snapshots | Deferred | No perf problem today; right solution needs ADR |

---

## Workflow for This Session

Per `docs/opencode-workflow.md` (updated this session):

1. **Plan** — Alex plans all items upfront ✅ (done)
2. **User approves plan** ✅ (done)
3. **Execute one item at a time:** Sam implements → Casey reviews → OpenCode commits
4. **UAT at end of session** (unless user requests earlier)

Any agent may ask clarifying questions at any point.
