# Intro Guide / Walkthrough — Design Specification

**Status:** Shipped ✅  
**Version:** v1.0.0  
**Date:** February 17, 2026 (shipped February 19, 2026)  
**Architect:** Architecture Alex

---

## Overview

This document specifies the complete design for the v1.0.0 Intro Guide and Help Menu.
The feature introduces new users to Squickr Life's core workflow through a 7-step
interactive tutorial and extends the existing `UserProfileMenu` with self-service
help options.

---

## Part 1: Tutorial — 7 Steps

### Library: `react-joyride`

**Why react-joyride:**
- Battle-tested spotlight overlay library (3M+ weekly downloads)
- Built-in mobile support and scroll-into-view
- Dark mode via `styles` prop
- Controlled mode (step management in our own state)
- Full accessibility (ARIA, keyboard nav)
- No CSS bundle conflicts (styles injected inline)

**Alternative:** `driver.js` (simpler API, slightly less accessible).
Reject `intro.js` (license restrictions).

**Install:**
```bash
pnpm add react-joyride --filter @squickr/client
```

---

### State Management: `TutorialContext`

```typescript
// packages/client/src/context/TutorialContext.tsx

interface TutorialState {
  isRunning: boolean;
  stepIndex: number;
  isPaused: boolean;           // true while waiting for user to create a collection
  hasCompletedTutorial: boolean; // persisted in localStorage
}

interface TutorialContextValue extends TutorialState {
  startTutorial: () => void;
  stopTutorial: () => void;
  nextStep: () => void;
  pauseTutorial: () => void;   // pauses at current step, sets isPaused = true
  resumeTutorial: () => void;  // advances past pause point, sets isPaused = false
  resetTutorial: () => void;   // for "Restart Tutorial" in Help menu
}
```

**Persistence:**
- `localStorage.getItem('squickr_tutorial_completed')` — `'true'` if user finished or skipped
- `sessionStorage.getItem('squickr_tutorial_seen')` — `'true'` if already shown this session
- Auto-trigger fires only when: authenticated + zero real collections + not yet seen this session

---

### Auto-Trigger Logic

```typescript
// In CollectionIndexView.tsx, after loadData() resolves:

useEffect(() => {
  const realCollections = collections.filter(c => c.id !== UNCATEGORIZED_COLLECTION_ID);
  const hasSeenThisSession = sessionStorage.getItem('squickr_tutorial_seen') === 'true';
  const hasCompletedTutorial = localStorage.getItem('squickr_tutorial_completed') === 'true';

  if (realCollections.length === 0 && !hasSeenThisSession && !hasCompletedTutorial) {
    sessionStorage.setItem('squickr_tutorial_seen', 'true');
    tutorial.startTutorial();
  }
}, [collections]);
```

---

### DOM Anchor Attributes

Add `data-tutorial-id` attributes to the following existing components
(minimal markup change, no functional impact):

| Component | Element | `data-tutorial-id` |
|---|---|---|
| `CollectionIndexView` | The "Squickr Life" `<h1>` title | `tutorial-welcome` |
| `HierarchicalCollectionList` | The outermost list `<div>` | `tutorial-collection-list` |
| `FAB` | The `<button>` | `tutorial-fab` |
| `CollectionHeader` | The three-dot `⋮` menu `<button>` | `tutorial-collection-menu` |
| `CollectionNavigationControls` | The Prev/Next button group | `tutorial-navigation` |

> **Note:** `tutorial-entry-type` on `EntryInput` was removed. `EntryInputModal` returns `null`
> when closed so the element is never in the DOM during the tutorial. Step 4 was retargeted to
> `tutorial-fab` instead (see Step 4 below).

---

### The 7 Tutorial Steps

#### Step 1 — Welcome
**Target:** `[data-tutorial-id="tutorial-welcome"]` (the "Squickr Life" title)
**Placement:** `bottom` (center)
**Title:** "Welcome to Squickr Life"
**Content:**
> Squickr Life is a bullet journal app built for getting things done —
> faster. This quick tour shows you the essentials. Takes about 60 seconds.

**Buttons:** Skip Tour / Next

---

#### Step 2 — Collections Are Your Journal Pages
**Target:** `[data-tutorial-id="tutorial-collection-list"]` (HierarchicalCollectionList)
**Placement:** `bottom`
**Title:** "Collections are your journal pages"
**Content:**
> Each collection is a page in your journal. You might have a page for
> **Today**, one for **Work Projects**, one for **Home**.
> Pinned (★) collections stay at the top. Daily logs are grouped by year and month.

**Buttons:** Back / Next

---

#### Step 3 — Create Your First Collection
**Target:** `[data-tutorial-id="tutorial-fab"]` (the FAB `+` button)
**Placement:** `top` (center on mobile, top-left on desktop)
**Title:** "Create your first collection"
**Content:**
> Tap this button to create a collection. You can make a **Daily Log**
> (linked to a date), or a **Custom** collection for any topic — projects,
> habits, reading lists, whatever you need.

**Buttons:** Back / Next

> **Implementation note for Steps 4–6:** These steps target elements that only exist
> when a collection is open (`EntryInput`, entry three-dot menu). Since this is the
> first-run tutorial with zero collections, two approaches are possible:
>
> **Option A (Recommended) ✅ Implemented:** Pause the tutorial after Step 3. Display a prompt:
> "Create a collection to continue the tour." Resume automatically when the user
> navigates into a collection for the first time.
>
> **Option B:** Use screen-centered floating tooltips (no spotlight anchor) for Steps 4–6.

---

#### Step 4 — Adding Entries (Tasks, Notes, Events)
**Target:** `[data-tutorial-id="tutorial-fab"]` (the FAB `+` button — always visible)
**Placement:** `top`
**Title:** "Three entry types: tasks, notes, events"
**Content:** (rendered as JSX with left-aligned list)
> - ☐ **Task** — something to do (tap the bullet to complete it)
> - 📝 **Note** — a thought, reference, or observation
> - 📅 **Event** — something happening on a date
>
> Tap the `+` button to open the entry input, choose a type, and press Enter or tap Save.

**Buttons:** Back / Next

> **Note:** Originally targeted `tutorial-entry-type` on `EntryInput`, but that element is
> never in the DOM when the modal is closed. Retargeted to `tutorial-fab` with content
> rewritten to explain the three entry types via the FAB context.

---

#### Step 5 — Manage Your Collection
**Target:** `[data-tutorial-id="tutorial-collection-menu"]` (the ⋮ three-dot menu button on the **collection header**)
**Placement:** `left` (or `bottom` on mobile)
**Title:** "Manage your collection"
**Content:**
> Tap **⋮** on a collection header to manage it:
> **Rename**, **Delete**, **Settings**, and **Add to Favorites** (★) to pin it at the top.
> Use **Select Entries** to bulk-select and migrate multiple entries at once.

**Buttons:** Back / Next

---

#### Step 6 — Migration: Moving Entries Between Pages
**Target:** `[data-tutorial-id="tutorial-collection-menu"]` (same collection header ⋮ menu button)
**Placement:** `left` (or `bottom` on mobile)
**Title:** "Migrate entries between collections"
**Content:**
> Bullet journaling is about **migration** — moving unfinished work forward.
> Tap **⋮** on any entry to **Migrate** it to another collection.
> Ghost entries (→) show where a task came from.
> Use **Select Entries** from the collection header menu to migrate multiple entries at once.

**Buttons:** Back / Next

---

#### Step 7 — Navigation and What's Next
**Target:** `[data-tutorial-id="tutorial-navigation"]` (CollectionNavigationControls)
**Placement:** `bottom`
**Title:** "Flip between pages like a real journal"
**Content:**
> Use the **‹ ›** arrows to flip between collections — or swipe left/right on mobile.
> You're all set! Tap your profile picture any time to access Help, Settings,
> and to restart this tour.

**Buttons:** Back / Finish

**On Finish:** `localStorage.setItem('squickr_tutorial_completed', 'true')`

---

## Part 2: Help Menu (Extended UserProfileMenu)

### Current UserProfileMenu Structure
```
[Avatar]
  ├── User Name
  ├── user@email.com
  ├── ─────────────── (separator)
  ├── Settings
  ├── ─────────────── (separator)
  └── Sign out
```

### Updated UserProfileMenu Structure
```
[Avatar]
  ├── User Name
  ├── user@email.com
  ├── ─────────────── (separator)
  ├── Settings
  ├── ─────────────── (separator)      NEW
  ├── Restart Tutorial                 NEW
  ├── Bullet Journal Guide             NEW (opens modal)
  ├── Keyboard Shortcuts               NEW (opens modal)
  ├── Report a Bug                     NEW (opens GitHub in new tab)
  ├── Request a Feature                NEW (opens GitHub in new tab)
  ├── GitHub Discussions               NEW (opens GitHub in new tab)
  ├── About Squickr Life               NEW (opens modal)
  ├── ─────────────── (separator)
  └── Sign out
```

**Design rationale:**
No new `?` button. Avoids header clutter in an already-crowded top bar.
`UserProfileMenu` is the natural home for app-level settings and help.
"Restart Tutorial" re-triggers `tutorial.startTutorial()` from Step 1.

---

### Help Menu Items: Detailed Specs

#### Restart Tutorial
- Calls `tutorial.startTutorial()` (resets `stepIndex` to 0, sets `isRunning = true`)
- Clears `localStorage.squickr_tutorial_completed` so it will re-trigger on next zero-collections session
- Closes the profile dropdown before starting

#### Bullet Journal Guide
Opens a **modal** with static content. No navigation away from app.

**Modal content outline:**
```
Bullet Journal Guide
─────────────────────
What is Bullet Journaling?
  A system invented by Ryder Carroll for capturing and organizing thoughts.

The Three Entry Types
  •  Task      Something to do
  –  Note      Something to record
  ○  Event     Something happening

The Bullet States
  •  Open task
  ×  Completed task
  >  Migrated task (moved to another page)
  –  Cancelled/irrelevant task

Collections (Pages)
  Daily Logs    Day-by-day entries
  Monthly Logs  Month-level planning
  Custom        Projects, habits, anything

The Migration Practice
  At the end of each day/week, review unfinished tasks.
  Migrate them forward to keep your journal active.

Learn More: bulletjournal.com (external link)
```

#### Keyboard Shortcuts
Opens a **modal** with a table of shortcuts.

| Action | Shortcut |
|---|---|
| Navigate to next collection | Arrow Right |
| Navigate to previous collection | Arrow Left |
| Close modal / Go back | Escape |
| Submit entry | Enter |

> This list should be maintained alongside any new shortcuts added to the app.

#### Report a Bug
Opens external link (new tab):
```
https://github.com/[owner]/[repo]/issues/new?template=bug_report.md&labels=bug&title=[Bug]+&body=**Version**:+v{__APP_VERSION__}
```
The `__APP_VERSION__` Vite constant is already available in the codebase.

**Note:** The GitHub owner/repo constants should be extracted to a `src/constants/github.ts`
file rather than hardcoded inline in `UserProfileMenu`.

#### Request a Feature
Opens external link (new tab):
```
https://github.com/[owner]/[repo]/issues/new?template=feature_request.md&labels=enhancement&title=[Feature]+
```

#### GitHub Discussions
Opens external link (new tab):
```
https://github.com/[owner]/[repo]/discussions
```

#### About Squickr Life
Opens a **modal** with:
```
Squickr Life
Version: v{__APP_VERSION__}
─────────────────────
A bullet journal app for getting things done.
Built with React, TypeScript, and Event Sourcing.

Data is stored locally in your browser (IndexedDB)
and synced to the cloud when you're signed in.

[GitHub Repository]   [Report an Issue]
```

---

## Part 3: Technical Architecture

### New Files
```
packages/client/src/
├── context/
│   └── TutorialContext.tsx             new
├── hooks/
│   └── useTutorial.ts                  new (convenience wrapper for TutorialContext)
├── constants/
│   └── github.ts                       new (repo owner, repo name, URL builders)
└── components/
    ├── BulletJournalGuideModal.tsx      new
    ├── KeyboardShortcutsModal.tsx       new
    └── AboutModal.tsx                  new
```

### Modified Files
```
packages/client/src/
├── App.tsx                             wrap AppContent with TutorialProvider + TutorialJoyride + TUTORIAL_STEPS
├── components/
│   └── UserProfileMenu.tsx             add Help section items + 3 modal states
├── views/
│   ├── CollectionIndexView.tsx         add auto-trigger logic + data-tutorial-id on title
│   └── CollectionDetailView.tsx        add resume effect with hasResumedRef guard
├── components/
│   ├── FAB.tsx                         add data-tutorial-id="tutorial-fab"
│   ├── HierarchicalCollectionList.tsx  add data-tutorial-id="tutorial-collection-list"
│   ├── CollectionNavigationControls.tsx add data-tutorial-id="tutorial-navigation"
│   └── CollectionHeader.tsx            add data-tutorial-id to three-dot menu button
```

> **Note:** `EntryInput.tsx` was NOT modified with a tutorial anchor. The `tutorial-entry-type`
> attribute was briefly added then removed — the element is never in the DOM when the modal is closed.

### SOLID Principles Applied

- **Single Responsibility:** `TutorialContext` manages only tutorial state. Help modals are separate components. `UserProfileMenu` is extended, not replaced.
- **Open/Closed:** Help menu items are a new section appended to `UserProfileMenu` without modifying existing Settings/Sign Out items.
- **Dependency Inversion:** Tutorial trigger logic depends on `TutorialContext` abstraction, not directly on `localStorage`.

---

## Part 4: Acceptance Criteria

### Tutorial
- [x] Auto-triggers on first sign-in with zero real collections (not virtual Uncategorized)
- [x] Does NOT re-trigger on the same session if dismissed
- [x] Does NOT re-trigger after user completes it
- [x] "Restart Tutorial" from Help menu resets and replays from Step 1
- [x] All 7 steps render with correct spotlight targets
- [x] Each step has correct title, body text, and navigation buttons
- [x] Skip button on every step works
- [ ] Tutorial works on mobile (correct placement, scroll-into-view)
- [x] Tutorial works in dark mode
- [x] Tutorial is keyboard navigable (Tab, Enter, Escape)
- [x] Steps 4–6 pause/resume correctly when zero collections at trigger time

### Help Menu
- [x] Help section visible in UserProfileMenu dropdown (below Settings separator)
- [x] Bullet Journal Guide modal opens and renders correct content
- [x] Keyboard Shortcuts modal opens with complete shortcuts table
- [x] Report a Bug opens correct GitHub URL in new tab with version pre-filled
- [x] Request a Feature opens correct GitHub URL in new tab
- [x] GitHub Discussions opens correct GitHub URL in new tab
- [x] About modal shows correct version number (`__APP_VERSION__`)
- [x] All modals close on Escape key and click-outside

### General
- [x] All existing tests still pass (no regressions)
- [x] New tests for: auto-trigger logic, step progression, localStorage persistence
- [ ] Manual walkthrough tested on mobile and desktop

---

## Part 5: Time Estimate Breakdown

| Phase | Description | Estimate |
|---|---|---|
| 1 | Infrastructure (react-joyride, TutorialContext, useTutorial, github constants) | 2-3 hours |
| 2 | 7-step tutorial (DOM anchors, step config, Joyride wiring, pause/resume logic) | 2-3 hours |
| 3 | Help menu (extend UserProfileMenu + 3 modals + 4 external links) | 2.5-3 hours |
| 4 | Auto-trigger + polish (dark mode, mobile, a11y, tests) | 1.5-2 hours |
| **Total** | | **8-11 hours** |

Buffer for unknowns (Step 4/5 anchor complexity, react-joyride quirks): +2 hours
**Realistic range: 8–13 hours**
