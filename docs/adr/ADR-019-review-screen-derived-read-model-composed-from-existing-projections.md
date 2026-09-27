# ADR-019: Review Screen — Derived Read Model Composed from Existing Projections

**Date**: 2026-03-20
**Status**: Accepted

## Context

The Proactive Squickr initiative (Phase 1) adds a "Review" screen that answers:

1. **"What did I do?"** — completed tasks this week (or month), grouped by collection
2. **"What's stuck?"** — open tasks on any monthly log whose last *content* event is more than 14 days ago

The app already captures everything needed: `completedAt` timestamps on tasks, `type: 'monthly'` on collections, and a full event log with per-aggregate timestamps. No new domain events or aggregates are required.

A key design question: how does this screen get its data?

**Option A: Continuously-projected read model** — a dedicated `ReviewProjection` subscribes to the event store and maintains pre-computed state, like `EntryListProjection`.

**Option B: Computed-on-demand query** — a query object reads from the existing `EntryListProjection` cache (already warm) and the raw event log (needed only for staleness), computes the result at call time, and discards it.

**Option C: New aggregate or new events** — emit `TaskStalled` events, or create a `ReviewAggregate`.

## Decision

Implement **Option B**: a **computed-on-demand** query model composed from existing projections.

Concretely:

1. A new class `ReviewProjection` (`packages/domain/src/review.projection.ts`) holds two query methods and nothing else.
2. It is wired into `EntryListProjection` as a **private façade field** — the same pattern used by `CollectionViewProjection`, `DailyLogProjection`, and `SubTaskProjection`. `EntryListProjection` exposes two new delegating public methods.
3. A new React hook `useReviewData` in the client layer calls these methods, manages loading state, and subscribes to `EntryListProjection` for reactivity.
4. No new events. No new aggregates. No new IndexedDB stores. No continuous projection state.

**New domain surface:**

```typescript
// packages/domain/src/review.projection.ts

export interface StalledTask {
  readonly entry: Entry;
  readonly collectionId: string;
  readonly collectionName: string;
  readonly lastEventAt: string;   // ISO timestamp of most recent content event on this aggregate
  readonly staleDays: number;
}

export class ReviewProjection {
  constructor(
    private readonly entryProjection: EntryListProjection,
    private readonly eventStore: IEventStore,
  ) {}

  /** Returns completed tasks (type === 'task') with completedAt in [from, to] */
  async getCompletedInRange(from: Date, to: Date): Promise<Entry[]>

  /** Returns open tasks on any monthly-type collection whose last content event is > olderThanDays ago */
  async getStalledMonthlyTasks(
    olderThanDays: number,
    getCollection: (id: string) => Collection | undefined,
  ): Promise<StalledTask[]>
}
```

**Staleness algorithm:**

```
staleness(task):
  monthlyColl = task.collections.find(c => collections[c].type === 'monthly')
  if !monthlyColl → not stalled
  if task.status !== 'open' → not stalled
  lastContentEventAt = max(event.timestamp
    for event where event.aggregateId === task.id
      AND event.type IN CONTENT_EVENT_TYPES)
  if !lastContentEventAt → not stalled (no content events = unknown)
  staleDays = floor((now - lastContentEventAt) / 86400000)
  stalled = staleDays > olderThanDays
```

**Content event types** (migration and collection-management events are excluded):
`TaskCreated`, `TaskCompleted`, `TaskReopened`, `TaskTitleChanged`, `TaskDeleted`, `TaskRestored`, `TaskReordered`

**Rationale for content-only staleness:** A task migrated every day but never edited or actioned is as stale as one that was never touched. The migration action (`TaskMigratedToCollection`) reflects the user deferring a task, not engaging with it. Only content changes (edits, completions, status changes) count as evidence of activity.

**Routing:**

```
/review              → weekly view (default)
/review?period=monthly → monthly view
```

Entry point: `UserProfileMenu` in `CollectionIndexView` (avatar/profile menu).

## Rationale

**Why on-demand, not continuously projected?**

The review screen is accessed infrequently (once per week, triggered by notification tap or deliberate navigation). Maintaining continuously-updated in-memory state for a screen that is rarely open wastes memory and adds subscription complexity. The existing `EntryListProjection` cache (`cachedEntries`) means the `getCompletedInRange` query is O(n) in entries — practically free after hydration.

The staleness scan (`getStalledMonthlyTasks`) calls `eventStore.getAll()` each time the screen is opened. At current event log scales (~1,000–5,000 events) this is sub-millisecond. If it becomes a bottleneck in future, a `lastContentEventByAggregate` cache can be memoized inside `ReviewProjection` — an internal implementation detail with zero public API change.

**Why the private façade pattern?**

`EntryListProjection` already uses this pattern three times (`CollectionViewProjection`, `DailyLogProjection`, `SubTaskProjection`). Adding a fourth `ReviewProjection` is consistent and keeps `entry.projections.ts` from growing unboundedly. The façade is an implementation detail — callers only ever see `EntryListProjection`.

**Why `getCollection` as a callback?**

`ReviewProjection` is constructed inside `EntryListProjection`. Injecting `CollectionListProjection` would add a third constructor dependency and risk initialisation order issues (both projections subscribe to the same event store). Passing a `getCollection` callback (resolved at query time by the hook) keeps the domain layer free of cross-projection references, following Interface Segregation — the projection only needs *resolve a collection by ID*, not the full `CollectionListProjection` surface.

**Why no new events?**

Option C (`TaskStalled` events) would require a background scheduler to emit staleness events — impossible in a fully offline, no-backend app. Staleness is a **derived property** of the existing event log, not a domain fact worth recording.

**Why content events only for staleness?**

A task migrated repeatedly from one daily log to the next is demonstrably procrastinated, not actively worked on. Using all events (including `TaskMigratedToCollection`) would reset the staleness clock each time a user defers a task, hiding the very stall the screen is meant to surface. Only edits, completions, and status changes constitute genuine user engagement with a task's content.

## Consequences

**Positive:**
- ✅ Zero new events, zero new aggregates — existing event log is the source of truth
- ✅ Fully offline — all data in IndexedDB, no network required
- ✅ Uses existing `EntryListProjection` cache — `getCompletedInRange` is essentially free after hydration
- ✅ Consistent with existing private façade pattern
- ✅ `StalledTask` return type carries `collectionName` — no N+1 lookups in the view
- ✅ Gracefully handles absent `HabitProjection` — placeholder section in UI until Phase 2
- ✅ Deep-link compatible: `/review?period=weekly` or `/review?period=monthly`
- ✅ All existing tests unaffected — additive change only

**Negative / Risks:**
- ⚠️ `getStalledMonthlyTasks` calls `eventStore.getAll()` on each review screen open. At 5,000+ events this could become perceptible. *Mitigation:* Memoize `lastContentEventByAggregate` map inside `ReviewProjection` between calls — zero API surface change.
- ⚠️ `getCollection` callback is passed from the client layer into the domain layer, which is slightly unusual. *Mitigation:* The callback has a minimal, stable signature `(id: string) => Collection | undefined` and does not leak React or browser APIs into the domain.

## SOLID Principles

- **Single Responsibility**: `ReviewProjection` answers only review-screen queries. `ReviewView` renders only the review screen. `useReviewData` manages only review data fetching.
- **Open/Closed**: `EntryListProjection` is extended via the private façade pattern — not modified. New methods are additive.
- **Liskov Substitution**: `ReviewProjection` accepts `IEventStore` (domain abstraction). Tests use `InMemoryEventStore`.
- **Interface Segregation**: `getCollection` callback exposes only the one operation `ReviewProjection` needs.
- **Dependency Inversion**: `ReviewProjection` depends on `IEventStore` (domain abstraction). `useReviewData` depends on `EntryListProjection` (injected via `AppContext`).

## Files Created / Modified

**Created:**
- `packages/domain/src/review.projection.ts` — `ReviewProjection`, `StalledTask`
- `packages/domain/src/review.projection.test.ts` — 18 domain tests
- `packages/client/src/utils/reviewDateRange.ts` — `getDateRange`, `ReviewPeriod`
- `packages/client/src/utils/reviewDateRange.test.ts` — 11 tests
- `packages/client/src/hooks/useReviewData.ts` — review data hook
- `packages/client/src/hooks/useReviewData.test.ts` — 10 tests
- `packages/client/src/views/ReviewView.tsx` — review screen
- `packages/client/src/views/ReviewView.test.tsx` — 10 tests
- `packages/client/src/components/ReviewHeader.tsx` — header with back/toggle
- `packages/client/src/components/ReviewHeader.test.tsx` — 11 tests
- `packages/client/src/components/ReviewCompletedSection.tsx`
- `packages/client/src/components/ReviewCompletedSection.test.tsx` — 8 tests
- `packages/client/src/components/ReviewStalledSection.tsx`
- `packages/client/src/components/ReviewStalledSection.test.tsx` — 5 tests
- `packages/client/src/components/ReviewHabitSection.tsx` — Phase 2 placeholder

**Modified:**
- `packages/domain/src/entry.projections.ts` — private `review` façade field + 2 delegating methods
- `packages/domain/src/entry.projections.test.ts` — 2 delegation integration tests
- `packages/domain/src/index.ts` — exports `ReviewProjection`, `StalledTask`
- `packages/client/src/routes.tsx` — `review` route constant, `buildReviewPath` helper
- `packages/client/src/App.tsx` — `<Route path={ROUTES.review} element={<ReviewView />} />`
- `packages/client/src/App.test.tsx` — route render test
- `packages/client/src/components/UserProfileMenu.tsx` — `onReviewClick` prop + button
- `packages/client/src/components/UserProfileMenu.test.tsx` — 2 new tests
- `packages/client/src/views/CollectionIndexView.tsx` — passes `onReviewClick` to menu
