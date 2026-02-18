# Event Models - Quick Reference

**Purpose:** Quick reference for event schemas. Full TypeScript definitions are in `packages/domain/src/task.types.ts`.

---

## Core Concepts

### Event Sourcing Pattern
```
User Action → Command → Event → Projection (Read Model)
```

**Write Side (Commands):**
- Validate input
- Generate event
- Append to event store

**Read Side (Projections):**
- Subscribe to events
- Rebuild state by replaying events
- Multiple projections for different views

---

## Event Naming Conventions

- **Events:** Past tense (`TaskCreated`, not `CreateTask`)
- **Commands:** Imperative (`CreateTaskCommand`)
- **Aggregates:** Noun (`Task`, `Note`, `Event`)

---

## Aggregate Types

### Task Events
- `TaskCreated` - New task added
- `TaskCompleted` - Task marked done
- `TaskReopened` - Completed task reopened
- `TaskTitleChanged` - Title edited
- `TaskDeleted` - Task removed
- `TaskReordered` - Order changed
- `TaskAddedToCollection` - Task added to a collection (multi-collection)
- `TaskRemovedFromCollection` - Task removed from a collection (creates ghost)

### Note Events
- `NoteCreated` - New note added
- `NoteContentChanged` - Content edited
- `NoteDeleted` - Note removed
- `NoteReordered` - Order changed
- `NoteMigrated` - Note moved to different collection (legacy pattern)

### Event Events (Calendar/Future Log)
- `EventCreated` - New calendar event
- `EventContentChanged` - Content edited
- `EventDateChanged` - Date changed or removed
- `EventDeleted` - Event removed
- `EventReordered` - Order changed
- `EventMigrated` - Event moved to different collection (legacy pattern)

### Cross-Cutting Events
- `EntryMovedToCollection` - Generic move for any entry type

---

## Entry Types (Discriminated Union)

```typescript
type Entry = 
  | (Task & { type: 'task' })
  | (Note & { type: 'note' })
  | (Event & { type: 'event' });
```

**Why separate events per type?**
- Type safety (TypeScript narrows types)
- Clear audit trail (know exactly what changed)
- No migration needed when adding fields to one type
- See ADR-003 in `architecture-decisions.md`

**Note on migration patterns:**
- Tasks use the **multi-collection pattern** (`TaskAddedToCollection` / `TaskRemovedFromCollection`) — preserves ID, full history, ghost rendering
- Notes/Events still use the **legacy migration pattern** (`NoteMigrated` / `EventMigrated`) — creates a new ID with `migratedTo`/`migratedFrom` pointers
- See ADR-015 in `architecture-decisions.md` for the full story

---

## Event Store Interface

```typescript
interface IEventStore {
  append(event: DomainEvent): Promise<void>;
  appendBatch(events: DomainEvent[]): Promise<void>;
  getAll(): Promise<readonly DomainEvent[]>;
  subscribe(callback: () => void): () => void;
}
```

**Implementations:**
- `EventStore` - In-memory (testing)
- `IndexedDBEventStore` - Browser persistence (production)

---

## Projection Pattern

```typescript
class EntryListProjection {
  constructor(private eventStore: IEventStore) {
    // Subscribe for reactive updates
    this.eventStore.subscribe(() => {
      this.notifySubscribers();
    });
  }

  async getEntries(): Promise<Entry[]> {
    const events = await this.eventStore.getAll();
    return this.applyEvents(events);
  }

  private applyEvents(events: DomainEvent[]): Entry[] {
    // Replay events to rebuild current state
  }
}
```

---

## For Full Schemas

**See TypeScript definitions:**
- `packages/domain/src/task.types.ts` - All event types
- `packages/domain/src/*.handlers.ts` - Command handlers
- `packages/domain/src/entry.projections.ts` - Read models

**See Architecture Decisions:**
- `docs/architecture-decisions.md` - Why we chose this design

**See Implementation Examples:**
- `packages/domain/tests/*.test.ts` - Event creation examples
