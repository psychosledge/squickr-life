# Session Summary: Phase 5 Manual Testing Feedback

**Date:** 2026-01-29  
**Status:** 📋 Collecting Feedback  
**Goal:** Identify and document UX issues from manual testing of Phase 4 features

---

## Context

Phase 4 UX Enhancements completed with:
- ✅ 6 features implemented (title, FAB padding, Save button, actions menu, navigation, reordering)
- ✅ 2 bugs fixed (Save button in modal, "Go to" navigation)
- ✅ 643 tests passing
- ✅ All changes committed and pushed

This session focuses on gathering feedback from real-world usage to identify remaining UX issues.

---

## Feedback Items

### #1: FAB Overlapping Drag Handles (Mobile) 🔴 HIGH PRIORITY

**Reporter:** User (manual testing)  
**Date:** 2026-01-29

#### Problem Description

The FAB (Floating Action Button) still covers drag handles on mobile despite Phase 4B's `pb-32` padding fix.

**Where it occurs:**
- Collection detail views with ~10+ entries
- All collections (not specific to any collection type)

**Why padding didn't work:**
- Bottom padding pushes content down, but FAB is `fixed` positioned
- When user scrolls, FAB stays in place and covers the last entry's drag handle
- Drag handle is at `right-2`, FAB is at `right-5` → only 3 units apart

#### Current Behavior

**Desktop (md+):**
```
[drag-handle (left)] [•] Task title          [⋯]
```
✅ Works perfectly - drag handles on left, FAB on right = no overlap

**Mobile (<md):**
```
[•] Task title          [⋯] [drag-handle (right)]
                                    [FAB (fixed bottom-right)]
```
❌ Drag handle and FAB overlap in bottom-right corner

#### Technical Details

**Current Implementation:**
- `SortableEntryItem.tsx` line 63: `className="relative group pr-14 md:pr-0 md:pl-0"`
- `SortableEntryItem.tsx` line 68-69: 
  ```tsx
  className="absolute right-2 top-1/2 -translate-y-1/2
             md:right-auto md:left-0 md:-translate-x-8"
  ```
- `FAB.tsx` line 11: `className="fixed bottom-5 right-5 md:bottom-6 md:right-6"`

**Why this creates overlap:**
- Mobile: Drag handle at `right-2` (0.5rem from right edge)
- Mobile: FAB at `right-5` (1.25rem from right edge)
- Distance between them: Only 0.75rem (12px) - not enough clearance
- FAB is 56px wide (14 Tailwind units), so it extends into drag handle's space

#### Proposed Solutions

##### Option A: Move FAB to Bottom Center (Mobile Only)

**Implementation:**
```tsx
// FAB.tsx
className="fixed bottom-5 left-1/2 -translate-x-1/2
           md:bottom-6 md:right-6 md:left-auto md:translate-x-0"
```

**Pros:**
- ✅ Simple fix (~30 minutes)
- ✅ Common mobile pattern (Material Design, Google apps)
- ✅ Doesn't interfere with right-side drag handles
- ✅ Still easily accessible with thumb
- ✅ No need to modify entry components

**Cons:**
- ❌ Breaks muscle memory if users are used to bottom-right
- ❌ May interfere with other center UI elements (if we add any)
- ❌ Less discoverable (eyes naturally go to corners)
- ❌ Creates mobile/desktop inconsistency

**Files to modify:**
- `packages/client/src/components/FAB.tsx` (positioning classes)
- `packages/client/src/components/FAB.test.tsx` (update position tests)

**Estimated effort:** 30 minutes

---

##### Option B: Move Drag Handles to Left Side (All Devices)

**Implementation:**
```tsx
// SortableEntryItem.tsx - Remove responsive positioning
className="absolute left-2 top-1/2 -translate-y-1/2"
```

**Pros:**
- ✅ Consistent across mobile and desktop
- ✅ Follows established convention (left = structure/actions, right = content)
- ✅ More space for entry content on right side
- ✅ Bullet journal icon + text flows naturally left-to-right
- ✅ Future-proof (no more mobile/desktop divergence)

**Cons:**
- ❌ More complex implementation (~2-3 hours)
- ❌ Changes established mobile pattern
- ❌ Need to update both entries AND collections for consistency
- ❌ Requires layout reordering in all entry item components

**DOM Reordering Required:**
```tsx
// Current (mobile):
[bujo-icon] [content] [actions-menu] [drag-handle]

// New (all devices):
[drag-handle] [bujo-icon] [content] [actions-menu]
```

**Files to modify:**
- `packages/client/src/components/SortableEntryItem.tsx`
- `packages/client/src/components/SortableCollectionItem.tsx`
- `packages/client/src/components/TaskEntryItem.tsx`
- `packages/client/src/components/NoteEntryItem.tsx`
- `packages/client/src/components/EventEntryItem.tsx`
- `packages/client/src/components/CollectionListItem.tsx`
- All corresponding test files

**Estimated effort:** 2-3 hours

---

##### Option C: Move FAB to Top-Right (Mobile Only)

**Implementation:**
```tsx
// FAB.tsx
className="fixed top-20 right-5
           md:bottom-6 md:top-auto md:right-6"
```

**Pros:**
- ✅ Simple fix (~30 minutes)
- ✅ Clear separation from bottom content
- ✅ Still accessible (top-right is natural tap zone)

**Cons:**
- ❌ Unconventional placement (most apps put FAB at bottom)
- ❌ May conflict with navigation header
- ❌ Less thumb-friendly on larger phones (harder to reach top)
- ❌ May scroll out of view if header is sticky

**Files to modify:**
- `packages/client/src/components/FAB.tsx`
- `packages/client/src/components/FAB.test.tsx`

**Estimated effort:** 30 minutes

---

#### Questions for Alex (Architecture Design)

1. **Mobile UX Patterns:** Which solution best aligns with modern mobile UX standards and user expectations?
2. **Accessibility:** Any concerns with drag handle positioning for screen readers or keyboard navigation?
3. **Future-proofing:** Will we add more bottom-positioned UI elements that could conflict with FAB or drag handles?
4. **Consistency:** Should mobile and desktop follow the same pattern, or is divergence acceptable for this use case?
5. **User Testing:** Should we prototype multiple options and A/B test with users?

#### Recommendation

**Pending Alex's input**, but preliminary thoughts:

**If prioritizing consistency and long-term maintainability:** Choose **Option B** (move drag handles left)
- Creates uniform experience across devices
- Aligns with desktop's already-working pattern
- More effort upfront, but cleaner architecture

**If prioritizing quick fix and minimal risk:** Choose **Option A** (move FAB center on mobile)
- Fast to implement and test
- Well-established mobile pattern
- Low risk of breaking existing functionality

**Avoid:** Option C (top-right FAB) - too unconventional and creates usability issues

#### Next Steps

1. Schedule architecture design session with Alex (`/design`)
2. Alex weighs in on UX tradeoffs and makes architectural decision
3. Implement chosen solution using TDD with Sam
4. Review with Casey
5. Manual testing to verify fix
6. Commit and move to next feedback item

---

---

### #2: Completed Task Management & Collection Types 🟡 MEDIUM PRIORITY

**Reporter:** User (manual testing)  
**Date:** 2026-01-29

#### Problem Description

Different collections have different needs for managing completed tasks:
- **Logs** (daily logs, journals): Want to see completed tasks to show what was accomplished
- **Lists** (todo lists, projects): Want to hide or separate completed tasks to focus on what's left

Current behavior treats all collections the same - completed tasks stay in place with strikethrough.

#### Current Behavior

**All Collections (regardless of type):**
```
[×] Completed task title (strikethrough)
[•] Active task title
[×] Another completed task (strikethrough)
[•] Another active task
```

Tasks remain in their original order, showing completion status but not separating them.

#### User Preferences & Insights

**What works well:**
- ✅ Current behavior is good for "log" type collections
- ✅ Seeing completed tasks shows what you accomplished (BuJo principle)

**What's missing:**
- ❌ Todo lists get cluttered with completed tasks
- ❌ Hard to focus on remaining work in project-based collections
- ❌ No way to hide/collapse completed items

**Key Insight from User:**
> "Long-term, I see logs as being tied to some date mechanism so we can do calendar or auto/virtual migrations between Future Logs, Monthly Logs, and Daily Logs. Lists would be simple dumb lists. It is possible that I'm really after a specialized 'ToDo' type that only has tasks as its only entry type."

This suggests **three distinct collection types** may be emerging:
1. **Log** - Date-based, chronological, shows all entries including completed
2. **List** - General-purpose, mixed entry types, may need completed task management
3. **ToDo** - Task-only, project/idea-focused, definitely needs completed task management

#### Proposed Solutions

##### Option A: Simple Filter Toggle (No Collection Types)

Add a per-collection filter toggle to hide/show completed tasks.

**UI Placement:**
```
┌─────────────────────────────────────┐
│ ← Collection Name             [⋮]   │ ← Header
│ ─────────────────────────────────── │
│ Show completed [toggle]             │ ← Filter control
│ ─────────────────────────────────── │
│ [•] Active task 1                   │
│ [•] Active task 2                   │
│ [×] Completed task (hidden if off)  │
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Simple implementation (~1 hour)
- ✅ Works for all existing collections
- ✅ User controls visibility per-collection
- ✅ No migration needed
- ✅ Flexible (each collection can be configured)

**Cons:**
- ❌ No default behavior based on collection purpose
- ❌ Users must manually configure each collection
- ❌ Filter state needs persistence (per-collection setting)
- ❌ Doesn't align with BuJo paradigm of different page types

**Implementation:**
- Add `showCompleted?: boolean` to collection state (client-side only, not persisted)
- OR add CollectionSettings event/aggregate to persist filter state
- Filter completed tasks in EntryList component based on toggle
- UI toggle in CollectionDetailView header area

**Estimated effort:** 1-2 hours (depending on persistence strategy)

---

##### Option B: Collection Types with Default Behaviors

Introduce collection types that have different default behaviors for completed tasks.

**Type 1: Log** (existing "custom" type becomes "log")
- Date-based collections (Daily Log, Monthly Log, Future Log)
- Shows all entries including completed (default)
- Completed tasks stay in original position
- Future: Tied to calendar, virtual migrations between log levels

**Type 2: List** (new type)
- General-purpose collections
- Mixed entry types (tasks, notes, events)
- Option to hide/collapse completed tasks
- No date mechanics

**Type 3: ToDo** (new type) - **Most interesting for this use case**
- Task-only collections (no notes/events allowed)
- Completed tasks auto-moved to bottom or collapsed section
- Focused on "what's left to do"
- Examples: "App Ideas", "Home Repairs", "Tax Documents", "Work Projects"

**UI for Completed Tasks in ToDo Type:**

**Option B1: Move to Bottom**
```
┌─────────────────────────────────────┐
│ ← ToDo Collection Name        [⋮]   │
│ ─────────────────────────────────── │
│ [•] Active task 1                   │
│ [•] Active task 2                   │
│ ─────────────────────────────────── │
│ Completed (3)                       │
│ [×] Completed task 1                │
│ [×] Completed task 2                │
│ [×] Completed task 3                │
└─────────────────────────────────────┘
```

**Option B2: Collapsed Section**
```
┌─────────────────────────────────────┐
│ ← ToDo Collection Name        [⋮]   │
│ ─────────────────────────────────── │
│ [•] Active task 1                   │
│ [•] Active task 2                   │
│ ─────────────────────────────────── │
│ ▶ Completed (3)                     │ ← Click to expand
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Aligns with Bullet Journal paradigm (different page types)
- ✅ Default behavior matches collection purpose
- ✅ Opens door for future features (calendar for logs, task-only for todos)
- ✅ Clear user intent when creating collection
- ✅ No manual configuration needed per-collection
- ✅ Scalable (can add more types/behaviors later)

**Cons:**
- ❌ More complex implementation (~4-6 hours)
- ❌ Need to migrate existing "custom" collections to "log" type
- ❌ UI for selecting collection type during creation
- ❌ Need to decide if/how users can change collection type later

**Implementation:**

1. **Backend Changes:**
   - Update Collection type definition: `type: 'log' | 'list' | 'todo'`
   - Update CreateCollectionCommand to accept type
   - Update CollectionCreated event payload
   - Migration: All existing collections → `type: 'log'`

2. **Frontend Changes:**
   - Add type selector to CreateCollectionModal
   - Update CollectionDetailView to filter/group by type
   - For "todo" type: Separate active/completed tasks
   - For "todo" type: Collapse completed section by default
   - EntryInput: For "todo" type, only show Task type selector

3. **UI for Collection Type Selection:**
```
┌─────────────────────────────────────┐
│ Create New Collection               │
│                                     │
│ Name: ________________________      │
│                                     │
│ Type:                               │
│ ( ) Log - Daily journal entries     │
│ (•) List - General collection       │
│ ( ) ToDo - Task-focused project     │
│                                     │
│          [Cancel]  [Create]         │
└─────────────────────────────────────┘
```

**Estimated effort:** 4-6 hours

---

##### Option C: Hybrid Approach (Type + Optional Filter)

Introduce collection types BUT also allow per-collection override filter.

**Default Behaviors by Type:**
- **Log:** Show completed (no filter UI)
- **List:** Show completed, but filter toggle available
- **ToDo:** Hide/collapse completed by default, toggle to show all

**Pros:**
- ✅ Best of both worlds (smart defaults + user control)
- ✅ Flexibility for edge cases

**Cons:**
- ❌ Most complex implementation (~6-8 hours)
- ❌ Potential confusion (when to use type vs. filter?)

**Estimated effort:** 6-8 hours

---

#### Questions for Alex (Architecture Design)

**Strategic Questions:**
1. **Collection Type Philosophy:** Should we embrace Bullet Journal's concept of different page types (Index, Future Log, Monthly Log, Daily Log, Collections)? Or keep it simpler with one type + filters?

2. **ToDo Type Viability:** Is a task-only collection type architecturally sound? 
   - Entry type restriction (only tasks allowed)
   - Different UI (no entry type selector, just task input)
   - Completed task auto-sorting/collapsing

3. **Future Vision:** If we add collection types now:
   - What other types might we add later? (Index, Tracker, Calendar?)
   - What behaviors would differentiate them?
   - Is this a slippery slope or a natural evolution?

4. **Migration Strategy:** How do we migrate existing "custom" collections?
   - Auto-convert all to "log" type?
   - Prompt user to choose type on next visit?
   - Default to "list" for backward compatibility?

**Technical Questions:**
5. **Entry Type Restrictions:** 
   - Should collection types restrict what entry types can be created?
   - How to enforce (UI-level only, or command handler validation)?
   - What happens if you migrate a Note into a ToDo collection?

6. **Completed Task Sorting:**
   - Should completed tasks auto-reorder on completion, or stay in place until manual sort?
   - Does auto-reordering conflict with drag-and-drop reordering?
   - How to handle fractional indexing when moving completed to bottom?

7. **Persistence:**
   - If we use filters: Store filter state in IndexedDB? Or just client memory?
   - If we use types: Is type immutable after creation, or can users convert types?

8. **UX Patterns:**
   - Collapsed completed section: How to indicate count? ("Completed (5)" or just "▶")
   - Expand/collapse animation?
   - Should collapsed state persist across sessions?

**Bullet Journal Alignment:**
9. In traditional BuJo:
   - Daily Logs show everything chronologically
   - Collections are topical (can be lists, trackers, etc.)
   - Completed tasks often get migrated forward or archived
   - Is moving completed to bottom aligned with BuJo principles?

10. **Naming:**
    - Is "ToDo" the right name, or should it be "Project" / "TaskList" / "Collection" (confusing!)?
    - Should "Log" be called "Journal" to be clearer?

#### User's Current Thinking

**From conversation:**
> "I like the idea of conforming to traditional bujo collection/page types, but I'm not sure if this feature alone is worth adding another collection type for."

**Possible resolution paths:**
1. **Simple first, evolve later:** Start with Option A (filter toggle), see if it's enough
2. **Go full BuJo:** Implement Option B (collection types) to align with BuJo paradigm
3. **Prototype both:** Build quick prototypes of A and B, user test to decide

#### Edge Cases to Consider

**Notes and Events in ToDo Collections:**
- If ToDo type only allows tasks, what happens when:
  - User tries to add a note? (Show error? Disable note/event buttons?)
  - Someone migrates a note/event into the collection? (Reject? Auto-convert?)
  
**Recommended:** If ToDo type is task-only, show only Task input, disable Note/Event in entry type selector

**Completed Task Reordering:**
- User completes task #3 (of 5 tasks)
- Does it immediately move to bottom, or wait until user sorts?
- What if user manually reordered tasks? Does completion override manual order?

**Recommended:** Keep completed tasks in place, only sort on page load or explicit "clean up" action

**Type Conversion:**
- User creates "ToDo" collection, adds 50 tasks
- Later wants to add notes (meeting notes related to project)
- Can they convert to "List" type?

**Recommended:** Allow type conversion, but warn if restrictions will be violated

#### Impact Analysis

**Users Affected:**
- Anyone using collections for project management, todo lists, or goal tracking
- Low impact on users using collections as daily journals (already works well)

**Severity:**
- Medium (nice-to-have for better organization, not a blocker)

**Frequency:**
- High for todo-list users, low for journal users

**Business Value:**
- High (differentiates from simple todo apps, aligns with BuJo methodology)

#### Recommendation

**Deferred to Alex for architectural decision**, but preliminary thoughts:

**If prioritizing Bullet Journal authenticity:** Choose **Option B** (collection types)
- Aligns with traditional BuJo page types
- Opens door for future calendar/migration features
- Creates clear mental model for users

**If prioritizing simplicity and MVP:** Choose **Option A** (filter toggle)
- Fastest to implement and test
- No migration needed
- Can evolve to types later if needed

**Personal lean:** Option B feels right long-term, but need Alex's input on:
- ToDo type viability (task-only restriction)
- Migration strategy for existing collections
- Future vision for other collection types

#### Next Steps

1. Schedule architecture design session with Alex (`/design`)
2. Discuss collection type philosophy and BuJo alignment
3. Prototype collection type selector UI
4. Decide on completed task UX (bottom vs. collapsed)
5. Plan migration strategy for existing collections
6. Implement chosen solution using TDD
7. Manual testing with real todo lists

---

---

### #3: Create Collection During Migration 🟢 LOW COMPLEXITY

**Reporter:** User (manual testing)  
**Date:** 2026-01-29

#### Problem Description

When migrating an entry, users often realize the target collection doesn't exist yet. Current flow requires:
1. Cancel migration modal
2. Navigate to collection index
3. Create new collection
4. Navigate back to original entry
5. Start migration again

This breaks the flow of the daily ritual (migrating incomplete tasks to next daily log).

#### Current Behavior

**Migration Modal:**
```
┌─────────────────────────────────────┐
│ Move to...                    [×]   │
│                                     │
│ ( ) Work Projects                   │
│ ( ) Personal                        │
│ ( ) Daily Log - Jan 29              │
│                                     │
│          [Cancel]  [Move]           │
└─────────────────────────────────────┘
```

If target collection doesn't exist → user must cancel and create it separately.

#### Desired Behavior

**Migration Modal with Create Option:**
```
┌─────────────────────────────────────┐
│ Migrate to...                 [×]   │
│                                     │
│ ( ) Work Projects                   │
│ ( ) Personal                        │
│ ( ) Daily Log - Jan 29              │
│ ─────────────────────────────────── │
│ ( ) + Create New Collection         │ ← NEW
│                                     │
│          [Cancel]  [Migrate]        │
└─────────────────────────────────────┘
```

#### User Requirements

**From conversation:**

1. **Terminology:** Change "Move to..." → "Migrate to..." (more BuJo-authentic)
2. **Create Option:** Add "+ Create New Collection" as selectable option in list
3. **Collection Type:** If creating during migration, ask for collection type (same as normal creation)
4. **Auto-Migration:** After creating collection, automatically complete the migration (no extra confirmation)
5. **Duplicate Names:** Allow duplicate collection names (no validation/restriction)
6. **Common Workflow:** Part of daily ritual (e.g., migrating tasks to tomorrow's daily log)

#### Proposed Solution

**Two-Modal Flow:**

**Step 1: Migration Modal**
```
┌─────────────────────────────────────┐
│ Migrate to...                 [×]   │
│                                     │
│ ( ) Work Projects                   │
│ ( ) Personal                        │
│ ( ) Daily Log - Jan 29              │
│ ─────────────────────────────────── │
│ (•) + Create New Collection         │ ← User selects this
│                                     │
│          [Cancel]  [Next]           │ ← Button changes to "Next"
└─────────────────────────────────────┘
```

**Step 2: Create Collection Modal (same as existing)**
```
┌─────────────────────────────────────┐
│ Create New Collection               │
│                                     │
│ Name: Daily Log - Jan 30_____      │
│                                     │
│ Type:                               │
│ (•) Log - Daily journal entries     │
│ ( ) List - General collection       │
│ ( ) ToDo - Task-focused project     │
│                                     │
│    [Back]  [Create & Migrate]       │ ← Clear intent
└─────────────────────────────────────┘
```

**Step 3: Automatic Migration**
- Collection created
- Migration completes automatically
- User sees success feedback
- Entry now in new collection

#### Implementation Details

**Files to Modify:**

1. **MoveEntryToCollectionModal.tsx** (rename to MigrateEntryModal.tsx)
   - Change title from "Move to..." → "Migrate to..."
   - Add "+ Create New Collection" option at bottom of list
   - When selected, button changes to "Next" instead of "Move"/"Migrate"
   - Opens CreateCollectionModal on "Next" click

2. **CreateCollectionModal.tsx**
   - Add optional prop: `onCreateComplete?: (collectionId: string) => void`
   - When called from migration flow, button says "Create & Migrate" instead of "Create"
   - Calls callback with new collection ID after creation

3. **Migration Flow Logic:**
   - MigrateEntryModal tracks if "+ Create New" is selected
   - If yes, opens CreateCollectionModal with callback
   - Callback receives new collection ID
   - Automatically triggers migration to that collection
   - Closes both modals
   - Shows success toast/feedback

4. **Entry Actions Menu:**
   - Update menu item text from "Move to..." → "Migrate to..."

**Component Communication:**
```typescript
// MigrateEntryModal state
const [selectedOption, setSelectedOption] = useState<string | 'CREATE_NEW'>();
const [showCreateModal, setShowCreateModal] = useState(false);

// When user clicks "Next" with CREATE_NEW selected
const handleNext = () => {
  if (selectedOption === 'CREATE_NEW') {
    setShowCreateModal(true);
  } else {
    // Normal migration
    handleMigrate(selectedOption);
  }
};

// Callback from CreateCollectionModal
const handleCollectionCreated = (newCollectionId: string) => {
  setShowCreateModal(false);
  handleMigrate(newCollectionId); // Auto-migrate
  onClose(); // Close migration modal
};
```

**UI States:**
```typescript
// MigrateEntryModal button logic
const buttonText = selectedOption === 'CREATE_NEW' ? 'Next' : 'Migrate';
const buttonDisabled = !selectedOption;
```

#### Edge Cases to Consider

**Case 1: User cancels creation modal**
- MigrateEntryModal stays open
- "+ Create New Collection" remains selected
- User can try again or select different collection

**Case 2: User presses Back in creation modal**
- Returns to MigrateEntryModal
- Selection preserved

**Case 3: Collection creation fails**
- Show error in CreateCollectionModal
- Don't close modals
- User can retry or cancel

**Case 4: Migration fails after collection created**
- Collection exists but migration didn't complete
- Show error message
- User can try migrating again manually
- New collection is in the list now

**Case 5: Duplicate collection names**
- No restriction (per user requirement)
- Both collections appear in list
- User can migrate to either one

#### Alternative UI Approach (Inline Creation)

**Single Modal with Inline Create:**
```
┌─────────────────────────────────────┐
│ Migrate to...                 [×]   │
│                                     │
│ ( ) Work Projects                   │
│ ( ) Personal                        │
│ ─────────────────────────────────── │
│ Create new:                         │
│ Name: _________________________     │
│ Type: [Log ▼]                       │
│                                     │
│          [Cancel]  [Create & Migrate]│
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Fewer modal transitions
- ✅ Faster for quick migrations

**Cons:**
- ❌ More complex single modal
- ❌ Doesn't reuse existing CreateCollectionModal
- ❌ Two ways to create collections (inconsistency)

**Recommendation:** Use two-modal flow to reuse existing CreateCollectionModal and maintain consistency.

#### Testing Requirements

**Unit Tests:**
- MigrateEntryModal renders "+ Create New Collection" option
- Selecting "+ Create New" changes button to "Next"
- Clicking "Next" opens CreateCollectionModal
- CreateCollectionModal callback triggers auto-migration
- Both modals close after successful migration
- Error handling for creation/migration failures

**Integration Tests:**
- Full flow: Select entry → Migrate → Create New → Enter name/type → Auto-migrate
- Verify entry appears in new collection
- Verify original entry marked as migrated
- Verify new collection appears in collection list

**Manual Testing:**
- Daily ritual flow: Create today's log, migrate tasks from yesterday
- Create specialized collection during migration (e.g., "Home Repairs")
- Cancel creation modal → verify migration modal still open
- Test all three collection types (if #2 is implemented)

#### User Stories

**Story 1: Daily Log Migration**
```
As a user doing my morning ritual,
When I migrate incomplete tasks from yesterday,
And tomorrow's log doesn't exist yet,
I want to create it during migration,
So I don't break my flow.
```

**Story 2: Discover New Project**
```
As a user reviewing my tasks,
When I realize "Fix leaky faucet" should be in "Home Repairs",
And that collection doesn't exist,
I want to create it on the spot,
So I can organize immediately.
```

**Story 3: Quick Categorization**
```
As a user migrating multiple entries,
When I notice they all belong to a new category,
I want to create that collection once,
Then migrate all entries to it,
Without leaving the migration flow repeatedly.
```

#### Accessibility Considerations

- "+ Create New Collection" should be keyboard accessible (Tab to reach)
- Screen readers should announce it as a radio option
- Modal transitions should preserve focus
- Success feedback should be announced to screen readers
- Error messages should be associated with form fields (ARIA)

#### Impact Analysis

**Users Affected:**
- All users who migrate entries regularly
- Especially users doing daily BuJo rituals

**Severity:**
- Medium (workflow improvement, not a blocker)

**Frequency:**
- High for active users (daily/weekly migrations)
- Low for casual users

**Business Value:**
- High (removes friction from core BuJo workflow)
- Encourages daily ritual adherence
- Improves user satisfaction

#### Estimated Effort

**Backend:** None (reuses existing CreateCollectionHandler and migration handlers)

**Frontend:**
- Rename MoveEntryToCollectionModal → MigrateEntryModal: 15 min
- Add "+ Create New Collection" option: 30 min
- Wire up CreateCollectionModal callback: 30 min
- Handle two-modal flow state: 30 min
- Update all references (menu items, tests): 30 min
- Write tests (10-15 new tests): 1 hour
- Manual testing: 30 min

**Total Estimated Effort:** 3-4 hours

**Complexity:** Low-Medium
- Mostly UI/flow logic
- No new domain concepts
- Reuses existing components and handlers

#### Dependencies

**Optional Dependency on Feedback #2:**
- If collection types are implemented, CreateCollectionModal already has type selector
- If not, just use existing modal without type selector
- This feature works either way

**No Blocking Dependencies:** Can be implemented independently

#### Next Steps

1. ✅ Document requirements and design
2. Rename MoveEntryToCollectionModal → MigrateEntryModal
3. Implement "+ Create New Collection" option
4. Wire up two-modal flow
5. Add tests
6. Manual testing with daily log migration scenario
7. Review with Casey
8. Commit and deploy

---

---

### #4: Collection Navigation (Page Flipping) 🟡 MEDIUM COMPLEXITY

**Reporter:** User (manual testing)  
**Date:** 2026-01-29

#### Problem Description

Currently, navigating between collections requires:
1. Go back to Collection Index
2. Find and tap next collection
3. View that collection
4. Repeat for each collection

This is cumbersome for daily rituals where users want to review multiple collections in sequence.

#### Desired Behavior

**Quick navigation between collections like flipping pages in a physical journal:**
- Previous/Next arrow buttons in collection header
- Swipe gestures on mobile (swipe left/right to flip pages)
- Keyboard shortcuts on desktop (Left/Right arrow keys)
- Navigate in same order as Collection Index (user's custom order)
- Wrap to "Add Collection" placeholder at end instead of first collection

#### User Requirements

**From conversation:**

1. **Placement:** Collection header (open to alternatives)
2. **Order:** Same as Collection Index (user's custom drag-and-drop order)
3. **Visual:** Simple arrow buttons (← →), but page-flip animation would be cool
4. **Uncategorized:** Include in navigation, always first (like index)
5. **Wraparound:** At end, show placeholder page with option to create new collection
6. **Mobile:** Swipe gestures + navigation icons
7. **Desktop:** Navigation icons only (no swipe)
8. **Use Case:** Daily ritual (reviewing all collections) + quick browsing

#### Proposed Solution

**Collection Header with Navigation:**

```
┌─────────────────────────────────────┐
│ ← Daily Log - Jan 29          → [⋮] │ ← Navigation arrows
│ ─────────────────────────────────── │
│ Show completed [toggle]             │
│ ─────────────────────────────────── │
│ [•] Task 1                          │
│ [•] Task 2                          │
└─────────────────────────────────────┘
```

**Navigation Order Example:**
```
[Uncategorized] → [Work Projects] → [Personal] → [Daily Log - Jan 29] → [+ Create New]
      ↑                                                                         ↓
      └─────────────────────────────────────────────────────────────────────────┘
```

**End of List Placeholder:**
```
┌─────────────────────────────────────┐
│ ←                             [×]   │
│                                     │
│         📚                          │
│                                     │
│    You've reached the end!          │
│                                     │
│  [+ Create New Collection]          │
│                                     │
│  Or go back to the first one        │
│                                     │
└─────────────────────────────────────┘
```

#### Implementation Details

**Files to Modify:**

1. **CollectionHeader.tsx**
   - Add prev/next arrow buttons
   - Position: Left arrow before title, right arrow after title
   - Disabled state when at boundaries
   - Click handlers navigate to adjacent collection

2. **CollectionDetailView.tsx**
   - Add keyboard event listener (Left/Right arrows)
   - Add touch/swipe event listener (mobile only)
   - Calculate prev/next collection IDs
   - Navigate using React Router

3. **New Component: CollectionEndPlaceholder.tsx**
   - Shown when user navigates past last collection
   - Displays "Create New Collection" option
   - Back arrow returns to last collection

4. **AppContext.tsx**
   - Expose collection list in same order as index
   - Provide helper: `getAdjacentCollections(currentId) => { prev, next }`

**Navigation Logic:**

```typescript
// In CollectionDetailView.tsx
const collections = useCollections(); // From AppContext
const currentIndex = collections.findIndex(c => c.id === collectionId);

const prevCollection = currentIndex > 0 
  ? collections[currentIndex - 1] 
  : null;

const nextCollection = currentIndex < collections.length - 1
  ? collections[currentIndex + 1]
  : 'END_PLACEHOLDER'; // Special ID for end page

const handlePrevious = () => {
  if (prevCollection) {
    navigate(`/collections/${prevCollection.id}`);
  }
};

const handleNext = () => {
  if (nextCollection === 'END_PLACEHOLDER') {
    navigate('/collections/end');
  } else if (nextCollection) {
    navigate(`/collections/${nextCollection.id}`);
  }
};

// Keyboard navigation
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && prevCollection) {
      handlePrevious();
    } else if (e.key === 'ArrowRight' && nextCollection) {
      handleNext();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [prevCollection, nextCollection]);

// Swipe navigation (mobile only)
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => handleNext(),  // Swipe left = next page
  onSwipedRight: () => handlePrevious(), // Swipe right = prev page
  preventDefaultTouchmoveEvent: true,
  trackMouse: false, // Desktop doesn't get swipe
});
```

**Arrow Button Styling:**

```tsx
// CollectionHeader.tsx
<button
  onClick={onPrevious}
  disabled={!hasPrevious}
  className="p-2 text-gray-600 dark:text-gray-300 
             hover:text-gray-900 dark:hover:text-white
             disabled:opacity-30 disabled:cursor-not-allowed
             transition-all"
  aria-label="Previous collection"
>
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
</button>

{/* Collection title in center */}

<button
  onClick={onNext}
  disabled={!hasNext}
  className="p-2 text-gray-600 dark:text-gray-300 
             hover:text-gray-900 dark:hover:text-white
             disabled:opacity-30 disabled:cursor-not-allowed
             transition-all"
  aria-label="Next collection"
>
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
</button>
```

**Mobile Swipe Detection:**

Use `react-swipeable` library:
```bash
pnpm add react-swipeable
```

**Page Flip Animation (Optional Enhancement):**

```css
/* Slide transition when navigating */
.page-enter {
  opacity: 0;
  transform: translateX(100%);
}

.page-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 300ms, transform 300ms;
}

.page-exit {
  opacity: 1;
  transform: translateX(0);
}

.page-exit-active {
  opacity: 0;
  transform: translateX(-100%);
  transition: opacity 300ms, transform 300ms;
}
```

Or use `framer-motion` for smoother animations:
```bash
pnpm add framer-motion
```

#### Routes to Add

**New Route for End Placeholder:**

```typescript
// routes.tsx
export const ROUTES = {
  // ... existing routes
  COLLECTION_END: '/collections/end',
};

// App.tsx
<Route path={ROUTES.COLLECTION_END} element={<CollectionEndPlaceholder />} />
```

#### Edge Cases to Consider

**Case 1: User is on Uncategorized and presses Previous**
- Previous button should be disabled
- No action on Left arrow key
- No action on right swipe

**Case 2: User is on last collection and presses Next**
- Navigate to `/collections/end` placeholder
- Show "Create New Collection" option

**Case 3: User is on end placeholder and presses Previous**
- Navigate back to last collection
- Next button disabled on end placeholder

**Case 4: User deletes current collection while viewing it**
- Already handled by existing delete logic (redirects to index)
- Navigation should work after redirect

**Case 5: Collections are reordered while user is viewing one**
- Prev/next should update reactively (based on current collection list)
- useEffect dependency on collections array

**Case 6: User creates new collection from end placeholder**
- After creation, navigate to the new collection
- Or redirect to collection index

**Case 7: Keyboard shortcuts conflict with input fields**
- Disable keyboard navigation when input/textarea is focused
- Check `document.activeElement.tagName`

**Case 8: Swipe conflicts with drag-to-reorder**
- Swipe detection should be on container, not individual entries
- Drag handles should preventDefault on swipe events

#### Accessibility Considerations

**Keyboard Navigation:**
- ✅ Left/Right arrow keys for navigation
- ✅ Don't trigger when input fields are focused
- ✅ Screen reader announces when collection changes

**ARIA Attributes:**
- Arrow buttons have `aria-label="Previous/Next collection"`
- Disabled buttons have `aria-disabled="true"`
- Collection count: "Collection 2 of 5"

**Focus Management:**
- After navigation, focus should move to collection title
- Preserve scroll position on back navigation

**Screen Reader Announcements:**
```tsx
<div role="status" aria-live="polite" className="sr-only">
  Navigated to {collection.name}. Collection {currentIndex + 1} of {totalCollections}.
</div>
```

#### Testing Requirements

**Unit Tests:**
- Navigation buttons render with correct enabled/disabled state
- Clicking prev/next navigates to correct collection
- Keyboard shortcuts trigger navigation
- Swipe gestures trigger navigation (mobile)
- End placeholder shown when navigating past last collection
- Previous from end placeholder returns to last collection

**Integration Tests:**
- Full navigation flow: First → Middle → Last → End → Back
- Keyboard navigation through all collections
- Swipe navigation on mobile
- Navigation order matches Collection Index order
- Uncategorized always first in sequence

**Manual Testing:**
- Daily ritual flow: Review each collection in sequence
- Swipe feels natural on mobile
- Page transitions smooth
- Keyboard shortcuts don't conflict with inputs
- Works with 1 collection, 2 collections, 10+ collections

#### User Stories

**Story 1: Morning Ritual**
```
As a user doing my morning review,
When I open my Daily Log collection,
I want to quickly flip through all collections,
So I can review yesterday's work and plan today.
```

**Story 2: Quick Browse**
```
As a user organizing my thoughts,
When I'm viewing one collection,
I want to jump to the next one without going back to index,
So I can quickly scan all my projects.
```

**Story 3: Create While Browsing**
```
As a user flipping through collections,
When I reach the end of my list,
I want a quick way to create the next collection,
So I can continue my organization flow.
```

#### UX Enhancements (Future)

**Phase 1 (MVP):**
- Simple arrow buttons
- Keyboard navigation
- Basic swipe detection

**Phase 2 (Polish):**
- Page-flip animation (slide transition)
- Haptic feedback on mobile swipe
- Collection count indicator ("2 / 5")

**Phase 3 (Advanced):**
- Gesture-based preview (swipe partway to peek at next collection)
- Quick-jump menu (hold arrow button to see list)
- Breadcrumb trail of recently viewed collections

#### Dependencies

**NPM Packages:**
- `react-swipeable` for swipe detection (~4KB)
- OR `framer-motion` for animations + gestures (~32KB, but richer features)

**Recommendation:** Start with `react-swipeable` for MVP, add `framer-motion` later if animations are desired.

#### Estimated Effort

**Backend:** None (pure frontend feature)

**Frontend:**
- Add navigation buttons to CollectionHeader: 1 hour
- Implement navigation logic (prev/next calculation): 1 hour
- Add keyboard shortcuts: 30 min
- Add swipe detection (mobile): 1 hour
- Create CollectionEndPlaceholder component: 1 hour
- Add route for end placeholder: 30 min
- Accessibility (focus management, ARIA): 1 hour
- Write tests (15-20 new tests): 2 hours
- Manual testing (mobile + desktop): 1 hour

**Total Estimated Effort:** 8-9 hours

**With Animations:**
- Add framer-motion page transitions: +2 hours
- Polish animation timing/easing: +1 hour

**Total with animations:** 11-12 hours

**Complexity:** Medium
- Multiple interaction modes (click, keyboard, swipe)
- Cross-device behavior differences
- Navigation state management
- Accessibility considerations

#### Impact Analysis

**Users Affected:**
- All users who regularly review multiple collections
- Daily ritual practitioners (high value)

**Severity:**
- Medium (quality-of-life improvement)

**Frequency:**
- High for active users (daily use)

**Business Value:**
- High (core BuJo workflow enhancement)
- Differentiates from basic todo apps
- Makes app feel more like physical journal

#### Alternative Approaches

**Alternative 1: Sidebar Navigation**
```
┌────┬──────────────────────────────┐
│ U  │ Daily Log - Jan 29      [⋮] │
│ W  │ ─────────────────────────── │
│ P  │ [•] Task 1                  │
│ D  │                             │
└────┴──────────────────────────────┘
```
- Shows all collection initials in sidebar
- Click to jump to any collection
- More like tabs than page flipping

**Alternative 2: Carousel View**
```
[Prev] [Work] Daily Log [Personal] [Next]
         ↑       ↑          ↑
      preview current   preview
```
- Shows current + previews of adjacent
- Swipe to slide carousel
- More visual, less text-focused

**Recommendation:** Stick with simple arrows + swipe for MVP. Aligns with "page flipping" metaphor.

#### Next Steps

1. ✅ Document requirements and design
2. Install `react-swipeable` dependency
3. Add navigation buttons to CollectionHeader
4. Implement prev/next calculation logic
5. Add keyboard shortcuts
6. Add swipe detection
7. Create CollectionEndPlaceholder component
8. Add tests
9. Manual testing (daily ritual flow)
10. Review with Casey
11. (Optional) Add page-flip animations

---

---

### #5: Active Task Count on Collection Index 🟢 LOW COMPLEXITY

**Reporter:** User (manual testing)  
**Date:** 2026-01-29

#### Problem Description

Collection Index currently shows total entry count per collection, but doesn't distinguish between:
- Active tasks (need attention)
- Completed tasks (done)
- Migrated tasks (moved elsewhere)
- Notes and Events (not actionable tasks)

Users want to quickly see **how many active tasks** remain in each collection to prioritize their work.

#### Current Behavior

**Collection Index:**
```
┌─────────────────────────────────────┐
│ Squickr Life                        │
│ Get shit done quicker with Squickr! │
│ ─────────────────────────────────── │
│ 📦 Uncategorized             (12)   │ ← Total entries
│ 💼 Work Projects             (8)    │
│ 🏠 Personal                  (15)   │
│ 📅 Daily Log - Jan 29        (23)   │
└─────────────────────────────────────┘
```

Count shows **all entries** (tasks + notes + events, regardless of status).

#### Desired Behavior

**Collection Index with Active Task Count:**
```
┌─────────────────────────────────────┐
│ Squickr Life                        │
│ Get shit done quicker with Squickr! │
│ ─────────────────────────────────── │
│ 📦 Uncategorized        3 tasks     │ ← Active tasks only
│ 💼 Work Projects        5 tasks     │
│ 🏠 Personal            0 tasks      │
│ 📅 Daily Log - Jan 29  12 tasks     │
└─────────────────────────────────────┘
```

**What counts as "active task":**
- ✅ Task with status = 'pending'
- ❌ Task with status = 'completed' (excluded)
- ❌ Task with migratedTo set (excluded - migrated away)
- ❌ Notes (not tasks)
- ❌ Events (not tasks)

#### User Requirements

**From conversation:**
- Show count of **active tasks** per collection
- Exclude completed tasks
- Exclude migrated tasks
- Don't count notes or events

#### Proposed Solution

**Option A: Replace Total Count with Active Task Count**

```
┌─────────────────────────────────────┐
│ 💼 Work Projects        5 tasks     │
│ 🏠 Personal            0 tasks      │
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Simple, clean display
- ✅ Shows most actionable information
- ✅ Easy to scan for work to do

**Cons:**
- ❌ Loses visibility of total entries
- ❌ Can't see notes/events count

---

**Option B: Show Both Total and Active Tasks**

```
┌─────────────────────────────────────┐
│ 💼 Work Projects     5 tasks / 23   │ ← 5 active, 23 total
│ 🏠 Personal         0 tasks / 8     │
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Shows both metrics
- ✅ Can see collection size + actionable items

**Cons:**
- ❌ More visual clutter
- ❌ May be confusing (what does each number mean?)

---

**Option C: Show Active Tasks, Total on Hover**

```
┌─────────────────────────────────────┐
│ 💼 Work Projects        5 tasks     │ ← Hover shows "23 total entries"
│ 🏠 Personal            0 tasks      │
└─────────────────────────────────────┘
```

**Pros:**
- ✅ Clean primary display
- ✅ Total available if needed
- ✅ Best of both worlds

**Cons:**
- ❌ Not discoverable on mobile (no hover)
- ❌ Slight implementation complexity

---

**Recommendation:** **Option A** (replace with active task count)
- Most useful information for users
- Aligns with use case (quickly see what needs attention)
- If users need total, they can open the collection

#### Implementation Details

**Backend Changes:**

Add new projection method in `EntryListProjection`:

```typescript
/**
 * Get count of active tasks grouped by collection
 * Active = pending status + not migrated
 * Excludes: completed tasks, migrated tasks, notes, events
 */
async getActiveTaskCountsByCollection(): Promise<Map<string | null, number>> {
  const allEntries = await this.getEntries('all');
  const counts = new Map<string | null, number>();
  
  for (const entry of allEntries) {
    // Only count tasks
    if (entry.type !== 'task') continue;
    
    // Only count active tasks (pending + not migrated)
    if (entry.status === 'completed') continue;
    if (entry.migratedTo) continue;
    
    const collectionId = entry.collectionId ?? null;
    counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
  }
  
  return counts;
}
```

**Frontend Changes:**

1. **CollectionIndexView.tsx**
   - Replace `useEntryCountsByCollection()` with `useActiveTaskCountsByCollection()`
   - Update display text from "(12)" to "12 tasks" or "5 tasks"
   - Handle zero: "0 tasks" or hide badge?

2. **CollectionListItem.tsx**
   - Update badge text
   - Add tooltip (optional): "X active tasks, Y total entries"

**Files to Modify:**
- `packages/shared/src/entry.projections.ts` (add new method)
- `packages/shared/src/entry.projections.test.ts` (add tests)
- `packages/client/src/views/CollectionIndexView.tsx` (use new projection)
- `packages/client/src/components/CollectionListItem.tsx` (update display)
- Test files

#### Edge Cases to Consider

**Case 1: Collection has only notes/events (no tasks)**
- Active task count = 0
- Display: "0 tasks" or hide badge entirely?
- **Recommendation:** Show "0 tasks" for consistency

**Case 2: Collection has only completed tasks**
- Active task count = 0
- Shows collection is "done" but not empty
- **Recommendation:** Show "0 tasks"

**Case 3: Collection has tasks but all are migrated**
- Active task count = 0
- Migrated entries remain visible (with blue >)
- **Recommendation:** Show "0 tasks" (correct - nothing actionable here)

**Case 4: Virtual "Uncategorized" collection**
- Should show active task count like real collections
- Helps users see orphaned work
- **Recommendation:** Same logic applies

**Case 5: Zero-based indexing confusion**
- "0 tasks" vs "No tasks" vs hide badge
- **Recommendation:** "0 tasks" (clear and consistent)

#### Testing Requirements

**Unit Tests:**

```typescript
describe('getActiveTaskCountsByCollection', () => {
  it('should count only pending tasks', async () => {
    // Create 3 pending tasks, 2 completed tasks
    // Verify count = 3
  });

  it('should exclude migrated tasks', async () => {
    // Create 3 tasks, migrate 1
    // Verify count = 2 (original excluded, new one in target collection)
  });

  it('should not count notes or events', async () => {
    // Create 2 tasks, 3 notes, 2 events
    // Verify count = 2
  });

  it('should group by collection ID', async () => {
    // Create tasks in different collections
    // Verify counts per collection
  });

  it('should handle uncategorized entries', async () => {
    // Create tasks without collectionId
    // Verify count under null key
  });

  it('should return zero for collections with no active tasks', async () => {
    // Create collection with only completed tasks
    // Verify count = 0
  });
});
```

**Integration Tests:**
- Collection Index displays correct active task counts
- Counts update when task is completed
- Counts update when task is migrated
- Counts update when task is created/deleted
- Zero counts display correctly

**Manual Testing:**
- Create collection with mixed entries (tasks, notes, events)
- Complete some tasks → verify count decreases
- Migrate some tasks → verify count decreases
- Add new task → verify count increases
- Delete task → verify count decreases

#### Alternative Display Options

**Option 1: Badge with icon**
```
💼 Work Projects     ✓ 5
```
Checkmark icon indicates "tasks to check off"

**Option 2: Color-coded badge**
```
💼 Work Projects     [5]  ← Green if tasks exist
🏠 Personal         [0]  ← Gray if zero
```

**Option 3: Descriptive text**
```
💼 Work Projects     5 tasks remaining
🏠 Personal         All done!
```

**Option 4: Task-specific emoji**
```
💼 Work Projects     • 5
```
Bullet point (BuJo style) before count

**Recommendation:** Keep it simple - "5 tasks" is clear and scannable.

#### Accessibility Considerations

- Badge should have accessible label: `aria-label="5 active tasks"`
- Screen reader should announce: "Work Projects, 5 active tasks"
- Color shouldn't be only differentiator (use text too)

#### Performance Considerations

**Current getEntryCountsByCollection:**
- Loads all entries once
- Counts in memory
- O(n) where n = total entries

**New getActiveTaskCountsByCollection:**
- Same performance characteristics
- Just adds filtering logic (type check + status check)
- No additional database queries
- Still O(n), no performance impact

**Optimization (if needed later):**
- Could add IndexedDB index on `[collectionId, type, status]`
- But likely not needed for foreseeable future

#### User Stories

**Story 1: Morning Review**
```
As a user opening the app,
When I view the Collection Index,
I want to quickly see which collections have work to do,
So I can prioritize my day.
```

**Story 2: Collection Triage**
```
As a user managing multiple projects,
When I scan my collections,
I want to see active task counts,
So I know which projects need attention.
```

**Story 3: Completion Satisfaction**
```
As a user finishing tasks,
When I complete the last task in a collection,
I want to see "0 tasks" on the index,
So I feel a sense of accomplishment.
```

#### Impact Analysis

**Users Affected:**
- All users with multiple collections
- Especially helpful for project/todo-oriented users

**Severity:**
- Low (nice-to-have quality of life improvement)

**Frequency:**
- High (every time user visits Collection Index)

**Business Value:**
- Medium (helps users prioritize work)
- Aligns with BuJo principle of "what needs attention"

#### Estimated Effort

**Backend:**
- Add `getActiveTaskCountsByCollection()` method: 30 min
- Add tests (6-8 tests): 1 hour

**Frontend:**
- Update CollectionIndexView to use new method: 15 min
- Update CollectionListItem display: 15 min
- Update tests: 30 min
- Manual testing: 15 min

**Total Estimated Effort:** 3 hours

**Complexity:** Low
- Simple filtering logic
- Reuses existing patterns
- No new domain concepts

#### Dependencies

**None** - Pure projection logic, no new dependencies needed.

**Related to Feedback #2:**
- If collection types are implemented, could show different metrics per type:
  - **Log:** Total entries (for accomplishment tracking)
  - **List:** Total entries
  - **ToDo:** Active tasks (this feature)

But this feature works independently of collection types.

#### Next Steps

1. ✅ Document requirements and design
2. Implement `getActiveTaskCountsByCollection()` in EntryListProjection
3. Add comprehensive tests
4. Update CollectionIndexView to use new method
5. Update display in CollectionListItem
6. Manual testing with various scenarios
7. Review with Casey
8. Commit and deploy

---

## Feedback Collection Status

- ✅ **Item #1:** FAB overlapping drag handles - Documented
- ✅ **Item #2:** Completed task management & collection types - Documented
- ✅ **Item #3:** Create collection during migration - Documented
- ✅ **Item #4:** Collection navigation (page flipping) - Documented
- ✅ **Item #5:** Active task count on collection index - Documented

---

## Summary & Prioritization

### Feedback Items by Complexity

**🟢 Low Complexity (3-4 hours each):**
- **#3:** Create collection during migration
- **#5:** Active task count on collection index

**🟡 Medium Complexity (4-9 hours each):**
- **#1:** FAB overlapping drag handles (Option A: 30 min, Option B: 2-3 hours)
- **#2:** Completed task management & collection types (4-6 hours, needs Alex)
- **#4:** Collection navigation / page flipping (8-9 hours)

### Recommended Implementation Order

**Phase 5A: Quick Wins (Ready to Implement)**
1. **#5:** Active task count (3 hours) - Immediate value, low risk
2. **#3:** Create during migration (3-4 hours) - High daily ritual value
3. **#1:** FAB overlap - Option A center position (30 min) - Quick fix, or defer to Option B after Alex input

**Phase 5B: Architecture Review with Alex**
4. **#2:** Collection types - Needs design session (impacts app identity)
5. **#1:** FAB overlap - Option B if chosen (requires #2 context)

**Phase 5C: Enhanced Navigation**
6. **#4:** Page flipping navigation (8-9 hours) - Polish feature, high delight factor

### Total Effort Estimate

**Quick Wins (Phase 5A):** 6-7 hours  
**After Alex Review (Phase 5B):** 4-9 hours (depending on decisions)  
**Navigation Polish (Phase 5C):** 8-9 hours  

**Grand Total:** 18-25 hours across all feedback items

---

## Next Steps

1. Continue collecting feedback items from user
2. Document each item with problem description, proposed solutions, and questions
3. Prioritize items (High/Medium/Low)
4. Group items by implementation effort and architectural impact
5. Schedule design sessions with Alex for high-impact decisions
6. Begin implementation of agreed-upon fixes

---

## References

- **Phase 4 Completion:** docs/session-2026-01-28-ux-enhancements.md
- **Collections Implementation Plan:** docs/collections-implementation-plan.md
- **OpenCode Workflow:** docs/opencode-workflow.md
