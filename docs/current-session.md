# Current Session Plan
**Date:** February 27, 2026  
**Status:** ✅ Complete — v1.2.0 shipped  
**Version:** v1.1.0 → v1.2.0

---

## Session Goal

Three items from user testing feedback: one bug fix (collection stats) + two recoverable-delete features (collections and entries). Full architectural plan produced and approved by user.

## If Interrupted

v1.2.0 is fully shipped and tagged. Start a new session for the next roadmap item (projection snapshots).

---

## Approved Implementation Sequence

### Item 1 — Bug: Collection Stats Counting Moved Tasks as Active
**Status:** ✅ Done (commit `7b26a0c`)

### Item 2 — Recoverable Deleted Collections
**Status:** ✅ Done (commit `3c8c1e2`)

### Item 3 — Recoverable Deleted Entries with Visual Distinction
**Status:** ✅ Done (commit `1ea5021`)

### UAT Bug 1 — Stats ghost (sidebar counter showing "1 task" for migrated collections)
**Status:** ✅ Fixed (commit `ee629f6`)
- Root cause: `sanitizeMigrationPointers` was incorrectly clearing `migratedTo` on source entries when the migration target was soft-deleted.
- Fix: revert to `allEntries.some(e => e.id === entry.migratedTo)` — preserve pointer as long as target exists (even if deleted).

### UAT Bug 2 — Migrated entries showing strikethrough (conflicts with deleted entry styling)
**Status:** ✅ Fixed (commits `ee629f6` + `8363946`)
- Part 1 (`ee629f6`): Removed `line-through` from `isLegacyMigrated` ternary in `TaskEntryItem`, `NoteEntryItem`, `EventEntryItem`.
- Part 2 (`8363946`): Removed `textDecoration: 'line-through'` inline style from `GhostEntry.tsx`; changed color to faded `text-gray-500/dark:text-gray-400`.

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
4. **UAT at end of session** ✅ (done — 2 bugs found and fixed)

---

## Previous Session (v1.1.0 — February 25, 2026)

Six items shipped: error toast tests, `parentTaskId` → `parentEntryId` rename, last-hop ghost links, SRP split (`EntryEventApplicator`), multi-collection for notes/events, `isAppReady` sync guard. See `CHANGELOG.md` and `docs/roadmap.md` for details.
