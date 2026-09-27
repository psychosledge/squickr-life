# ADR-021: Fix Stale `collectionId` Inheritance in Sub-Task Creation

**Date**: 2026-03-25  
**Status**: Accepted

## Context

Monthly log stats showed phantom task counts: sub-tasks created under a moved parent appeared in the wrong collection. The `CreateSubTaskHandler` inherited `collectionId` from `parentTask.collectionId` — a legacy scalar set once at `TaskCreated` time and never updated when the parent moves. Authoritative collection membership is stored in `parentTask.collections[]` per ADR-015.

A secondary issue existed in `isSubTaskMigrated()` inside `sub-task.projection.ts`, which also used the stale `collectionId` scalar for its intersection check instead of `collections[]`.

## Decision

### 1. `CreateSubTaskCommand` carries `collectionId`

`CreateSubTaskCommand` gains a required `collectionId: string | undefined` field. The client (`useEntryOperations.handleCreateSubTask`) passes `collection?.id` from the active route, with an `UNCATEGORIZED_COLLECTION_ID` guard for uncategorised contexts.

### 2. `CreateSubTaskHandler` uses `command.collectionId` directly

The handler no longer reads `parentTask.collectionId`. It uses `command.collectionId` directly, avoiding the stale scalar entirely.

### 3. `isSubTaskMigrated()` updated to use `collections[]` intersection

`isSubTaskMigrated()` in `sub-task.projection.ts` was comparing `subTask.collectionId` against `parentTask.collectionId` — both potentially stale scalars. Updated to perform the correct `collections[]` intersection check (consistent with how the rest of the codebase identifies multi-collection membership per ADR-015).

### 4. Historical stale data deliberately not backfilled

Sub-tasks created before this fix may have stale `collectionId` scalars baked into historical events. A migration was considered and deliberately skipped — the stale data will stop affecting new sub-tasks immediately, and existing stale sub-tasks will naturally age out as collections are completed or archived.

## Consequences

**Positive:**
- ✅ New sub-tasks always inherit the correct collection from the active route — no phantom counts
- ✅ `isSubTaskMigrated()` produces correct results regardless of whether the parent has been moved
- ✅ Zero changes to domain events or event store — fix is entirely in the command/handler/projection layer
- ✅ Consistent with ADR-015: `collections[]` is the single source of truth for collection membership

**Negative / Risks:**
- ⚠️ Historical sub-tasks with stale `collectionId` scalars are not corrected. Impact is limited to edge cases in `isSubTaskMigrated()` for very old data.
- ⚠️ `CreateSubTaskCommand.collectionId` can be `undefined` for uncategorised contexts. The handler must guard against this (currently handled via `UNCATEGORIZED_COLLECTION_ID`).

## SOLID Principles

- **Single Responsibility**: The handler is responsible for creating the sub-task event; the route is responsible for knowing which collection is active.
- **Open/Closed**: No changes to existing event types or projections beyond the targeted bug-fix.
- **Dependency Inversion**: The handler receives `collectionId` via the command — it does not reach into the read model to derive it.

## Files Modified

- `packages/domain/src/task.types.ts` — `CreateSubTaskCommand` gains `collectionId?: string`
- `packages/domain/src/sub-task.handlers.ts` — handler uses `command.collectionId` directly
- `packages/domain/src/sub-task.projection.ts` — `isSubTaskMigrated()` uses `collections[]` intersection
- `packages/domain/src/sub-task.handlers.test.ts` — regression test for correct collectionId propagation
- `packages/domain/src/sub-task.projections.test.ts` — 3 new intersection tests + mirror intersection test
- `packages/domain/src/complete-parent-task.handler.test.ts` — 23 fixtures updated with `collectionId`
- `packages/client/src/hooks/useEntryOperations.ts` — passes `collection?.id` as `collectionId`
