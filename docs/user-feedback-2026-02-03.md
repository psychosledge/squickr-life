# User Feedback - February 3, 2026

**Context:** User has been using the app for a full day after Session 6 deployment.

---

## 🐛 Bugs Found

### Bug #1: Daily Log Creation via Migration Creates Custom Collection
**Severity:** 🔴 HIGH  
**Impact:** Data integrity - collections created with wrong type

**Description:**
When migrating an item from a daily log and choosing "Create New Collection" with a date, the resulting collection is created as `type: 'custom'` instead of `type: 'daily'`.

**Expected Behavior:**
- If user selects a date in CreateCollectionModal, create as `type: 'daily'`
- If user provides custom name (no date), create as `type: 'custom'`

**Current Behavior:**
- Always creates as `type: 'custom'` regardless of date selection

**Root Cause (Likely):**
`CreateCollectionModal.tsx` may not be passing the `type` and `date` fields to the `CreateCollectionHandler` when invoked from migration flow.

**Fix Strategy:**
1. Review CreateCollectionModal prop handling
2. Ensure `type` and `date` are passed when date picker is used
3. Add test to verify daily log creation via migration modal
4. Manual test migration → create new collection → verify type

**Estimated Effort:** 30 minutes - 1 hour

---

### Bug #2: Page Navigation Ignores Collection Ordering
**Severity:** 🔴 HIGH  
**Impact:** Navigation order doesn't match visual order on index page

**Description:**
The page navigation controls (arrows and swipe gestures) do not follow the same collection ordering as shown on the collection index page.

**Expected Behavior:**
- Navigation should follow the exact order shown on collection index:
  1. Favorited customs (by `order` field)
  2. Date hierarchy (by date, descending: newest first)
  3. Other customs (by `order` field)

**Current Behavior:**
- Navigation appears to use a different ordering (possibly database order or creation order)

**Root Cause (Likely):**
`useCollectionNavigation.ts` hook may be using unsorted collection list or different sorting logic than `useCollectionHierarchy.ts`.

**Fix Strategy:**
1. Review `useCollectionNavigation.ts` sorting logic
2. Ensure it uses the same hierarchical ordering as collection index
3. Extract shared sorting function if needed
4. Add test to verify navigation order matches index order
5. Manual test: navigate through collections and verify order

**Estimated Effort:** 1-2 hours

---

## 😕 UX Issues

### UX #1: Drag Handles Too Far from Edge on Mobile
**Severity:** 🟡 MEDIUM  
**Impact:** Harder to reach on mobile devices

**Description:**
On mobile, drag handles are positioned with `right-2` (0.5rem = 8px from edge). This requires reaching further across the screen, especially on larger phones.

**Current Styling:**
```css
right-2 /* 0.5rem / 8px from edge */
```

**Suggested Fix:**
```css
right-0 /* Flush with edge */
right-1 /* 0.25rem / 4px from edge - minimal padding */
```

**Considerations:**
- Ensure handle doesn't get cut off by container overflow
- Maintain 48x48px touch target size
- Test on various screen sizes

**Estimated Effort:** 15-30 minutes

---

### UX #2: Collection Stats Missing from Collection List
**Severity:** 🟡 MEDIUM  
**Impact:** Users can't see entry counts at a glance

**Description:**
Previously, collections showed a count like "3 tasks remaining" in the collection list. This was removed (unclear when) and users want it back.

**User Request:**
- Show icons + counts for each entry type (tasks, notes, events)
- Differentiate between completed vs incomplete tasks
- Make it visually compact but informative

**Design Options:**

**Option A: Icon Row with Counts**
```
Collection Name
📋 3  📝 2  📅 1  ✅ 5
```

**Option B: Compact Inline**
```
Collection Name  •  📋 3  📝 2  ✅ 5
```

**Option C: Badge Style**
```
Collection Name
[📋 3] [📝 2] [📅 1]
```

**Implementation Considerations:**
- Need to query entry counts per collection (projection query)
- May want to cache counts to avoid performance hit
- Should update reactively when entries are added/removed
- Consider hiding icons with zero counts

**Related Impact:**
User mentioned this may result in changing icons on the collection details page as well (for consistency).

**Estimated Effort:** 2-3 hours

---

## 💡 Feature Requests

### Feature #1: Completed Tasks Auto-Move to Bottom
**Severity:** 🟡 MEDIUM  
**Priority:** Quick Win  
**Impact:** Reduces clutter, improves task focus

**Description:**
When a task is marked complete, it should automatically move to the bottom of the entry list. This would work alongside the existing "collapse completed tasks" setting.

**Proposed Behavior:**

**Current Setting: "Collapse Completed Tasks"**
- OFF: Completed tasks stay in place, mixed with incomplete
- ON: Completed tasks move to expandable section at bottom

**New Setting: "Completed Task Behavior"**
- **"Keep in place"**: Completed tasks stay where they are
- **"Move to bottom"**: Completed tasks auto-reorder to bottom (still visible)
- **"Collapse"**: Completed tasks move to expandable section

**User's Perspective:**
> "This makes the setting essentially collapse vs sort"

**Implementation Strategy:**

**Option A: Extend Existing Setting**
```typescript
interface CollectionSettings {
  completedTaskBehavior: 'in-place' | 'move-to-bottom' | 'collapse';
}
```

**Option B: Separate Settings**
```typescript
interface CollectionSettings {
  sortCompletedToBottom: boolean; // Move completed to bottom
  collapseCompletedTasks: boolean; // Hide in expandable section
}
```

**Technical Approach:**
1. Add setting to `CollectionSettings` interface
2. Update `CollectionSettingsModal` UI
3. Modify `EntryList` component to respect setting:
   - Sort incomplete tasks first (by order)
   - Then completed tasks (by order within completed group)
4. Update drag-and-drop to maintain separation (can't drag completed above incomplete)

**Edge Cases:**
- What happens when dragging incomplete task below completed tasks?
- Should there be a visual separator between incomplete and completed?
- Should completed tasks be reorderable within their section?

**Estimated Effort:** 2-3 hours

---

### Feature #2: Bulk Entry Migration
**Severity:** 🟡 MEDIUM  
**Priority:** High Value  
**Impact:** Saves time when migrating multiple entries

**Description:**
When migrating tasks from one day to the next, users want to select multiple entries and migrate them all at once instead of one-by-one.

**Use Case:**
> "At end of day, I have 5 incomplete tasks. I want to migrate all 5 to tomorrow's daily log with 2 clicks instead of 10."

**Proposed UX:**

**Step 1: Selection Mode**
- Add "Select" button in collection header
- Enters multi-select mode
- Checkboxes appear next to each entry
- Bottom action bar appears with "Migrate Selected" button

**Step 2: Bulk Migration**
- User selects multiple entries (checkboxes)
- Clicks "Migrate Selected"
- Migration modal opens (same as current)
- All selected entries migrate to chosen collection

**Design Mockup:**
```
┌────────────────────────────────┐
│ Collection Name      [Select]  │
├────────────────────────────────┤
│ ☐ Task 1                       │
│ ☐ Task 2 (completed)           │
│ ☐ Note 1                       │
│ ☐ Task 3                       │
└────────────────────────────────┘
      
      [Cancel] [Migrate Selected (3)]
```

**Implementation:**

**Backend:**
- No changes needed - handlers already support individual migrations
- Migrate entries sequentially in loop

**Frontend:**
1. Add selection state to `CollectionDetailView`
2. Add "Select" mode toggle in `CollectionHeader`
3. Add checkboxes to `EntryList` items (when in select mode)
4. Add bottom action bar component
5. Modify `MigrateEntryModal` to accept array of entries
6. Execute migrations sequentially with progress indicator

**Edge Cases:**
- What if some migrations fail?
- Should completed tasks be migrated?
- Should order be preserved after migration?
- What about notes and events? (User said "tasks" but may want all entry types)

**Estimated Effort:** 4-6 hours

---

### Feature #3: Monthly Log Collection Type
**Severity:** 🟢 LOW  
**Priority:** Foundation for Future Features  
**Impact:** Enables monthly planning and project tracking

**Description:**
Add a new collection type `'monthly'` that serves as a monthly planning page. This would contain:
- Future events (that appear on their respective daily logs)
- Tasks (that can be migrated to specific days as needed)

**User's Vision:**
> "Monthly log will serve as the placeholder for future events that can be shown on their daily log and tasks that can be migrated to the days as needed."

**Bullet Journal Context:**
In BuJo methodology, the Monthly Log contains:
- Calendar page (dates 1-31 with events)
- Task page (tasks for the month, to be migrated to daily logs)

**Implementation Phases:**

**Phase 1: Basic Monthly Log Type (2-3 hours)**
1. Add `'monthly'` to collection type enum
2. Add `date` field for monthly logs (YYYY-MM format)
3. Update `CreateCollectionModal` to support monthly logs
4. Auto-generate names like "February 2026"
5. Show monthly logs in date hierarchy (between year and daily logs)

**Phase 2: Future Event Visibility (Future)**
- Events in monthly log appear on their respective daily logs
- Requires "linked entries" or "entry references" architecture
- May need new event type or relationship model

**Phase 3: Smart Migration (Future)**
- Migrate tasks from monthly log to specific day
- Tasks remain visible in monthly log (with indicator showing they're delegated)
- Completing task in daily log updates status in monthly log

**Current Scope (Session 7?):**
- Implement Phase 1 only (basic monthly log collection type)
- Design architecture for Phases 2-3 (for future sessions)

**Estimated Effort (Phase 1):** 2-3 hours

---

### Feature #4: Sub-Tasks (Hierarchical Tasks)
**Severity:** 🟢 LOW  
**Priority:** Future Enhancement  
**Impact:** Enables project tracking and complex task management

**Description:**
Add support for nested sub-tasks under parent tasks. Sub-tasks can be migrated independently, and completing a sub-task in a new collection marks it complete under the original parent.

**User's Vision:**
> "Sub tasks would be cool. Especially if they could be migrated and once completed in their new home, would mark the sub-task as complete under the original collection. This could essentially serve as a 'project' tracker and may be very useful for the monthly log."

**Use Case Example:**

**Monthly Log: "Plan Wedding"**
- [ ] Book venue
  - [ ] Research venues (migrated to → Feb 5)
  - [ ] Schedule tours (migrated to → Feb 8)
  - [ ] Sign contract
- [ ] Send invitations
  - [ ] Design invitation
  - [ ] Order printing
  - [ ] Mail invitations

When "Research venues" is completed on Feb 5, it's marked complete under "Plan Wedding" in the monthly log.

**Technical Challenges:**

**Challenge 1: Data Model**
- Tasks currently have no `parentId` field
- Need hierarchical relationship (parent-child)
- Need to support arbitrary nesting depth? Or limit to 1 level?

**Challenge 2: Event Sourcing**
- New events: `SubTaskCreated`, `SubTaskCompleted`, `SubTaskMigrated`
- How to handle parent completion when sub-tasks are incomplete?
- What happens if parent is deleted? Cascade or orphan?

**Challenge 3: Migration Semantics**
- Can parent tasks be migrated? What happens to sub-tasks?
- Can sub-tasks be migrated independently?
- Should migrated sub-tasks remain linked to parent?

**Challenge 4: UI Complexity**
- Indented sub-tasks in entry list
- Drag-and-drop with nesting (complex interaction)
- Visual indicators for migration/completion status
- Expanded/collapsed parent tasks

**Recommendation:**
- **Defer to future session** (significant architectural change)
- **Prerequisite:** Monthly logs implemented first (Phase 1)
- **Design session with Alex** before implementation
- **Estimated Effort:** 10-15 hours (design + implementation + testing)

---

## 📊 Summary Table

| # | Item | Type | Severity | Effort | Quick Win? |
|---|------|------|----------|--------|------------|
| 1 | Daily log creation via migration bug | 🐛 Bug | 🔴 HIGH | 0.5-1 hr | ✅ YES |
| 2 | Page navigation ordering bug | 🐛 Bug | 🔴 HIGH | 1-2 hrs | ✅ YES |
| 3 | Drag handle position on mobile | 😕 UX | 🟡 MEDIUM | 0.5 hr | ✅ YES |
| 4 | Collection stats missing | 😕 UX | 🟡 MEDIUM | 2-3 hrs | ⚠️ Maybe |
| 5 | Completed tasks move to bottom | 💡 Feature | 🟡 MEDIUM | 2-3 hrs | ⚠️ Maybe |
| 6 | Bulk entry migration | 💡 Feature | 🟡 MEDIUM | 4-6 hrs | ❌ NO |
| 7 | Monthly log collection type | 💡 Feature | 🟢 LOW | 2-3 hrs | ⚠️ Maybe |
| 8 | Sub-tasks (hierarchical tasks) | 💡 Feature | 🟢 LOW | 10-15 hrs | ❌ NO |

---

## 🎯 Prioritization Questions for User

Before finalizing Session 7 plan, please provide your input:

### Question 1: Quick Wins vs. Large Features
We have **2 critical bugs** (items #1-2) that should be fixed immediately. After those, would you prefer:

**Option A: All Quick Wins First**
- Fix bugs #1-2 (1.5-3 hrs)
- Quick UX fixes #3 (0.5 hr)
- Then tackle Casey's code quality items (8-12 hrs)
- **Result:** Clean codebase, bugs fixed, minor UX improvements

**Option B: Mix of Quick Wins + High-Value Features**
- Fix bugs #1-2 (1.5-3 hrs)
- Quick UX fix #3 (0.5 hr)
- Add collection stats #4 (2-3 hrs)
- Add completed task sorting #5 (2-3 hrs)
- Defer Casey's items to Session 8
- **Result:** Bugs fixed, 3 UX improvements, tech debt remains

**Option C: Prioritize Foundation Features**
- Fix bugs #1-2 (1.5-3 hrs)
- Implement monthly logs #7 (2-3 hrs)
- Defer Casey's items and other UX to Session 8
- **Result:** Bugs fixed, foundation for future features, tech debt remains

### Question 2: Collection Stats Design
For item #4 (collection stats), which design do you prefer?

**Option A: Icon Row**
```
📚 My Tasks
📋 3  📝 2  📅 1  ✅ 5
```

**Option B: Compact Inline**
```
📚 My Tasks  •  📋 3  📝 2  ✅ 5
```

**Option C: Badge Style**
```
📚 My Tasks
[📋 3] [📝 2] [📅 1]
```

**Option D: Custom Idea?**

### Question 3: Completed Task Behavior
For item #5 (completed tasks to bottom), which approach?

**Option A: Single Setting (3 states)**
- Setting: "Completed Task Behavior"
- Options: "Keep in place" | "Move to bottom" | "Collapse"

**Option B: Two Separate Settings**
- Setting 1: "Sort completed to bottom" (checkbox)
- Setting 2: "Collapse completed tasks" (checkbox)
- Can enable both for sorted + collapsed

**Option C: Replace Existing Setting**
- Remove "Collapse completed tasks"
- Replace with "Move completed to bottom"
- Simpler, but removes existing functionality

### Question 4: Bulk Migration Scope
For item #6 (bulk migration), should it support:

- [ ] Tasks only
- [ ] Notes only
- [ ] Events only
- [ ] All entry types (tasks, notes, events)
- [ ] Filter by completed status (e.g., "migrate all incomplete tasks")

### Question 5: Session 7 Scope
Given Casey's code quality plan (8-12 hours) + your feedback (2-15 hours depending on scope), should we:

**Option A: Split into Two Sessions**
- Session 7A: Bugs + Casey's code quality (4-6 hrs)
- Session 7B: Feature additions (4-8 hrs)

**Option B: One Long Session**
- Session 7: Bugs + Code Quality + Top 2-3 Features (12-18 hrs)

**Option C: Focus Session**
- Session 7: Bugs + Quick Wins only (2-4 hrs)
- Defer everything else to Session 8

---

## ✅ User Decisions - February 3, 2026

### Session 7: Bug Fixes + Code Quality
**Agent Team:** Sam (implement) → Casey (review)  
**Estimated Time:** 10-15 hours  
**Scope:**
1. Fix Bug #1: Daily log creation via migration (0.5-1 hr)
2. Fix Bug #2: Page navigation ordering (1-2 hrs)
3. Fix UX #1: Drag handle position on mobile (0.5 hr)
4. Casey's full code quality plan (8-12 hrs):
   - Extract handler initialization with useMemo
   - Optimize drag sensor creation
   - Replace console statements with logger
   - Extract duplicate drag handle component
   - Refactor CollectionDetailView into hooks
   - Add comprehensive drag-and-drop tests
   - Add keyboard navigation to dropdown menus
   - Fix subscription memory leak
   - Extract magic numbers to constants
   - Add error boundaries

**Goal:** Fix critical bugs and clean up technical debt before adding new features.

---

### Session 8: UX Enhancements
**Agent Team:** Alex (design) → Sam (implement) → Casey (review)  
**Estimated Time:** 6-9 hours  
**Scope:**
1. Collection stats in collection list (2-3 hrs)
   - Design: Icon + count display for tasks/notes/events
   - Differentiate completed vs incomplete
2. Completed task sorting behavior (2-3 hrs)
   - Setting to auto-move completed tasks to bottom
   - Choice between "in-place", "move to bottom", or "collapse"
3. Monthly log collection type - Phase 1 (2-3 hrs)
   - Add `'monthly'` collection type
   - Date field (YYYY-MM format)
   - Auto-generated names ("February 2026")
   - Display in date hierarchy

**Goal:** High-value UX improvements with visual impact.

**Design Questions for Alex (Session 8):**
- Collection stats: Icon layout and positioning
- Completed task behavior: Single setting vs. two settings
- Monthly log: Display format in hierarchy

---

### Session 9: Advanced Features
**Agent Team:** Alex (design) → Sam (implement) → Casey (review)  
**Estimated Time:** 4-6 hours (+ design session)  
**Scope:**
1. Bulk entry migration (4-6 hrs)
   - Multi-select mode for entries
   - "Migrate Selected" action
   - Support all entry types (tasks, notes, events)
   - Consider filter options (incomplete only, etc.)

**Future Sessions:**
- Sub-tasks (hierarchical tasks) - Requires dedicated design session with Alex
- Monthly log Phase 2: Future event visibility
- Monthly log Phase 3: Smart migration from monthly to daily

**Goal:** Power-user features for efficiency.

**Design Questions for Alex (Session 9):**
- Bulk migration: Selection UX and action bar design
- Entry type filtering: Should it support granular selection?

---

### Deferred Items
- **Sub-tasks (Feature #4):** Requires full architecture design session with Alex (estimated 10-15 hours total). Defer to Session 10+.

---

## 🎯 Workflow Approved

**Session 7:** Sam → Casey  
**Session 8+:** Alex → Sam → Casey  

This ensures:
- Session 7 focuses on implementation and cleanup (no design needed)
- Sessions 8+ get proper design review before implementation
- Casey reviews all code for quality assurance
- Each session has clear scope and deliverables

---

**Next Steps:**
1. ✅ Prioritization complete
2. ✅ Session plan documented
3. 🔜 Session 7: Sam implements bug fixes + code quality
4. 🔜 Session 8: Alex designs UX enhancements
5. 🔜 Session 9: Alex designs bulk migration

**Last Updated:** February 3, 2026  
**Status:** Ready for Session 7 kickoff
