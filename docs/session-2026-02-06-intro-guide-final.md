# Intro Guide Design - Final Specification

**Date:** February 6, 2026  
**Designer:** Alex (Architecture Agent)  
**Target Version:** v0.6.0 (minor release)  
**Estimated Time:** 7-11 hours (revised from 8-12 hours)  
**Status:** ✅ Approved - Ready for Implementation

---

## User Decisions (Finalized)

### Decision #1: Simplified Trigger Logic
✅ **APPROVED:** Use zero collections check instead of localStorage

**Auto-start behavior:**
- **Option A selected:** Auto-start once per browser session IF user has zero collections
- Implementation: Use `sessionStorage` to track auto-start per session
- Walkthrough reappears if user deletes all collections (self-healing)

### Decision #2: GitHub Issue Flow
✅ **APPROVED:** Enhanced Help menu with bug/feature templates

**GitHub templates:**
- User does NOT have existing templates
- **Action:** Create `.github/ISSUE_TEMPLATE/` directory with:
  - `bug_report.md`
  - `feature_request.md`
  - `config.yml` (optional - for template selection UI)

**Debug info approach:**
- Pre-fill GitHub URLs with environment info (version, browser, screen size)
- No "Copy Debug Info" button needed

**Error tracking:**
- **SKIP** auto-capture of JavaScript errors (privacy concerns)
- Can revisit later if bug reports lack critical info

---

## Revised Trigger Logic (Final)

### `useWalkthrough` Hook

```typescript
interface WalkthroughState {
  isActive: boolean;           // Is walkthrough currently showing?
  currentStep: number;         // Current step (0-6)
  shouldSuggest: boolean;      // Should we suggest walkthrough? (zero collections)
}

function useWalkthrough(collections: Collection[]) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Calculate if we should suggest walkthrough (zero collections)
  const shouldSuggest = useMemo(() => {
    // Don't dismiss walkthrough mid-flow
    if (isActive) return true;
    
    const realCollections = collections.filter(
      c => c.id !== UNCATEGORIZED_COLLECTION_ID
    );
    return realCollections.length === 0;
  }, [collections, isActive]);
  
  // Auto-start walkthrough ONCE per session if zero collections
  useEffect(() => {
    const hasAutoStarted = sessionStorage.getItem('squickr-ftux-auto-started');
    
    if (shouldSuggest && !hasAutoStarted && !isActive) {
      setIsActive(true);
      sessionStorage.setItem('squickr-ftux-auto-started', 'true');
    }
  }, [shouldSuggest, isActive]);
  
  const startWalkthrough = () => {
    setCurrentStep(0);
    setIsActive(true);
  };
  
  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsActive(false);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const closeWalkthrough = () => {
    setIsActive(false);
  };
  
  return {
    isActive,
    currentStep,
    shouldSuggest,
    startWalkthrough,
    nextStep,
    prevStep,
    closeWalkthrough,
  };
}
```

### Empty State UI (When Zero Collections)

```tsx
{shouldSuggest && !isActive && (
  <div className="text-center py-12 px-4">
    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
      Welcome to Squickr Life!
    </h2>
    <p className="text-gray-600 dark:text-gray-400 mb-6">
      Get shit done quicker with Squickr! Start by creating your first collection.
    </p>
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Create Collection
      </button>
      <button
        onClick={startWalkthrough}
        className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        Show Tutorial
      </button>
    </div>
  </div>
)}
```

---

## GitHub Integration (Final)

### Help Menu Structure

```
┌──────────────────────────────────┐
│ 📖 Restart Tutorial              │
│ 📚 Bullet Journal Guide          │
│ 💡 Keyboard Shortcuts            │
│ ──────────────────────────────   │
│ 🐛 Report a Bug                  │
│ ✨ Request a Feature             │
│ 💬 GitHub Discussions            │
│ ──────────────────────────────   │
│ ℹ️  About Squickr Life           │
└──────────────────────────────────┘
```

### Bug Report URL Generator

```typescript
// packages/client/src/utils/github.ts

const GITHUB_REPO = 'psychosledge/squickr-life';  // Update with actual repo

export function getBugReportUrl(): string {
  const baseUrl = `https://github.com/${GITHUB_REPO}/issues/new`;
  
  // Gather environment info
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.6.0';
  const userAgent = navigator.userAgent;
  const screenSize = `${window.innerWidth}x${window.innerHeight}`;
  const browserLang = navigator.language;
  const isOnline = navigator.onLine;
  const timestamp = new Date().toISOString();
  
  // Pre-fill bug report template
  const title = '';  // Let user fill title
  const labels = 'bug';
  const body = `
## Bug Description
<!-- Describe what went wrong -->


## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
<!-- What should have happened? -->


## Actual Behavior
<!-- What actually happened? -->


## Environment
- **Squickr Version:** ${appVersion}
- **Browser:** ${userAgent}
- **Screen Size:** ${screenSize}
- **Language:** ${browserLang}
- **Online Status:** ${isOnline ? 'Online' : 'Offline'}
- **Timestamp:** ${timestamp}

## Screenshots
<!-- If applicable, add screenshots to help explain the problem -->
  `.trim();
  
  return `${baseUrl}?labels=${encodeURIComponent(labels)}&body=${encodeURIComponent(body)}`;
}

export function getFeatureRequestUrl(): string {
  const baseUrl = `https://github.com/${GITHUB_REPO}/issues/new`;
  
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.6.0';
  const timestamp = new Date().toISOString();
  
  const labels = 'enhancement';
  const body = `
## Feature Description
<!-- What feature would you like to see? -->


## Use Case
<!-- Why do you need this feature? What problem does it solve? -->


## Proposed Solution
<!-- How do you envision this feature working? -->


## Alternatives Considered
<!-- Have you thought of other ways to solve this problem? -->


## Additional Context
- **Squickr Version:** ${appVersion}
- **Timestamp:** ${timestamp}
  `.trim();
  
  return `${baseUrl}?labels=${encodeURIComponent(labels)}&body=${encodeURIComponent(body)}`;
}

export function getDiscussionsUrl(): string {
  return `https://github.com/${GITHUB_REPO}/discussions`;
}
```

### GitHub Issue Templates (To Create)

**File: `.github/ISSUE_TEMPLATE/bug_report.md`**

```markdown
---
name: Bug Report
about: Report a bug or issue with Squickr Life
title: ''
labels: bug
assignees: ''
---

## Bug Description
<!-- Describe what went wrong -->


## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
<!-- What should have happened? -->


## Actual Behavior
<!-- What actually happened? -->


## Environment
<!-- This will be auto-filled if you use the in-app "Report a Bug" button -->
- **Squickr Version:** 
- **Browser:** 
- **Screen Size:** 
- **Language:** 
- **Online Status:** 
- **Timestamp:** 

## Screenshots
<!-- If applicable, add screenshots to help explain the problem -->
```

**File: `.github/ISSUE_TEMPLATE/feature_request.md`**

```markdown
---
name: Feature Request
about: Suggest a new feature for Squickr Life
title: ''
labels: enhancement
assignees: ''
---

## Feature Description
<!-- What feature would you like to see? -->


## Use Case
<!-- Why do you need this feature? What problem does it solve? -->


## Proposed Solution
<!-- How do you envision this feature working? -->


## Alternatives Considered
<!-- Have you thought of other ways to solve this problem? -->


## Additional Context
<!-- Any other context, screenshots, or mockups -->
```

**File: `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
contact_links:
  - name: GitHub Discussions
    url: https://github.com/psychosledge/squickr-life/discussions
    about: Ask questions, share ideas, or discuss features
```

---

## Implementation Plan (Revised)

### Phase 1: Core Walkthrough Infrastructure (2.5-3 hours)
**Reduced from 3-4 hours due to simplified hook**

**Step 1.1: Create `useWalkthrough` hook (0.5 hours)**
- File: `packages/client/src/hooks/useWalkthrough.ts`
- Simplified state management (no localStorage)
- SessionStorage for auto-start tracking
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

**Step 1.4: Integrate into `App.tsx` and empty state (0.5 hours)**
- Render `WalkthroughOverlay` at root
- Add empty state UI with "Show Tutorial" button
- Pass walkthrough context

---

### Phase 2: Step-Specific Targeting (2-3 hours)
**Unchanged**

**Step 2.1: Implement Step 3 (FAB spotlight) (1 hour)**
- Target FAB button with spotlight
- Auto-advance when CreateCollectionModal opens

**Step 2.2: Implement Step 4 (Modal targeting) (1 hour)**
- Spotlight collection type radio buttons
- Auto-advance when collection created

**Step 2.3: Implement Steps 5-7 (Entry actions) (1 hour)**
- Target entry input field
- Target task checkbox (conditional)
- Target entry actions menu

---

### Phase 3: Help Menu & GitHub Integration (2.5-3 hours)
**Increased from 2-3 hours for GitHub templates**

**Step 3.1: Create GitHub utilities (0.5 hours)**
- File: `packages/client/src/utils/github.ts`
- URL generators for bug/feature/discussions
- Add tests: `github.test.ts`

**Step 3.2: Create `HelpMenu` component (1 hour)**
- File: `packages/client/src/components/HelpMenu.tsx`
- Dropdown menu with 7 options
- Integrate GitHub URL generators
- Add tests: `HelpMenu.test.tsx`

**Step 3.3: Create GitHub Issue Templates (0.5 hours)**
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/config.yml`

**Step 3.4: Create `BulletJournalGuide` modal (1 hour)**
- File: `packages/client/src/components/BulletJournalGuide.tsx`
- Static content with BuJo primer
- Add tests: `BulletJournalGuide.test.tsx`

**Step 3.5: Create `KeyboardShortcutsModal` (0.5 hours)**
- File: `packages/client/src/components/KeyboardShortcutsModal.tsx`
- Table of shortcuts
- Add tests: `KeyboardShortcutsModal.test.tsx`

---

### Phase 4: Mobile Optimization & Polish (2-3 hours)
**Unchanged**

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

---

## Files to Create/Modify (Updated)

### New Files (15)
**Hooks:**
1. `packages/client/src/hooks/useWalkthrough.ts`
2. `packages/client/src/hooks/useWalkthrough.test.ts`

**Components:**
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

**Utilities:**
13. `packages/client/src/utils/github.ts`
14. `packages/client/src/utils/github.test.ts`

**GitHub Templates:**
15. `.github/ISSUE_TEMPLATE/bug_report.md`
16. `.github/ISSUE_TEMPLATE/feature_request.md`
17. `.github/ISSUE_TEMPLATE/config.yml`

### Modified Files (3)
1. `packages/client/src/App.tsx` (render WalkthroughOverlay)
2. `packages/client/src/views/CollectionIndexView.tsx` (add HelpMenu + empty state)
3. `packages/client/src/views/CollectionDetailView.tsx` (support step targeting)

**Total:** 17 new files, 3 modified files

---

## Success Criteria (Updated)

### Functional Requirements
- [ ] First-time users with zero collections see walkthrough on launch (once per session)
- [ ] Walkthrough auto-starts ONLY if user has zero collections
- [ ] User can manually restart walkthrough from Help menu (? button)
- [ ] Empty state shows "Show Tutorial" button if walkthrough closed
- [ ] Walkthrough reappears if user deletes all collections (self-healing)
- [ ] All 7 steps functional with proper navigation
- [ ] Help menu has bug/feature/discussions options
- [ ] Bug report opens GitHub with pre-filled environment info
- [ ] Feature request opens GitHub with structured template
- [ ] GitHub Discussions link opens in new tab
- [ ] Bullet Journal Guide shows primer content
- [ ] Keyboard Shortcuts modal lists all shortcuts

### UX Requirements
- [ ] Mobile touch targets ≥48x48px
- [ ] Tooltips don't cover target elements
- [ ] Spotlight clearly highlights target
- [ ] Backdrop dims rest of UI (0.7 opacity)
- [ ] Animations smooth (fade/slide)
- [ ] Virtual keyboard doesn't cover tooltip (iOS)
- [ ] Dark mode styling correct
- [ ] Empty state looks good on mobile and desktop

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
- [ ] External links have proper labels
- [ ] Help menu keyboard accessible

---

## Key Architecture Decisions

### ADR #1: Zero Collections Trigger
**Decision:** Walkthrough appears when `collections.length === 0`  
**Rationale:** Simpler, self-healing, matches purpose  
**Trade-off:** Reappears if user deletes all collections (acceptable)

### ADR #2: SessionStorage for Auto-Start
**Decision:** Use `sessionStorage` to prevent auto-start spam  
**Rationale:** Once per session is helpful but not annoying  
**Trade-off:** Resets on browser close (acceptable)

### ADR #3: No Error Tracking
**Decision:** Skip auto-capture of JavaScript errors  
**Rationale:** Privacy concerns outweigh benefits  
**Alternative:** Can add opt-in error reporting later

### ADR #4: Pre-filled GitHub URLs
**Decision:** Pre-fill bug/feature templates with environment info  
**Rationale:** Higher quality reports, less maintainer burden  
**Trade-off:** GitHub-specific (acceptable for now)

---

## Next Steps

1. ✅ **Design Approved** - User decisions finalized
2. ✅ **GitHub Templates Created** - Sam will create in PR
3. → **Sam Implementation** - 7-11 hours across 4 phases
4. → **Casey Review** - Code quality, tests, accessibility
5. → **User Testing** - Manual verification on mobile/desktop
6. → **Deploy v0.6.0** - Production release

---

**Document Status:** ✅ Approved - Ready for Implementation  
**Estimated Time:** 7-11 hours (4 phases)  
**Target Version:** v0.6.0  
**Date:** February 6, 2026  
**Approved By:** User
