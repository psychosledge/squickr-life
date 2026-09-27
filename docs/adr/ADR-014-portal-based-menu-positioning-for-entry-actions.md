# ADR-014: Portal-Based Menu Positioning for Entry Actions

**Date**: 2026-02-14  
**Status**: Accepted

## Context

The EntryActionsMenu component (three-dot menu on each entry) had multiple critical UX and accessibility issues:

1. **Menu coverage bug**: Long sub-task text was covering/overlapping the menu when opened
2. **Portal positioning bugs** (discovered during fix):
   - Menu appeared at top-left corner briefly before moving to correct position
   - Menu positioned incorrectly when page was scrolled (viewport vs document coordinates)
   - Sub-task menus closed immediately after opening (click-outside handler registered too early)
   - Menu stayed visible when scrolling, appearing detached from entry (confusing UX)

**Initial implementation:**
- Menu rendered inline within entry component DOM
- Absolute positioning relative to parent container
- CSS stacking context issues caused overlap with long text
- z-index conflicts with other UI elements

## Decision

**Implement portal-based rendering with fixed positioning:**

1. **React Portal rendering**:
   - Render menu in `document.body` instead of inline DOM
   - Break out of parent component's CSS stacking context
   - Use `createPortal()` from `react-dom`

2. **Fixed viewport positioning**:
   - Calculate position from button's `getBoundingClientRect()`
   - Use `position: fixed` (viewport-relative, not document-relative)
   - Do NOT add `window.scrollY/scrollX` (would double-count scroll offset)
   - Initial `menuPosition` state is `null` (only render when calculated)

3. **Deferred event listener registration**:
   - Use `setTimeout(..., 0)` to defer click-outside listener
   - Prevents opening click from immediately closing menu
   - Add `stopPropagation()` on button click for sub-task wrapper handling

4. **Scroll-to-close behavior**:
   - Add window scroll listener when menu is open
   - Use `{ capture: true, passive: true }` for performance
   - Close menu immediately when scrolling starts

5. **Proper z-index layering**:
   - Menu uses `z-[150]` (above entries, below full-page modals)
   - Entry content uses `pr-8` padding to prevent text wrapping under menu button

## Rationale

**Why React Portal:**
- **Escapes stacking context**: Parent CSS (overflow, transform, z-index) can't affect menu
- **Predictable z-index**: Menu always above page content, no cascading z-index issues
- **Accessibility**: Screen readers handle portals correctly (menu still associated with button)
- **React best practice**: Recommended pattern for modals/dropdowns

**Why fixed positioning:**
- **Viewport-relative**: Menu position stays consistent regardless of scroll
- **Simple math**: `getBoundingClientRect()` gives viewport coords directly (no offset needed)
- **No double-counting**: Adding `window.scrollY` to `getBoundingClientRect()` with `fixed` is incorrect

**Why deferred event listeners:**
- **Click event order**: Click fires → opens menu → next tick → register listener
- **Prevents immediate closure**: Opening click has already bubbled before listener exists
- **Sub-task compatibility**: DOM walking + stopPropagation handles wrapper divs

**Why scroll-to-close:**
- **UX clarity**: Menu should close when entry scrolls out of view
- **Prevents confusion**: Menu appearing at wrong position during scroll is jarring
- **Performance**: Passive listener doesn't block scrolling

**Why pr-8 padding:**
- **Text wrapping**: Prevents long titles from flowing under menu button
- **Visual balance**: Creates white space for menu button without layout shift
- **Responsive**: Works across different screen sizes

## Consequences

**Positive:**
- ✅ Menu never covered by entry text (portal rendering)
- ✅ No flash at top-left (null initial position)
- ✅ Correct positioning when scrolled (fixed, no offset double-counting)
- ✅ Sub-task menus work reliably (deferred listener + stopPropagation)
- ✅ Menu closes on scroll (better UX)
- ✅ Predictable z-index layering
- ✅ Accessible (ARIA labels, keyboard support maintained)
- ✅ All 894 client tests passing

**Negative:**
- ❌ Slightly more complex implementation (portal + position calculation)
- ❌ Menu rendered outside component tree (debugging requires understanding portals)
- ❌ Need to manage cleanup for scroll listeners
- ❌ Fixed padding on all entries (even when menu not open)

**Trade-offs:**
- **Portal complexity vs reliability**: Worth it for correct z-index behavior
- **Memory overhead**: Small (one event listener per open menu)
- **Fixed padding**: Acceptable visual trade-off for preventing text overlap

## Implementation Details

**Position Calculation:**
```typescript
const rect = buttonRef.current.getBoundingClientRect();
setMenuPosition({
  top: rect.bottom + 4,    // 4px gap below button
  left: rect.right - 160,  // Align right edge (menu width = 160px)
});
```

**Deferred Listener Registration:**
```typescript
useEffect(() => {
  if (!isOpen) return;
  
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  }, 0);
  
  return () => {
    clearTimeout(timeoutId);
    // ... remove listeners
  };
}, [isOpen]);
```

**Click-Outside Handler (Sub-task Compatible):**
```typescript
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  
  // Don't close if clicking menu
  if (menuRef.current?.contains(target)) return;
  
  // Don't close if clicking button or its parents (sub-task wrappers)
  if (buttonRef.current) {
    if (buttonRef.current.contains(target)) return;
    
    // Walk up DOM tree to check for button
    let node: Node | null = target;
    while (node) {
      if (node === buttonRef.current) return;
      node = node.parentNode;
    }
  }
  
  setIsOpen(false);
};
```

## Testing

**8 new comprehensive tests:**
1. Menu does NOT close immediately after opening
2. Menu closes when clicking outside
3. Menu closes on Escape key
4. Menu closes when scrolling window
5. Menu closes when scrolling container
6. Menu has correct z-index (`z-[150]`)
7. Menu renders in `document.body` portal
8. Sub-task menus handle wrapper divs correctly

## SOLID Principles

- **Single Responsibility**: EntryActionsMenu handles menu display only, not entry rendering
- **Open/Closed**: Portal pattern allows extending menu behavior without modifying core logic
- **Dependency Inversion**: Component depends on React Portal abstraction (not DOM manipulation)

## Files Changed

**Modified:**
- `packages/client/src/components/EntryActionsMenu.tsx` (portal + positioning + listeners)
- `packages/client/src/components/EntryActionsMenu.test.tsx` (+8 tests)
- `packages/client/src/components/TaskEntryItem.tsx` (+pr-8 padding)
- `packages/client/src/components/NoteEntryItem.tsx` (+pr-8 padding)
- `packages/client/src/components/EventEntryItem.tsx` (+pr-8 padding)

**Test Results:**
- Before: 886 client tests passing
- After: 894 client tests passing (+8 new tests)
- No regressions

---

## Future Considerations

Potential future ADRs:
- Event schema versioning strategy
- Event compaction/snapshotting for performance
- Real-time collaboration conflict resolution
- Migration from Firebase to self-hosted backend
- Backend implementation with Node.js + Firebase Admin SDK
