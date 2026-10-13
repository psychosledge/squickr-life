# ADR-028: Habit Schedule Timeline Derived in HabitProjection

**Date**: 2026-09-28
**Status**: Accepted

## Context

`HabitState` holds one `frequency`, overwritten on `HabitFrequencyChanged`, so every past day in the 30-day history is evaluated against the current schedule. Past days must be evaluated against the schedule in effect on that local day. `HabitCreated` and `HabitFrequencyChanged` already carry the frequency and an ISO timestamp (`createdAt`, `updatedAt`), so the history is recoverable without new events. Full replay (`getAll`) sorts events by `timestamp`, but the live subscription path applies synced events in arrival order, so an older remote change can be applied after a newer local one.

### Decision 1: Where schedule history lives

| Option | Summary | Key cost |
|--------|---------|----------|
| A: Timeline in HabitState | Projection keeps an ordered list of schedule entries per habit, built from existing events | Snapshot shape must grow (Slice 3) |
| B: New event or payload field | Record an explicit effective date on `HabitFrequencyChanged` | Event schema change, migration of existing events, still needs a projection timeline |
| C: Query the event store on demand | `buildHistory` reads the habit's events via `getById` | Async in a pure function, bypasses the snapshot cache, breaks delta-only cold start (ADR-025) |

**Option A: Timeline in HabitState**
Each habit state gains a schedule timeline: entries of changed-at ISO timestamp plus frequency, seeded by `HabitCreated` and appended by `HabitFrequencyChanged`. It is pure projection state, works retroactively for already-edited habits, and fits the existing snapshot mechanism once serialised.

**Option B: New event or payload field**
An explicit effective date adds nothing the timestamp does not already imply under the "local day of the change" rule, and would require handling old events without it.

**Option C: Query the event store on demand**
Couples read-model building to the event store and fails whenever the projection was hydrated from a snapshot with only delta events locally.

### Recommendation: Option A
It needs no event change and keeps the read model synchronous and snapshot-compatible. It would be wrong if a schedule change ever needed an effective date other than the day it was made (backdating or future-dating), which would require Option B.

### Decision 2: Ordering of timeline entries

| Option | Summary | Key cost |
|--------|---------|----------|
| A: Sorted by changed-at timestamp | Insert each entry in timestamp order, ties keep arrival order | Insertion is a sorted insert, not a push |
| B: Arrival order | Push each entry as applied | Out-of-order sync corrupts the timeline until the next full replay |

**Option A: Sorted by changed-at timestamp**
The timeline is independent of delivery order and matches full-replay order, since `payload.updatedAt` equals the event `timestamp` by construction in `UpdateHabitFrequencyHandler`.

**Option B: Arrival order**
Simpler, but gives different answers on different devices for the same event log.

### Recommendation: Option A
Timelines hold a handful of entries, so a sorted insert costs nothing. It would be wrong if client clocks were skewed enough across devices to misorder real changes, which the rest of the event log already accepts.

### Decision 3: Hydrating from a snapshot without a timeline (until Slice 3)

| Option | Summary | Key cost |
|--------|---------|----------|
| A: Seed a single entry | `hydrateFromSnapshot` builds a one-entry timeline from `createdAt` and the snapshot's `frequency` | Pre-snapshot history collapses to the current schedule until Slice 3 |
| B: Optional timeline with fallback | Lookup falls back to `frequency` when the timeline is absent | Conditional branch in a reusable lookup, two code paths to test |

### Recommendation: Option A
The lookup has one code path and changes applied after hydration still extend the timeline correctly. It would be wrong if Slice 3 were dropped, leaving hydrated devices permanently showing the collapsed history.

## Consequences

- The local day of a change is derived at query time from the stored ISO timestamp, matching how `createdAt` is handled, so a snapshot written in one timezone reads correctly in another.
- The every-n-days anchor remains the local creation day for every entry.
- `HabitState` holds no separate current frequency. `currentFrequency(state)` reads the latest timeline entry, so the current schedule matches the timeline after out-of-order sync.
- `SerializableHabitState` gains the timeline in Slice 3, with a `SNAPSHOT_SCHEMA_VERSION` bump under ADR-026.
- Streaks, `isScheduledToday`, and `getHabitsForDate` can adopt the same lookup later without further state changes.
