# ADR-013: Bulk Migration UX - Terminology and Accessibility

**Date**: 2026-02-08  
**Status**: Complete (2026-02-15)

## Context

Users need to migrate multiple entries between collections efficiently. Two UX issues were identified:

1. **Misleading "Incomplete" terminology**: Task-specific term doesn't work for notes/events
2. **Screen flashing during bulk migration**: Rapid UI updates cause accessibility hazard (WCAG 2.1 violation)

## Decision

Implement improvements in 4 phases:

**Phase 1**: Replace "Incomplete" with "Active" terminology
- "Active" = entries without `migratedTo` pointer (not ghost entries)
- Domain-agnostic, works for tasks, notes, and events

**Phase 2**: Add batch append infrastructure to IEventStore
- New `appendBatch()` method for atomic multi-event writes
- Single projection rebuild instead of N rebuilds

**Phase 3**: Create generic `BulkMigrateEntriesHandler`
- Handles tasks, notes, and events in single handler
- Uses `appendBatch()` to eliminate screen flashing

**Phase 4**: Wire UI with loading state
- Show loading indicator for any bulk operation (>1 entry)
- Single UI update after batch completes

## Rationale

**Phase 1 (Terminology)**:
- "Active" is domain-agnostic vs. task-specific "Incomplete"
- Aligns with event sourcing terminology (active vs. migrated/archived)
- Semantically correct: active = not yet migrated away

**Phases 2-4 (Batching)**:
- **Accessibility**: Prevents rapid flashing (WCAG 2.1 compliance)
- **Performance**: One projection rebuild vs. N rebuilds
- **Event sourcing intact**: Still emit individual events (audit trail preserved)
- **Atomic operations**: IndexedDB/Firestore transactions ensure consistency

## Consequences

**Positive:**
- ✅ No screen flashing - WCAG 2.1 compliant
- ✅ Better performance (single projection rebuild)
- ✅ Domain-agnostic terminology
- ✅ Reusable batching pattern for other bulk operations
- ✅ Maintains complete audit trail (individual events)

**Negative:**
- ⚠️ Added complexity: `appendBatch()` method on all event stores
- ⚠️ Implementation effort: ~5 hours total
- ⚠️ Breaking change: External docs referencing "Incomplete" need updates

## SOLID Principles

**Single Responsibility**:
- IEventStore: Handles event persistence (batch capability added)
- BulkMigrateEntriesHandler: Coordinates bulk migration logic
- Projections: Rebuild read models (unchanged responsibility)

**Open/Closed**:
- Extended IEventStore interface without modifying existing `append()`
- New bulk handler doesn't modify individual migration handlers
- Batching pattern extensible to other operations

**Dependency Inversion**:
- UI depends on command handler abstractions
- Handlers depend on IEventStore interface (not concrete implementations)

## Implementation Status

- ✅ **Phase 1 Complete**: Terminology renamed, tests passing
- ✅ **Phase 2 Complete**: Batch append infrastructure added
- ✅ **Phase 3 Complete**: BulkMigrateEntriesHandler implemented
- ✅ **Phase 4 Complete**: UI wiring with loading state

**Status**: Complete (2026-02-15) - See ADR-015 for migration pattern evolution
