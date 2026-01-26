# Event Models - Quick Reference

**Purpose:** Quick reference for event schemas. Full TypeScript definitions are in `packages/shared/src/task.types.ts`.

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

### Note Events
- `NoteCreated` - New note added
- `NoteContentChanged` - Content edited
- `NoteDeleted` - Note removed
- `NoteReordered` - Order changed

### Event Events (Calendar/Future Log)
- `EventCreated` - New calendar event
- `EventContentChanged` - Content edited
- `EventDateChanged` - Date changed or removed
- `EventDeleted` - Event removed
- `EventReordered` - Order changed

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

---

## Event Store Interface

```typescript
interface IEventStore {
  append(event: DomainEvent): Promise<void>;
  getEvents(): Promise<DomainEvent[]>;
  subscribe(callback: (event: DomainEvent) => void): () => void;
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
    const events = await this.eventStore.getEvents();
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
- `packages/shared/src/task.types.ts` - All event types
- `packages/shared/src/*.handlers.ts` - Command handlers
- `packages/shared/src/entry.projections.ts` - Read models

**See Architecture Decisions:**
- `docs/architecture-decisions.md` - Why we chose this design

**See Implementation Examples:**
- `packages/shared/tests/*.test.ts` - Event creation examples
