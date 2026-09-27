# ADR-008: Collections for Entry Grouping

**Date**: 2026-01-28  
**Status**: Accepted

## Context
Bullet journal methodology uses different collection types beyond daily logs:
- **Monthly Log**: Month-level tasks/events
- **Future Log**: Long-term planning (6-12 months)
- **Custom Collections**: Project trackers, habit trackers, etc.

Users need ability to organize entries into these logical groupings.

## Decision
Implement Collection domain aggregate with event sourcing:
- Collections as first-class aggregates (separate from entries)
- Events: `CollectionCreated`, `CollectionRenamed`, `CollectionDeleted`
- Entry events extended with `collectionId?: string` field
- Migration events: `EntryMovedToCollection`, `EntryRemovedFromCollection`
- Built-in collections: Daily, Monthly, Future
- User-created custom collections

## Rationale
- **BuJo Authenticity**: Matches bullet journal methodology
- **Flexible Organization**: Users organize entries beyond daily logs
- **Migration Support**: Move entries between collections (e.g., monthly task → daily)
- **Immutable Events**: Migrations create new events, preserving audit trail
- **Open for Extension**: Users create custom collections for any purpose

## Consequences
**Positive:**
- Complete bullet journal workflow support
- Flexible entry organization
- Migration history preserved in event log
- Custom collections enable habit tracking, project management, etc.

**Negative:**
- Additional complexity beyond daily logs
- Need to handle orphaned entries (deleted collection)
- Migration events add to event log size

**Implementation Notes:**
- Default collection: "Daily" (all entries without explicit collection)
- Orphaned entries revert to Daily collection
- Collections projection maintains collection list
- EntryList projection filters by collectionId

## SOLID Principles
- **Single Responsibility**: Collection aggregate manages collection lifecycle
- **Open/Closed**: Add collection types without modifying core domain
- **Dependency Inversion**: UI depends on Collection abstraction
