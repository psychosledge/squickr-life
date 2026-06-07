# UX Bug Fixes — 2026-06-06

Four user-reported UX bugs: resume reconnection, context menu clipping, reminder date default, and reminder time display.

---

## Slice 1 — Resume Reconnection

**Status:** ✅ done
**Commit:** 31278f9
**File:** `packages/client/src/hooks/useColdStartSequencer.ts`

**What:** On the fast path (returning user with local data), the `onSyncStateChange` callback called `setSyncError(error)` when a background sync timed out, flipping `isAppReady` back to `false` and showing the blocking overlay. Fixed by suppressing sync errors on the fast and benchmark paths. Added `setSyncError(null)` before `setColdStartPhase('ready')` to clear stale errors from prior slow-path cycles. Slow path is unchanged.

**Acceptance Criteria:**
- [x] Returning user opens app → local data renders immediately, no overlay appears
- [x] Background sync times out → app stays interactive, no "Show local data" button
- [x] Slow path (empty local store, first login) → overlay still appears after 15s timeout
- [x] `dismissSyncError` on slow path still transitions to ready state correctly

---

## Slice 2 — Context Menu Flip

**Status:** ✅ done
**Commit:** 9339263
**File:** `packages/client/src/components/EntryActionsMenu.tsx`

**What:** The position `useEffect` always places the menu below the trigger (`top: rect.bottom + 4`) with no viewport check. When the trigger is near the bottom of the screen, the menu clips. Fix: compare available space below vs above; if below is insufficient (< ~300px), flip to open upward (`top: rect.top - MENU_MAX_HEIGHT`).

**Acceptance Criteria:**
- [x] ⋯ menu on last visible row opens upward, fully within viewport
- [x] ⋯ menu near top of list still opens downward
- [x] No menu items obscured or require scrolling in either direction
- [x] Closes on outside click, Escape, scroll

---

## Slice 3 — Reminder Date Default

**Status:** ✅ done
**Commit:** 4c81d09
**File:** `packages/client/src/components/TaskReminderModal.tsx`

**What:** `date` state initializes as `''`. Fix: initialize with today's local `YYYY-MM-DD` string via lazy `useState` initializer. The existing `useEffect` that pre-populates from `existingReminderAt` still overrides this when editing an existing reminder.

**Acceptance Criteria:**
- [x] Opening "Set reminder" (no existing reminder) → date pre-populated with today, time blank, Save disabled
- [x] Entering a time → Save enables, saves correctly for today
- [x] Opening with existing reminder → existing date/time shown, not today's date
- [x] Correct reminder timestamp produced when date changed to a future date

---

## Slice 4 — Reminder Time Display

**Status:** ✅ done
**Commit:** e962342
**Files:** `packages/client/src/utils/formatters.ts`, `packages/client/src/components/TaskEntryItem.tsx`

**What:** `formatTimestamp(entry.reminderAt)` returns `"just now"` for future timestamps (negative `diffMs` is `< 10` seconds). Fix: add `formatReminderTime()` that renders the absolute scheduled time — `"7:00 PM"` (same day), `"Jun 8 at 7:00 PM"` (different day same year), `"Jun 8, 2027 at 7:00 PM"` (different year). Use it in `TaskEntryItem.tsx` in place of `formatTimestamp`.

**Acceptance Criteria:**
- [x] Reminder set for later today → shows `"7:00 PM"` (not `"just now"`)
- [x] Reminder set for different day this year → shows `"Jun 8 at 7:00 PM"`
- [x] Reminder set for different year → shows year in display
- [x] Bell icon still visible alongside time
- [x] `"just now"` never appears in any reminder indicator

---

## UAT Checklist

**Bug 1 — Resume Reconnection**
- [ ] Switch away from app for 30s, return — local data shows, no overlay
- [ ] Go offline in DevTools, switch tabs and back — app stays usable, no blocking UI
- [ ] Fresh device (empty IndexedDB), simulate 15s Firestore timeout → slow-path overlay still appears with "Show local data" button
- [ ] Re-enable network after fast-path test — next sync succeeds silently

**Bug 2 — Context Menu Flip**
- [ ] Bottom-of-list task on mobile (375px) → ⋯ menu opens fully upward, all items visible
- [ ] Top-of-list task → menu still opens downward
- [ ] Short browser window (400px) → no menu clipping at bottom
- [ ] Menu closes on outside tap, Escape, scroll

**Bug 3 — Reminder Date Default**
- [ ] New reminder modal → date = today, time blank, Save disabled
- [ ] Enter a time, Save → reminder created for today at that time
- [ ] Existing reminder → shows existing date/time, not today
- [ ] Change date + time, Save → correct timestamp in Bell indicator

**Bug 4 — Reminder Time Display**
- [ ] Reminder for later today → indicator shows `"7:00 PM"`, not `"just now"`
- [ ] Reminder for a different day this year → `"Jun 8 at 7:00 PM"`
- [ ] Set new reminder → indicator immediately shows correct scheduled time
- [ ] Bell icon present alongside time text
- [ ] `"just now"` never appears in any reminder indicator
