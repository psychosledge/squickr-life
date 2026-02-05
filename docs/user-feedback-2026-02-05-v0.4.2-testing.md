# User Feedback - v0.4.2 Testing
**Date:** February 5, 2026  
**Context:** User tested v0.4.2 on mobile after Session 9 hotfix deployment  
**Version:** 0.4.2 (Post-Session 9)

---

## 📱 Testing Context

After deploying v0.4.2 (Session 9 hotfix for mobile UX issues), the user performed comprehensive mobile testing and discovered 2 bugs and proposed 2 feature enhancements.

**Session 9 (v0.4.1 → v0.4.2) Features:**
1. ✅ Fixed swipe navigation sensitivity
2. ✅ Added Today/Yesterday/Tomorrow indicators
3. ✅ Added Tomorrow to migration common choices
4. ✅ Increased collection stats icon size
5. ✅ Implemented mobile back button behavior

---

## 🐛 Bugs Discovered (Priority Order)

### Bug #1: Monthly Logs Not Reachable via Arrow/Swipe Navigation 🔴 CRITICAL
**Problem:** Monthly log pages cannot be accessed using arrow keys or swipe gestures

**User Description:**
> "The monthly pages are not reachable using the arrow or swipe navigation"

**Technical Analysis:**
- **Root Cause:** `collectionSorting.ts` and `useCollectionNavigation.ts` don't include monthly logs in the navigation order
- **Current Code:** `sortCollectionsHierarchically()` only processes:
  - Daily logs (`type === 'daily'`)
  - Custom collections (`type === 'custom' | 'log' | 'tracker'`)
- **Missing:** Monthly logs (`type === 'monthly'`) are filtered out entirely

**Impact:**
- Monthly logs exist and are visible in the collection index
- Monthly logs can be opened from the index
- Monthly logs CANNOT be navigated to using arrows or swipes
- This breaks the page-flipping UX for monthly logs

**Files Affected:**
- `packages/client/src/utils/collectionSorting.ts:26-46`
- `packages/client/src/hooks/useCollectionNavigation.ts:58`

**Priority:** CRITICAL - Core navigation feature broken for monthly logs

---

### Bug #2: Long Collection Names Get Cut Off in Mobile Title 🟡 MEDIUM
**Problem:** Collection names that are too long get truncated in the header title on mobile

**User Description:**
> "In mobile, long collection names get cut off in the title"

**Technical Analysis:**
- **Root Cause:** `CollectionHeader.tsx` uses `truncate` class on the title
- **Current Code:** Line 131 has `truncate mx-4 flex-1 text-center`
- **CSS Behavior:** `truncate` adds `text-overflow: ellipsis` which cuts text with "..."

**Impact:**
- Users cannot see full collection names on mobile
- Makes it harder to identify which collection you're viewing
- Especially problematic for daily logs with long formatted names like "Today, February 5, 2026"

**Possible Solutions:**
1. **Remove truncate, allow wrap:** Multi-line titles (may increase header height)
2. **Reduce font size on mobile:** Keep single line but smaller text
3. **Horizontal scroll:** Allow scrolling the title text
4. **Smart truncation:** Show start + end, truncate middle (e.g., "Today, Feb...2026")

**Files Affected:**
- `packages/client/src/components/CollectionHeader.tsx:131`

**Priority:** MEDIUM - UX issue but not blocking functionality

---

## 💡 Feature Ideas (User Proposed)

### Idea #1: Global Default for Completed Task Behavior 🟢 ENHANCEMENT
**Problem:** Current per-collection setting requires configuring each collection individually

**User Description:**
> "Global config for default task complete behavior to serve as the default that the current settings can override per collection"

**Current Implementation:**
- Per-collection setting: `completedTaskBehavior` on each collection
- Values: `'keep-in-place' | 'move-to-bottom' | 'collapse'`
- Default: `'keep-in-place'` (hardcoded in code)

**Proposed Enhancement:**
- Add global user preference: `defaultCompletedTaskBehavior`
- Each collection's `completedTaskBehavior` can be:
  - `undefined` = use global default
  - Explicit value = override global default
- Settings UI shows: "Use default (Keep in place)" as one option

**Benefits:**
- Set preference once, applies to all new collections
- Can still override per collection as needed
- Better UX for users with many collections

**Note:** This was actually part of the original Session 8 design spec but may not have been fully implemented or needs verification.

**Files to Check:**
- `packages/shared/src/user-preferences.types.ts` (check if exists)
- `packages/client/src/components/CollectionSettingsModal.tsx`
- Event models for `UserPreferencesUpdated`

**Priority:** MEDIUM - Quality of life improvement

---

### Idea #2: Auto-Favorite Today/Yesterday/Tomorrow Daily Logs 🟢 ENHANCEMENT
**Problem:** Users manually favorite daily logs to keep them at the top, but this is repetitive for temporal logs

**User Description:**
> "Add a global option to enable today/tomorrow/yesterday daily logs to be always counted as Favorites"

**Proposed Enhancement:**
- Add global user preference: `autoFavoriteDailyLogs` (boolean)
- When enabled, automatically treat these as favorited in the UI:
  - Today's daily log
  - Yesterday's daily log (if exists)
  - Tomorrow's daily log (if exists)
- These logs appear in the "Favorites" section without manual favoriting
- Original `isFavorite` field remains unchanged (this is UI-only treatment)

**Implementation Considerations:**
- **UI Layer Only:** Don't modify the actual `isFavorite` field in the database
- **Collection List:** Filter/sort logic treats them as favorited
- **Navigation:** Include them in favorited collections order
- **Visual Indicator:** Show star icon but maybe with different styling (e.g., hollow star vs filled star)

**Benefits:**
- Today's log always accessible at the top
- Reduces manual favoriting workflow
- Temporal logs automatically "float" to favorites section
- Historical logs (older than yesterday) remain in regular daily logs section

**Use Cases:**
- User wants quick access to recent daily logs
- User doesn't want to manually favorite/unfavorite each day
- User still wants to favorite other custom collections normally

**Files Affected:**
- User preferences type definitions
- `useCollectionHierarchy.ts` (favorites filtering logic)
- `CollectionList.tsx` or hierarchy components
- Settings UI

**Priority:** LOW - Nice-to-have, not blocking daily use

---

## 📋 Recommended Next Session Plan

### Option A: Session 9.5 - Critical Bug Fixes (RECOMMENDED)
**Scope:** Fix the 2 bugs discovered in testing

**Items:**
1. Fix monthly log navigation (Bug #1 - CRITICAL)
2. Fix long collection name truncation on mobile (Bug #2 - MEDIUM)

**Estimated Time:** 1-2 hours

**Target Version:** v0.4.3 (patch release)

**Rationale:** Critical bug blocking monthly log navigation should be fixed immediately before adding new features.

---

### Option B: Session 10 - Bulk Entry Migration (ORIGINAL PLAN)
**Scope:** Add bulk migration feature as originally planned

**Items:**
1. Bulk entry selection UI
2. Bulk migration functionality
3. Tests for bulk operations

**Estimated Time:** 4-6 hours

**Target Version:** v0.5.0 (minor release - new feature)

**Rationale:** Proceed with original roadmap if bugs are not considered blocking.

---

### Option C: Combined Session - Bugs + Enhancements
**Scope:** Fix bugs AND add the 2 proposed enhancement ideas

**Items:**
1. Fix monthly log navigation (Bug #1 - CRITICAL)
2. Fix long collection name truncation (Bug #2 - MEDIUM)
3. Implement global default completed task behavior (Idea #1)
4. Implement auto-favorite daily logs preference (Idea #2)

**Estimated Time:** 4-5 hours

**Target Version:** v0.4.3 or v0.5.0 (depending on scope decision)

**Rationale:** Consolidate all related settings/preferences work into one session.

---

## 🎯 User Decision Required

### Question 1: Session Priority
**Which session should be next?**

- **Option A:** Fix bugs immediately (Session 9.5 → v0.4.3)
- **Option B:** Defer bugs, proceed with bulk migration (Session 10 → v0.5.0)
- **Option C:** Combined session with bugs + enhancements (→ v0.4.3 or v0.5.0)

### Question 2: Bug #2 Solution Preference
**For long collection name truncation, which solution do you prefer?**

1. **Remove truncate, allow wrap:** Multi-line titles (header grows taller)
2. **Reduce font size on mobile:** Keep single line with smaller text
3. **Horizontal scroll:** Allow scrolling the title (swipeable title text)
4. **Smart truncation:** Show "Today, Feb...2026" style

### Question 3: Idea #1 Verification
**Was global default completed task behavior already implemented in Session 8?**

Need to verify if:
- User preferences type exists with `defaultCompletedTaskBehavior`
- Collection settings modal shows "Use default" option
- Backend events support user preferences updates

If already implemented: Mark as "verify working" task
If not implemented: Add to session scope

---

## 🔍 Technical Investigation Needed

### For Bug #1 (Monthly Log Navigation)
**Files to modify:**
- `packages/client/src/utils/collectionSorting.ts`
  - Add monthly logs to sorting logic
  - Determine placement: before daily logs? after daily logs? grouped by year?
- `packages/client/src/hooks/useCollectionNavigation.ts`
  - Verify it uses `sortCollectionsHierarchically()` correctly

**Expected Hierarchy (from Session 8 design):**
```
Favorites (starred customs)
└─ Year (2026, 2025...)
   ├─ Monthly Logs (Feb 2026, Jan 2026...) [newest first] ← SHOULD BE HERE
   └─ Month (February, January...)
      └─ Daily Logs (Feb 3, Feb 2...) [newest first]
Other Customs (unstarred)
```

**Navigation Order Should Be:**
1. Favorited customs (by order)
2. Monthly logs for each year (newest first by date)
3. Daily logs for each month (newest first by date)
4. Other customs (by order)

**Question:** Should navigation flatten the hierarchy or respect it?
- **Flatten:** Fav1, Fav2, Monthly1, Monthly2, Daily1, Daily2, Custom1, Custom2
- **Respect hierarchy:** Fav1, Fav2, [Year 2026: Monthly-Feb, Monthly-Jan, [Month Feb: Daily-5, Daily-4], [Month Jan: Daily-31, Daily-30]], Custom1

**Recommended:** Flatten for simpler navigation UX (matches current implementation for daily logs)

---

### For Bug #2 (Long Collection Names)
**Files to modify:**
- `packages/client/src/components/CollectionHeader.tsx:131`

**Current Code:**
```tsx
<Link
  to={ROUTES.index}
  className="
    text-xl font-semibold 
    text-gray-900 dark:text-white 
    hover:text-blue-600 dark:hover:text-blue-400
    truncate mx-4 flex-1 text-center  // ← TRUNCATE HERE
    transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500 rounded
    flex items-center justify-center gap-2
  "
>
  {isFavorite && <span className="text-yellow-500">{ENTRY_ICONS.FAVORITE}</span>}
  {collectionName}
</Link>
```

**Solution Options (CSS Changes):**

1. **Remove truncate, allow wrap:**
   ```tsx
   className="... text-center mx-4 flex-1 ..." // Remove "truncate"
   ```

2. **Reduce font size on mobile:**
   ```tsx
   className="... text-lg sm:text-xl font-semibold truncate ..." // text-lg on mobile, text-xl on desktop
   ```

3. **Horizontal scroll:**
   ```tsx
   className="... overflow-x-auto whitespace-nowrap ..."
   // May conflict with swipe navigation
   ```

4. **Smart truncation:**
   ```tsx
   // More complex - requires JS logic to truncate intelligently
   // Example: "Today, February 5, 2026" → "Today, Feb...2026"
   ```

---

## 📊 Version History Context

**v0.4.0 (Session 8):**
- Collection stats display
- Completed task behavior settings (3 modes)
- Monthly log collection type
- 925 tests passing
- Casey rating: 9.5/10
- **Status:** Deployed, mobile issues discovered

**v0.4.1 → v0.4.2 (Session 9):**
- Fixed swipe navigation sensitivity
- Added Today/Yesterday/Tomorrow indicators
- Added Tomorrow to migration modal
- Increased collection stats icon size
- Mobile back button behavior
- **Status:** Deployed, 2 bugs discovered in testing

**v0.4.3 (Session 9.5 - Proposed):**
- Fix monthly log navigation (Bug #1)
- Fix long collection name truncation (Bug #2)
- Target: Bug fixes only, fast deployment
- **Status:** Awaiting user decision

**v0.5.0 (Session 10 - Deferred):**
- Bulk entry migration
- **Status:** Deferred until bugs resolved

---

## 🔗 Related Documentation

- **Roadmap:** `docs/next-session-roadmap.md` (needs update)
- **Session 9 Feedback:** `docs/user-feedback-2026-02-03-session9.md`
- **Session 8 Design:** `docs/session-2026-02-03-session8-design.md` (monthly log hierarchy spec)
- **Architecture Decisions:** `docs/architecture-decisions.md`

---

## 📝 Summary

**Bugs Found:** 2
- 🔴 CRITICAL: Monthly logs not navigable (breaks core UX)
- 🟡 MEDIUM: Long names truncated on mobile (usability issue)

**Ideas Proposed:** 2
- 🟢 Global default completed task behavior (may already exist from Session 8?)
- 🟢 Auto-favorite today/tomorrow/yesterday daily logs (nice-to-have)

**Recommended Next Action:** Fix Bug #1 (monthly log navigation) immediately as it blocks a core feature (monthly logs added in Session 8). Bug #2 and enhancement ideas can be batched or deferred.

---

**Document Created:** February 5, 2026  
**Next Action:** User decides session priority and Bug #2 solution preference  
**Status:** Awaiting user decisions
