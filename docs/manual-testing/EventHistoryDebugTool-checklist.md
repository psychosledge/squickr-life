# Manual Testing Checklist: EventHistoryDebugTool

## Test Session: 2026-02-14

### Phase 1: Refactored Implementation (DebugContext)

**Component Under Test:** EventHistoryDebugTool  
**Version:** v2.0 (Context-based)  
**Reviewer:** _____________  
**Date:** _____________

---

## Pre-Testing Setup

- [ ] Ensure dev mode is enabled (`import.meta.env.DEV === true`)
- [ ] Open browser DevTools console for error monitoring
- [ ] Navigate to a collection with entries

---

## Test 1: Production Mode Exclusion

**Objective:** Verify debug tool is hidden in production mode

**Steps:**
1. [ ] Open browser DevTools
2. [ ] In console, run: `import.meta.env.DEV = false`
3. [ ] Reload page
4. [ ] Check: Debug buttons should NOT appear on any entry

**Expected:** No debug buttons visible  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 2: Debug Button Visibility (Dev Mode)

**Objective:** Verify debug button appears on all entry types

**Steps:**
1. [ ] Ensure dev mode is enabled
2. [ ] Navigate to a collection with mixed entry types
3. [ ] Check Task entries for "🐛 N" button in top-right corner
4. [ ] Check Note entries for "🐛 N" button in top-right corner
5. [ ] Check Event entries for "🐛 N" button in top-right corner

**Expected:** Small purple button with bug emoji and event count  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 3: Button Position (No FAB Overlap)

**Objective:** Verify button doesn't overlap with FAB (Add Entry button)

**Steps:**
1. [ ] Open a collection with entries
2. [ ] Scroll to bottom of page
3. [ ] Locate FAB (+ button) in bottom-right corner
4. [ ] Check debug buttons are in top-right of each entry card
5. [ ] Verify NO overlap between debug button and FAB

**Expected:** Debug button visible and clickable (not hidden by FAB)  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 4: Event Filtering - Task Events

**Objective:** Verify correct events are shown for tasks

**Steps:**
1. [ ] Create a new task: "Test Debug Task"
2. [ ] Click debug button (🐛 1)
3. [ ] Verify panel shows 1 event: `TaskCreated`
4. [ ] Edit the task title: "Test Debug Task Updated"
5. [ ] Click debug button (🐛 2)
6. [ ] Verify panel shows 2 events: `TaskCreated`, `TaskTitleUpdated`
7. [ ] Complete the task
8. [ ] Click debug button (🐛 3)
9. [ ] Verify panel shows 3 events: `TaskCreated`, `TaskTitleUpdated`, `TaskCompleted`

**Expected:** Correct events for task lifecycle  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 5: Event Filtering - Note Events

**Objective:** Verify correct events are shown for notes

**Steps:**
1. [ ] Create a new note: "Test Debug Note"
2. [ ] Click debug button (🐛 1)
3. [ ] Verify panel shows 1 event: `NoteCreated`
4. [ ] Edit note content: "Test Debug Note Updated"
5. [ ] Click debug button (🐛 2)
6. [ ] Verify panel shows 2 events: `NoteCreated`, `NoteContentChanged`

**Expected:** Correct events for note lifecycle  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 6: Event Filtering - Event Entries

**Objective:** Verify correct events are shown for calendar events

**Steps:**
1. [ ] Create a new event: "Test Debug Event" with date
2. [ ] Click debug button (🐛 1)
3. [ ] Verify panel shows 1 event: `EventCreated`
4. [ ] Edit event content or date
5. [ ] Click debug button (🐛 2)
6. [ ] Verify panel shows 2 events: `EventCreated`, `EventContentChanged` or `EventDateChanged`

**Expected:** Correct events for event lifecycle  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 7: Migration Events

**Objective:** Verify migration events are tracked

**Steps:**
1. [ ] Create a task in Collection A
2. [ ] Note event count (should be 1)
3. [ ] Move task to Collection B
4. [ ] Click debug button
5. [ ] Verify panel shows migration event: `TaskAddedToCollection`, `TaskRemovedFromCollection`, or `TaskMigrated`

**Expected:** Migration events appear in history  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 8: Expand/Collapse Interaction

**Objective:** Verify panel can be opened and closed

**Steps:**
1. [ ] Click debug button (🐛 N)
2. [ ] Verify panel expands with event list
3. [ ] Click "✕" button in panel header
4. [ ] Verify panel closes and button reappears

**Expected:** Smooth open/close interaction  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 9: Event Metadata Display

**Objective:** Verify event details are displayed correctly

**Steps:**
1. [ ] Open debug panel for any entry
2. [ ] Verify each event shows:
   - [ ] Event type (e.g., "TaskCreated")
   - [ ] Timestamp (formatted date/time)
   - [ ] Full event JSON in `<pre>` block
3. [ ] Verify JSON is formatted (indented)
4. [ ] Verify JSON is scrollable if long

**Expected:** All event metadata visible and readable  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 10: No Events Case

**Objective:** Verify graceful handling when no events exist

**Steps:**
1. [ ] Manually corrupt an entry ID (in browser DevTools):
   ```javascript
   // Find an entry element and modify its data attribute
   document.querySelector('[data-entry-id]').dataset.entryId = 'fake-id-999'
   ```
2. [ ] Click debug button for corrupted entry
3. [ ] Verify panel shows "No events found for this entry"

**Expected:** Clear message for orphaned entries  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 11: Multiple Entries Simultaneously

**Objective:** Verify multiple debug panels can be open at once

**Steps:**
1. [ ] Open debug panel for Entry A
2. [ ] Without closing, open debug panel for Entry B
3. [ ] Verify both panels are visible
4. [ ] Verify correct events for each entry

**Expected:** Multiple panels can coexist without conflict  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 12: Performance - Large Event History

**Objective:** Verify tool handles large event histories

**Steps:**
1. [ ] Create a task
2. [ ] Perform 20+ operations (edit, complete, reopen, move, etc.)
3. [ ] Click debug button
4. [ ] Verify panel opens without lag
5. [ ] Verify all events are listed
6. [ ] Verify panel is scrollable

**Expected:** Smooth performance even with many events  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 13: Context Integration (No Prop Drilling)

**Objective:** Verify DebugContext eliminates prop drilling

**Steps:**
1. [ ] Open browser DevTools → React DevTools
2. [ ] Inspect `TaskEntryItem` component
3. [ ] Verify NO `allEvents` prop is passed
4. [ ] Inspect `NoteEntryItem` component
5. [ ] Verify NO `allEvents` prop is passed
6. [ ] Inspect `EventEntryItem` component
7. [ ] Verify NO `allEvents` prop is passed

**Expected:** No `allEvents` prop in component hierarchy  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 14: Event Subscription (Reactivity)

**Objective:** Verify debug tool updates when new events occur

**Steps:**
1. [ ] Open debug panel for a task
2. [ ] Note current event count (e.g., 3 events)
3. [ ] Without closing panel, complete the task
4. [ ] Verify panel updates to show new event count (4 events)
5. [ ] Verify new `TaskCompleted` event appears

**Expected:** Debug panel updates reactively  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 15: Type Safety (No Console Errors)

**Objective:** Verify no TypeScript or runtime errors

**Steps:**
1. [ ] Open browser DevTools → Console
2. [ ] Clear console
3. [ ] Interact with debug tool (open/close panels, multiple entries)
4. [ ] Check console for errors

**Expected:** Zero console errors  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Test 16: Accessibility

**Objective:** Verify keyboard and screen reader support

**Steps:**
1. [ ] Tab to debug button
2. [ ] Press Enter to open panel
3. [ ] Tab to close button (✕)
4. [ ] Press Enter to close panel
5. [ ] Verify button has `title` attribute
6. [ ] Verify close button has accessible label

**Expected:** Fully keyboard accessible  
**Actual:** _______________  
**Status:** [ ] Pass [ ] Fail

---

## Known Issues / Edge Cases

**Issue:** ________________________________________________  
**Severity:** [ ] Blocker [ ] Major [ ] Minor [ ] Cosmetic  
**Status:** [ ] Fixed [ ] Needs Attention [ ] Deferred

**Issue:** ________________________________________________  
**Severity:** [ ] Blocker [ ] Major [ ] Minor [ ] Cosmetic  
**Status:** [ ] Fixed [ ] Needs Attention [ ] Deferred

---

## Summary

**Total Tests:** 16  
**Tests Passed:** _____ / 16  
**Tests Failed:** _____ / 16  
**Pass Rate:** _____% 

**Overall Status:** [ ] Pass [ ] Fail  
**Ready for Casey's Re-Review:** [ ] Yes [ ] No

**Notes:**
___________________________________________________________________
___________________________________________________________________
___________________________________________________________________

---

## Reviewer Sign-Off

**Tested By:** _____________  
**Date:** _____________  
**Signature:** _____________
