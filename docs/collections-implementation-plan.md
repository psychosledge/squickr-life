# Collections Feature - Implementation Plan

**Status:** ✅ Phase 2 Complete - Ready for Phase 3 (Entry Migration)  
**Started:** 2026-01-26  
**Completed:** 2026-01-27  
**Architecture:** ADR-008 (Collections as Journal Pages)

---

## Progress Summary

### Completed Phases ✅

**Phase 1A: Collection Aggregate (Backend)** - DONE  
- ✅ Committed: `ac7f0c4` (2026-01-26)
- ✅ Created Collection domain types, events, commands
- ✅ Implemented 4 handlers: Create, Rename, Reorder, Delete
- ✅ Added CollectionListProjection for read model
- ✅ Added validation helpers and comprehensive tests (58 tests)
- ✅ All handlers are idempotent (prevent double-submit bugs)
- ✅ Casey review: 9/10 rating
- Files: 8 new + 2 modified

**Phase 1B: Add collectionId to Entries** - DONE  
- ✅ Committed: `ab0591b` (2026-01-26)
- ✅ Added `collectionId` field to Task, Note, Event types
- ✅ Updated all Create handlers to accept collectionId
- ✅ Implemented MoveEntryToCollectionHandler (polymorphic, idempotent)
- ✅ Added getEntriesByCollection() to EntryListProjection
- ✅ Fixed type guard ambiguity bug (Notes/Events can now be moved)
- ✅ Added regression tests (18 new tests, 288 total passing)
- ✅ Backward compatible (legacy entries work as uncategorized)
- ✅ Casey review: 9.5/10 rating
- Files: 1 new + 10 modified

**Phase 2A: React Router Setup** - DONE  
- ✅ Committed: `be8643b` (2026-01-27)
- ✅ Installed react-router-dom dependency
- ✅ Created routes.tsx with route constants
- ✅ Wrapped App with BrowserRouter and Routes
- ✅ Created AppContext for shared projections/handlers
- ✅ Set up placeholder views and basic routing
- ✅ Fixed pre-existing test failures (5 App.test.tsx tests)
- ✅ All 128 client tests passing
- Files: 3 new + 4 modified

**Phase 2B: Collection Index View** - DONE  
- ✅ Committed: `54a9856` + `ed6dc61` (2026-01-27)
- ✅ Created CollectionList, CollectionListItem, CreateCollectionModal
- ✅ Full reactive Collection Index with create/navigate functionality
- ✅ Added Escape key handler and body scroll lock to modal
- ✅ Added 30 comprehensive tests for Collection Index
- ✅ All 161 client tests passing
- ✅ Casey review: 9/10 rating
- Files: 4 new + 1 modified

**Phase 2C: Collection Detail View** - DONE  
- ✅ Committed: `eeaa762` (2026-01-27)
- ✅ Created CollectionHeader, RenameCollectionModal, DeleteCollectionModal
- ✅ Full CollectionDetailView with rename/delete functionality
- ✅ Context-aware FAB (entries added to current collection)
- ✅ Replaced window.prompt/confirm with proper modals
- ✅ Added 47 comprehensive tests for Collection Detail
- ✅ All 208 client tests passing
- ✅ Casey review: 9.5/10 rating
- Files: 4 new + 5 modified

**Phase 2D: Navigation Integration** - DONE  
- ✅ Committed: `6f4cfc7` (2026-01-27)
- ✅ Changed default route from Daily Logs to Collections Index
- ✅ Implemented virtual "Uncategorized" collection for orphaned entries
- ✅ Made collection title clickable for navigation
- ✅ Removed dead code (DailyLogsView.tsx)
- ✅ Enforced consistent route constants usage
- ✅ Added 20 comprehensive tests for virtual collection logic
- ✅ All 228 client tests passing
- ✅ Casey review: 10/10 rating
- Files: 1 deleted + 9 modified

**Performance Optimization: N+1 Query Fix** - DONE  
- ✅ Committed: `2262b1d` (2026-01-27)
- ✅ Added getEntryCountsByCollection() bulk query method
- ✅ Eliminated N+1 pattern in CollectionIndexView (101x faster with 100 collections)
- ✅ Optimized from 2 queries to 1 query per load
- ✅ Added 7 comprehensive tests for bulk counting
- ✅ All 295 shared + 228 client tests passing (523 total)
- ✅ Casey review: 9/10 rating
- Files: 4 modified

**Visual Polish** - DONE  
- ✅ Committed: `5eac4c7` (2026-01-27)
- ✅ Fixed non-uniform trash icon sizes across entry types
- ✅ All icons now use consistent text-xl styling
- Files: 2 modified

### Git Status
- ✅ All changes pushed to origin/master
- ✅ All 523 tests passing (295 shared + 228 client)
- ✅ No TypeScript errors
- ✅ Ready for Phase 3 (Entry Migration)

---

## 🚀 Quick Start for Next Session (Phase 3)

### What to tell Sam:

> "Sam, please implement Phase 2A: React Router Setup. The backend (Phase 1A/1B) is complete and committed. Now we need to add routing infrastructure so users can navigate between the collection index and individual collection pages."

### Context for Sam:
- Phase 1A/1B added all backend logic (Collections aggregate + collectionId on entries)
- All 288 tests passing, code reviewed by Casey (9.5/10)
- No UI exists yet - Phase 2A starts the UI layer
- Current app shows "Daily Logs" view - we'll replace this with Collections-based navigation

---

## 🚀 Quick Start for Next Session (Phase 3)

### What to tell Sam:

> "Sam, please implement Phase 3: Entry Migration. Phase 2 (Collections UI) is complete and all changes are pushed. Now we need to allow users to move entries between collections with a full audit trail."

### Context for Sam:
- Phase 1A/1B added all backend logic (Collections + collectionId)
- Phase 2A/2B/2C/2D completed the full Collections UI
- All 523 tests passing, Phase 2 reviewed by Casey (9-10/10 ratings)
- Users can now create collections and add entries to them
- Next step: Allow moving existing entries between collections

### Sam's Task (Phase 3):
1. Update entry types to include `migratedTo` and `migratedFrom` fields
2. Create EntryMigrated events for Task/Note/Event
3. Implement MigrateEntryHandler for each entry type
4. Add UI for "Move to Collection" action in entry detail
5. Add visual indicator for migrated entries
6. Verify migration preserves original and creates new entry

See **Phase 3** section below for full details.

---

## Overview

Replace the current date-based Daily Logs view with a **Collections-based architecture** where each collection is a "page" in the journal. Users can create named collections, organize entries within them, and migrate entries between collections.

### Key Concepts

- **Collections = Pages in a Journal** - Not "daily logs vs custom", but named pages in a book
- **User-Defined Order** - Collections arranged however user wants (not auto-sorted by date)
- **Page-Based Navigation** - Each collection is a separate page (not infinite scroll)
- **Migration** - Move entries between collections with full audit trail

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Collection Type** | Default to `'log'` | Better than 'custom', represents chronological records |
| **Name Uniqueness** | Allow duplicates | More flexible, matches physical journals |
| **Collection ID** | UUID + name field | Name can change/duplicate, ID is stable |
| **Collection Order** | Fractional indexing | User-defined order, no auto-sort |
| **Delete Behavior** | Hide collection + entries | Clean, can add restore later |
| **Legacy Entries** | Virtual "Uncategorized" | Visible but separate, user migrates at leisure |
| **Routing** | React Router v6 | Mature, well-supported, good mobile support |
| **Navigation** | Page-based (not scroll) | Each collection is a separate page |
| **Index View** | List view | Simple, clean, mobile-friendly |
| **Entry Actions** | Tap entry → detail sheet | Large touch target, mobile-friendly |
| **Migration Visual** | Subtle arrow `→` | Not busy, migrations are common |

---

## Implementation Phases

### Phase 1A: Collection Aggregate (Backend)
**Status:** ✅ COMPLETE (Committed: `ac7f0c4`)  
**Goal:** Create Collection as first-class aggregate

**Completed Work:**
- ✅ Created `collection.types.ts` with Collection entity, 4 events, 4 commands
- ✅ Created `collection.handlers.ts` with 4 handlers (Create, Rename, Reorder, Delete)
- ✅ Created `collection.projections.ts` with CollectionListProjection
- ✅ Created `collection-validation.ts` with reusable helpers
- ✅ Created comprehensive test suite (58 tests)
- ✅ All handlers implement idempotency safeguards
- ✅ Exported all types and handlers in index.ts
- ✅ Casey code review: 9/10 rating

**Key Implementation Details:**
```typescript
// Idempotency patterns used:
// - CreateCollectionHandler: Time-based deduplication (5-second window)
// - RenameCollectionHandler: State-based (no event if already has target name)
// - ReorderCollectionHandler: State-based (no event if already in position)
// - DeleteCollectionHandler: Throws error if already deleted

// Soft delete: Sets deletedAt timestamp, entries remain in event store
```

---

### Phase 1B: Add collectionId to Entries
**Status:** ✅ COMPLETE (Committed: `ab0591b`)  
**Goal:** Update all entry types to reference a collection

**Completed Work:**
- ✅ Added `collectionId?: string` to Task, Note, Event entities
- ✅ Updated TaskCreated, NoteCreated, EventCreated event payloads
- ✅ Updated CreateTaskCommand, CreateNoteCommand, CreateEventCommand
- ✅ Modified all 3 Create handlers to accept and store collectionId
- ✅ Implemented MoveEntryToCollectionHandler (polymorphic, works for all entry types)
- ✅ Added EntryMovedToCollection event (included in TaskEvent, NoteEvent, EventEvent unions)
- ✅ Updated EntryListProjection to handle collectionId
- ✅ Added getEntriesByCollection() method (filters by collection, null = uncategorized)
- ✅ Fixed type guard bug (EntryMovedToCollection handled centrally before type routing)
- ✅ Added 18 new tests (16 from implementation + 2 regression tests)
- ✅ Casey code review: 9.5/10 rating

**Key Implementation Details:**
```typescript
// Legacy entry handling:
// - Entries without collectionId are treated as "uncategorized"
// - getEntriesByCollection(null) returns entries where collectionId is undefined/null
// - Backward compatible: old entries work without migration

// Type guard fix:
// - EntryMovedToCollection is cross-cutting (applies to Task/Note/Event)
// - Handled FIRST in applyEvents() before type-specific routing
// - Checks all three maps (tasks, notes, eventEntries) dynamically
// - Prevents bug where only Tasks could be moved to collections
```

---
**Status:** Pending  
**Goal:** Update all entry types to reference a collection

**Files to Modify:**
- `packages/shared/src/task.types.ts` - Add `collectionId?: string`
- `packages/shared/src/note.types.ts` - Add `collectionId?: string`
- `packages/shared/src/event.types.ts` - Add `collectionId?: string`
- `packages/shared/src/task.handlers.ts` - Accept collectionId in commands
- `packages/shared/src/note.handlers.ts` - Accept collectionId in commands
- `packages/shared/src/event.handlers.ts` - Accept collectionId in commands
- `packages/shared/src/entry.projections.ts` - Handle legacy entries

**Legacy Entry Handling:**
```typescript
// Virtual "Uncategorized" collection for entries without collectionId
async getCollections(): Promise<Collection[]> {
  const realCollections = // ... get from events
  const legacyEntries = await this.getLegacyEntries();
  
  if (legacyEntries.length > 0) {
    // Add virtual "Uncategorized" collection
    return [...realCollections, {
      id: 'uncategorized',
      name: 'Uncategorized (Legacy)',
      type: 'custom',
      order: 'zzz', // Sort to bottom
      createdAt: new Date().toISOString(),
      isVirtual: true,
    }];
  }
  
  return realCollections;
}
```

---

### Phase 2A: React Router Setup
**Status:** ✅ COMPLETE (Committed: `be8643b`)  
**Goal:** Add routing infrastructure for navigation

**Completed Work:**
- ✅ Installed react-router-dom v6
- ✅ Created `routes.tsx` with ROUTES constants
- ✅ Created AppContext for sharing projections/handlers
- ✅ Wrapped App with BrowserRouter and Routes
- ✅ Set up routes: `/` (index) and `/collection/:id` (detail)
- ✅ Fixed 5 pre-existing test failures in App.test.tsx
- ✅ All 128 client tests passing

**Files Created:**
- `packages/client/src/routes.tsx`
- `packages/client/src/context/AppContext.tsx`
- `packages/client/src/views/CollectionIndexView.tsx` (placeholder)
- `packages/client/src/views/CollectionDetailView.tsx` (placeholder)

**Files Modified:**
- `packages/client/src/App.tsx`
- `packages/client/src/App.test.tsx`
- `packages/client/package.json`

---

### Phase 2B: Collection Index View
**Status:** ✅ COMPLETE (Committed: `54a9856` + `ed6dc61`)  
**Goal:** "Table of contents" showing all collections

**Completed Work:**
- ✅ Created CollectionList, CollectionListItem, CreateCollectionModal
- ✅ Full reactive Collection Index with create/navigate functionality
- ✅ Added Escape key handler to close modal
- ✅ Added body scroll lock when modal open
- ✅ Entry count badges for each collection
- ✅ Added 30 comprehensive tests
- ✅ All 161 client tests passing
- ✅ Casey review: 9/10 rating

**Files Created:**
- `packages/client/src/components/CollectionList.tsx`
- `packages/client/src/components/CollectionListItem.tsx`
- `packages/client/src/components/CreateCollectionModal.tsx`
- `packages/client/src/components/CreateCollectionModal.test.tsx`

**UI Features:**
```
┌─────────────────────────────────┐
│ Collections                   ︙ │
├─────────────────────────────────┤
│ 📚 Books to Read          →     │  ← Tap to navigate
│ 💼 Work Projects          →     │
│ 📅 Jan 26, 2026           →     │
│ 💡 Someday Maybe          →     │
│ 📦 Uncategorized (Legacy)  →    │
│                                 │
│ [FAB: +]                        │  ← Create new collection
└─────────────────────────────────┘

```

**Features:**
- List all collections in user-defined order
- Tap collection → Navigate to detail page
- Long-press or drag to reorder
- FAB opens "Create Collection" modal
- Virtual "Uncategorized" collection if legacy entries exist

---

### Phase 2C: Collection Detail View
**Status:** ✅ COMPLETE (Committed: `eeaa762`)  
**Goal:** Individual collection page showing its entries

**Completed Work:**
- ✅ Created CollectionHeader with rename/delete functionality
- ✅ Created RenameCollectionModal and DeleteCollectionModal
- ✅ Full CollectionDetailView with entry display
- ✅ Context-aware FAB (entries added to current collection)
- ✅ Replaced window.prompt/confirm with proper modals
- ✅ Back navigation and menu functionality
- ✅ Added 47 comprehensive tests
- ✅ All 208 client tests passing
- ✅ Casey review: 9.5/10 rating

**Files Created:**
- `packages/client/src/components/CollectionHeader.tsx`
- `packages/client/src/components/CollectionHeader.test.tsx`
- `packages/client/src/components/RenameCollectionModal.tsx`
- `packages/client/src/components/DeleteCollectionModal.tsx`
- `packages/client/src/views/CollectionDetailView.test.tsx`

**Files Modified:**
- `packages/client/src/views/CollectionDetailView.tsx` (full implementation)
- `packages/client/src/components/FAB.tsx` (context-aware collectionId)
- `packages/client/src/components/EntryList.tsx`
- `packages/client/src/App.tsx`
- `packages/client/src/routes.tsx`

---

### Phase 2D: Navigation Integration  
**Status:** ✅ COMPLETE (Committed: `6f4cfc7`)  
**Goal:** Replace Daily Logs with Collections-based navigation

**Completed Work:**
- ✅ Changed default route `/` from Daily Logs to Collections Index
- ✅ Implemented virtual "Uncategorized" collection for orphaned entries
- ✅ Virtual collection synthesized on-the-fly (not persisted)
- ✅ Virtual collection appears FIRST in list (order: '!')
- ✅ Made collection title clickable for navigation
- ✅ Removed dead code (DailyLogsView.tsx - 156 lines)
- ✅ Enforced consistent ROUTES constant usage
- ✅ Added 20 comprehensive tests for virtual collection logic
- ✅ All 228 client tests passing
- ✅ Casey review: 10/10 rating

**Files Deleted:**
- `packages/client/src/components/DailyLogsView.tsx`

**Files Modified:**
- `packages/client/src/routes.tsx` (added UNCATEGORIZED_COLLECTION_ID)
- `packages/client/src/App.tsx` (changed default route)
- `packages/client/src/App.test.tsx` (updated 5 tests)
- `packages/client/src/views/CollectionIndexView.tsx` (virtual collection synthesis)
- `packages/client/src/views/CollectionDetailView.tsx` (handle uncategorized)
- `packages/client/src/components/CollectionHeader.tsx` (isVirtual prop, clickable title)
- `packages/client/src/views/CollectionIndexView.test.tsx` (8 new tests)
- `packages/client/src/views/CollectionDetailView.test.tsx` (6 new tests)
- `packages/client/src/components/CollectionHeader.test.tsx` (6 new tests)

**Key Implementation Details:**
```typescript
// Virtual collection synthesis (view-layer only)
if (orphanedEntries.length > 0) {
  collectionsWithVirtual.push({
    id: UNCATEGORIZED_COLLECTION_ID,
    name: 'Uncategorized',
    type: 'custom',
    order: '!', // Sorts first (! comes before alphanumerics)
    createdAt: new Date().toISOString(),
  });
}
```

---

### Performance Optimization: N+1 Query Fix
**Status:** ✅ COMPLETE (Committed: `2262b1d`)  
**Goal:** Eliminate N+1 query pattern in Collection Index

**Completed Work:**
- ✅ Added `getEntryCountsByCollection()` bulk query method to EntryListProjection
- ✅ Updated CollectionIndexView to use single bulk query
- ✅ Optimized from 2 queries → 1 query per page load
- ✅ Performance improvement: 101x faster with 100 collections
- ✅ Added 7 comprehensive tests for bulk counting method
- ✅ All 295 shared + 228 client tests passing (523 total)
- ✅ Casey review: 9/10 rating

**Files Modified:**
- `packages/shared/src/entry.projections.ts` (added getEntryCountsByCollection)
- `packages/shared/src/entry.projections.test.ts` (7 new tests)
- `packages/client/src/views/CollectionIndexView.tsx` (use bulk query)
- `packages/client/src/views/CollectionIndexView.test.tsx` (updated mocks)

**Performance Impact:**
| Collections | Before (N+1) | After (Bulk) | Improvement |
|-------------|--------------|--------------|-------------|
| 5 | 6 queries | 1 query | 6x faster |
| 100 | 101 queries | 1 query | 101x faster |

---

### Phase 3: Entry Migration
**Status:** 🔜 NEXT - Ready to implement  
**Goal:** Move entries between collections

**New Events:**
```typescript
interface TaskMigrated extends DomainEvent {
  type: 'TaskMigrated';
  payload: {
    originalTaskId: string;
    targetCollectionId: string;
    migratedToId: string;      // New task created in target
    migratedAt: string;
  };
}
```

**Updated Entry Types:**
```typescript
interface Task {
  // ... existing fields
  migratedTo?: string;      // ID of entry this migrated to
  migratedFrom?: string;    // ID of entry this was migrated from
}
```

**UI Flow:**
1. Tap entry → Detail sheet opens
2. Tap "Migrate to..." → Collection picker opens
3. Select target → Entry migrates
4. Original shows `→` indicator
5. New entry created in target

---

## Testing Strategy

### After Phase 1A + 1B: Backend Ready
- All unit tests pass
- Can create collections via handlers
- Can create entries with collectionId
- Legacy entries handled

### After Phase 2A: Routing Ready
- Routes load correct components
- Navigation works

### After Phase 2B: Index View Complete
- Can see all collections
- Can create new collection
- Can navigate to collection

### After Phase 2C: Detail View Complete
- Can view entries in collection
- Can add entries to specific collection
- Navigation works end-to-end

### After Phase 3: Migration Complete
- Can move entries between collections
- Audit trail preserved

---

## Manual Testing Checklist

### Phase 1 (Backend)
- [ ] Create collection with valid name
- [ ] Create collection with duplicate name (should succeed)
- [ ] Rename collection
- [ ] Reorder collections
- [ ] Delete collection (soft delete)
- [ ] Create entry with collectionId
- [ ] Create entry without collectionId (legacy)
- [ ] Legacy entries appear in "Uncategorized"

### Phase 2A (Routing)
- [ ] Navigate to index (/)
- [ ] Navigate to collection detail (/collection/:id)
- [ ] Back button works

### Phase 2B (Index View)
- [ ] See all collections in order
- [ ] Create new collection
- [ ] Tap collection → Navigate to detail
- [ ] Reorder collections via drag
- [ ] Virtual "Uncategorized" appears if legacy entries exist

### Phase 2C (Detail View)
- [ ] View collection name and entries
- [ ] Add entry to collection via FAB
- [ ] Tap entry → Detail sheet opens
- [ ] Back to index works
- [ ] Collection menu (rename, delete) works
- [ ] Empty state when no entries

### Phase 3 (Migration)
- [ ] Migrate entry to different collection
- [ ] Original shows `→` indicator
- [ ] New entry created in target
- [ ] Can trace migration history
- [ ] Migrated entry disappears from original view
- [ ] Can migrate legacy entries from Uncategorized

---

## Future Enhancements (Backlog)

- [ ] Collection icons/colors (customization)
- [ ] Quick collection switcher (dropdown while viewing detail)
- [ ] Collection templates (quick create with default entries)
- [ ] Bulk operations (select multiple entries, migrate all)
- [ ] Collection search/filter
- [ ] Collection archive (vs delete)
- [ ] Restore deleted collections
- [ ] Collection sharing (multi-user)
- [ ] Collection export (PDF, markdown)

---

## Notes

- **Date Picker Feature:** Superseded by Collections feature. Original goal (select which date to add entries to) is subsumed by collection selection.
- **Daily Logs:** Now just one type of collection. Users create date-based collections explicitly (e.g., "Jan 26, 2026").
- **Migration Ritual:** Core bullet journal practice. Original entry preserved, new entry created in target.
- **Mobile-First:** All UI designed for touch (large targets, bottom sheets, etc.)

---

## References

- **ADR-008:** Collections as Journal Pages (see Architecture Alex's design in conversation)
- **Event Sourcing Patterns:** docs/architecture-decisions.md
- **Development Guide:** docs/development-guide.md
- **OpenCode Workflow:** docs/opencode-workflow.md
