# ADR-020: Phase 2 Habit Tracking — Event-Sourced Habit Aggregate with Derived Read Models

**Date**: 2026-03-20
**Status**: Accepted

## Context

Phase 2 adds habit tracking to Squickr Life: users can create daily or weekly habits, check them off each day, and review streaks + history. The core questions:

1. **How are habits stored?** — New event types on a `Habit` aggregate, or piggy-back on existing `Task`/`Collection` events?
2. **How are read models computed?** — Continuously-projected (live) state, or computed on-demand?
3. **How does the UI access habit data?** — New context fields, or a new provider?
4. **How are habit history and streaks calculated?** — Real-time from events, or cached?

## Decision

### 1. New `Habit` Aggregate with Dedicated Event Types

Habits have distinct lifecycle semantics (frequency schedules, completion windows, streaks) that don't map cleanly onto `Task` or `Collection`. A dedicated aggregate is the right boundary.

**9 new event types** (all prefixed `habit-`):
- `habit-created`, `habit-title-updated`, `habit-frequency-updated`
- `habit-completed`, `habit-completion-reverted`
- `habit-archived`, `habit-restored`
- `habit-reordered`

Each event carries `aggregateId` (the habit ID), `timestamp` (ISO string), and typed `data`. Events are immutable and appended to the same `IEventStore` shared by all other aggregates — no new storage mechanism.

### 2. `HabitProjection` — Continuous Read Model

A dedicated `HabitProjection` class (in `packages/domain/src/`) subscribes to the event store and maintains a `Map<habitId, HabitState>` in memory. This follows the existing `EntryListProjection` pattern precisely.

`HabitProjection` exposes:
- `getActiveHabits()` — all non-archived habits, sorted by `order`
- `getAllHabits()` — active + archived
- `getHabitById(id)` — single habit read model
- `getHabitsForDate(dateKey)` — habits scheduled for a given local date (used by daily log view)

The read model (`HabitReadModel`) is fully derived from events at projection time:
- `currentStreak` / `longestStreak` — computed from `history` on every projection update
- `history` — last 30 days of `HabitDayStatus` (`completed | missed | not-scheduled | future`)
- `isScheduledToday` / `isCompletedToday` — derived from today's date and completion events

### 3. `HabitProjection` Wired into `EntryListProjection` as a Private Façade Field

Following the existing pattern (`review`, `collectionView`, `dailyLog`, `subTask`), `HabitProjection` is held as a **private field** on `EntryListProjection`. Four new public delegating methods are added to `EntryListProjection`:

```typescript
getActiveHabits(): Promise<HabitReadModel[]>
getAllHabits(): Promise<HabitReadModel[]>
getHabitById(id: string): Promise<HabitReadModel | undefined>
getHabitsForDate(date: string): Promise<HabitReadModel[]>
```

This keeps all domain query access behind the single `entryProjection` reference in `AppContext` — no new context fields for projections.

### 4. 8 New Handler Classes, All Injected via `AppContext`

Each command type (`CreateHabit`, `UpdateHabitTitle`, `UpdateHabitFrequency`, `CompleteHabit`, `RevertHabitCompletion`, `ArchiveHabit`, `RestoreHabit`, `ReorderHabit`) has a dedicated handler class following the existing `CreateTaskHandler` pattern: validate → create event → `eventStore.append()`.

All 8 handlers are instantiated in `App.tsx` and injected into `AppContext`. UI components access them via `useApp()`.

### 5. Client UI Layer

- **`useHabitsForDate(date)`** — hook wrapping `entryProjection.getHabitsForDate(date)` with reactive subscription
- **`useHabitsManagement()`** — hook exposing all 8 handler `handle()` functions
- **`HabitRow`** — single habit row with check/uncheck, archive, reorder
- **`HabitsSection`** — list of `HabitRow`s for a given date, used in `CollectionDetailView`
- **`CreateHabitModal`** — modal form for creating a new habit (title + frequency)
- **`HabitHistoryGrid`** — 7-column Mon–Sun calendar grid showing last 30 days of status
- **`HabitDetailView`** — `/habits/:habitId` route: title, streak stats, frequency, `HabitHistoryGrid`
- **`HabitsView`** — `/habits` management route: active habits list, archived habits, FAB → `CreateHabitModal`
- **`ReviewHabitSection`** — replaces placeholder; shows each active habit's streak + 30-day completion rate

### 6. Navigation

`UserProfileMenu` gains an optional `onHabitsClick` prop. When provided, a "📊 Habits" menu item appears between "Review" and the Help Section. `CollectionIndexView` passes `() => navigate(ROUTES.habits)`.

## Consequences

**Positive:**
- ✅ Clean aggregate boundary — habits are not tasks masquerading as another type
- ✅ Zero changes to existing aggregates or their events
- ✅ Follows every established pattern: façade projection field, handler-per-command, AppContext injection
- ✅ `HabitProjection` is fully testable in isolation with `InMemoryEventStore`
- ✅ 30-day history + streaks are pure functions of the event log — no derived state stored
- ✅ Offline-first: all habit data lives in `IndexedDB`, no network required
- ✅ Reactive UI: all hooks subscribe to `entryProjection` and re-render on any event

**Negative / Risks:**
- ⚠️ Streak computation iterates `history` on every projection update. For users with many habits (50+) and long histories this is O(habits × 30). *Mitigation:* Streaks are computed in `HabitProjection.buildReadModel()` which only runs when a habit event is appended — not on every render.
- ⚠️ `getHabitsForDate` is called unconditionally in `CollectionDetailView` (React hooks rules). Non-daily collections pass `''` as the date, returning an empty array. *Mitigation:* Empty date returns `[]` immediately — no projection work done.

## SOLID Principles

- **Single Responsibility**: `HabitProjection` answers only habit queries. Each handler handles one command. `HabitsSection` renders only habit rows.
- **Open/Closed**: `EntryListProjection` extended via the façade pattern — not modified structurally. Additive only.
- **Liskov Substitution**: All handlers accept `IEventStore`. Tests use `InMemoryEventStore`.
- **Interface Segregation**: `useHabitsForDate` exposes only read access; `useHabitsManagement` exposes only write access.
- **Dependency Inversion**: All domain classes depend on `IEventStore` abstraction; all UI components depend on `AppContext` abstraction.

## Files Created / Modified

**Domain (packages/domain/src/):**
- `habit.types.ts` — all command, event, and read model types (NEW)
- `habit.handlers.ts` — 8 handler classes (NEW)
- `habit.handlers.test.ts` — handler tests (NEW)
- `habit.projection.ts` — `HabitProjection` (NEW)
- `habit.projection.test.ts` — projection tests (NEW)
- `entry.projections.ts` — private `habit` façade field + 4 delegating methods (MODIFIED)
- `entry.projections.test.ts` — delegation integration tests (MODIFIED)
- `index.ts` — exports for all new public types (MODIFIED)

**Client (packages/client/src/):**
- `hooks/useHabitsForDate.ts` + `.test.ts` — read hook (NEW)
- `hooks/useHabitsManagement.ts` + `.test.ts` — write hook (NEW)
- `hooks/useReviewData.ts` — added `habits` field from `getActiveHabits()` (MODIFIED)
- `hooks/useReviewData.test.ts` — updated mocks + 2 new tests (MODIFIED)
- `context/AppContext.tsx` — 8 new handler fields (MODIFIED)
- `components/HabitRow.tsx` + `.test.tsx` — habit row component (NEW)
- `components/HabitsSection.tsx` + `.test.tsx` — habit list section (NEW)
- `components/CreateHabitModal.tsx` + `.test.tsx` — create modal (NEW)
- `components/HabitHistoryGrid.tsx` + `.test.tsx` — 30-day calendar grid (NEW)
- `components/ReviewHabitSection.tsx` — replaced placeholder with real data (MODIFIED)
- `components/ReviewHabitSection.test.tsx` — 6 new tests (NEW)
- `components/UserProfileMenu.tsx` — optional `onHabitsClick` prop + menu item (MODIFIED)
- `components/UserProfileMenu.test.tsx` — 2 new tests (MODIFIED)
- `views/CollectionDetailView.tsx` — `HabitsSection` + `CreateHabitModal` integrated (MODIFIED)
- `views/CollectionDetailView.test.tsx` — mock patches (MODIFIED)
- `views/CollectionIndexView.tsx` — passes `onHabitsClick` to `UserProfileMenu` (MODIFIED)
- `views/CollectionIndexView.test.tsx` — mock patches (MODIFIED)
- `views/HabitsView.tsx` + `.test.tsx` — `/habits` management route (NEW)
- `views/HabitDetailView.tsx` + `.test.tsx` — `/habits/:habitId` detail route (NEW)
- `views/ReviewView.tsx` — passes `habits` to `ReviewHabitSection` (MODIFIED)
- `views/ReviewView.test.tsx` — updated fixtures (MODIFIED)
- `routes.tsx` — `ROUTES.habits`, `ROUTES.habitDetail` (MODIFIED)
- `App.tsx` — 8 handlers instantiated + 2 new routes (MODIFIED)
- `test/test-utils.tsx` — 8 habit handler stubs (MODIFIED)
