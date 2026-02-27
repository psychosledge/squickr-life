# Current Session Plan
**Date:** February 26, 2026  
**Status:** 🟡 In Progress — plan approved, not yet started  
**Version:** v1.1.0 → v1.2.0 (planned)

---

## Session Goal

Three items from user testing feedback: one bug fix (collection stats) + two recoverable-delete features (collections and entries). Full architectural plan produced and approved by user.

## If Interrupted

Resume here. The plan is fully approved. Pick up at the first incomplete item in the sequence below. Each item follows: Sam implements → Casey reviews → OpenCode commits. UAT at end of session.

---

## Approved Implementation Sequence

### Item 1 — Bug: Collection Stats Counting Moved Tasks as Active
**Status:** Pending  
**Type:** Bug fix (domain only, no new events)  
**Complexity:** 🟢 Low

**Root cause:** `getEntryCountsByCollection()`, `getActiveTaskCountsByCollection()`, and `getEntryStatsByCollection()` in `entry.projections.ts` bucket entries by `entry.collectionId` (a legacy field never updated when tasks are moved). They must use `entry.collections[]` as the source of truth, with `[entry.collectionId ?? null]` as the legacy fallback — the same pattern already used correctly by `buildEntriesByCollectionMap.ts`.

**Fix:** In each of the 3 methods, replace:
```typescript
const collectionId = entry.collectionId ?? null;
counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
```
With a loop over:
```typescript
const collectionIds = entry.collections.length > 0
  ? entry.collections
  : [entry.collectionId ?? null];
for (const collectionId of collectionIds) { ... }
```

Also add `if (entry.deletedAt) continue;` guard in each method (Item 3 dependency — implement both together or add the guard when Item 3 lands).

**Files:**
- `packages/domain/src/entry.projections.ts`

**Tutorial impact:** None

---

### Item 2 — Recoverable Deleted Collections
**Status:** Pending  
**Type:** New feature  
**Complexity:** 🟡 Medium  
**ADR:** ADR-016 (to be created by Sam)

**Domain plan:**
- `CollectionDeleted` is already a soft delete (sets `deletedAt`). Infrastructure is mostly ready.
- New event: `CollectionRestored` (payload: `collectionId`, `restoredAt`)
- New command: `RestoreCollectionCommand`
- New handler: `RestoreCollectionHandler` (validates collection is deleted; idempotent if already active)
- New projection methods: `getDeletedCollections()` (sorted by `deletedAt` desc), `getCollectionByIdIncludingDeleted()`
- Refactor `applyEvents()` in `CollectionListProjection` to use a new private `buildCollectionMap()` helper so both `getCollections()` (filters deleted) and `getDeletedCollections()` (returns deleted) can share the same event-application logic

**UX decisions (approved):**
- **Sidebar UI (A1):** Collapsed accordion row at the bottom of the sidebar: `▸ Deleted (3)`. Starts collapsed every session. Each deleted collection shown with a Restore button.
- **After delete (B1):** Collection immediately disappears from the active list. No undo toast — the existing `DeleteCollectionModal` confirmation is sufficient.
- **Entries:** Remain accessible in their other active collections; the deleted collection simply disappears as a nav link. If an entry was only in the deleted collection, it is effectively hidden until restored.
- **Permanent delete:** Not supported — recoverable forever.

**`DeleteCollectionModal.tsx` copy update:**
- Remove text implying entries are deleted
- Add: "You can restore this collection from the Deleted section in your collections list."

**`HierarchicalCollectionList.tsx` changes:**
- New props: `deletedCollections?: Collection[]`, `onRestoreCollection?: (collectionId: string) => void`
- New local state: `isDeletedSectionExpanded` (boolean, starts `false`, not persisted)
- New JSX section below the date hierarchy: accordion header (`▸ Deleted (N)`) + content (list of deleted collection names, each with a Restore button)

**Parent wiring** (wherever `HierarchicalCollectionList` is rendered):
- Load `getDeletedCollections()` alongside `getCollections()`
- Wire `onRestoreCollection` to call `restoreCollectionHandler.handle({ collectionId })`

**Files:**
- `packages/domain/src/collection.types.ts`
- `packages/domain/src/collection.projections.ts`
- `packages/domain/src/collection.handlers.ts`
- `packages/domain/src/index.ts`
- `packages/client/src/context/AppContext.tsx`
- `packages/client/src/components/DeleteCollectionModal.tsx`
- `packages/client/src/components/HierarchicalCollectionList.tsx`
- Parent view(s) that render `HierarchicalCollectionList` (likely `CollectionIndexView.tsx` or sidebar layout)

**Tutorial impact:** None

---

### Item 3 — Recoverable Deleted Entries with Visual Distinction
**Status:** Pending  
**Type:** New feature  
**Complexity:** 🔴 High  
**ADR:** ADR-017 (to be created by Sam)

**Core design:**
- Existing delete events (`TaskDeleted`, `NoteDeleted`, `EventDeleted`) shift from hard-delete to **soft-delete at the projection level** — entries gain `deletedAt` on `BaseEntry` and stay in the map
- New restore events: `TaskRestored`, `NoteRestored`, `EventRestored`
- New restore commands: `RestoreTaskCommand`, `RestoreNoteCommand`, `RestoreEventCommand`
- New restore handlers: `RestoreTaskHandler`, `RestoreNoteHandler`, `RestoreEventHandler`

**`BaseEntry` change:**
```typescript
readonly deletedAt?: string; // ISO 8601 — set on soft-delete; undefined = active
```

**Multi-collection delete semantics (Q3.4):**
- "Delete" in a collection where the entry also belongs to other active collections → emit `TaskRemovedFromCollection` only (entry survives elsewhere). No `TaskDeleted` event.
- "Delete" in the last/only collection → emit `TaskDeleted` (soft-delete the entity).
- `DeleteTaskCommand` gains optional `currentCollectionId?: string` to drive this logic in the handler.
- Same pattern for `DeleteNoteCommand` and `DeleteEventCommand`.

**Sub-task cascade (Q3.5):**
- Parent deleted → all sub-tasks also soft-deleted (cascade within `DeleteParentTaskHandler` / `DeleteTaskHandler`)
- Parent restored → all sub-tasks that were co-deleted (within 1s window) also restored (cascade within `RestoreTaskHandler`)

**Show/hide behaviour (Q3.2/Q3.3):**
- Deleted entries follow the existing `CompletedTaskBehavior` setting:
  - `keep-in-place` → shown inline with deleted styling
  - `move-to-bottom` → shown below the separator alongside completed entries
  - `collapse` → hidden in the existing collapsed section (label updates to "Completed & Deleted" when both are present)
- No new preference needed — reuse the existing setting.

**Visual distinction:**
- **Completed tasks:** retain existing styling (no strikethrough change — confirmed intentional per spec)
- **Deleted entries (all types):** greyed out + strikethrough + reduced opacity — visually distinct from completed

**Restore action:**
- Appears in the existing entry actions menu (`EntryActionsMenu`)
- When `entry.deletedAt` is set: show "Restore" button instead of "Delete"
- Checkbox and edit interactions disabled for deleted entries

**Stats:**
- All stats methods (`getEntryCountsByCollection`, `getActiveTaskCountsByCollection`, `getEntryStatsByCollection`, `collectionStatsFormatter`) exclude entries with `deletedAt`

**`getEntriesForCollectionView()` update:**
- Adds `renderAsDeleted?: boolean` flag alongside existing `renderAsGhost`
- Deleted entries scoped to the collection are included in the result with `renderAsDeleted: true`

**`applyEvents()` in `EntryEventApplicator`:**
- Gains `includeDeleted = false` parameter (default preserves all existing callers)
- When `false`: filters out entries with `deletedAt` from the returned array (default behaviour — no breaking changes)

**Files:**
- `packages/domain/src/task.types.ts`
- `packages/domain/src/entry.event-applicator.ts`
- `packages/domain/src/entry.projections.ts`
- `packages/domain/src/task.handlers.ts`
- `packages/domain/src/note.handlers.ts`
- `packages/domain/src/event.handlers.ts`
- `packages/domain/src/index.ts`
- `packages/client/src/context/AppContext.tsx`
- `packages/client/src/hooks/useEntryOperations.ts`
- `packages/client/src/components/EntryActionsMenu.tsx`
- `packages/client/src/components/TaskEntryItem.tsx`
- `packages/client/src/components/NoteEntryItem.tsx`
- `packages/client/src/components/EventEntryItem.tsx`
- `packages/client/src/views/CollectionDetailView.tsx`
- `packages/client/src/utils/collectionStatsFormatter.ts`

**Tutorial impact:** None

---

## Architectural Decisions Made This Session

| Decision | Choice | Rationale |
|---|---|---|
| Soft-delete approach for entries | Reinterpret existing delete events at projection level | Event payloads are immutable; `deletedAt` already exists on `TaskDeleted.payload` |
| Restore granularity (Q3.4) | Delete from one collection = `RemovedFromCollection` if entry is multi-collection | Preserves entry in other collections; avoids data loss |
| Sub-task cascade (Q3.5) | Parent delete/restore cascades to sub-tasks | Within 1s co-deletion window for restore cascade |
| Show/hide for deleted (Q3.2/Q3.3) | Reuse `CompletedTaskBehavior` setting | No new preference needed now; can split out later |
| Visual distinction | Completed = current styling; Deleted = strikethrough + reduced opacity | User-specified: completed tasks lose strikethrough is NOT a change — deleted get strikethrough |
| Deleted collections UI (Q2.1) | A1 — collapsed accordion at bottom of sidebar | Consistent with existing year/month accordion; zero new modals; best discoverability |
| Post-delete behaviour (Q2.3) | B1 — immediate removal from active list | Confirmation modal already serves as the "are you sure" step |
| Permanent delete | None — recoverable forever (both collections and entries) | User decision |
| Stats bug fix | Use `collections[]` not `collectionId` | Mirrors already-correct `buildEntriesByCollectionMap.ts` |

---

## Workflow for This Session

Per `docs/opencode-workflow.md`:

1. **Plan** — Alex plans all items upfront ✅ (done)
2. **User approves plan** ✅ (done)
3. **Execute one item at a time:** Sam implements → Casey reviews → OpenCode commits
4. **UAT at end of session** (unless user requests earlier)

Any agent may ask clarifying questions at any point.

---

## Previous Session (v1.1.0 — February 25, 2026)

Six items shipped: error toast tests, `parentTaskId` → `parentEntryId` rename, last-hop ghost links, SRP split (`EntryEventApplicator`), multi-collection for notes/events, `isAppReady` sync guard. See `CHANGELOG.md` and `docs/roadmap.md` for details.
