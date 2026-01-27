# Collections Feature - Implementation Plan

**Status:** In Progress - Phase 1A/1B Complete ✅  
**Started:** 2026-01-26  
**Current Phase:** Ready for Phase 2A (React Router Setup)  
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

### Git Status
- 📦 3 commits ahead of origin/master
- ✅ All 288 tests passing
- ✅ No TypeScript errors
- Ready to push or continue with Phase 2

---

## 🚀 Quick Start for Next Session (Phase 2A)

### What to tell Sam:

> "Sam, please implement Phase 2A: React Router Setup. The backend (Phase 1A/1B) is complete and committed. Now we need to add routing infrastructure so users can navigate between the collection index and individual collection pages."

### Context for Sam:
- Phase 1A/1B added all backend logic (Collections aggregate + collectionId on entries)
- All 288 tests passing, code reviewed by Casey (9.5/10)
- No UI exists yet - Phase 2A starts the UI layer
- Current app shows "Daily Logs" view - we'll replace this with Collections-based navigation

### Sam's Task (Phase 2A):
1. Install `react-router-dom` dependency
2. Create `routes.tsx` with route constants
3. Wrap App with BrowserRouter
4. Create placeholder views: `CollectionIndexView` and `CollectionDetailView`
5. Verify routing works (navigate via URL, back/forward buttons)

See **Phase 2A** section below for full details.

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
**Status:** 🔜 NEXT - Ready to start  
**Goal:** Add routing infrastructure for navigation

**Dependencies to Install:**
```bash
cd packages/client
pnpm add react-router-dom
pnpm add -D @types/react-router-dom
```

**Files to Create/Modify:**
- `packages/client/src/routes.tsx` (NEW) - Route constants
- `packages/client/src/App.tsx` (MODIFY) - Wrap with BrowserRouter
- `packages/client/src/main.tsx` (CHECK) - May need changes

**Route Structure:**
```typescript
// routes.tsx
export const routes = {
  index: '/',
  collectionDetail: (id: string) => `/collection/${id}`,
} as const;

// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<CollectionIndexView />} />
    <Route path="/collection/:id" element={<CollectionDetailView />} />
  </Routes>
</BrowserRouter>
```

**Testing:**
- Navigate to `/` should show collection index
- Navigate to `/collection/:id` should show collection detail
- Browser back/forward buttons work
- URL updates when navigating

---

### Phase 2B: Collection Index View
**Status:** Pending (after Phase 2A)  
**Goal:** "Table of contents" showing all collections

**Files to Create:**
- `packages/client/src/views/CollectionIndexView.tsx`
- `packages/client/src/components/CollectionList.tsx`
- `packages/client/src/components/CollectionListItem.tsx`
- `packages/client/src/components/CreateCollectionModal.tsx`

**UI Structure:**
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
**Status:** Pending  
**Goal:** Individual collection page showing its entries

**Files to Create:**
- `packages/client/src/views/CollectionDetailView.tsx`
- `packages/client/src/components/CollectionHeader.tsx`
- `packages/client/src/components/EntryDetailSheet.tsx`

**Files to Modify:**
- `packages/client/src/components/EntryInputModal.tsx` - Remove collection picker
- `packages/client/src/components/FAB.tsx` - Context-aware behavior

**UI Structure:**
```
┌─────────────────────────────────┐
│ ←  Books to Read            ︙   │  ← Back + menu
├─────────────────────────────────┤
│ ☐ 1984 by George Orwell         │  ← Tap to expand
│ ☐ Dune by Frank Herbert         │
│                                 │
│ [FAB: +]                        │  ← Add to THIS collection
└─────────────────────────────────┘
```

**Simplified EntryInputModal (No Collection Picker!):**
- collectionId is implicit (current page context)
- Just shows: entry type selector + content input
- Much simpler flow

---

### Phase 3: Entry Migration
**Status:** Pending  
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
