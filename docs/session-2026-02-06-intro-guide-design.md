# Session 11: Intro Guide & Walkthrough - Design Specification

**Date:** February 6, 2026  
**Designer:** Alex (Architecture Agent)  
**Target Version:** v0.6.0 (minor release)  
**Estimated Time:** 8-12 hours  
**Status:** 📋 Design Complete - Awaiting Approval

---

## Executive Summary

Session 11 introduces a **First-Time User Experience (FTUX) Walkthrough** to help new users understand Squickr Life's purpose, bullet journal concepts, and key features. This addresses a critical gap: new users currently land on an empty collection list with no context or guidance.

### Key Features
- Multi-step interactive tutorial overlays
- Feature highlights with contextual explanations
- "Skip" and "Previous/Next" navigation
- Persistent completion tracking (don't show again)
- Help menu for re-accessing guide later
- Mobile and desktop optimized
- Minimal UI disruption (overlay-based, not full-page)

### User Problem Solved
- **Before:** New users see empty app, unclear what to do first
- **After:** Guided tour explains purpose, introduces collections, shows how to create entries, demonstrates migration
- **Value:** Faster onboarding, reduced confusion, increased feature discovery

---

## UX Design

### Trigger Points

**When to Show FTUX:**

1. **First Launch (Primary Trigger):**
   - User signs in for the first time
   - No collections exist yet (empty state)
   - `localStorage.getItem('squickr-ftux-completed')` is `null`
   - Auto-start walkthrough immediately

2. **Manual Access (Secondary Trigger):**
   - User can always restart guide from Help menu
   - Accessed via "?" button in top-right navigation
   - Useful for reviewing features or onboarding new devices

**When NOT to Show:**
- User has completed walkthrough before (`squickr-ftux-completed: 'true'`)
- User has clicked "Skip" (sets `squickr-ftux-skipped: 'true'`, can re-enable from Help)
- User has existing collections (implied prior usage)

### UI Approach: Interactive Spotlight Overlays

**Design Pattern:** Progressive disclosure with contextual tooltips (similar to product tours in Notion, Asana, Linear)

**Visual Structure:**
```
┌──────────────────────────────────────────────────┐
│ [App UI - dimmed backdrop]                       │
│                                                  │
│         ╔════════════════════════╗               │
│         ║ Highlighted Element    ║ ← Spotlight   │
│         ║ (e.g., FAB button)     ║    (z-index high)
│         ╚════════════════════════╝               │
│                  │                               │
│                  ▼                               │
│         ┌─────────────────────────┐              │
│         │ 💡 Tooltip Card         │              │
│         │                         │              │
│         │ "Tap here to create     │              │
│         │  your first collection" │              │
│         │                         │              │
│         │ [Prev] [Skip]  [Next 2/7]│              │
│         └─────────────────────────┘              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Key Components:**
- **Backdrop:** Semi-transparent dark overlay (z-index: 1000)
- **Spotlight:** Cut-out circle/rectangle around target element (no dim)
- **Tooltip Card:** White/dark card with arrow pointing to target
- **Navigation:** Progress indicator + Prev/Skip/Next buttons

---

## Walkthrough Steps

### Step 1: Welcome & Purpose
**Target:** Full-screen overlay (no specific element)  
**Title:** "Welcome to Squickr Life! 👋"  
**Content:**
> "Get shit done quicker with Squickr!  
> 
> Squickr Life is a digital **bullet journal** that helps you organize tasks, notes, and events with a simple, flexible system.
> 
> Unlike rigid to-do apps, you organize your life using **collections** — like pages in a physical journal."

**Actions:** [Skip] [Next 1/7]

**Mobile Note:** Full-screen modal (not spotlight)

---

### Step 2: Collections Concept
**Target:** Collection list area (center of screen)  
**Title:** "📚 Collections Organize Your Entries"  
**Content:**
> "Collections are containers for your tasks, notes, and events:
> - **Daily Logs** — Your day-to-day planning (like diary pages)
> - **Monthly Logs** — Month-level goals and events
> - **Custom Collections** — Projects, reading lists, habit trackers, etc.
> 
> You decide how to organize your life."

**Actions:** [Prev] [Skip] [Next 2/7]

**Visual:** Spotlight on empty collection list area

---

### Step 3: Create Your First Collection
**Target:** FAB (Floating Action Button) in bottom-right  
**Title:** "➕ Let's Create Your First Collection"  
**Content:**
> "Tap this button to create a collection.  
> 
> Try creating a **Daily Log** for today — it's the best way to start journaling."

**Actions:** [Prev] [Skip] [Next 3/7]

**Interaction:** User must tap FAB to proceed (blocks Next button)  
**Auto-advance:** When `CreateCollectionModal` opens, auto-advance to Step 4

**Mobile Note:** Spotlight on FAB with pulsing animation

---

### Step 4: Collection Types
**Target:** Collection type radio buttons in `CreateCollectionModal`  
**Title:** "🗂️ Choose a Collection Type"  
**Content:**
> "**Daily Log** — For today's tasks and notes (most common)  
> **Monthly Log** — Month-level planning  
> **Custom Collection** — For projects, topics, anything you want
> 
> Daily logs auto-generate names like 'Today, February 6' from the date."

**Actions:** [Prev] [Skip] [Next 4/7]

**Context:** Modal is already open from Step 3  
**Auto-advance:** When user clicks "Create" button, auto-advance to Step 5

---

### Step 5: Adding Entries
**Target:** Entry input field at top of collection detail view  
**Title:** "✍️ Add Tasks, Notes, and Events"  
**Content:**
> "Type here to add entries to your collection:
> - Start with **`•`** for tasks — `• Buy groceries`
> - Start with **`-`** for notes — `- Interesting idea`
> - Start with **`○`** for events — `○ Team meeting at 2pm`
> 
> Or just type normally — Squickr auto-detects based on content."

**Actions:** [Prev] [Skip] [Next 5/7]

**Interaction:** User should add 1-2 entries to proceed (optional, can skip)

**Visual:** Spotlight on input field + example entries below

---

### Step 6: Completing Tasks
**Target:** Checkbox on a task entry (if exists, otherwise skip this step)  
**Title:** "✅ Complete Tasks with One Tap"  
**Content:**
> "Tap the checkbox to mark tasks complete.  
> 
> By default, completed tasks stay visible (strikethrough). You can change this in collection settings (≡ menu)."

**Actions:** [Prev] [Skip] [Next 6/7]

**Conditional:** Only show if at least one task entry exists  
**Fallback:** If no tasks, skip to Step 7

---

### Step 7: Migration & Organization
**Target:** Entry actions menu (⋮ button on entry)  
**Title:** "🚀 Migrate Entries Between Collections"  
**Content:**
> "Bullet journaling is about **migration** — moving tasks forward.  
> 
> Tap the menu (⋮) on any entry to:
> - Migrate to another collection
> - Edit content
> - Delete
> 
> Pro tip: Use **Bulk Select** (from collection menu) to migrate many entries at once!"

**Actions:** [Prev] [Skip] [Done 7/7]

**Final Step:** "Done" button replaces "Next"

---

### Post-Completion Actions

**On "Done" Click:**
1. Set `localStorage.setItem('squickr-ftux-completed', 'true')`
2. Set `localStorage.setItem('squickr-ftux-timestamp', Date.now())`
3. Close walkthrough overlay
4. Show success toast: "🎉 You're all set! Happy journaling!"
5. User continues using app normally

**On "Skip" Click:**
1. Set `localStorage.setItem('squickr-ftux-skipped', 'true')`
2. Show confirmation: "Skip tutorial? You can restart it from Help menu."
3. If confirmed, close walkthrough

---

## Help Menu Design

**Location:** Top-right navigation bar (next to DarkModeToggle and UserProfileMenu)

**Icon:** `?` (question mark) in circle button

**Dropdown Menu:**
```
┌─────────────────────────────┐
│ 📖 Restart Tutorial         │
│ 📚 Bullet Journal Guide     │
│ 💡 Keyboard Shortcuts       │
│ 🐛 Report a Bug             │
│ ℹ️  About Squickr Life      │
└─────────────────────────────┘
```

**Actions:**

1. **Restart Tutorial:**
   - Reset `squickr-ftux-completed` and `squickr-ftux-skipped`
   - Restart walkthrough from Step 1
   - Works on any page (gracefully handles non-empty state)

2. **Bullet Journal Guide:**
   - Opens modal with BuJo methodology primer:
     - What is bullet journaling?
     - Daily/monthly/future logs explained
     - Migration concept
     - Symbols guide (•, -, ○, ×, >)
   - Static reference content (not interactive)

3. **Keyboard Shortcuts:**
   - Lists all keyboard shortcuts:
     - `n` — Create new collection
     - `e` — Add entry to current collection
     - `Left/Right Arrow` — Navigate between collections
     - `/` — Focus search (future)
     - `?` — Open help menu

4. **Report a Bug:**
   - Opens GitHub Issues page (external link)
   - Pre-fills issue template with version info

5. **About Squickr Life:**
   - Shows app version, credits, license
   - Links to documentation, GitHub repo

---

## Mobile vs Desktop Experience

### Desktop (≥768px)

**Spotlight Positioning:**
- Tooltips appear beside target (prefer right/bottom)
- Larger tooltip cards (400px width)
- Keyboard navigation: Arrow keys for Prev/Next, Esc for Skip

**Help Menu:**
- Always visible in top-right
- Dropdown menu on hover/click

### Mobile (<768px)

**Spotlight Positioning:**
- Tooltips appear below target (avoid covering)
- Narrower tooltip cards (90% screen width)
- Touch-optimized buttons (48x48px minimum)

**Help Menu:**
- Collapsed into hamburger menu (≡)
- Opens full-screen modal for options

**Special Considerations:**
- Step 3 (FAB): Spotlight with pulsing animation to draw attention
- Step 4 (Modal): Full-screen modal, tooltip becomes banner at top
- Virtual keyboard: Tooltips reposition when keyboard opens (iOS Safari)

---

## Technical Design

### State Management

**New Hook:** `useWalkthrough`

```typescript
interface WalkthroughState {
  isActive: boolean;
  currentStep: number; // 0-6 (7 steps total)
  isStepComplete: (step: number) => boolean;
  hasSeenFTUX: boolean;
  wasSkipped: boolean;
}

function useWalkthrough() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem('squickr-ftux-completed') === 'true';
    const skipped = localStorage.getItem('squickr-ftux-skipped') === 'true';
    
    if (!completed && !skipped) {
      // Auto-start for first-time users
      setIsActive(true);
    }
  }, []);
  
  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      completeFTUX();
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const skipFTUX = () => {
    localStorage.setItem('squickr-ftux-skipped', 'true');
    setIsActive(false);
  };
  
  const completeFTUX = () => {
    localStorage.setItem('squickr-ftux-completed', 'true');
    localStorage.setItem('squickr-ftux-timestamp', Date.now().toString());
    setIsActive(false);
    // Show success toast
  };
  
  const restartFTUX = () => {
    localStorage.removeItem('squickr-ftux-completed');
    localStorage.removeItem('squickr-ftux-skipped');
    setCurrentStep(0);
    setIsActive(true);
  };
  
  return {
    isActive,
    currentStep,
    nextStep,
    prevStep,
    skipFTUX,
    completeFTUX,
    restartFTUX,
  };
}
```

**Storage Schema:**
```typescript
// LocalStorage keys
'squickr-ftux-completed': 'true' | null
'squickr-ftux-skipped': 'true' | null
'squickr-ftux-timestamp': string (Date.now())
```

---

### Component Structure

#### New Components

**1. WalkthroughOverlay** (`components/WalkthroughOverlay.tsx`)
```typescript
interface WalkthroughOverlayProps {
  isActive: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}
```
- Renders backdrop + spotlight + tooltip
- Manages z-index layering
- Handles step-specific targeting
- Responsive positioning

**2. WalkthroughTooltip** (`components/WalkthroughTooltip.tsx`)
```typescript
interface WalkthroughTooltipProps {
  title: string;
  content: string;
  currentStep: number;
  totalSteps: number;
  target: HTMLElement | null; // Element to spotlight
  position: 'top' | 'bottom' | 'left' | 'right';
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}
```
- Renders tooltip card with arrow
- Positions relative to target element
- Handles viewport boundaries (repositions if overflow)
- Animates in/out (fade + slide)

**3. HelpMenu** (`components/HelpMenu.tsx`)
```typescript
interface HelpMenuProps {
  onRestartTutorial: () => void;
}
```
- Dropdown menu with help options
- Opens modals for guides
- Handles external links

**4. BulletJournalGuide** (`components/BulletJournalGuide.tsx`)
```typescript
interface BulletJournalGuideProps {
  isOpen: boolean;
  onClose: () => void;
}
```
- Modal with BuJo methodology primer
- Static content (no interactivity)
- Sections: What is BuJo?, Collections, Symbols, Migration

**5. KeyboardShortcutsModal** (`components/KeyboardShortcutsModal.tsx`)
```typescript
interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```
- Table of keyboard shortcuts
- Categorized: Navigation, Editing, Actions

#### Modified Components

**1. CollectionIndexView** (`views/CollectionIndexView.tsx`)
- Integrate `useWalkthrough` hook
- Pass `isActive` and `currentStep` to `WalkthroughOverlay`
- Add `HelpMenu` to top-right navigation

**2. App.tsx** (`App.tsx`)
- Render `WalkthroughOverlay` at root level (outside `BrowserRouter`)
- Provide walkthrough context to all routes

**3. CollectionDetailView** (`views/CollectionDetailView.tsx`)
- Support walkthrough step triggers (e.g., Step 5 targets input)

---

### Spotlight Implementation

**Technical Approach:** SVG mask over full-screen overlay

```typescript
function Spotlight({ target }: { target: HTMLElement | null }) {
  if (!target) return null;
  
  const rect = target.getBoundingClientRect();
  const radius = 8; // Border radius for spotlight
  
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      <defs>
        <mask id="spotlight-mask">
          {/* White = visible, Black = hidden */}
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx={radius}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.7)"
        mask="url(#spotlight-mask)"
      />
    </svg>
  );
}
```

**Accessibility:**
- Spotlight region marked with `aria-hidden="false"`
- Rest of page marked with `aria-hidden="true"` during walkthrough
- Tooltip has `role="dialog"` and `aria-live="polite"`
- Focus trapped within tooltip navigation buttons

---

## Implementation Plan

### Phase 1: Core Walkthrough Infrastructure (3-4 hours)

**Step 1.1: Create `useWalkthrough` hook (1 hour)**
- File: `packages/client/src/hooks/useWalkthrough.ts`
- Implement state management (active, currentStep, localStorage)
- Add tests: `useWalkthrough.test.ts`

**Step 1.2: Create `WalkthroughOverlay` component (1 hour)**
- File: `packages/client/src/components/WalkthroughOverlay.tsx`
- Render backdrop + spotlight SVG
- Handle z-index layering
- Add tests: `WalkthroughOverlay.test.tsx`

**Step 1.3: Create `WalkthroughTooltip` component (1.5 hours)**
- File: `packages/client/src/components/WalkthroughTooltip.tsx`
- Position tooltip relative to target
- Handle viewport boundaries
- Prev/Skip/Next navigation
- Add tests: `WalkthroughTooltip.test.tsx`

**Step 1.4: Integrate into `App.tsx` (0.5 hours)**
- Render `WalkthroughOverlay` at root
- Pass walkthrough context

**Expected Output:**
- Walkthrough infrastructure functional
- Steps 1-2 (full-screen overlays) working
- Navigation (Prev/Skip/Next) functional

---

### Phase 2: Step-Specific Targeting (2-3 hours)

**Step 2.1: Implement Step 3 (FAB spotlight) (1 hour)**
- Target FAB button with spotlight
- Disable Next until CreateCollectionModal opens
- Auto-advance logic

**Step 2.2: Implement Step 4 (Modal targeting) (1 hour)**
- Spotlight collection type radio buttons
- Auto-advance when collection created

**Step 2.3: Implement Steps 5-7 (Entry actions) (1 hour)**
- Target entry input field
- Target task checkbox (conditional)
- Target entry actions menu

**Expected Output:**
- All 7 steps functional
- Auto-advance logic working
- Conditional Step 6 logic implemented

---

### Phase 3: Help Menu & Reference Content (2-3 hours)

**Step 3.1: Create `HelpMenu` component (1 hour)**
- File: `packages/client/src/components/HelpMenu.tsx`
- Dropdown menu with 5 options
- Integrate into `CollectionIndexView`
- Add tests: `HelpMenu.test.tsx`

**Step 3.2: Create `BulletJournalGuide` modal (1 hour)**
- File: `packages/client/src/components/BulletJournalGuide.tsx`
- Static content with BuJo primer
- Add tests: `BulletJournalGuide.test.tsx`

**Step 3.3: Create `KeyboardShortcutsModal` (1 hour)**
- File: `packages/client/src/components/KeyboardShortcutsModal.tsx`
- Table of shortcuts
- Add tests: `KeyboardShortcutsModal.test.tsx`

**Expected Output:**
- Help menu accessible from all views
- User can restart tutorial
- Reference content available

---

### Phase 4: Mobile Optimization & Polish (2-3 hours)

**Step 4.1: Responsive tooltip positioning (1 hour)**
- Media queries for mobile (<768px)
- Touch-optimized button sizes (48x48px)
- Virtual keyboard handling (iOS Safari)

**Step 4.2: Animations & transitions (0.5 hours)**
- Fade in/out for backdrop
- Slide in for tooltips
- Pulsing animation for Step 3 FAB

**Step 4.3: Dark mode styling (0.5 hours)**
- Tooltip dark mode colors
- Spotlight visibility in dark mode
- Help menu dark mode

**Step 4.4: Accessibility (1 hour)**
- ARIA labels for all interactive elements
- Focus trapping in tooltip
- Screen reader testing
- Keyboard navigation (arrow keys, Esc)

**Expected Output:**
- Mobile UX feels natural
- Dark mode works correctly
- Accessible to screen readers
- Smooth animations (no jank)

---

## Files to Create/Modify

### New Files (12)
1. `packages/client/src/hooks/useWalkthrough.ts`
2. `packages/client/src/hooks/useWalkthrough.test.ts`
3. `packages/client/src/components/WalkthroughOverlay.tsx`
4. `packages/client/src/components/WalkthroughOverlay.test.tsx`
5. `packages/client/src/components/WalkthroughTooltip.tsx`
6. `packages/client/src/components/WalkthroughTooltip.test.tsx`
7. `packages/client/src/components/HelpMenu.tsx`
8. `packages/client/src/components/HelpMenu.test.tsx`
9. `packages/client/src/components/BulletJournalGuide.tsx`
10. `packages/client/src/components/BulletJournalGuide.test.tsx`
11. `packages/client/src/components/KeyboardShortcutsModal.tsx`
12. `packages/client/src/components/KeyboardShortcutsModal.test.tsx`

### Modified Files (3)
1. `packages/client/src/App.tsx` (render WalkthroughOverlay)
2. `packages/client/src/views/CollectionIndexView.tsx` (add HelpMenu)
3. `packages/client/src/views/CollectionDetailView.tsx` (support step targeting)

**Total:** 12 new files, 3 modified files

---

## Bullet Journal Guide Content

**Modal Title:** "What is Bullet Journaling?"

**Section 1: The BuJo Philosophy**
> Bullet journaling (BuJo) is a flexible organizational system created by Ryder Carroll. Instead of rigid categories, you organize your life using three core tools:
> - **Collections** — Containers for related entries (daily logs, project trackers, etc.)
> - **Rapid Logging** — Quick capture using symbols (•, -, ○)
> - **Migration** — Moving incomplete tasks forward (yesterday → today)

**Section 2: Collection Types**
> - **Daily Logs** — Your day-to-day planning (most common)
> - **Monthly Logs** — Month-level goals, events, tasks
> - **Custom Collections** — Project trackers, reading lists, habit logs, anything!

**Section 3: Entry Symbols**
> Squickr uses traditional BuJo symbols:
> - **• (bullet)** — Incomplete task
> - **× (cross)** — Completed task
> - **> (arrow)** — Migrated task
> - **– (dash)** — Note
> - **○ (circle)** — Event

**Section 4: Migration Workflow**
> At the end of each day (or week), review incomplete tasks:
> 1. Still relevant? **Migrate** to today/tomorrow
> 2. No longer relevant? **Mark complete** or delete
> 3. This keeps your journal clutter-free and intentional

**Learn More:** [External link to bulletjournal.com]

---

## Success Criteria

### Functional Requirements
- [ ] First-time users see walkthrough on empty app launch
- [ ] Walkthrough has 7 steps with clear progression
- [ ] User can navigate Prev/Skip/Next through steps
- [ ] Step 3 requires FAB tap (blocks Next)
- [ ] Step 4 auto-advances when collection created
- [ ] Step 6 is conditional (skips if no tasks)
- [ ] "Done" button completes FTUX (sets localStorage)
- [ ] "Skip" button exits walkthrough (sets skipped flag)
- [ ] Help menu accessible from top-right (? button)
- [ ] "Restart Tutorial" clears localStorage and restarts
- [ ] Bullet Journal Guide shows primer content
- [ ] Keyboard Shortcuts modal lists all shortcuts
- [ ] Completed users never see walkthrough again (unless restarted)

### UX Requirements
- [ ] Mobile touch targets ≥48x48px
- [ ] Tooltips don't cover target elements
- [ ] Spotlight clearly highlights target (cut-out)
- [ ] Backdrop dims rest of UI (0.7 opacity)
- [ ] Animations smooth (fade/slide transitions)
- [ ] Virtual keyboard doesn't cover tooltip (iOS)
- [ ] Dark mode styling correct
- [ ] Works on mobile (320px width) and desktop (1920px width)

### Performance Requirements
- [ ] Lazy loaded (doesn't slow app startup)
- [ ] Step transitions <200ms
- [ ] No layout shift when walkthrough activates
- [ ] No jank during animations (60fps)

### Accessibility Requirements
- [ ] Keyboard navigation works (Arrow keys, Esc)
- [ ] Focus trapped in tooltip during walkthrough
- [ ] ARIA labels on all interactive elements
- [ ] Screen reader announces step changes
- [ ] `aria-hidden` applied to dimmed content
- [ ] Tooltip has `role="dialog"`

---

## Architecture Decision Records

### ADR: Overlay Tooltips vs Full-Page Walkthrough

**Context:** Need to show first-time user experience without disrupting existing UI.

**Decision:** Use spotlight overlay tooltips (progressive disclosure) rather than full-page slides.

**Rationale:**
1. **Contextual Learning:** Users see features in context, not abstract screenshots
2. **Lower Disruption:** Can skip anytime, doesn't block entire app
3. **Industry Standard:** Notion, Asana, Linear use this pattern successfully
4. **Reusable:** Can highlight features in future updates (e.g., "New Feature!" tooltips)

**Alternatives Considered:**
- Full-page slides: Abstract, disconnected from actual UI
- Video tutorial: Passive, hard to update, large file size
- Text-only guide: Boring, low engagement

**Consequences:**
- **Positive:** Interactive, contextual, engaging, reusable
- **Positive:** Follows established UX patterns (familiar to users)
- **Neutral:** More complex than full-page (acceptable tradeoff)
- **Negative:** Positioning logic needed (mitigated with boundary detection)

---

### ADR: LocalStorage for FTUX Tracking

**Context:** Need to persist whether user has seen walkthrough.

**Decision:** Use `localStorage` to track FTUX completion status.

**Rationale:**
1. **Client-Side Only:** FTUX is UI preference, not user data (no backend needed)
2. **Instant Access:** No network latency
3. **Privacy-Friendly:** No server tracking
4. **Simple:** Single key-value pair

**Alternatives Considered:**
- Firebase Firestore: Overkill, adds network latency, privacy concerns
- IndexedDB: Overkill for single boolean
- Cookies: More complex, HTTP overhead

**Consequences:**
- **Positive:** Fast, simple, privacy-friendly
- **Positive:** Works offline
- **Negative:** Doesn't sync across devices (acceptable — tutorial is per-device)
- **Negative:** Private browsing blocks it (mitigated with graceful fallback)

---

### ADR: No Event Sourcing for FTUX State

**Context:** Should walkthrough completion be an event in the event store?

**Decision:** Do NOT store FTUX state in event store. Use `localStorage` only.

**Rationale:**
1. **UI Preference, Not Domain Event:** FTUX is ephemeral UI state, not business logic
2. **No Audit Trail Needed:** Don't need history of "user saw tutorial 3 times"
3. **Performance:** Avoid event store operations for non-domain concerns
4. **Separation of Concerns:** UI state ≠ domain state

**Event Sourcing Principle:**
> "Events are facts about the domain, not facts about the UI."  
> — Greg Young

**Consequences:**
- **Positive:** Clean separation, no event store pollution
- **Positive:** Faster (no event append/read)
- **Negative:** FTUX state doesn't sync to cloud (acceptable — tutorial is device-specific UX)

---

## Risk Assessment

**Risk Level:** LOW-MEDIUM

### Identified Risks

1. **Tooltip positioning edge cases**
   - **Risk:** Tooltip overflows viewport on small screens
   - **Mitigation:** Boundary detection logic, repositioning
   - **Likelihood:** Medium

2. **Auto-advance race conditions**
   - **Risk:** Step advances before user sees content
   - **Mitigation:** Minimum display time (500ms), explicit user action required
   - **Likelihood:** Low

3. **LocalStorage quota**
   - **Risk:** Private browsing blocks localStorage
   - **Mitigation:** Graceful fallback, in-memory state
   - **Likelihood:** Low

4. **Walkthrough conflicts with existing UI**
   - **Risk:** Z-index conflicts, click-through issues
   - **Mitigation:** High z-index (1000+), pointer-events control
   - **Likelihood:** Low

5. **Mobile virtual keyboard issues**
   - **Risk:** Keyboard covers tooltip on iOS
   - **Mitigation:** `window.visualViewport` API, repositioning
   - **Likelihood:** Medium (iOS Safari known issue)

---

## Next Steps

1. ✅ **Design Complete** - This document
2. ⏳ **User Approval** - User reviews and approves design
3. ⏳ **Sam Implementation** - 8-12 hours over 1-2 sessions
4. ⏳ **Casey Review** - Code quality and test coverage check
5. ⏳ **User Testing** - Manual verification on mobile and desktop
6. ⏳ **Deploy v0.6.0** - Production release

---

**Document Status:** ✅ Ready for Implementation  
**Estimated Timeline:** 8-12 hours (4 phases)  
**Target Version:** v0.6.0  
**Date:** February 6, 2026
