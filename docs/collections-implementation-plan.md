# Collections Feature - Implementation Plan

**Status:** In Progress  
**Started:** 2026-01-26  
**Architecture:** ADR-008 (Collections as Journal Pages)

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
**Status:** Pending  
**Goal:** Create Collection as first-class aggregate

**Files to Create:**
- `packages/shared/src/collection.types.ts`
- `packages/shared/src/collection.handlers.ts`
- `packages/shared/src/collection.projections.ts`
- `packages/shared/tests/collection.handlers.test.ts`

**Key Types:**
```typescript
interface Collection {
  id: string;              // UUID
  name: string;            // User-facing, can duplicate
  type: CollectionType;    // 'log' (default) | 'custom' | 'tracker'
  order: string;           // Fractional index
  createdAt: string;
  deletedAt?: string;      // Soft delete
}

type CollectionType = 'log' | 'custom' | 'tracker';

// Events
CollectionCreated
CollectionRenamed
CollectionReordered
CollectionDeleted  // Soft delete (sets deletedAt)
```

**Validation Rules:**
- Name required (min 1 char after trim)
- Name can duplicate (no uniqueness check)
- Type defaults to 'log'
- Order uses fractional indexing

---

### Phase 1B: Add collectionId to Entries
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
**Status:** Pending  
**Goal:** Add routing infrastructure for navigation

**Dependencies:**
```bash
cd packages/client
pnpm add react-router-dom
pnpm add -D @types/react-router-dom
```

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

---

### Phase 2B: Collection Index View
**Status:** Pending  
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
