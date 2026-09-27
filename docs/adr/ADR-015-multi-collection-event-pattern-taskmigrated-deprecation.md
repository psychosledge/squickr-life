# ADR-015: Multi-Collection Event Pattern (TaskMigrated Deprecation)

**Date**: 2026-02-15
**Status**: Accepted (enforcement complete 2026-04-04)

## Context

The original task migration implementation used `TaskMigrated` events that created new task IDs and lost collection history. This caused **Issue #7G**: Users couldn't see the full history of where a task had been.

**Problem Example (Issue #7G)**:
- User's "Find eye doctor" sub-task only showed 1 entry in `collectionHistory` (Today)
- Expected: 3 entries (Monthly created, Yesterday added then removed, Today added)
- Root cause: Task was MIGRATED (new ID created) instead of MOVED (ID preserved)

**Old Pattern (Deprecated)**:
```typescript
// Created NEW task with NEW ID
TaskMigrated {
  originalTaskId: "abc",
  migratedToId: "def",  // New ID!
  targetCollectionId: "today"
}
// Result: Lost full collection history
```

**Issues with TaskMigrated**:
1. **Data loss**: New task ID meant fresh `collectionHistory` (lost previous collections)
2. **Ghost rendering complexity**: `migratedTo` pointer required special handling
3. **ID proliferation**: Each migration created a new task ID
4. **Inconsistent with domain**: Tasks don't "migrate" in event sourcing, they appear/disappear from collections

## Decision

**Deprecate `TaskMigrated` events** and use multi-collection pattern instead:

**New Pattern (Multi-Collection)**:
```typescript
// Remove from current collection(s)
TaskRemovedFromCollection {
  taskId: "abc",           // SAME ID
  collectionId: "monthly",
  removedAt: "2026-02-14T10:00:00Z"
}

// Add to target collection
TaskAddedToCollection {
  taskId: "abc",           // SAME ID
  collectionId: "today",
  addedAt: "2026-02-14T10:00:00Z"
}
// Result: Full collection history preserved
```

**Task Model Evolution**:
```typescript
// OLD (deprecated)
interface Task {
  id: string;
  collectionId: string | null;     // Single collection
  migratedTo?: string;             // Pointer to new ID
  migratedToCollectionId?: string; // Where it was migrated
}

// NEW (multi-collection)
interface Task {
  id: string;
  collections: string[];           // Multiple collections
  collectionHistory: CollectionHistoryEntry[];
}

interface CollectionHistoryEntry {
  collectionId: string;
  addedAt: string;
  removedAt?: string;  // Undefined if still active
}
```

## Rationale

**Why Multi-Collection Pattern:**
- **Preserves task IDs**: Same task across all collections (no ID proliferation)
- **Full history tracking**: `collectionHistory` contains complete audit trail
- **Event sourcing alignment**: Tasks don't "migrate", they're added/removed from collections
- **Flexible semantics**: Supports both "move" (remove + add) and "add" (just add) modes
- **Ghost rendering simplicity**: Ghost = collection in history with `removedAt` timestamp
- **Domain clarity**: "Task appears on collection" is clearer mental model than "task migrates"

**Why Deprecate (Not Delete) TaskMigrated:**
- **Backward compatibility**: Existing events remain valid (event sourcing principle)
- **Projection upcasting**: Old events still handled by projections
- **Data safety**: No migration of existing event log needed
- **Graceful transition**: New code doesn't generate TaskMigrated, but reads it if present

## Consequences

**Positive:**
- ✅ **Full collection history preserved** (fixes Issue #7G)
- ✅ **Task IDs stable** across migrations
- ✅ **Multi-collection support** (task can appear on multiple collections)
- ✅ **Flexible migration modes**: Both "move" and "add" supported
- ✅ **Simpler ghost rendering**: Check `removedAt` in history
- ✅ **Event sourcing best practice**: Events describe what happened, not implementation details
- ✅ **Backward compatible**: Old TaskMigrated events still handled

**Negative:**
- ⚠️ **More events per migration**: 2 events (remove + add) vs 1 event (TaskMigrated)
- ⚠️ **Larger event log**: More events = more storage (mitigated: events are small JSON)
- ⚠️ **Legacy support burden**: Projections must handle both old and new patterns
- ~~⚠️ **Two handlers for migration**: `MoveTaskToCollectionHandler` vs old `MigrateTaskHandler`~~ — resolved: `MigrateTaskHandler` removed from all UI call sites (2026-04-04)

**Trade-offs:**
- **Event volume vs clarity**: Acceptable trade-off for data integrity
- **Backward compatibility complexity**: Worth it to avoid breaking existing data
- **Handler duplication**: `MigrateTaskHandler` retained in domain layer for event replay only; no longer instantiated in UI

## Implementation Details

**5-Phase Implementation** (2026-02-15):

**Phase 1: Fix Move Semantics** (3 hours)
- Added `currentCollectionId` to `MoveTaskToCollectionCommand`
- Handler removes from current collection only (not all collections)
- Comprehensive validation and edge case tests
- Casey approved: 9.5/10

**Phase 2: Fix BulkMigrateEntriesHandler** (4 hours)
- Removed `TaskMigrated` event generation for tasks
- Rewrote to use `TaskAddedToCollection` + `TaskRemovedFromCollection`
- Added idempotency checks (prevent duplicate events)
- Uses `generateEventMetadata()` helper for consistency
- Casey approved: 9.2/10

**Phase 3: Verify UI Wiring** (1 hour)
- Confirmed UI already using `handleMigrateWithMode`
- Fixed dependency array bug in `useEntryOperations.ts`
- All migration flows tested and working

**Phase 4: Integration Testing** (3 hours)
- Created 19 comprehensive end-to-end tests
- Verified full stack behavior (handlers → projections → UI)
- All tests passing (577 domain tests, 1,540 total)

**Phase 5: Documentation** (1 hour)
- ADR-015 documented
- CHANGELOG updated
- Implementation notes added

**Total Time**: 12 hours (under original 18-22 hour estimate)

## Files Changed

**Domain Layer**:
- `packages/domain/src/task.types.ts` - Added `currentCollectionId` to command, enhanced JSDoc
- `packages/domain/src/collection-management.handlers.ts` - Fixed move semantics, added validation
- `packages/domain/src/bulk-migrate-entries.handler.ts` - Removed TaskMigrated, added idempotency
- `packages/domain/src/collection-management.test.ts` - Added 4 edge case tests
- `packages/domain/src/bulk-migrate-entries.handler.test.ts` - Updated 12 tests, added 1 comprehensive test
- `packages/domain/src/multi-collection-integration.test.ts` - **NEW**: 19 integration tests

**Client Layer**:
- `packages/client/src/hooks/useEntryOperations.ts` - Fixed dependency array bug
- `packages/client/src/views/CollectionDetailView.test.tsx` - Fixed 3 date/time mocking issues

**Test Results**:
- Before: 1,521 tests passing
- After: 1,540 tests passing (+19 integration tests)
- Zero regressions

## Migration Strategy

**For New Code**:
- ✅ Use `BulkMigrateEntriesHandler` (generates multi-collection events)
- ✅ Use `MoveTaskToCollectionHandler` (removes from current, adds to target)
- ✅ Use `AddTaskToCollectionHandler` (adds to collection without removing)
- ❌ DO NOT use `MigrateTaskHandler` (generates deprecated TaskMigrated events)

**For Existing Data**:
- ✅ Projections handle both old (TaskMigrated) and new (multi-collection) events
- ✅ Old tasks with `migratedTo` pointers still render as ghosts
- ✅ No data migration needed (backward compatible)
- ✅ Event log preserved (immutable events)

**Projection Handling**:
```typescript
// Projection handles BOTH patterns
private replayEvents(events: DomainEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      // NEW pattern
      case 'TaskAddedToCollection':
        task.collections.push(event.payload.collectionId);
        task.collectionHistory.push({
          collectionId: event.payload.collectionId,
          addedAt: event.payload.addedAt,
        });
        break;
      
      case 'TaskRemovedFromCollection':
        task.collections = task.collections.filter(
          id => id !== event.payload.collectionId
        );
        const historyEntry = task.collectionHistory.find(
          h => h.collectionId === event.payload.collectionId
        );
        if (historyEntry) {
          historyEntry.removedAt = event.payload.removedAt;
        }
        break;
      
      // OLD pattern (legacy support)
      case 'TaskMigrated':
        // Create new task with new ID, point old task to new
        // (handled for backward compatibility only)
        break;
    }
  }
}
```

## Testing Strategy

**Unit Tests** (Domain Handlers):
- Move semantics (removes from current only)
- Idempotency (duplicate operations are no-ops)
- Validation (empty IDs, invalid collections)
- Edge cases (same-collection moves, uncategorized)

**Integration Tests** (Full Stack):
- Task ID preservation across migrations
- Collection history completeness
- Multi-collection behavior (move vs add)
- Bulk migration atomicity
- Ghost rendering in multiple collections

**UI Tests** (Client Layer):
- Migration modal mode selection
- Collection history display
- Ghost entry rendering
- Navigation between collections

## Future Considerations

**Potential Improvements**:
1. **Event compaction**: Snapshot aggregates to reduce event log size
2. **Batch optimization**: Single `appendBatch()` for bulk migrations
3. **Real-time sync**: Firestore `onSnapshot` for live multi-device updates
4. **Legacy migration**: Script to convert old TaskMigrated events (optional)

**Event Schema Evolution**:
- Current: v1 (TaskMigrated deprecated, multi-collection recommended)
- Future: v2 (remove TaskMigrated support after migration period)

## SOLID Principles

**Single Responsibility**:
- `MoveTaskToCollectionHandler` - Coordinates move operation (remove + add)
- `AddTaskToCollectionHandler` - Adds to collection only
- `RemoveTaskFromCollectionHandler` - Removes from collection only
- Each handler has one clear responsibility

**Open/Closed**:
- New multi-collection events added without modifying existing event types
- Projections extended to handle new events without changing old logic
- UI can use new handlers without breaking old code

**Liskov Substitution**:
- Both `TaskMigrated` and `TaskAddedToCollection + TaskRemovedFromCollection` produce same outcome (task moves)
- Projections handle both transparently
- Old code still works with new events

**Dependency Inversion**:
- Handlers depend on `IEventStore` abstraction (not concrete implementation)
- UI depends on command handler abstractions (not event details)
- Projections depend on event interfaces (not storage)

## Documentation

**ADR-015**: This document  
**Implementation Plan**: `docs/adr-015-implementation-plan.md` (original plan, superseded)  
**Integration Tests**: `packages/domain/src/multi-collection-integration.test.ts`  
**CHANGELOG**: Updated with Issue #7G fix

---

*Architecture decisions are revisited as we learn. Status may change to Deprecated or Superseded.*
