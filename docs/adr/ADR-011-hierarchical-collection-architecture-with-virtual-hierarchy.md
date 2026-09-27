# ADR-011: Hierarchical Collection Architecture with Virtual Hierarchy

**Date**: 2026-02-01  
**Status**: Accepted

## Context

User wants to organize collections in a hierarchical folder structure aligned with Bullet Journal methodology to solve the navigation problem as collection count grows:

```
★ App Ideas                      ← Pinned custom collection
★ Home Projects                  ← Pinned custom collection
▼ 2026 Logs                      ← Virtual year node
  ▼ February                     ← Virtual month node
    • Saturday, February 1       ← Daily log collection
    • Friday, January 31         ← Daily log collection
  ▶ January (31 logs)            ← Collapsed month
▶ 2025 Logs (365 logs)           ← Collapsed year
  Work Projects                  ← Non-pinned custom collection
```

**Requirements:**
1. Hierarchical presentation of date-based collections (year → month → day)
2. Smart navigation - Auto-expand current year/month, prioritize today + favorites
3. Migration filtering - Show today + pinned + yesterday by default
4. BuJo workflow support - Easy yesterday→today migration
5. Type system - Distinguish temporal (daily) from topical (custom) collections
6. No future log concept - Year nodes replace traditional BuJo future log
7. Immutable types - Collection type cannot change after creation

**Architectural Choice: Virtual vs Real Hierarchy**

**Option A: Virtual Hierarchy** (CHOSEN ✅)
- Collections remain flat in data model
- Hierarchy derived from `type` and `date` fields in UI layer
- Year/month are presentation-only nodes (not stored collections)

**Option B: Real Hierarchy** (REJECTED ❌)
- Year/month are actual collections with IDs
- Daily logs have `parentId` pointing to month
- Cascade deletes, orphaned nodes, complex event sourcing

## Decision

**Implement virtual hierarchy** using `type` and `date` fields to derive hierarchical presentation in UI layer.

**Data Model:**

```typescript
export type CollectionType = 
  | 'yearly'   // Reserved for future use
  | 'monthly'  // Reserved for future use
  | 'daily'    // Actual daily log (e.g., "Saturday, February 1")
  | 'custom';  // User-defined topical collection

export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly type: CollectionType;
  readonly order: string;
  readonly date?: string;           // ISO format (YYYY-MM-DD for daily)
  readonly isFavorite?: boolean;    // Pin topical collections
  readonly lastAccessedAt?: string; // Smart sorting
  readonly createdAt: string;
  readonly deletedAt?: string;
  readonly userId?: string;
  readonly settings?: CollectionSettings;
}
```

**New Events:**

```typescript
// Extend CollectionCreated with date field
CollectionCreated { 
  payload: { 
    date?: string; // ISO date for temporal collections 
  } 
}

// Favorite/unfavorite custom collections
CollectionFavorited { collectionId, favoritedAt }
CollectionUnfavorited { collectionId, unfavoritedAt }

// Track access for smart sorting
CollectionAccessed { collectionId, accessedAt }
```

**Hierarchy Building:**

UI builds tree from flat collections by grouping daily logs by year/month extracted from `date` field:
- Year nodes: Group by `date.substring(0, 4)` → "2026 Logs"
- Month nodes: Group by `date.substring(0, 7)` → "February"
- Day nodes: Actual collections with `type: 'daily'` → "Saturday, February 1"

**Display Order:**
1. Pinned custom collections (★)
2. Temporal hierarchy (current year/month auto-expanded)
3. Non-pinned custom collections

**Migration Modal Filtering:**
- Default view: Today's log + Pinned customs + Yesterday's log
- "Show all collections" expands to full hierarchical list
- Year/month nodes not selectable (can't migrate to a month)

**Daily Log Auto-Generation:**
- User selects date via date picker
- System auto-generates name: "Saturday, February 1" from date "2026-02-01"
- Names are immutable (derived from date)

**Schema Migration Strategy:**

Existing collections with old types (`'log'`, `'tracker'`) are automatically interpreted as `'custom'` by the projection:

```typescript
private mapCollectionType(rawType: string): CollectionType {
  switch (rawType) {
    case 'log':
    case 'tracker':
      return 'custom'; // Old schema → map to custom
    case 'yearly':
    case 'monthly':
    case 'daily':
    case 'custom':
      return rawType as CollectionType; // New schema → pass through
    default:
      return 'custom'; // Unknown → default to custom
  }
}
```

**Rationale:** Events are immutable facts. Old `CollectionCreated` events with `type: 'log'` remain valid. The projection interprets them as `type: 'custom'` for current requirements. This follows event sourcing best practices (event upcasting in projections, not event mutation).

## Rationale

**Why Virtual Hierarchy:**
- **Event sourcing alignment** - Collections remain independent aggregates (no parent/child dependencies)
- **No cascade deletes** - Year/month are UI concepts, not data entities
- **Simple querying** - Filter by date field, no recursive traversal
- **Flexible presentation** - Can reorganize hierarchy without data migration
- **Fewer events** - No `YearCreated`, `MonthCreated` needed
- **No orphaned collections** - Year/month derived from existing daily logs

**Why Type System:**
- **Separates temporal from topical** - Daily logs (date-based) vs custom collections (user interest)
- **Enables smart sorting** - Daily logs by date, customs by favorites + access
- **Aligns with BuJo methodology** - Daily logs for planning, customs for projects

**Why No Future Log:**
- User's workflow focuses on daily + custom collections
- Year nodes serve as organizational containers (replace future log concept)
- Can add future log type later if needed

## Consequences

**Positive:**
- ✅ Solves navigation problem immediately with smart sorting + hierarchy
- ✅ Event sourcing friendly (no complex relationships)
- ✅ Flexible presentation (reorganize UI without data migration)
- ✅ No cascade deletes (deleting "year" is just UI filtering)
- ✅ Future-proof (can add real `parentId` later)
- ✅ BuJo workflow support (hierarchical view matches physical journal)
- ✅ Smart migration modal (shows contextually relevant collections)
- ✅ Simple querying (`getDailyLog(date)` is a filter)

**Negative:**
- ❌ UI complexity (need tree view component with expand/collapse)
- ❌ Slight performance cost (building hierarchy on render, mitigated with `useMemo`)
- ❌ Fixed hierarchy (can't nest custom collections)
- ❌ Name auto-generation (user can't customize daily log names)

**Trade-offs:**
- **Immutable types** - Prevents confusion but requires creating new collection + migrating entries to change organization
- **No monthly/yearly creation** - Phase 1 only supports daily logs; monthly/yearly reserved for future
- **Virtual hierarchy limitations** - Year/month nodes not navigable (can't view "all entries in February"); acceptable for Phase 1

## SOLID Principles

- **Single Responsibility**: `CollectionProjection` handles querying, `buildHierarchy()` handles UI construction
- **Open/Closed**: Can add new hierarchy types without modifying existing code
- **Dependency Inversion**: UI depends on `HierarchyNode` abstraction, not concrete structure

## Implementation Plan

**Phase 1: Collection Types + Hierarchical Navigation** (~5 hours, one session)

**Phase 1A: Types + Date Fields** (1.5 hours)
- Add `date`, `isFavorite`, `lastAccessedAt` fields
- Add collection types: `yearly`, `monthly`, `daily`, `custom`
- Update events and projection with schema migration logic
- Tests for date validation and type mapping
- **Commit:** "feat: add collection types and date fields for hierarchical organization"

**Phase 1B: Favorites + Access Tracking** (1 hour)
- Implement favorite/unfavorite handlers
- Track last access on navigation
- Add "Favorite" toggle to collection menu
- Tests for favorites and access tracking
- **Commit:** "feat: add collection favorites and access tracking"

**Phase 1C: Hierarchical UI** (2 hours)
- New components: `HierarchicalCollectionList`, tree nodes
- New hook: `useCollectionHierarchy`
- Auto-expand current year/month
- Persist expand state in localStorage
- Tests for hierarchy building and rendering
- **Commit:** "feat: implement hierarchical collection list view"

**Phase 1D: Migration Modal Filtering** (0.5 hours)
- Update modal with filtered default view
- "Show all collections" expansion
- Tests for filtering logic
- **Commit:** "feat: add smart collection filtering to migration modal"

## Future Enhancements

- **Phase 2**: Date-based collection creation (date picker, auto-generate names)
- **Phase 3**: Calendar navigation UI (calendar widget, jump to date)
- **Phase 4**: Virtual yesterday→today migration (bulk migration banner)
- **Phase 5**: Google Calendar integration (export to GCal, agenda view)
