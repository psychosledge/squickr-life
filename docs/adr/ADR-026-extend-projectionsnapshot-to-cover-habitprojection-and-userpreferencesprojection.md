# ADR-026: Extend ProjectionSnapshot to Cover HabitProjection and UserPreferencesProjection

**Date**: 2026-04-03
**Status**: Accepted

## Context

The cold-start snapshot mechanism (ADR-016 through ADR-025) seeds `EntryListProjection`
and `CollectionListProjection` from a remote snapshot so the UI renders immediately on
new devices. However, two projections were not included: `HabitProjection` and
`UserPreferencesProjection`. This caused:

1. **Incorrect cold-start habit state**: On a new device, habits had no completions or
   streaks until the full event log downloaded, producing incorrect read models.
2. **Missing user preferences**: `defaultCompletedTaskBehavior` and related settings
   defaulted to their initial values rather than the user's saved preferences, causing
   incorrect UI behaviour during the delta-sync window.
3. **Delta-only sync gap**: ADR-025 introduced delta-only event downloads anchored at
   the snapshot cursor. Without habit and preferences state in the snapshot, a new
   device had no way to reconstruct these projections until the full log was replayed.

## Decision

### Schema (snapshot-store.ts)
- `SNAPSHOT_SCHEMA_VERSION` bumped **4 → 5**.
- `ProjectionSnapshot` gains two new optional fields:
  - `habits?: SerializableHabitState[]` — serialised habit states
  - `userPreferences?: UserPreferences` — user preferences at snapshot time

### New type (habit.types.ts)
`SerializableHabitState` is a plain-object representation of the internal `HabitState`:
- `completions` stored as `Record<string, string>` (Map is not JSON-serialisable)
- `reverted` stored as `string[]` (Set is not JSON-serialisable)

### HabitProjection (habit.projection.ts)
- Added `private stateCache: Map<string, HabitState> | null` — avoids repeated replays.
- `loadStates()` checks and populates the cache; invalidated on any event-store append.
- `hydrateFromSnapshot(states)` — deserialises the snapshot and populates the cache;
  notifies subscribers immediately.
- `getStatesForSnapshot()` — async; calls `loadStates()` if cache is cold, then
  serialises to `SerializableHabitState[]`.

### UserPreferencesProjection (user-preferences.projections.ts)
- Added `private preferencesCache: UserPreferences | null` — single replay per session.
- `getUserPreferences()` now checks the cache before calling `eventStore.getAll()`.
- Cache is cleared in the existing event-store subscriber callback.
- `hydrateFromSnapshot(prefs)` — sets the cache and notifies subscribers.

### EntryListProjection (entry.projections.ts)
- Exposes `get habitProjection(): HabitProjection` so callers do not need a separate
  constructor argument.
- `hydrate()` adds an **all-or-nothing completeness guard**: if a v5 snapshot is missing
  either `habits` or `userPreferences`, it is discarded and a full replay is scheduled.
  This covers the transition window between schema bump and full deployment.
- After passing the guard, `hydrate()` calls `this.habit.hydrateFromSnapshot(snapshot.habits)`
  before seeding the entry cache, so habit state is available as soon as entries are.

### SnapshotManager (snapshot-manager.ts)
- Two new optional constructor parameters: `habitProjection?` and
  `userPreferencesProjection?`.
- `saveSnapshot()` enriches the snapshot with `habits` and `userPreferences` when both
  projections are provided.

### App.tsx
- `UserPreferencesProjection` elevated from a local variable inside `initializeApp` to a
  stable `useState` value so it can be passed to `SnapshotManager` and referenced from
  the cold-start sequencer.
- Cold-start slow path: after seeding `collectionProjection` from the remote snapshot,
  also calls `userPreferencesProjection.hydrateFromSnapshot(remoteSnapshot.userPreferences)`
  when that field is present.
- Both `SnapshotManager` constructor calls updated to pass
  `entryProjection.habitProjection` and `userPreferencesProjection`.

## Rationale

**All-or-nothing cursor invalidation**: A v5 snapshot missing either field was saved
by code that had the schema bump but not the enrichment wiring. Rather than patching
individual fields, the snapshot is discarded entirely. This ensures the cursor used for
delta-only sync (ADR-025) is never stale relative to the projection state.

**Cache in HabitProjection and UserPreferencesProjection**: Both projections previously
replayed all events on every query. Adding a simple null-check cache reduces the per-query
cost from O(events) to O(1) after the first access. The cache is invalidated on every
event-store append so correctness is preserved.

**SerializableHabitState vs HabitReadModel**: The snapshot stores raw state (completions,
reverted, frequency) rather than computed read models (streaks, history). This keeps
snapshot size small and allows the projection to recompute derived fields on demand.

## Consequences

**Positive:**
- Correct habit state and user preferences are available immediately on cold-start, even
  before the event log downloads.
- Delta-only sync (ADR-025) now works correctly for habits and preferences on new devices.
- `HabitProjection` and `UserPreferencesProjection` each replay events at most once per
  session, reducing IndexedDB reads.

**Negative / Risks:**
- One full replay occurs on the transition from a v4 snapshot to a v5 snapshot (first
  app open after upgrade). This is the same cost as any schema-version bump.
- Serialisation overhead: every `saveSnapshot()` call now also serialises habit states.
  For users with many habits this is a small but non-zero cost.
- If `getStatesForSnapshot()` triggers a cache miss (e.g. the habit projection was never
  queried before the snapshot fires), it performs a full event replay. This is
  unavoidable and consistent with the pre-ADR-026 behaviour.

## SOLID Principles

- **Single Responsibility**: `HabitProjection` owns habit state; `SnapshotManager` owns
  snapshot lifecycle. Neither crosses into the other's domain — the snapshot contract is
  a plain DTO (`SerializableHabitState[]`).
- **Open/Closed**: `ProjectionSnapshot` is extended with optional fields; all existing
  code paths that do not check these fields continue to work unchanged.
- **Liskov Substitution**: `hydrateFromSnapshot` and `getStatesForSnapshot` integrate
  seamlessly with the existing projection contract. Any consumer that previously called
  `getActiveHabits()` sees the same results whether the cache was warm from events or
  from a snapshot.
- **Interface Segregation**: The new snapshot methods (`hydrateFromSnapshot`,
  `getStatesForSnapshot`) are additive. They are not added to `IEventStore` or any other
  interface — only to the concrete projection classes.
- **Dependency Inversion**: `SnapshotManager` depends on the abstract `HabitProjection`
  and `UserPreferencesProjection` types passed as optional constructor arguments — not on
  specific implementations or event store details.
