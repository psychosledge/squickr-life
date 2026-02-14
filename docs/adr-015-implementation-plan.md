# ADR-015 Implementation Plan: "Entries Appear on Collections" Model

**Date**: 2026-02-14  
**Status**: Planned  
**Estimated Time**: 18-22 hours across 8 phases

---

## Overview

This plan implements the unified "Entries Appear on Collections" mental model, simplifying navigation from 4 types to 1 unified approach.

**User's Mental Model**:
- Entries do not "belong" to collections, they "appear" on collections
- **Move migration**: Entry removed from current collection(s), added to new collection (creates ghosts in old locations)
- **Add migration**: Entry added to new collection, kept in current collection(s) (active in both)
- **Navigation**: Show "Go to [Collection]" for ALL collections where entry appears (active or ghost), excluding current

---

## Phase 1: Stop Creating TaskMigrated Events (3 hours)

### Objective
Change UI handlers to use `TaskAddedToCollection` + `TaskRemovedFromCollection` instead of `TaskMigrated`.

### Files to Modify

#### 1.1 Update Migrate Handler Routing (`packages/client/src/App.tsx`)

**Current**:
```typescript
const handleMigrate = async (entryId: string, targetCollectionId: string | null) => {
  if (entry.type === 'task') {
    await migrateTaskHandler.handle({ taskId: entryId, targetCollectionId });
  }
  // ... similar for notes/events
};
```

**New**:
```typescript
const handleMigrate = async (
  entryId: string, 
  targetCollectionId: string | null,
  mode: 'move' | 'add' = 'move' // Default to move for backward compat
) => {
  if (entry.type === 'task') {
    const task = await projection.getTaskById(entryId);
    
    if (mode === 'move') {
      // Remove from ALL current collections (creates ghosts)
      for (const collId of task.collections) {
        await removeTaskFromCollectionHandler.handle({
          taskId: entryId,
          collectionId: collId,
        });
      }
    }
    
    // Add to target collection
    await addTaskToCollectionHandler.handle({
      taskId: entryId,
      collectionId: targetCollectionId,
    });
    
    // CASCADE: Move children if parent is being moved
    if (mode === 'move') {
      const children = await projection.getSubTasks(entryId);
      for (const child of children) {
        // Recursively move each child (creates ghosts in their current collections)
        await handleMigrate(child.id, targetCollectionId, 'move');
      }
    }
  }
  // ... similar for notes/events (no cascade)
};
```

**Key Changes**:
1. **Remove from ALL current collections** (not just one) - creates ghosts in all source collections
2. **Add to target** - single collection
3. **Cascade children** - recursive move for sub-tasks
4. **No new `TaskMigrated` events** - only `TaskAdded` + `TaskRemoved`

#### 1.2 Add Mode Selection UI (`packages/client/src/components/MigrateEntryModal.tsx`)

**Add radio buttons** for Move vs Add:

```tsx
export function MigrateEntryModal({ entry, onMigrate, ... }) {
  const [mode, setMode] = useState<'move' | 'add'>('move');
  
  return (
    <Modal>
      <h2>Migrate Entry</h2>
      
      {/* NEW: Mode selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Migration Type</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              checked={mode === 'move'}
              onChange={() => setMode('move')}
              className="mr-2"
            />
            <div>
              <strong>Move</strong>
              <p className="text-sm text-gray-600">
                Remove from current collection(s), add to new collection.
                Entry will appear as ghost in current collection.
              </p>
            </div>
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              checked={mode === 'add'}
              onChange={() => setMode('add')}
              className="mr-2"
            />
            <div>
              <strong>Add</strong>
              <p className="text-sm text-gray-600">
                Keep in current collection(s), also add to new collection.
                Entry will appear active in both locations.
              </p>
            </div>
          </label>
        </div>
      </div>
      
      {/* Existing collection picker */}
      <CollectionPicker onChange={setTargetCollection} />
      
      <button onClick={() => onMigrate(entry.id, targetCollection, mode)}>
        {mode === 'move' ? 'Move' : 'Add'} Entry
      </button>
    </Modal>
  );
}
```

#### 1.3 Update Bulk Migration (`packages/client/src/hooks/useBulkMigration.ts`)

**Current**: Uses `BulkMigrateEntriesHandler` (creates `TaskMigrated` events)

**New**: Loop through entries, call `handleMigrate` for each:

```typescript
const handleBulkMigrate = async (
  entryIds: string[],
  targetCollectionId: string | null,
  mode: 'move' | 'add'
) => {
  setLoading(true);
  
  try {
    for (const entryId of entryIds) {
      await handleMigrate(entryId, targetCollectionId, mode);
    }
    
    // Success notification
    showToast(`${entryIds.length} entries ${mode === 'move' ? 'moved' : 'added'} successfully`);
  } catch (error) {
    showToast('Bulk migration failed', 'error');
  } finally {
    setLoading(false);
  }
};
```

**Performance Note**: This creates N × M events (N entries × M collections per entry). For 100 entries with avg 2 collections = 200 events. Acceptable for now, can optimize later with batch append if needed.

### Tests to Write

```typescript
// packages/client/src/components/MigrateEntryModal.test.tsx
describe('MigrateEntryModal - Mode Selection', () => {
  it('should default to Move mode', () => {
    render(<MigrateEntryModal entry={task} />);
    expect(screen.getByLabelText(/Move/)).toBeChecked();
  });
  
  it('should switch to Add mode when selected', async () => {
    render(<MigrateEntryModal entry={task} onMigrate={mockMigrate} />);
    
    await user.click(screen.getByLabelText(/Add/));
    await user.click(screen.getByText('Add Entry'));
    
    expect(mockMigrate).toHaveBeenCalledWith(task.id, 'target-collection', 'add');
  });
});

// packages/domain/src/move-vs-add-migration.test.ts
describe('Move vs Add Migration (No TaskMigrated)', () => {
  it('should create ghosts in ALL source collections when moving', async () => {
    // Arrange: Task in Collections A, B, C
    await createTask({ collectionId: 'A' });
    await addToCollection({ taskId, collectionId: 'B' });
    await addToCollection({ taskId, collectionId: 'C' });
    
    // Act: Move to Collection D (removes from A, B, C)
    await handleMigrate(taskId, 'D', 'move');
    
    // Assert: Task shows as GHOST in A, B, C
    const entriesA = await projection.getEntriesForCollectionView('A');
    const entriesB = await projection.getEntriesForCollectionView('B');
    const entriesC = await projection.getEntriesForCollectionView('C');
    
    expect(entriesA.find(e => e.id === taskId).renderAsGhost).toBe(true);
    expect(entriesB.find(e => e.id === taskId).renderAsGhost).toBe(true);
    expect(entriesC.find(e => e.id === taskId).renderAsGhost).toBe(true);
    
    // Assert: Task shows as ACTIVE in D
    const entriesD = await projection.getEntriesForCollectionView('D');
    expect(entriesD.find(e => e.id === taskId).renderAsGhost).toBeFalsy();
  });
  
  it('should keep entry active in source when adding', async () => {
    // Arrange: Task in Collection A
    await createTask({ collectionId: 'A' });
    
    // Act: Add to Collection B (keeps in A)
    await handleMigrate(taskId, 'B', 'add');
    
    // Assert: Task shows as ACTIVE in both A and B
    const entriesA = await projection.getEntriesForCollectionView('A');
    const entriesB = await projection.getEntriesForCollectionView('B');
    
    expect(entriesA.find(e => e.id === taskId).renderAsGhost).toBeFalsy();
    expect(entriesB.find(e => e.id === taskId).renderAsGhost).toBeFalsy();
  });
  
  it('should cascade move to children', async () => {
    // Arrange: Parent in A with 2 children
    await createTask({ title: 'Parent', collectionId: 'A' });
    await createSubTask({ title: 'Child1', parentTaskId, collectionId: 'A' });
    await createSubTask({ title: 'Child2', parentTaskId, collectionId: 'A' });
    
    // Act: Move parent to B
    await handleMigrate(parentTaskId, 'B', 'move');
    
    // Assert: All 3 entries show as ghosts in A
    const entriesA = await projection.getEntriesForCollectionView('A');
    expect(entriesA.filter(e => e.renderAsGhost)).toHaveLength(3);
    
    // Assert: All 3 entries show as active in B
    const entriesB = await projection.getEntriesForCollectionView('B');
    expect(entriesB.filter(e => !e.renderAsGhost)).toHaveLength(3);
  });
});
```

### Deliverable
- ✅ No new `TaskMigrated` events created
- ✅ UI supports Move vs Add selection
- ✅ Bulk migration uses same logic
- ✅ Sub-tasks cascade with parent
- ✅ Tests verify ghost rendering for moves

---

## Phase 2: Ghost Rendering Logic Enhancement (4 hours)

### Objective
Update projection to correctly render ghosts for entries removed from collections.

### Files to Modify

#### 2.1 Enhanced Ghost Detection (`packages/domain/src/entry.projections.ts`)

**Current**:
```typescript
async getEntriesForCollectionView(collectionId: string | null): Promise<Entry[]> {
  const tasks = await this.getTasks();
  // ... filters by collections array only
}
```

**New**:
```typescript
async getEntriesForCollectionView(
  collectionId: string | null
): Promise<(Entry & { renderAsGhost?: boolean; ghostOtherLocations?: string[] })[]> {
  const tasks = await this.getTasks();
  const notes = await this.getNotes();
  const events = await this.getEvents();
  
  const allEntries = [...tasks, ...notes, ...events];
  
  // ACTIVE entries: Currently in this collection
  const active = allEntries.filter(entry => {
    if (collectionId === null) {
      return entry.collections?.length === 0; // Uncategorized
    }
    return entry.collections?.includes(collectionId);
  });
  
  // GHOST entries: Removed from this collection (in collectionHistory with removedAt)
  const ghosts = allEntries
    .filter(entry => {
      // NOT currently in this collection
      if (collectionId === null) {
        return entry.collections?.length > 0; // Has been categorized
      }
      return !entry.collections?.includes(collectionId);
    })
    .filter(entry => {
      // But WAS in this collection (has history entry with removedAt)
      return entry.collectionHistory?.some(h => 
        h.collectionId === collectionId && h.removedAt !== undefined
      );
    })
    .map(entry => ({
      ...entry,
      renderAsGhost: true,
      ghostOtherLocations: entry.collections, // ALL active collections (for menu)
    }));
  
  // LEGACY ghosts: Old TaskMigrated events (migratedTo pointer, not in collections array)
  const legacyGhosts = allEntries
    .filter(entry => {
      // Has migratedTo pointer (old format)
      if (!entry.migratedTo) return false;
      
      // Original collection matches current view
      const originalCollectionId = entry.collectionId ?? null;
      return originalCollectionId === collectionId;
    })
    .map(entry => ({
      ...entry,
      renderAsGhost: true,
      ghostOtherLocations: entry.migratedToCollectionId ? [entry.migratedToCollectionId] : [],
    }));
  
  return [...active, ...ghosts, ...legacyGhosts];
}
```

**Key Changes**:
1. **Three categories**: Active, Ghosts (new format), Legacy Ghosts (old format)
2. **Ghost detection**: `collectionHistory` with `removedAt !== undefined`
3. **Ghost metadata**: `renderAsGhost: true`, `ghostOtherLocations: all active collections`

#### 2.2 Sub-Task De-Duplication Logic

**User requirement**: Hide child ghost if parent is also a ghost (avoid duplicate crossed-out items).

**Add to method above**:
```typescript
async getEntriesForCollectionView(
  collectionId: string | null
): Promise<(Entry & { renderAsGhost?: boolean; ghostOtherLocations?: string[] })[]> {
  // ... existing logic from 2.1 ...
  
  const allEntriesWithGhosts = [...active, ...ghosts, ...legacyGhosts];
  
  // DE-DUPLICATE: Hide child ghosts if parent is also a ghost
  const deduplicated = allEntriesWithGhosts.filter(entry => {
    // Keep if not a ghost
    if (!entry.renderAsGhost) return true;
    
    // Keep if not a sub-task
    if (!entry.parentTaskId) return true;
    
    // Check if parent is ALSO a ghost in this view
    const parent = allEntriesWithGhosts.find(e => e.id === entry.parentTaskId);
    
    // If parent is a ghost, HIDE this child ghost (de-duplicate)
    if (parent?.renderAsGhost) {
      return false; // Hide child ghost
    }
    
    // Otherwise, keep child ghost (parent is active or not in this view)
    return true;
  });
  
  return deduplicated;
}
```

**Logic Explanation**:
- **Parent ghost + Child ghost** → Show only parent (hide child)
- **Parent ghost + Child active** → Show both (child still in collection, parent moved)
- **Parent active + Child ghost** → Show both (child moved, parent stayed)
- **Parent active + Child active** → Show both (normal case)

### Tests to Write

See implementation plan for comprehensive test cases.

### Deliverable
- ✅ Ghosts render in all removed collections
- ✅ Sub-task de-duplication (hide child ghost if parent also ghost)
- ✅ Supports multi-collection entries (ghostOtherLocations array)
- ✅ Backward compatibility with legacy `TaskMigrated` ghosts

---

## Phase 3: Unified Navigation Metadata (3 hours)

### Objective
Simplify navigation logic to single rule: "Show all other collections where entry appears (active or ghost)."

### New Projection Method

```typescript
/**
 * Get all collections where an entry appears (for navigation menu).
 * Excludes current collection (no-op navigation).
 * 
 * Returns collections where entry is:
 * - Currently active (in collections array)
 * - Previously removed (in collectionHistory with removedAt)
 * - Legacy migrated to/from (old TaskMigrated format)
 */
async getNavigationCollectionsForEntry(
  entry: Entry,
  currentCollectionId: string | null
): Promise<string[]> {
  const collections = new Set<string>();
  
  // 1. Add all ACTIVE collections (currently in collections array)
  for (const collId of entry.collections || []) {
    if (collId !== currentCollectionId) {
      collections.add(collId);
    }
  }
  
  // 2. Add all REMOVED collections (in collectionHistory with removedAt)
  for (const history of entry.collectionHistory || []) {
    if (history.removedAt !== undefined && history.collectionId !== currentCollectionId) {
      collections.add(history.collectionId);
    }
  }
  
  // 3. LEGACY: Add migratedTo collection (old format)
  if (entry.migratedToCollectionId && entry.migratedToCollectionId !== currentCollectionId) {
    collections.add(entry.migratedToCollectionId);
  }
  
  // 4. LEGACY: Add migratedFrom collection (old format)
  if (entry.migratedFromCollectionId && entry.migratedFromCollectionId !== currentCollectionId) {
    collections.add(entry.migratedFromCollectionId);
  }
  
  return Array.from(collections).sort(); // Alphabetical order
}
```

**Key Features**:
1. **Single method** replaces 4 navigation types
2. **Handles all cases**: Active, removed, legacy migrated
3. **Automatic de-duplication** via `Set`
4. **Excludes current** (no-op check)

### Deliverable
- ✅ Single method returns all navigation collections
- ✅ Handles active, removed, and legacy formats
- ✅ Excludes current collection automatically
- ✅ Supports unlimited collections (10+)

---

## Phase 4: Simplify EntryActionsMenu (2 hours)

### Objective
Replace 4 navigation types with single loop consuming `getNavigationCollectionsForEntry()`.

### Simplified Component

**BEFORE** (Current - 380 lines with 13+ props):
```typescript
interface EntryActionsMenuProps {
  entry: Entry;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddSubTask?: () => void;
  collections?: Collection[];
  currentCollectionId?: string;
  onNavigateToMigrated?: (collectionId: string | null) => void;
  onNavigateToSubTaskCollection?: () => void;
  isSubTask?: boolean;
  isSubTaskMigrated?: boolean;
  isGhost?: boolean;
}
```

**AFTER** (Simplified - ~200 lines with 7 props):
```typescript
interface EntryActionsMenuProps {
  entry: Entry;
  currentCollectionId: string | null;
  collections: Collection[];
  onEdit: () => void;
  onMigrate: () => void;
  onDelete: () => void;
  onAddSubTask?: () => void;
  onNavigateToCollection: (collectionId: string | null) => void;
  isGhost?: boolean;
}

export function EntryActionsMenu({ 
  entry, 
  currentCollectionId,
  collections,
  onEdit,
  onMigrate,
  onDelete,
  onAddSubTask,
  onNavigateToCollection,
  isGhost = false,
}: EntryActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [navigationCollections, setNavigationCollections] = useState<string[]>([]);
  
  // Fetch navigation collections when menu opens
  useEffect(() => {
    if (isOpen) {
      projection.getNavigationCollectionsForEntry(entry, currentCollectionId)
        .then(setNavigationCollections);
    }
  }, [isOpen, entry.id, currentCollectionId]);
  
  // Helper to get collection name
  const getCollectionName = (collectionId: string | null): string => {
    if (collectionId === null) return 'Uncategorized';
    return collections.find(c => c.id === collectionId)?.name || 'Unknown Collection';
  };
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>⋯</button>
      
      {isOpen && (
        <Menu>
          {/* UNIFIED NAVIGATION: Show all other collections */}
          {navigationCollections.map(collId => (
            <MenuItem 
              key={collId}
              onClick={() => {
                onNavigateToCollection(collId);
                setIsOpen(false);
              }}
            >
              Go to {getCollectionName(collId)}
            </MenuItem>
          ))}
          
          {/* Standard actions (unchanged) */}
          {!isGhost && (
            <>
              <MenuItem onClick={onEdit}>Edit</MenuItem>
              <MenuItem onClick={onMigrate}>Migrate</MenuItem>
              {entry.type === 'task' && !entry.parentTaskId && (
                <MenuItem onClick={onAddSubTask}>Add Sub-Task</MenuItem>
              )}
            </>
          )}
          
          <MenuItem onClick={onDelete} className="text-red-600">
            Delete
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
```

**Key Simplifications**:
1. **Removed props**: `onNavigateToMigrated`, `onNavigateToSubTaskCollection`, `isSubTask`, `isSubTaskMigrated` (13 props → 7 props)
2. **Single navigation loop**: Replaces 4 conditional blocks
3. **No complex logic**: Projection handles all cases
4. **Async loading**: Fetches navigation on menu open (lazy)

### Deliverable
- ✅ EntryActionsMenu reduced from 380 → 200 lines
- ✅ 13+ props → 7 props
- ✅ Single navigation loop (no conditional logic)
- ✅ All tests passing

---

## Phase 5: Update GhostEntry Component (1 hour)

### Objective
Update ghost rendering to show multiple "other locations" (not just first one).

### Enhanced Component

```typescript
export function GhostEntry({ entry, onNavigateToCollection, ... }) {
  const [navigationCollections, setNavigationCollections] = useState<string[]>([]);
  
  useEffect(() => {
    projection.getNavigationCollectionsForEntry(entry, currentCollectionId)
      .then(setNavigationCollections);
  }, [entry.id, currentCollectionId]);
  
  // Get friendly description for ghost location(s)
  const getGhostLocationText = (): string => {
    if (navigationCollections.length === 0) return 'another collection';
    if (navigationCollections.length === 1) {
      return getCollectionName(navigationCollections[0]);
    }
    return `${navigationCollections.length} other collections`;
  };
  
  return (
    <div className="ghost-entry">
      <BulletIcon 
        entry={entry}
        isGhost={true}
        title={`Moved to ${getGhostLocationText()}`}
      />
      
      {/* Entry content (crossed out) */}
      <div className="line-through opacity-50">
        {getEntryText(entry)}
      </div>
      
      {/* Actions menu - uses unified navigation */}
      <EntryActionsMenu
        entry={entry}
        currentCollectionId={currentCollectionId}
        collections={collections}
        onNavigateToCollection={onNavigateToCollection}
        isGhost={true}
      />
    </div>
  );
}
```

### Deliverable
- ✅ Ghost entries show accurate location count
- ✅ Menu shows all other collections (not just one)

---

## Phase 6: Sub-Task De-Duplication UI (2 hours)

### Objective
Verify UI-level hiding of duplicate child ghosts when parent is also ghosted.

### Testing Focus

Projection already filters (from Phase 2), need to verify UI rendering:

```typescript
describe('EntryList - Sub-Task De-duplication', () => {
  it('should hide child ghosts when parent is also ghost', async () => {
    // Arrange: Parent + child in Collection A, both moved to B
    await createTask({ title: 'Parent', collectionId: 'A' });
    await createSubTask({ title: 'Child', parentTaskId });
    await handleMigrate(parentTaskId, 'B', 'move'); // Cascades
    
    // Act: Render Collection A view
    const entries = await projection.getEntriesForCollectionView('A');
    render(<EntryList entries={entries} currentCollectionId="A" />);
    
    // Assert: Only parent ghost shown, child ghost hidden
    expect(screen.getByText('Parent')).toBeInTheDocument(); // Ghost
    expect(screen.queryByText('Child')).not.toBeInTheDocument(); // Hidden
  });
  
  it('should show child ghost when parent is active', async () => {
    // Arrange: Parent in A, child moved to B independently
    await createTask({ title: 'Parent', collectionId: 'A' });
    await createSubTask({ title: 'Child', parentTaskId });
    await handleMigrate(childTaskId, 'B', 'move'); // Only child moves
    
    // Act: Render Collection A view
    const entries = await projection.getEntriesForCollectionView('A');
    render(<EntryList entries={entries} currentCollectionId="A" />);
    
    // Assert: Both shown (parent active, child ghost)
    expect(screen.getByText('Parent')).toBeInTheDocument(); // Active
    expect(screen.getByText('Child')).toBeInTheDocument(); // Ghost
  });
});
```

### Deliverable
- ✅ Child ghosts hidden when parent also ghosted
- ✅ Tests verify de-duplication logic

---

## Phase 7: Debug Tool Implementation (2 hours) ✅ COMPLETED

See separate implementation in `packages/client/src/components/EventHistoryDebugTool.tsx`.

### Deliverable
- ✅ Debug tool shows all events for entry
- ✅ Only visible in dev mode
- ✅ Helps diagnose migration issues

---

## Phase 8: Documentation & ADR (2 hours)

### Files to Create/Update

1. **ADR-015** in `docs/architecture-decisions.md`
2. **Migration Guide** in `docs/MIGRATION_GUIDE_ADR015.md`
3. Update **roadmap.md** with ADR-015 implementation status

### Deliverable
- ✅ ADR-015 documented
- ✅ Migration guide created
- ✅ Breaking changes clearly listed

---

## Summary: Phase Timeline

| Phase | Estimated Time | Deliverable | Risk |
|-------|---------------|-------------|------|
| 1. Stop TaskMigrated Events | 3 hours | UI uses Move/Add handlers, cascade logic | Low |
| 2. Ghost Rendering Enhanced | 4 hours | Multi-collection ghosts, de-duplication | Medium |
| 3. Navigation Metadata | 3 hours | `getNavigationCollectionsForEntry()` method | Low |
| 4. Simplify Menu | 2 hours | EntryActionsMenu refactor | Low |
| 5. Update GhostEntry | 1 hour | Multi-location ghost rendering | Low |
| 6. Sub-Task De-duplication | 2 hours | UI-level filtering | Low |
| 7. Debug Tool | 2 hours | Event history viewer | Low |
| 8. Documentation | 2 hours | ADR-015, migration guide | Low |
| **TOTAL** | **19 hours** | Unified migration model | **Medium** |

---

## Testing Checklist (Per Phase)

- [ ] **Phase 1**: Move creates ghosts in all source collections
- [ ] **Phase 1**: Add keeps entry active in source
- [ ] **Phase 1**: Sub-tasks cascade with parent
- [ ] **Phase 2**: Ghosts render in removed collections
- [ ] **Phase 2**: Child ghosts hidden when parent ghosted
- [ ] **Phase 3**: Navigation shows all other collections
- [ ] **Phase 3**: Current collection excluded from navigation
- [ ] **Phase 4**: Menu renders with simplified props
- [ ] **Phase 4**: Navigation clicks work correctly
- [ ] **Phase 5**: Ghost location text accurate
- [ ] **Phase 6**: Sub-task de-duplication in UI
- [x] **Phase 7**: Debug tool loads event history
- [ ] **Phase 8**: ADR documented, migration guide complete

---

## Rollback Strategy

**If critical issues found during implementation**:

1. **Phase 1 rollback**: Revert UI handler changes, use old `MigrateTaskHandler`
2. **Phase 2+ rollback**: Projection changes are backward compatible, can revert projection without data loss
3. **Data safety**: All events preserved, projection changes don't affect event log

**No data loss risk** - events are immutable, projection is derived.

---

## Next Steps

**Recommended order**:
1. Implement Phase 1 (3 hours) - Get immediate feedback on Move vs Add UX
2. Implement Phase 2 (4 hours) - Verify ghost rendering works correctly
3. Continue with Phases 3-6 in sequence
4. Phase 7 already complete (Debug Tool)
5. Complete Phase 8 (Documentation)

**Status**: Phase 7 (Debug Tool) completed on 2026-02-14
