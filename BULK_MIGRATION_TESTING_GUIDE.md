# Bulk Entry Migration - Manual Testing Guide

**Feature:** v0.5.0 - Bulk Entry Migration  
**Status:** Phase 3 Complete (Implementation) → Phase 4 In Progress (Testing & Polish)  
**Dev Server:** http://localhost:3001/

---

## ✅ Automated Tests Status

- **Total Tests:** 996 (all passing)
  - Shared package: 388 tests ✅
  - Client package: 608 tests ✅
- **New Tests Added:** 33 tests
  - `useSelectionMode`: 10 tests
  - `SelectableEntryItem`: 8 tests  
  - `SelectionToolbar`: 12 tests
  - `SelectionModeToggle`: 3 tests

---

## 📋 Manual Testing Checklist

### Prerequisites
1. ✅ Dev server running on `http://localhost:3001/`
2. ✅ Browser with DevTools open (for console errors)
3. ✅ Create test collection with 10-15 mixed entries (tasks, notes, events)

---

### Test Suite 1: Basic Selection Mode (Desktop)

#### 1.1 Enter Selection Mode
- [ ] Navigate to a collection with multiple entries
- [ ] Click collection header menu (three dots)
- [ ] Verify "Select Entries" appears as first option (before "Favorite")
- [ ] Click "Select Entries"
- [ ] **Expected:** 
  - Checkboxes appear on left side of all entries
  - Selection toolbar appears at bottom
  - Selection count shows "0 selected"
  - Menu closes automatically

#### 1.2 Toggle Individual Selection
- [ ] Click checkbox on first entry
- [ ] **Expected:** 
  - Checkbox fills with checkmark
  - Entry background changes to blue highlight
  - Toolbar count updates to "1 selected"
- [ ] Click same checkbox again
- [ ] **Expected:**
  - Checkbox clears
  - Blue highlight removes
  - Toolbar count updates to "0 selected"

#### 1.3 Select Multiple Entries
- [ ] Select 3 different entries by clicking checkboxes
- [ ] **Expected:**
  - All 3 entries show blue highlight
  - Toolbar shows "3 selected"
  - All checkboxes filled correctly

---

### Test Suite 2: Quick Filters

#### 2.1 Select All Filter
- [ ] Click "All" button in toolbar
- [ ] **Expected:**
  - All entries in collection become selected
  - Toolbar count matches total entry count
  - All checkboxes filled

#### 2.2 Incomplete Tasks Filter
- [ ] Ensure collection has mix of incomplete tasks, completed tasks, and notes
- [ ] Click "Clear" to deselect all
- [ ] Click "Incomplete" button
- [ ] **Expected:**
  - Only incomplete tasks are selected (not completed tasks or notes)
  - Toolbar count matches number of incomplete tasks
  - Only incomplete task checkboxes filled

#### 2.3 Notes Filter
- [ ] Click "Clear" to deselect all
- [ ] Click "Notes" button
- [ ] **Expected:**
  - Only notes are selected (not tasks)
  - Toolbar count matches number of notes
  - Only note checkboxes filled

#### 2.4 Clear Filter
- [ ] Select several entries manually
- [ ] Click "Clear" button
- [ ] **Expected:**
  - All selections cleared
  - Toolbar shows "0 selected"
  - All checkboxes empty
  - Selection mode still active

---

### Test Suite 3: Bulk Migration

#### 3.1 Migrate Button Disabled State
- [ ] Enter selection mode
- [ ] With 0 entries selected, attempt to click "Migrate" button
- [ ] **Expected:**
  - Button appears disabled/grayed out
  - Button does not respond to clicks

#### 3.2 Migrate to Existing Collection
- [ ] Select 3-5 entries
- [ ] Click "Migrate" button
- [ ] **Expected:**
  - Modal opens with title "Migrate X entries" (X = selected count)
  - Dropdown shows all collections except current one
- [ ] Select target collection from dropdown
- [ ] Click "Migrate" button in modal
- [ ] **Expected:**
  - Modal closes
  - All selected entries disappear from current collection
  - Success toast appears
  - Selection mode exits automatically
  - Toolbar disappears
  - Checkboxes disappear
- [ ] Navigate to target collection
- [ ] **Expected:**
  - All migrated entries appear at bottom in same relative order

#### 3.3 Migrate to New Collection
- [ ] Select 2-3 entries
- [ ] Click "Migrate" button
- [ ] Click "Create New Collection" in modal
- [ ] **Expected:**
  - Create Collection modal appears
- [ ] Enter new collection name "Test Migration Target"
- [ ] Click "Create"
- [ ] **Expected:**
  - Returns to migration modal
  - New collection appears in dropdown as selected
  - Title still shows correct count
- [ ] Click "Migrate"
- [ ] **Expected:**
  - Entries migrate to new collection
  - Selection mode exits
  - Success toast appears
- [ ] Navigate to new collection
- [ ] **Expected:**
  - Entries present in correct order

#### 3.4 Cancel Migration
- [ ] Select entries
- [ ] Click "Migrate" button
- [ ] Click "Cancel" or X to close modal
- [ ] **Expected:**
  - Modal closes
  - Selection mode remains active
  - Selections preserved
  - Entries not migrated

---

### Test Suite 4: Exit Selection Mode

#### 4.1 Cancel via Toolbar
- [ ] Enter selection mode
- [ ] Select some entries
- [ ] Click "Cancel" button in toolbar
- [ ] **Expected:**
  - Selection mode exits
  - Checkboxes disappear
  - Toolbar disappears
  - Selections cleared
  - Entries remain in place

#### 4.2 Exit via Navigation
- [ ] Enter selection mode in Collection A
- [ ] Select some entries
- [ ] Navigate to Collection B (via sidebar or back button)
- [ ] **Expected:**
  - Selection cleared automatically
  - No checkboxes in Collection B
- [ ] Navigate back to Collection A
- [ ] **Expected:**
  - Selection mode not active
  - No checkboxes visible

---

### Test Suite 5: Mobile Responsiveness (Chrome DevTools)

#### 5.1 iPhone SE (320px width)
- [ ] Open DevTools → Toggle device toolbar
- [ ] Select "iPhone SE" or set width to 320px
- [ ] Navigate to collection
- [ ] Enter selection mode
- [ ] **Expected:**
  - Checkboxes visible and tappable (48x48px minimum)
  - Toolbar appears at bottom
  - Toolbar doesn't obscure last entry
  - Safe area inset applied (for notched devices)
- [ ] Select entries
- [ ] **Expected:**
  - Touch targets large enough (no accidental taps)
  - Toolbar buttons clearly labeled
  - Count visible and readable

#### 5.2 iPad (768px width)
- [ ] Set device to iPad or 768px width
- [ ] Repeat selection mode workflow
- [ ] **Expected:**
  - Layout adapts appropriately
  - Toolbar spans full width
  - All buttons accessible

---

### Test Suite 6: Dark Mode

#### 6.1 Visual Verification
- [ ] Enable dark mode (browser/OS setting)
- [ ] Enter selection mode
- [ ] **Expected:**
  - Checkboxes visible against dark background
  - Selected entry highlight visible (dark blue instead of light blue)
  - Toolbar has dark background
  - Text readable (white/light gray)
- [ ] Select entries
- [ ] **Expected:**
  - Blue highlight visible: `bg-blue-900/20` (20% opacity dark blue)
  - Checkbox checkmark visible
- [ ] Open migration modal
- [ ] **Expected:**
  - Modal has dark styling
  - Dropdown readable
  - Buttons properly styled

---

### Test Suite 7: Edge Cases

#### 7.1 Empty Collection
- [ ] Create new empty collection
- [ ] Enter selection mode
- [ ] **Expected:**
  - No checkboxes (no entries)
  - Toolbar shows "0 selected"
  - All filter buttons still work (but select nothing)
  - "Migrate" button disabled

#### 7.2 Single Entry Collection
- [ ] Create collection with 1 entry
- [ ] Enter selection mode
- [ ] Select the entry
- [ ] Migrate to another collection
- [ ] **Expected:**
  - Works correctly
  - Collection now empty
  - Selection mode exits

#### 7.3 All Entries Selected and Migrated
- [ ] Collection with 5 entries
- [ ] Select all entries
- [ ] Migrate all to different collection
- [ ] **Expected:**
  - Source collection now empty
  - All entries in target collection
  - Selection mode exited

#### 7.4 Mixed Entry Types
- [ ] Collection with tasks (open + completed), notes, and events
- [ ] Test "Incomplete" filter
- [ ] **Expected:**
  - Only selects open tasks (not completed, notes, or events)
- [ ] Test "Notes" filter
- [ ] **Expected:**
  - Only selects notes (not tasks or events)

#### 7.5 Completed Task Modes
Test with all 3 completed task behavior modes:

**Mode 1: Keep in Place**
- [ ] Set collection to "Keep in place" mode
- [ ] Enter selection mode
- [ ] **Expected:** All tasks (completed + incomplete) visible in one list
- [ ] Select mix of completed and incomplete tasks
- [ ] Migrate successfully

**Mode 2: Move to Bottom**
- [ ] Set collection to "Move to bottom" mode
- [ ] **Expected:** Active tasks at top, separator, completed tasks at bottom
- [ ] Enter selection mode
- [ ] **Expected:** Checkboxes appear in both sections
- [ ] Select entries from both sections
- [ ] **Expected:** Toolbar shows combined count
- [ ] Migrate successfully

**Mode 3: Collapse**
- [ ] Set collection to "Collapse completed" mode
- [ ] **Expected:** Completed tasks hidden behind "X completed tasks" button
- [ ] Enter selection mode without expanding
- [ ] Select visible entries
- [ ] **Expected:** Only visible entries have checkboxes
- [ ] Expand completed section
- [ ] **Expected:** Checkboxes appear on completed tasks too
- [ ] Select mix from both sections
- [ ] Migrate successfully

#### 7.6 Current Collection Filtering
- [ ] In Collection A, enter selection mode
- [ ] Select entries, click "Migrate"
- [ ] **Expected:** Collection A does NOT appear in dropdown
- [ ] Verify only other collections listed

---

### Test Suite 8: Performance & UX

#### 8.1 Small Collections (< 10 entries)
- [ ] Collection with 5 entries
- [ ] Select all and migrate
- [ ] **Expected:**
  - Migration completes instantly (<500ms)
  - No loading indicators needed
  - Smooth transition

#### 8.2 Medium Collections (10-30 entries)
- [ ] Collection with 20 entries (create via FAB or script if needed)
- [ ] Select all and migrate
- [ ] **Expected:**
  - Migration completes quickly (<1s)
  - UI remains responsive
  - No console errors

#### 8.3 Large Collections (50+ entries) - OPTIONAL
⚠️ **Not yet implemented:** Progress indicator for 50+ entries

If you can create a collection with 50+ entries:
- [ ] Select all and migrate
- [ ] **Expected (future):**
  - Progress indicator appears
  - Migration completes without UI freeze
  
**Current behavior:** Sequential migration, no progress indicator yet

#### 8.4 Very Large Collections (100+ entries) - OPTIONAL
⚠️ **Not yet implemented:** Warning toast for 100+ selections

If you can create a collection with 100+ entries:
- [ ] Click "Select All"
- [ ] **Expected (future):**
  - Warning toast appears: "Migrating 100+ entries may take a moment"
  
**Current behavior:** No warning, just slower sequential migration

---

### Test Suite 9: Browser Compatibility

Test the full workflow in each browser:

#### 9.1 Chrome/Edge (Chromium)
- [ ] All features work correctly
- [ ] No console errors
- [ ] Selection highlights visible
- [ ] Toolbar positioning correct

#### 9.2 Firefox
- [ ] All features work correctly
- [ ] Checkbox styling correct
- [ ] Blue highlight renders properly
- [ ] Toolbar doesn't clip

#### 9.3 Safari (if available)
- [ ] All features work correctly
- [ ] Safe area insets work on iPhone
- [ ] Webkit-specific CSS renders correctly

---

## 🐛 Bug Tracking Template

If you find issues, document them like this:

```markdown
### Bug: [Brief Description]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Browser:** Chrome 120 / Firefox 121 / Safari 17
**Screen Size:** Desktop 1920x1080 / Mobile 375x667
**Console Errors:** (paste here)
**Screenshots:** (attach if helpful)
```

---

## ✅ Definition of Done - Phase 4

Phase 4 is complete when:

- [ ] All manual test suites (1-7) completed without critical bugs
- [ ] Mobile UX verified on at least 2 screen sizes
- [ ] Dark mode verified
- [ ] No console errors during normal usage
- [ ] Edge cases handled gracefully
- [ ] Cross-browser testing on Chrome + 1 other browser
- [ ] Performance acceptable for collections up to 30 entries
- [ ] All bugs documented and prioritized
- [ ] Critical bugs fixed (P0/P1)

**Nice-to-have (can be post-MVP):**
- Progress indicator for 50+ entries
- Warning toast for 100+ entries
- Batch event appending optimization
- Accessibility (keyboard navigation, screen readers)

---

## 📝 Test Results Log

Use this section to log your test results:

### Tester: _____________
### Date: _____________
### Browser: _____________

#### Test Suite 1: Basic Selection (Desktop)
- [ ] 1.1 Enter Selection Mode - PASS / FAIL
- [ ] 1.2 Toggle Individual Selection - PASS / FAIL  
- [ ] 1.3 Select Multiple Entries - PASS / FAIL

#### Test Suite 2: Quick Filters
- [ ] 2.1 Select All - PASS / FAIL
- [ ] 2.2 Incomplete Tasks - PASS / FAIL
- [ ] 2.3 Notes - PASS / FAIL  
- [ ] 2.4 Clear - PASS / FAIL

#### Test Suite 3: Bulk Migration
- [ ] 3.1 Disabled State - PASS / FAIL
- [ ] 3.2 Migrate to Existing - PASS / FAIL
- [ ] 3.3 Migrate to New - PASS / FAIL
- [ ] 3.4 Cancel Migration - PASS / FAIL

#### Test Suite 4: Exit Selection Mode
- [ ] 4.1 Cancel via Toolbar - PASS / FAIL
- [ ] 4.2 Exit via Navigation - PASS / FAIL

#### Test Suite 5: Mobile
- [ ] 5.1 iPhone SE - PASS / FAIL
- [ ] 5.2 iPad - PASS / FAIL

#### Test Suite 6: Dark Mode
- [ ] 6.1 Visual Verification - PASS / FAIL

#### Test Suite 7: Edge Cases
- [ ] 7.1 Empty Collection - PASS / FAIL
- [ ] 7.2 Single Entry - PASS / FAIL
- [ ] 7.3 All Migrated - PASS / FAIL
- [ ] 7.4 Mixed Types - PASS / FAIL
- [ ] 7.5 Completed Task Modes - PASS / FAIL
- [ ] 7.6 Current Collection Filter - PASS / FAIL

#### Test Suite 8: Performance
- [ ] 8.1 Small Collections - PASS / FAIL
- [ ] 8.2 Medium Collections - PASS / FAIL

#### Test Suite 9: Browsers
- [ ] 9.1 Chrome/Edge - PASS / FAIL
- [ ] 9.2 Firefox - PASS / FAIL

**Critical Bugs Found:** _____________
**Minor Bugs Found:** _____________
**Overall Assessment:** PASS / NEEDS FIXES / FAIL

---

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Mark feature as "Ready for Casey Review"
   - Create summary document for code review
   - Merge to main after approval

2. **If bugs found:**
   - Prioritize bugs (P0=blocker, P1=critical, P2=nice-to-fix)
   - Fix P0/P1 bugs
   - Re-test affected areas
   - Document P2 bugs as future improvements

3. **Performance issues:**
   - If collections >30 entries lag, consider:
     - Implementing batch append to EventStore
     - Adding progress indicators
     - Optimizing projection queries

---

**Happy Testing! 🎉**
