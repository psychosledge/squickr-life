# Squickr Life: Retrospective Review
**Date:** February 17, 2026  
**Version Reviewed:** v0.10.1  
**Reviewers:** Architecture Alex + Code-Review Casey

> *"If we could do this all over again, knowing then what we know now, what would we do differently?"*

---

## Part 1: Architecture Alex — Domain Model Retrospective

### 🔴 Critical: Task Is Not the First-Class Citizen — Entry Is

This is the most fundamental design tension in the codebase. The **ubiquitous language** of the domain is `Entry` (tasks, notes, events are all entries in a bullet journal), but the **implementation language** is `Task`.

**Evidence of the problem today:**

| Feature | Tasks | Notes | Events |
|---------|-------|-------|--------|
| Multi-collection membership | ✅ Full support | ❌ Legacy `collectionId` only | ❌ Legacy `collectionId` only |
| Ghost entries (crossed-out after migration) | ✅ | ❌ | ❌ |
| Sub-entries (children) | ✅ Tasks only | ❌ | ❌ |
| `collections[]` array | ✅ | ❌ | ❌ |
| `collectionHistory[]` | ✅ | ❌ | ❌ |
| Bulk migrate (multi-collection) | ✅ | ❌ Uses legacy `NoteMigrated` | ❌ Uses legacy `EventMigrated` |

The `Entry` discriminated union exists in the type system (`task.types.ts:888`) and the `EntryListProjection` is correctly named, but the underlying domain model was built Task-first and Note/Event were bolted on as afterthoughts.

**What we'd do differently:**

Define `Entry` as the single aggregate root from day one, with `type` as a first-class field that gates behavior:

```typescript
// What we'd design from scratch:
interface BaseEntry {
  readonly id: string;
  readonly type: EntryType;          // 'task' | 'note' | 'event'
  readonly content: string;          // Unified content field (not title/content split)
  readonly createdAt: string;
  readonly order?: string;
  readonly collections: string[];    // Multi-collection from day 1
  readonly collectionHistory: CollectionHistoryEntry[];
  readonly parentEntryId?: string;   // Sub-entries of ANY type
  readonly userId?: string;
}

// Type-specific extensions via discriminated union
type TaskEntry = BaseEntry & { type: 'task'; status: TaskStatus; completedAt?: string; };
type NoteEntry = BaseEntry & { type: 'note' };
type EventEntry = BaseEntry & { type: 'event'; eventDate?: string; };
type Entry = TaskEntry | NoteEntry | EventEntry;
```

**All events would be `Entry`-prefixed, not type-prefixed:**
```typescript
// Instead of: TaskCreated, NoteCreated, EventCreated
EntryCreated { payload: { type: EntryType; content: string; ... } }

// Instead of: TaskMigrated, NoteMigrated, EventMigrated
EntryAddedToCollection { payload: { entryId, collectionId } }
EntryRemovedFromCollection { payload: { entryId, collectionId } }

// Instead of: TaskCompleted (task-only behavior)
EntryStatusChanged { payload: { entryId, newStatus: 'open' | 'completed' } }
```

---

### 🔴 Critical: Sub-Entries Should Be Type-Agnostic

`CreateSubTaskCommand` takes a `parentTaskId` and only creates tasks as children. This means:
- You can't add a note as a sub-entry under a task (e.g., "context note for this task")
- You can't add an event as a sub-entry (e.g., "meeting scheduled for this project")
- The parent must be a task — you can't have a note with sub-tasks

The field was renamed to `parentEntryId` in the `Task` interface (with `parentTaskId` deprecated), but the command, handler, and event payload still use `parentTaskId`. The rename is cosmetic, not structural.

**What we'd do differently:**

```typescript
// Generic sub-entry command
interface CreateSubEntryCommand {
  readonly type: EntryType;          // What kind of sub-entry
  readonly content: string;
  readonly parentEntryId: string;    // Parent can be ANY entry type
}
```

---

### 🟡 Significant: Migration Is Two Different Patterns — Should Be One

Today there are **two completely different migration mechanisms** that coexist:

1. **Legacy pattern** (Notes, Events): Creates a new entity with a new ID. Original gets `migratedTo` pointer. New entity gets `migratedFrom` pointer. Two separate database records.

2. **Multi-collection pattern** (Tasks): Preserves the same entity ID. Uses `TaskAddedToCollection` + `TaskRemovedFromCollection`. One record, full history.

The multi-collection pattern is strictly better. It preserves IDs (no broken references), maintains full history, and supports "ghost" rendering. The legacy pattern was the v1 approach and should have been replaced entirely when multi-collection was introduced.

**What we'd do differently:**

Design the multi-collection pattern from day one for all entry types. There would be no `TaskMigrated`, `NoteMigrated`, or `EventMigrated` events — just:

```typescript
EntryAddedToCollection { entryId, collectionId, addedAt }
EntryRemovedFromCollection { entryId, collectionId, removedAt }
```

Migration in BuJo terms is simply: remove from source collection, add to target collection. The entry ID never changes. Ghost rendering is automatic from `collectionHistory`.

---

### 🟡 Significant: `task.types.ts` Is a God File

At 914 lines, `task.types.ts` contains types for **three separate aggregates** (Task, Note, Event) plus the unified `Entry` type, `DailyLog`, and the master `SquickrDomainEvent` union. This violates Single Responsibility and makes the file a mandatory import for almost everything.

**What we'd do differently:**

```
packages/domain/src/
├── entry.types.ts          # BaseEntry, Entry union, EntryType, DailyLog
├── task.types.ts           # TaskEntry, TaskStatus, task-specific events/commands
├── note.types.ts           # NoteEntry, note-specific events/commands  
├── event.types.ts          # EventEntry, event-specific events/commands
├── collection.types.ts     # (already separate — good!)
└── domain-event.ts         # (already separate — good!)
```

---

### 🟡 Significant: Content Field Naming Inconsistency

- `Task.title` (string)
- `Note.content` (string)
- `Event.content` (string)

All three are the "main text" of an entry, but tasks call it `title` while notes and events call it `content`. This means the `Entry` union type can't have a single `content` field — you have to type-narrow before accessing the text. Every component that renders entries must handle this split.

**What we'd do differently:** Use `content` uniformly across all entry types. Tasks are just entries where `content` is the task description.

---

### 🟡 Significant: Reorder Commands Are Type-Specific

```typescript
ReorderTaskCommand   { taskId, previousTaskId, nextTaskId }
ReorderNoteCommand   { noteId, previousNoteId, nextNoteId }
ReorderEventCommand  { eventId, previousEventId, nextEventId }
```

These are structurally identical. The only difference is the field name prefix. This means three separate handlers with identical logic.

**What we'd do differently:**

```typescript
ReorderEntryCommand { entryId, previousEntryId, nextEntryId }
// → Single EntryReordered event, single handler
```

---

### 🟢 What Was Done Well (Architecture)

- **Event sourcing foundation** is solid. Immutable events, reactive projections, `IEventStore` abstraction — these are correct.
- **Collection virtual hierarchy** (ADR-011) was the right call. Flat data, derived UI tree is much simpler than real parent/child collections.
- **Fractional indexing** for ordering is the right approach for drag-and-drop.
- **`EntryListProjection` as unified read model** is the right direction — the projection is Entry-centric even if the events aren't.
- **Discriminated union for `Entry`** is correct TypeScript — the pattern is right, just not applied consistently to events/commands.
- **Firebase sync architecture** (ADR-010) with `IEventStore` abstraction is clean.

---

## Part 2: Code-Review Casey — Code Quality Retrospective

### 🔴 Critical: `entry.projections.ts` Is a God Class (1,143 lines)

This single file handles:
- Unified entry queries (tasks + notes + events)
- Sub-task queries and parent resolution
- Collection-filtered views
- Ghost entry logic
- Migration pointer sanitization
- Batch parent title lookups
- Daily log grouping
- Entry statistics

**Rating for this file alone: 5/10.** It does too much. The Single Responsibility Principle is violated at the class level.

**What we'd do differently:**

```
EntryListProjection        # Core: getEntries(), getEntryById(), applyEvents()
SubEntryProjection         # Sub-entry queries: getSubEntries(), getParentEntry()
CollectionViewProjection   # Collection-scoped: getEntriesForCollectionView(), ghost logic
EntryStatsProjection       # Stats: getEntryStatsByCollection(), getActiveTaskCounts()
DailyLogProjection         # Daily grouping: getDailyLogs()
```

Each would compose `EntryListProjection` as a dependency rather than inheriting or duplicating.

---

### 🔴 Critical: `applyEvents()` Has No Incremental Update — Full Replay Every Time

Every call to `getEntries()` replays the **entire event log** from scratch. For a user with 2 years of daily journaling (thousands of events), this becomes a performance bottleneck.

```typescript
// Current: O(n) replay on every read
async getEntries(): Promise<Entry[]> {
  const events = await this.eventStore.getAll(); // ALL events
  return this.applyEvents(events);               // Full replay
}
```

**What we'd do differently:** Maintain an in-memory snapshot that's updated incrementally when new events arrive:

```typescript
class EntryListProjection {
  private snapshot: Map<string, Entry> = new Map();
  private snapshotVersion = 0;

  constructor(eventStore: IEventStore) {
    eventStore.subscribe((newEvent) => {
      this.applyEvent(this.snapshot, newEvent); // Incremental update
      this.notifySubscribers();
    });
  }

  async getEntries(): Promise<Entry[]> {
    if (this.snapshotVersion === 0) await this.rebuild(); // Lazy init
    return Array.from(this.snapshot.values());
  }
}
```

---

### 🟡 Significant: Three Parallel Handler Implementations for Identical Logic

`task.handlers.ts`, `note.handlers.ts`, and `event.handlers.ts` each implement their own versions of:
- Create (with validation)
- Update content/title
- Delete
- Reorder
- Migrate

The validation logic (`title.trim()`, length checks) is duplicated across all three. The reorder logic (fractional indexing) is duplicated. The migration logic (create new entity, set pointers) is duplicated.

**What we'd do differently:** A single `EntryHandler` with type-specific behavior injected.

---

### 🟡 Significant: `parentTaskId` vs `parentEntryId` — Deprecated Field Still in Active Use

The `Task` interface has both:
```typescript
readonly parentEntryId?: string;   // "Use this"
readonly parentTaskId?: string;    // "DEPRECATED: Use parentEntryId instead"
```

But `sub-task.handlers.ts` still writes `parentTaskId` to events. `entry.projections.ts` reads `parentTaskId` in `getSubTasks()`. The `CreateSubTaskCommand` uses `parentTaskId`. The deprecation is documented but not enforced — the old field is still the live field.

This is a half-completed migration that creates confusion about which field is canonical.

---

### 🟡 Significant: `getEntriesForCollectionView()` Has Inconsistent Multi-Collection Logic

```typescript
// Active entries: Tasks use collections[], Notes/Events use legacy collectionId
const activeEntries = allEntries.filter(entry => {
  if (entry.type === 'task') {
    return entry.collections.includes(collectionId);  // Multi-collection
  }
  return entry.collectionId === collectionId;          // Legacy single-collection
});

// Ghost entries: Tasks only (Notes/Events can't ghost)
const ghostEntries = allEntries
  .filter(entry => entry.type === 'task')  // Tasks only!
```

This means the UI behaves differently for tasks vs notes/events in ways that aren't visible to the user but create hidden bugs. If a note is "migrated" (legacy pattern), it doesn't appear as a ghost in the source collection — it just disappears.

---

### 🟡 Significant: `BulkMigrateEntriesHandler` Has Explicit TODO Technical Debt

```typescript
case 'note': {
  // Notes still use legacy migration pattern (creates new ID)
  // TODO: Update to multi-collection pattern in future
```

These TODOs represent known architectural debt that will require a data migration or event upcasting to resolve. The longer this sits, the more production data accumulates in the legacy format.

---

### 🟡 Significant: `sanitizeMigrationPointers()` Uses `as any` Cast

```typescript
const { migratedTo, migratedToCollectionId, ...entryWithoutMigration } = entry as any;
return entryWithoutMigration as T;
```

This is a type safety hole that should be handled with proper type guards or a discriminated approach.

---

### 🟢 What Was Done Well (Code Quality)

- **Test coverage is excellent.** 1,565 tests across domain, infrastructure, and client. The TDD discipline shows.
- **`generateEventMetadata()`** helper is a clean abstraction — all events get consistent `id`, `timestamp`, `version` without boilerplate.
- **Fractional indexing** is correctly implemented and well-tested.
- **`appendBatch()`** for bulk operations is a smart optimization that prevents UI flashing.
- **`isoToLocalDateKey()`** utility correctly handles the UTC-to-local timezone conversion that trips up most developers.
- **Vitest + AAA pattern** is consistently applied across all test files.
- **`CollectionProjection` is well-scoped** — it handles only collection state and doesn't bleed into entry concerns.

---

## Summary: What We'd Do Differently

| Priority | Change | Impact |
|----------|--------|--------|
| 🔴 P0 | Design `Entry` as the single aggregate root from day 1 | Eliminates all type-parity gaps |
| 🔴 P0 | Use multi-collection pattern for all entry types from day 1 | No legacy migration pattern |
| 🔴 P0 | Sub-entries are type-agnostic (`parentEntryId` on all entry types) | Notes/events can be children too |
| 🔴 P0 | Incremental projection snapshots instead of full replay | Performance at scale |
| 🟡 P1 | Unified `content` field across all entry types | Simpler components |
| 🟡 P1 | Single `EntryHandler` instead of three parallel handlers | DRY, less duplication |
| 🟡 P1 | Single `ReorderEntryCommand` instead of three | DRY |
| 🟡 P1 | Split `entry.projections.ts` into focused projection classes | SRP compliance |
| 🟡 P1 | Split `task.types.ts` into per-aggregate type files | SRP, better imports |
| 🟢 P2 | Complete `parentTaskId` → `parentEntryId` migration | Remove deprecated field |
| 🟢 P2 | Fix `as any` cast in `sanitizeMigrationPointers()` | Type safety |

---

## What This Means for v1.0.0 and Beyond

The good news: **the event sourcing foundation is sound**. The event log is the source of truth, and projections can be rewritten without touching stored data. This means many of these architectural improvements can be made **without a data migration** — you update the projection to interpret old events correctly (event upcasting), and new events use the improved schema.

The path forward:
1. **Short term (v1.0.0):** Ship the intro guide as planned. Don't refactor now.
2. **Post-v1.0.0:** Implement multi-collection support for Notes and Events (closes the biggest UX gap).
3. **v2.0.0:** Consider a `v2` event schema with `Entry`-centric events. Old events are still valid — projections handle both `v1` and `v2` events via upcasting.

The architecture is recoverable. The test suite (1,565 tests) is your safety net for any refactoring.
