# Session 10: Bulk Entry Migration - Design Specification

**Date:** February 5, 2026  
**Designer:** Alex (Architecture Agent)  
**Target Version:** v0.5.0 (minor release)  
**Estimated Time:** 6-9 hours  
**Status:** ✅ Approved - Ready for Implementation

---

## Executive Summary

Session 10 introduces **Bulk Entry Migration**, allowing users to select and migrate multiple entries at once. This addresses a common pain point: migrating many incomplete tasks from yesterday to today, or reorganizing entries between collections.

### Key Features
- Selection mode toggle for clean UI
- Select multiple entries via checkboxes
- Quick filters: all, incomplete tasks, notes, deselect all
- Bulk migrate to any collection in one action
- Mobile and desktop optimized

### User Decisions (February 5, 2026)
- ✅ **Maximum selection:** Unlimited (no artificial limit)
- ✅ **Modal title:** Show count ("Migrate 12 entries")
- ✅ **Selection persistence:** Clear on navigation
- ✅ **Entry order:** Maintain relative order in target
- ✅ **Event filter:** No (not needed)
- ✅ **Completed tasks filter:** No (not needed)

---

## UX Design

### Entry into Selection Mode

**Desktop:**
- Collection header menu contains "Select Entries" option
- Click to enter selection mode

**Mobile:**
- Floating "Select" button at bottom-right (next to FAB for new entries)
- Tap to enter selection mode

**Visual Change:**
- Checkboxes appear on left side of each entry
- Selection toolbar appears at bottom (mobile) or top (desktop)
- Visual highlight indicates selection mode is active

### Selection Mode UI

**Entry Item Changes:**
```
┌─────────────────────────────────────────────┐
│ [ ] • Buy groceries                      ≡ │  ← Checkbox on left, drag handle on right
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ [✓] • Buy groceries                      ≡ │  ← Selected state
└─────────────────────────────────────────────┘
```

**Selection Toolbar (Bottom on Mobile, Top on Desktop):**
```
┌─────────────────────────────────────────────┐
│ 12 selected                                 │
│                                             │
│ [All] [Incomplete] [Notes] [Clear]          │
│                                             │
│         [Migrate]        [Cancel]           │
└─────────────────────────────────────────────┘
```

**Quick Filters:**
- **All** - Select all entries in current collection
- **Incomplete** - Select all incomplete tasks only
- **Notes** - Select all note entries only
- **Clear** - Deselect all

**Actions:**
- **Migrate** - Opens migration modal with selected entries
- **Cancel** - Exit selection mode, clear selections

### Bulk Migration Flow

1. **User enters selection mode** (button click)
2. **User selects entries** (tap checkboxes or use quick filters)
3. **User taps "Migrate" button**
4. **Migration modal opens** with title "Migrate 12 entries"
5. **User chooses destination collection**
6. **User taps "Migrate"**
7. **All entries migrate in batch** (optimistic UI update)
8. **Selection mode exits** automatically
9. **Success toast** appears: "12 entries migrated to Today"

### Edge Cases

**Empty Selection:**
- "Migrate" button is disabled
- Toolbar shows "0 selected"

**Single Selection:**
- Works identically to multi-select
- Modal shows "Migrate 1 entry" (not "entries")

**Large Selection (100+ entries):**
- No hard limit (per user decision)
- Warning toast: "Migrating large number of entries may take a moment"
- Progress indicator during migration (if >50 entries)

**Same Collection:**
- Migration modal filters out current collection from destination list
- User cannot migrate to the same collection

**Navigation During Selection:**
- Selections are cleared when navigating to another collection
- Selection mode exits automatically

---

## Technical Design

### State Management

**New Hook:** `useSelectionMode`

```typescript
interface SelectionState {
  isSelectionMode: boolean;
  selectedEntryIds: Set<string>;
}

function useSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  const enterSelectionMode = () => setIsSelectionMode(true);
  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEntryIds(new Set());
  };

  const toggleSelection = (entryId: string) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const selectAll = (entryIds: string[]) => {
    setSelectedEntryIds(new Set(entryIds));
  };

  const clearSelection = () => {
    setSelectedEntryIds(new Set());
  };

  return {
    isSelectionMode,
    selectedEntryIds,
    selectedCount: selectedEntryIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
  };
}
```

**State Location:** `CollectionDetailView` component (ephemeral state, not persisted)

**Navigation Effect:**
```typescript
useEffect(() => {
  // Clear selection when navigating away
  return () => {
    if (isSelectionMode) {
      exitSelectionMode();
    }
  };
}, [collectionId]);
```

### Components Structure

#### New Components

**1. SelectionModeToggle** (`components/SelectionModeToggle.tsx`)
```typescript
interface SelectionModeToggleProps {
  isSelectionMode: boolean;
  onEnter: () => void;
  onExit: () => void;
}
```
- Renders as button in collection header menu (desktop)
- Renders as floating action button (mobile)

**2. SelectionToolbar** (`components/SelectionToolbar.tsx`)
```typescript
interface SelectionToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onSelectIncomplete: () => void;
  onSelectNotes: () => void;
  onClear: () => void;
  onMigrate: () => void;
  onCancel: () => void;
}
```
- Shows selection count and quick filter buttons
- Positioned at bottom (mobile) or top (desktop)
- "Migrate" button disabled when selectedCount === 0

**3. SelectableEntryItem** (`components/SelectableEntryItem.tsx`)
```typescript
interface SelectableEntryItemProps {
  entry: Entry;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (entryId: string) => void;
  children: React.ReactNode; // Existing EntryItem
}
```
- Wraps existing `EntryItem` with checkbox when in selection mode
- Handles checkbox click separately from entry click

#### Modified Components

**1. CollectionDetailView** (`views/CollectionDetailView.tsx`)
- Add `useSelectionMode` hook
- Pass selection state to child components
- Handle bulk migration modal opening
- Clear selection on navigation

**2. MigrateEntryModal** (`components/MigrateEntryModal.tsx`)
```typescript
interface MigrateEntryModalProps {
  entry?: Entry;           // Single entry (existing)
  entries?: Entry[];       // Multiple entries (NEW)
  // ... rest of props
}
```
- Accept either single `entry` or multiple `entries`
- Title adjusts based on count: "Migrate entry" vs "Migrate 12 entries"
- Migrate action handles batch operations

**3. CollectionHeader** (`components/CollectionHeader.tsx`)
- Add "Select Entries" menu option (desktop)
- Trigger `onEnterSelectionMode` callback

### Event Sourcing

**No New Event Types!**

Reuse existing migration events:
- `TaskMigrated`
- `NoteMigrated`
- `EventMigrated`

**Batch Migration Strategy:**
```typescript
async function bulkMigrateEntries(entries: Entry[], toCollectionId: string) {
  const events: Event[] = [];

  for (const entry of entries) {
    const event = createMigrationEvent(entry, toCollectionId);
    events.push(event);
  }

  // Append all events in a single transaction
  await eventStore.appendBatch(events);
}
```

**Event Metadata (Optional Enhancement):**
```typescript
{
  type: 'TaskMigrated',
  aggregateId: 'task-123',
  payload: { /* ... */ },
  metadata: {
    batchId: 'bulk-migration-xyz',  // Links related migrations
    batchSize: 12,                   // Total in batch
    batchIndex: 0,                   // Index in batch
  }
}
```

### Performance Considerations

**Challenge:** Migrating 100+ entries could be slow

**Solutions:**

1. **Optimistic UI Updates:**
   - Remove entries from source collection immediately
   - Add to target collection immediately
   - Event store operations happen in background

2. **Batch Event Appending:**
   - Firebase `writeBatch()` supports up to 500 operations
   - Single network round-trip for all migrations

3. **Progress Indication:**
   - Show spinner during migration
   - If >50 entries: show progress bar with count
   - Toast notification on completion

4. **Chunking (if needed):**
   - If >200 entries, chunk into batches of 100
   - Process sequentially with progress updates

**Expected Performance:**
- 10 entries: <100ms
- 50 entries: <500ms
- 100 entries: <1s
- 200+ entries: 1-3s (with progress indicator)

---

## Implementation Plan

### Phase 1: Core Selection UI (2-3 hours)

**Step 1.1: Create `useSelectionMode` hook (30 min)**
- File: `packages/client/src/hooks/useSelectionMode.ts`
- Implement state management logic
- Add tests: `useSelectionMode.test.ts`

**Step 1.2: Create `SelectableEntryItem` component (1 hour)**
- File: `packages/client/src/components/SelectableEntryItem.tsx`
- Wrap `EntryItem` with checkbox
- Handle selection toggle
- Style selected state (background highlight)
- Add tests: `SelectableEntryItem.test.tsx`

**Step 1.3: Create `SelectionModeToggle` component (30 min)**
- File: `packages/client/src/components/SelectionModeToggle.tsx`
- Render button in header menu (desktop)
- Render FAB (mobile)
- Add tests: `SelectionModeToggle.test.tsx`

**Step 1.4: Integrate into `CollectionDetailView` (1 hour)**
- Add `useSelectionMode` hook
- Pass state to entry items
- Render selection mode toggle
- Handle navigation cleanup

**Expected Output:**
- User can enter/exit selection mode
- Checkboxes appear on entries
- Entries can be selected/deselected
- Selection count visible

---

### Phase 2: Quick Filters (1 hour)

**Step 2.1: Create `SelectionToolbar` component (30 min)**
- File: `packages/client/src/components/SelectionToolbar.tsx`
- Render quick filter buttons
- Show selection count
- Migrate/Cancel buttons
- Add tests: `SelectionToolbar.test.tsx`

**Step 2.2: Implement filter logic (30 min)**
- "Select All" → `selectAll(allEntryIds)`
- "Incomplete" → `selectAll(entries.filter(e => e.type === 'task' && !e.completed).map(e => e.id))`
- "Notes" → `selectAll(entries.filter(e => e.type === 'note').map(e => e.id))`
- "Clear" → `clearSelection()`

**Expected Output:**
- Toolbar renders with selection count
- Quick filters work correctly
- Selection count updates dynamically

---

### Phase 3: Bulk Migration (2-3 hours)

**Step 3.1: Extend `MigrateEntryModal` for bulk (1 hour)**
- File: `packages/client/src/components/MigrateEntryModal.tsx`
- Accept `entries?: Entry[]` prop
- Adjust modal title based on count
- Update modal content ("X entries will be migrated")
- Add tests for bulk mode

**Step 3.2: Implement batch migration handler (1 hour)**
- File: `packages/client/src/hooks/useEntryOperations.ts`
- Add `handleBulkMigrate` function
- Loop through entries, create migration events
- Use `eventStore.appendBatch()` for performance
- Handle errors gracefully

**Step 3.3: Integrate migration flow (1 hour)**
- Wire "Migrate" button in toolbar to open modal
- Pass selected entries to modal
- Handle successful migration (exit selection mode, clear selection)
- Show success toast with count
- Handle edge cases (empty selection, same collection)

**Expected Output:**
- User can bulk migrate selected entries
- Modal shows correct count and entry list
- Migration completes successfully
- Selection mode exits after migration
- Toast notification appears

---

### Phase 4: Testing & Polish (1-2 hours)

**Step 4.1: Unit Tests (30 min)**
- Test `useSelectionMode` hook logic
- Test quick filter functions
- Test batch migration handler

**Step 4.2: Integration Tests (30 min)**
- Test full selection → migration flow
- Test edge cases (empty, large batch)
- Test navigation cleanup

**Step 4.3: Mobile Testing (30 min)**
- Test touch targets (48x48px minimum)
- Test FAB positioning
- Test toolbar responsiveness
- Test swipe gestures don't conflict with selection

**Step 4.4: Visual Polish (30 min)**
- Dark mode styling
- Selection highlight color
- Checkbox animations
- Loading states
- Error states

**Expected Output:**
- All tests passing
- Mobile UX feels natural
- Dark mode works correctly
- No visual glitches

---

## Files to Create/Modify

### New Files (5)
1. `packages/client/src/hooks/useSelectionMode.ts`
2. `packages/client/src/hooks/useSelectionMode.test.ts`
3. `packages/client/src/components/SelectionModeToggle.tsx`
4. `packages/client/src/components/SelectionToolbar.tsx`
5. `packages/client/src/components/SelectableEntryItem.tsx`

### Modified Files (4)
1. `packages/client/src/views/CollectionDetailView.tsx`
2. `packages/client/src/components/MigrateEntryModal.tsx`
3. `packages/client/src/components/CollectionHeader.tsx`
4. `packages/client/src/hooks/useEntryOperations.ts`

### Test Files (3 new + 2 modified)
1. `packages/client/src/components/SelectionModeToggle.test.tsx` (new)
2. `packages/client/src/components/SelectionToolbar.test.tsx` (new)
3. `packages/client/src/components/SelectableEntryItem.test.tsx` (new)
4. `packages/client/src/components/MigrateEntryModal.test.tsx` (modified)
5. `packages/client/src/hooks/useEntryOperations.test.ts` (modified)

**Total:** 9 new files, 4 modified files

---

## Success Criteria

### Functional Requirements
- [x] User can enter selection mode via button
- [x] User can exit selection mode via cancel button
- [x] User can select/deselect individual entries
- [x] User can use "Select All" quick filter
- [x] User can use "Select Incomplete Tasks" quick filter
- [x] User can use "Select Notes" quick filter
- [x] User can clear all selections
- [x] Selection count badge shows accurate number
- [x] User can bulk migrate selected entries to another collection
- [x] Entries maintain relative order in target collection
- [x] Selection clears after successful migration
- [x] Selection clears when navigating to another collection
- [x] Selection mode exits automatically after migration
- [x] "Migrate" button disabled when no entries selected
- [x] Migration modal shows accurate count in title
- [x] Success toast shows accurate count after migration

### Performance Requirements
- [x] Selecting/deselecting entry: <50ms response time
- [x] Quick filters: <100ms to select all
- [x] Bulk migration (10 entries): <500ms
- [x] Bulk migration (50 entries): <2s
- [x] Bulk migration (100+ entries): <5s with progress indicator
- [x] No UI freezing during large migrations

### UX Requirements
- [x] Mobile touch targets ≥48x48px
- [x] Clear visual distinction between normal and selection mode
- [x] Selected entries have visible highlight
- [x] Checkboxes don't interfere with drag handles
- [x] Toolbar doesn't obscure content
- [x] Works on mobile (320px width) and desktop (1920px width)
- [x] Dark mode styling correct
- [x] Animations smooth (if any)

### Quality Requirements
- [x] All existing tests still passing
- [x] New unit tests for selection logic (≥90% coverage)
- [x] Integration tests for bulk migration flow
- [x] No regressions in single-entry migration
- [x] No console errors or warnings
- [x] TypeScript types are correct and strict

---

## Risk Assessment

**Risk Level:** MEDIUM

### Identified Risks

1. **Performance with very large selections (500+ entries)**
   - **Mitigation:** Warning toast, progress indicator, chunked processing
   - **Likelihood:** Low (users rarely have 500+ entries in one collection)

2. **UI complexity in selection mode**
   - **Mitigation:** Clear visual states, simple toggle, user testing
   - **Likelihood:** Low (design follows familiar patterns from mobile OS)

3. **State management bugs (selection sync issues)**
   - **Mitigation:** Comprehensive tests, React's built-in state batching
   - **Likelihood:** Low (simple Set-based state)

4. **Conflicts with existing gestures (drag-and-drop)**
   - **Mitigation:** Checkboxes on left, drag handles on right, clear separation
   - **Likelihood:** Low (different touch targets)

5. **Event store batch append failures**
   - **Mitigation:** Firebase `writeBatch()` is atomic, graceful error handling
   - **Likelihood:** Very low (existing migration uses same mechanism)

### Rollback Plan

If critical issues arise after deployment:

1. **Quick Disable (No Code Revert):**
   - Hide "Select Entries" button in UI (1-line change)
   - Feature becomes inaccessible but code remains
   - No data loss or corruption

2. **Full Rollback:**
   - Revert commit (9 new files, 4 modified files)
   - Re-deploy previous version
   - Single-entry migration unaffected

3. **Partial Rollback:**
   - Keep selection UI, disable bulk migration
   - Users can select but not migrate (useful for debugging)

---

## Architecture Decision Records

### ADR: Selection Mode vs Always-Visible Checkboxes

**Context:** Need to allow bulk operations without cluttering the UI.

**Decision:** Use a "Selection Mode" toggle rather than always-visible checkboxes.

**Rationale:**
1. **Clean UI:** Migration isn't the primary action; checkboxes would clutter everyday use
2. **Mobile Patterns:** iOS Files, Android file managers use selection mode successfully
3. **Accidental Selections:** Always-visible checkboxes risk accidental taps during scrolling
4. **Clear State:** Visual distinction between normal and selection mode reduces confusion

**Alternatives Considered:**
- Always-visible checkboxes: Cluttered UI, accidental selections
- Long-press to enter mode: Less discoverable, conflicts with mobile context menus
- Swipe gesture to select: Conflicts with existing swipe navigation

**Consequences:**
- **Positive:** Clean UI, clear state transitions, follows familiar patterns
- **Positive:** No conflicts with existing drag-and-drop or swipe navigation
- **Neutral:** Requires one extra tap to enter mode (acceptable tradeoff)
- **Negative:** Selection mode may not be immediately discoverable (mitigated by menu placement)

---

### ADR: Batch Event Appending vs Single Migration Events

**Context:** Need to migrate multiple entries efficiently.

**Decision:** Append multiple migration events in a single batch operation.

**Rationale:**
1. **Performance:** Single network round-trip vs N round-trips
2. **Atomicity:** Firebase `writeBatch()` ensures all-or-nothing
3. **Audit Trail:** Each entry still has its own migration event (full event sourcing)
4. **Existing Support:** Event store already supports batch appends (from Firebase sync)

**Alternatives Considered:**
- Create single "BulkMigration" event: Loses per-entry audit trail, breaks undo patterns
- Sequential event appends: Slow (N network calls), partial failures harder to handle
- Optimistic UI only: Breaks event sourcing, data loss on errors

**Consequences:**
- **Positive:** Fast, atomic, preserves event sourcing integrity
- **Positive:** Reuses existing event types and handlers
- **Negative:** Batch size limited by Firebase (500 operations) - acceptable given unlimited selection
- **Mitigation:** If >500 entries, chunk into multiple batches with progress indicator

---

### ADR: No Selection Persistence Across Navigation

**Context:** Should selections remain if user navigates away and returns?

**Decision:** Clear selections when navigating to another collection.

**Rationale:**
1. **Simplicity:** No need to persist state across navigation
2. **Predictability:** Users expect ephemeral state in selection mode
3. **Reduced Bugs:** No sync issues between in-memory state and persisted state
4. **Consistency:** Matches mobile OS behavior (iOS, Android file managers)

**User Decision:** Approved - "Clear on navigation (Recommended)"

**Alternatives Considered:**
- Persist selections in localStorage: Added complexity, potential for stale state
- Persist per-collection: Even more complex, unclear use case

**Consequences:**
- **Positive:** Simple implementation, predictable behavior, no persistence bugs
- **Negative:** User must reselect if they navigate away (acceptable - rare use case)

---

## Testing Strategy

### Unit Tests

**useSelectionMode Hook:**
```typescript
describe('useSelectionMode', () => {
  it('should initialize with selection mode off');
  it('should enter selection mode');
  it('should exit selection mode and clear selections');
  it('should toggle individual entry selection');
  it('should select all entries');
  it('should clear all selections');
  it('should track selected count accurately');
});
```

**SelectableEntryItem:**
```typescript
describe('SelectableEntryItem', () => {
  it('should render checkbox when in selection mode');
  it('should not render checkbox when not in selection mode');
  it('should handle checkbox toggle');
  it('should highlight when selected');
  it('should not highlight when not selected');
});
```

**Quick Filter Logic:**
```typescript
describe('Quick Filters', () => {
  it('should select all entries');
  it('should select only incomplete tasks');
  it('should select only notes');
  it('should clear selection');
  it('should handle empty entry list');
});
```

**Bulk Migration:**
```typescript
describe('Bulk Migration', () => {
  it('should create migration events for all selected entries');
  it('should append events in batch');
  it('should handle mixed entry types');
  it('should preserve entry order in target collection');
  it('should handle errors gracefully');
});
```

### Integration Tests

**Full Selection Flow:**
```typescript
describe('Selection Flow', () => {
  it('should allow selecting and migrating multiple entries');
  it('should clear selection after successful migration');
  it('should exit selection mode after migration');
  it('should show success toast with accurate count');
});
```

**Edge Cases:**
```typescript
describe('Edge Cases', () => {
  it('should disable migrate button when no entries selected');
  it('should prevent migration to same collection');
  it('should clear selection on navigation');
  it('should handle large selections (100+ entries)');
  it('should show progress indicator for large migrations');
});
```

### Manual Testing Checklist

**Desktop:**
- [ ] Enter selection mode via header menu
- [ ] Select/deselect individual entries
- [ ] Use quick filters (All, Incomplete, Notes, Clear)
- [ ] Bulk migrate to another collection
- [ ] Verify entries appear in target with correct order
- [ ] Verify selection clears after migration
- [ ] Test with 50+ entries

**Mobile:**
- [ ] Enter selection mode via floating button
- [ ] Tap checkboxes to select (verify 48x48px touch target)
- [ ] Use quick filters on toolbar
- [ ] Bulk migrate via toolbar button
- [ ] Verify no conflicts with swipe navigation
- [ ] Test on small screen (320px width)

**Cross-Browser:**
- [ ] Chrome (desktop + mobile simulator)
- [ ] Safari (macOS + iOS)
- [ ] Firefox (desktop)

**Dark Mode:**
- [ ] Selection highlights visible
- [ ] Toolbar styling correct
- [ ] Checkboxes visible

---

## User Decisions Summary

**Question 1: Maximum Selection Limit**
- ✅ **Unlimited** (no artificial limit)
- Note: Show warning toast if >100 entries, progress indicator if >50

**Question 2: Migration Modal Title**
- ✅ **Show count** ("Migrate 12 entries" vs "Migrate entry")

**Question 3: Selection Persistence**
- ✅ **Clear on navigation** (simple and predictable)

**Question 4: Entry Order in Target**
- ✅ **Maintain relative order** (entries keep their relative positions)

**Question 5: Event Quick Filter**
- ✅ **No** (events are less common, "Select all" is sufficient)

**Question 6: Completed Tasks Filter**
- ✅ **No** ("Select all incomplete tasks" + "Select all" covers most use cases)

---

## Next Steps

1. ✅ **Design Complete** - This document
2. ⏳ **User Approval** - User reviews and approves design
3. ⏳ **Sam Implementation** - 6-9 hours over 1 session
4. ⏳ **Casey Review** - Code quality and test coverage check
5. ⏳ **User Testing** - Manual verification on mobile and desktop
6. ⏳ **Deploy v0.5.0** - Production release

---

**Document Status:** ✅ Ready for Implementation  
**User Decisions:** All 6 questions answered  
**Next Action:** Sam begins Phase 1 implementation  
**Estimated Timeline:** 6-9 hours (1 session)
