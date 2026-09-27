# ADR-022: Collection Debug Panel and Clipboard Copy for Debug Tools

**Date**: 2026-03-25  
**Status**: Accepted

## Context

Two developer-experience gaps were identified:

1. **Collection-level debugging was missing.** The existing `EventHistoryDebugTool` shows events for a single entry, but there was no way to see all events that affected a collection (e.g. all `TaskAddedToCollection`, `TaskRemovedFromCollection`, and entry-level events for tasks ever in that collection) in one view. This made diagnosing phantom count bugs slow.

2. **Clipboard copy was missing from debug tools.** Both the entry-level debug tool and the new collection panel output JSON, but copying it required manually selecting text in the panel — error-prone on mobile and small viewports.

## Decision

### 1. `useCopyToClipboard` — shared hook with `useRef` timer cleanup

A new `useCopyToClipboard(resetDelayMs = 2000)` hook wraps `navigator.clipboard.writeText`. It returns `[copy(text), copied]`. The `copied` flag resets after `resetDelayMs` via a `useRef`-held timer. Using `useRef` (not `useEffect`) for the timer prevents the stale-closure bug that caused the "copied" state to persist on unmount and the rapid double-click reset bug (where the second click's timer would be lost).

### 2. `CollectionDebugPanel` — two-pass event filter

A new `CollectionDebugPanel` component (dev-only, rendered inside `CollectionHeader`) performs a two-pass filter over all events:

- **Pass 1 (membership):** Collect all entry IDs that have ever appeared in this collection via `TaskAddedToCollection`, `TaskCreatedInCollection`, `TaskMigrated`, or `TaskRemovedFromCollection` events.
- **Pass 2 (full event set):** Include: (a) lifecycle events directly referencing the `collectionId`, (b) membership events for the collection, (c) all events whose `aggregateId` is one of the entry IDs found in Pass 1.

This two-pass approach ensures that events for entries moved INTO the collection are included even if the event's `collectionId` field references a different collection.

The panel renders the events as formatted JSON with a `📋 Copy` / `✓ Copied!` button in the header. It self-gates via `useDebug().isEnabled` — no new props needed on `CollectionHeader`.

### 3. `CollectionHeader` wires the panel

`CollectionHeader` gains `<CollectionDebugPanel collectionId={collectionId} />` rendered below the existing header content. The panel is self-gating (returns `null` when debug mode is off), so no conditional logic is needed in `CollectionHeader`.

### 4. `EventHistoryDebugTool` gains clipboard copy

The existing per-entry debug tool gains a `📋 Copy` / `✓ Copied!` button in its panel header, using the shared `useCopyToClipboard` hook. `key={event.id}` replaces `key={index}` in the event list to avoid stale React keys when events stream in.

## Consequences

**Positive:**
- ✅ Collection-level event history visible in one click — dramatically speeds up phantom count / migration debugging
- ✅ Clipboard copy works reliably on all platforms, including mobile
- ✅ `useCopyToClipboard` is fully reusable — zero duplication between the two debug tools
- ✅ Both debug tools are dev-only (gated by `useDebug().isEnabled`) — zero production surface area added
- ✅ `useRef` timer pattern is the correct React pattern for cleanup-outside-useEffect timers

**Negative / Risks:**
- ⚠️ Two-pass filter iterates all events on every render of `CollectionDebugPanel`. For large event stores (5,000+ events) this is perceptible. Mitigation: the panel only renders in dev mode and is not open by default.
- ⚠️ The `navigator.clipboard` API is not available in all test environments — `useCopyToClipboard` tests mock it via `vi.stubGlobal`.

## SOLID Principles

- **Single Responsibility**: `useCopyToClipboard` manages clipboard state only. `CollectionDebugPanel` renders collection-scoped events only. `EventHistoryDebugTool` renders entry-scoped events only.
- **Open/Closed**: `CollectionHeader` is extended with the new panel via composition — its existing structure is unchanged.
- **Interface Segregation**: `CollectionDebugPanel` takes only `collectionId: string` — it fetches events itself via `useEvents()`.
- **Dependency Inversion**: Both debug components depend on `useEvents()` and `useDebug()` hooks (abstractions) rather than directly accessing the event store.

## Files Created / Modified

**Created:**
- `packages/client/src/hooks/useCopyToClipboard.ts` — shared clipboard hook
- `packages/client/src/hooks/useCopyToClipboard.test.ts` — 5 tests (4 unit + 1 rapid double-click)
- `packages/client/src/components/CollectionDebugPanel.tsx` — new collection debug panel
- `packages/client/src/components/CollectionDebugPanel.test.tsx` — 11 tests

**Modified:**
- `packages/client/src/components/CollectionHeader.tsx` — wired `<CollectionDebugPanel collectionId={collectionId} />`
- `packages/client/src/components/CollectionHeader.test.tsx` — 2 new integration tests
- `packages/client/src/components/EventHistoryDebugTool.tsx` — clipboard copy button, `key={event.id}`
- `packages/client/src/components/EventHistoryDebugTool.test.tsx` — 2 new clipboard tests
