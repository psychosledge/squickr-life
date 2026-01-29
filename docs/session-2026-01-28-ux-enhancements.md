# Session Summary: Phase 4 UX Enhancements (Pre-Backend Sync)

**Date:** 2026-01-28  
**Status:** 🚧 In Progress  
**Goal:** Polish Collections UX based on manual testing feedback before implementing backend sync

---

## Manual Testing Findings

After completing Phase 3 (Entry Migration + Bullet Journal Icons), manual testing revealed 7 UX improvement opportunities:

### Issues Identified

1. **Title/Subtitle Inconsistency**
   - Collections Index shows "Collections" / "Organize your life into collections"
   - Should restore original branding: "Squickr Life" / "Get shit done quicker with Squickr!"
   - Found in git history from old DailyLogsView (commit `34aeb59`)

2. **FAB Overlap on Mobile**
   - Floating Action Button covers the drag handle of last entry on mobile
   - Makes it difficult to reorder the last item in a list
   - Solution: Add bottom padding to entry lists

3. **Collection Reordering Missing**
   - Collections can be created but not reordered
   - Users expect drag-and-drop like entries have
   - Backend handler already exists (`ReorderCollectionHandler`)

4. **Event Date Picker UX Issue**
   - After picking date, user must return to textbox and press Enter
   - On mobile, keyboard dismissal loses the Enter key
   - Solution: Add explicit Save button for all entry types

5. **Event Time Field Missing**
   - Events only support date, not time
   - Users need to specify when events happen (e.g., "Meeting at 2pm")
   - **DEFERRED:** Moved to post-sync backlog (requires architecture design)

6. **Entry Actions Take Too Much Space**
   - Currently showing separate icons: ↗️ (migrate) + 🗑️ (delete)
   - Should consolidate into menu: ⋮ → [Edit, Move, Delete]
   - Saves screen real estate, especially on mobile

7. **No Navigation for Migrated Entries**
   - Migrated entries show blue `>` but can't navigate to target
   - Menu should include "Go to [Collection Name]" option
   - Helps users track where entries were moved

---

## Implementation Plan

### Phase 4A: Title/Subtitle Restoration
**Priority:** Medium  
**Effort:** 5 minutes  
**Complexity:** Trivial

**Changes:**
- Update `CollectionIndexView.tsx` header
- Replace "Collections" → "Squickr Life"
- Replace "Organize your life into collections" → "Get shit done quicker with Squickr!"

**Files to Modify:**
- `packages/client/src/views/CollectionIndexView.tsx`

**Tests:** Update existing snapshot/text expectations

**Success Criteria:**
- ✅ Title reads "Squickr Life" with gradient styling
- ✅ Subtitle reads "Get shit done quicker with Squickr!"
- ✅ All tests pass

---

### Phase 4B: Add Padding to Prevent FAB Overlap
**Priority:** Medium  
**Effort:** 10 minutes  
**Complexity:** Trivial

**Problem:** FAB covers last entry's drag handle on mobile

**Solution:**
- Add bottom padding (`pb-24` or `pb-32`) to entry list container
- Ensures last entry is fully accessible above the FAB

**Files to Modify:**
- `packages/client/src/components/EntryList.tsx` (add padding to container)
- OR `packages/client/src/views/CollectionDetailView.tsx` (add padding to list wrapper)

**Tests:** Visual verification on mobile

**Success Criteria:**
- ✅ Last entry is not covered by FAB on mobile
- ✅ User can drag last entry without FAB interference
- ✅ Padding is responsive (only needed when FAB is visible)

---

### Phase 4C: Add Save Button to EntryInput
**Priority:** High  
**Effort:** 30 minutes  
**Complexity:** Low

**Problem:** On mobile, keyboard dismissal loses Enter key, making it hard to save entries

**Solution:**
- Add visible "Save" button next to input field
- Keep Enter key functionality for keyboard users
- Button should be prominent and mobile-friendly

**UI Layout:**
```
┌──────────────────────────────────────────┐
│ [Task] [Note] [Event]                    │
│ ┌────────────────────────────┬─────────┐ │
│ │ What needs to be done?     │ [Save]  │ │
│ └────────────────────────────┴─────────┘ │
└──────────────────────────────────────────┘
```

**Files to Modify:**
- `packages/client/src/components/EntryInput.tsx`
- `packages/client/src/components/EntryInput.test.tsx`

**Tests:**
- Save button click triggers submission
- Save button disabled when input is empty
- Enter key still works (backward compatibility)
- Button works for all entry types (task, note, event)

**Success Criteria:**
- ✅ Save button visible and functional
- ✅ Works on mobile when keyboard is dismissed
- ✅ Enter key still works for keyboard users
- ✅ All existing tests pass + new button tests

---

### Phase 4D: Create Entry Actions Menu
**Priority:** High  
**Effort:** 2-3 hours  
**Complexity:** Medium

**Current State:**
```
[•] Task title          ↗️ 🗑️
```

**New State:**
```
[•] Task title          ⋮
    └─ Menu: [Edit] [Move to...] [Delete]
```

**Implementation:**
1. Create `EntryActionsMenu.tsx` component
   - Three-dot menu trigger (⋮)
   - Dropdown/bottom-sheet menu
   - Actions: Edit, Move to collection, Delete
   - Mobile: Bottom sheet (iOS/Android style)
   - Desktop: Dropdown menu

2. Replace individual action buttons in entry items
   - Remove ↗️ (migrate) button
   - Remove 🗑️ (delete) button
   - Add ⋮ (menu) button

3. Add Edit action
   - For tasks: Enter inline edit mode
   - For notes: Enter inline edit mode
   - For events: Enter inline edit mode

**Files to Create:**
- `packages/client/src/components/EntryActionsMenu.tsx`
- `packages/client/src/components/EntryActionsMenu.test.tsx`

**Files to Modify:**
- `packages/client/src/components/TaskEntryItem.tsx`
- `packages/client/src/components/NoteEntryItem.tsx`
- `packages/client/src/components/EventEntryItem.tsx`

**Tests (20+ tests):**
- Menu opens/closes on trigger click
- Edit action triggers edit mode
- Move action opens MoveEntryToCollectionModal
- Delete action calls onDelete handler
- Menu closes after action selection
- Keyboard navigation (Tab, Enter, Escape)
- ARIA attributes for accessibility
- Click outside menu closes it

**Success Criteria:**
- ✅ Menu replaces individual action icons
- ✅ All three actions work correctly
- ✅ Mobile-friendly (bottom sheet on small screens)
- ✅ Keyboard accessible
- ✅ All tests pass (including updated entry item tests)

---

### Phase 4E: Add "Go To" Navigation for Migrated Entries
**Priority:** Medium  
**Effort:** 1 hour  
**Complexity:** Low

**Feature:**
- When entry has `migratedTo` field, menu shows "Go to [Collection Name]"
- Clicking navigates to the target collection
- Only for original entries (not the new migrated copy)

**Implementation:**
1. Update `EntryActionsMenu.tsx` to check for `migratedTo`
2. Look up target collection name from collections list
3. Add "Go to [Collection Name]" menu item
4. Use React Router's `useNavigate()` to navigate to target collection

**Files to Modify:**
- `packages/client/src/components/EntryActionsMenu.tsx` (add navigation logic)
- All entry item components (pass collections prop)

**Tests (8+ tests):**
- "Go to" menu item appears for migrated entries
- Menu item shows correct collection name
- Clicking navigates to target collection
- Menu item does NOT appear for non-migrated entries
- Navigation works for all entry types (task, note, event)

**Success Criteria:**
- ✅ Migrated entries show "Go to [Collection]" in menu
- ✅ Navigation works correctly
- ✅ Original entry stays visible (not hidden)
- ✅ New migrated entry shows as regular entry (no backward navigation)
- ✅ All tests pass

---

### Phase 4F: Implement Collection Drag-and-Drop Reordering
**Priority:** High  
**Effort:** 1-2 hours  
**Complexity:** Medium

**Feature:**
- Collections can be reordered via drag-and-drop in the index view
- Uses same pattern as entry reordering (already implemented)
- Backend handler already exists: `ReorderCollectionHandler`

**Implementation:**
1. Create `SortableCollectionItem.tsx` (mirror of `SortableEntryItem.tsx`)
   - Wraps `CollectionListItem` with drag-and-drop
   - Uses `@dnd-kit/sortable`

2. Update `CollectionList.tsx`
   - Wrap with `DndContext` and `SortableContext`
   - Handle drag end event
   - Calculate new order position

3. Update `CollectionIndexView.tsx`
   - Pass `reorderCollectionHandler` to CollectionList
   - Expose handler from AppContext

4. Update `AppContext.tsx`
   - Expose `reorderCollectionHandler` for components

**Files to Create:**
- `packages/client/src/components/SortableCollectionItem.tsx`
- `packages/client/src/components/SortableCollectionItem.test.tsx`

**Files to Modify:**
- `packages/client/src/components/CollectionList.tsx` (add DndContext)
- `packages/client/src/components/CollectionList.test.tsx` (update tests)
- `packages/client/src/views/CollectionIndexView.tsx` (pass handler)
- `packages/client/src/context/AppContext.tsx` (expose handler)

**Tests (15+ tests):**
- Collections can be dragged
- Collections reorder on drop
- Order persists after reload
- Drag handles are visible and functional
- Keyboard navigation works (Space to grab, Arrow keys to move)
- ARIA attributes for accessibility
- Virtual "Uncategorized" collection cannot be reordered

**Success Criteria:**
- ✅ Collections can be reordered via drag-and-drop
- ✅ Order persists (stored in event store)
- ✅ Keyboard accessible
- ✅ Virtual "Uncategorized" stays at top (not draggable)
- ✅ All tests pass

---

## Deferred Items (Post-Backend Sync)

### Event Time Field (Not Implementing Now)
**Rationale:** Requires architecture design session with Alex

**Future Implementation:**
- Add optional time field to events (combined date/time)
- Backend: Add `eventTime?: string` to Event entity
- Frontend: Use `<input type="datetime-local">` for combined picker
- Auto-save after date/time selection (no Enter needed)
- Estimated effort: 2-3 hours (requires `/design` session)

**Added to:** `docs/collections-implementation-plan.md` → Future Enhancements section

---

## Implementation Sequence

Execute tasks one at a time in this order:

1. `/implement` Phase 4A: Title/Subtitle Restoration
2. `/review` with Casey
3. `/implement` Phase 4B: FAB Padding
4. `/review` with Casey
5. `/implement` Phase 4C: Save Button
6. `/review` with Casey
7. `/implement` Phase 4D: Entry Actions Menu
8. `/review` with Casey
9. `/implement` Phase 4E: Migration Navigation
10. `/review` with Casey
11. `/implement` Phase 4F: Collection Reordering
12. `/review` with Casey
13. **User Manual Testing** (mobile + desktop)
14. Fix any issues found
15. Commit all changes

**Estimated Total Effort:** 5-7 hours across multiple sessions

---

## Testing Plan

### Automated Testing
- Unit tests for all new components
- Integration tests for drag-and-drop
- Accessibility tests (ARIA, keyboard navigation)
- Target: 50+ new tests across all phases

### Manual Testing (After All 6 Phases Complete)
**User will test on:**
- Mobile (iOS/Android)
- Desktop (Chrome, Firefox, Safari, Edge)

**Test Scenarios:**
1. Title/subtitle appears correctly
2. Last entry not covered by FAB
3. Save button works when keyboard dismissed
4. Entry actions menu (Edit, Move, Delete) all work
5. "Go to" navigation for migrated entries
6. Collection drag-and-drop reordering
7. Keyboard accessibility for all features
8. Touch targets appropriate size on mobile

---

## Success Criteria

### Phase 4 Complete When:
- ✅ All 6 tasks implemented
- ✅ All automated tests passing (553+ tests)
- ✅ Casey code reviews complete (all phases 8+/10)
- ✅ User manual testing complete
- ✅ All bugs fixed
- ✅ Changes committed to master
- ✅ Ready to start Backend Sync (Phase 5)

---

## Next Steps After Phase 4

Once Phase 4 is complete and committed:
1. Update `docs/collections-implementation-plan.md` with completion status
2. Create session summary document
3. Begin Phase 5: Backend & Sync architecture design with Alex
4. Implement multi-device synchronization

---

## References

- **Manual Testing Findings:** This document, top section
- **Collections Implementation Plan:** docs/collections-implementation-plan.md
- **OpenCode Workflow:** docs/opencode-workflow.md
- **Original Title/Subtitle:** Git commit `34aeb59` (DailyLogsView.tsx)
- **Drag-Drop Pattern:** packages/client/src/components/SortableEntryItem.tsx

---

**Session Started:** 2026-01-28  
**Status:** Ready to begin implementation  
**First Task:** Phase 4A - Title/Subtitle Restoration
