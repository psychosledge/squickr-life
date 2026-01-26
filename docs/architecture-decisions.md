# Architecture Decision Records (ADRs)

This document tracks architectural decisions made for Squickr Life.

## Format

Each decision follows this structure:
- **Date**: When decided
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Rationale**: Why this approach?
- **Consequences**: Trade-offs and implications
- **SOLID Principles**: Which principle(s) does this support?

---

## ADR-001: Monorepo with pnpm Workspaces

**Date**: 2026-01-22  
**Status**: Accepted

### Context
Organize code for multi-package project (client, shared domain logic, future backend).

### Decision
Use monorepo with pnpm workspaces:
- `packages/client` - React PWA
- `packages/shared` - Domain logic, event sourcing, types
- `packages/backend` - Supabase functions (future)

### Rationale
- **Type Safety**: Shared types ensure client/backend use identical event schemas
- **Atomic Changes**: Event schema changes update all packages in single commit
- **pnpm Benefits**: Strict dependency management prevents phantom dependencies
- **Development Speed**: No need to publish/install shared package during dev

### Consequences
**Positive:**
- Type-safe contract between packages
- Single `pnpm install` for entire project
- Easier refactoring across packages

**Negative:**
- Slightly more complex setup
- All packages version together (acceptable for this project)

### SOLID Principles
- **Single Responsibility**: Each package has one clear purpose
- **Dependency Inversion**: Packages depend on abstractions in `shared`

---

## ADR-002: Event Sourcing with CQRS

**Date**: 2026-01-22  
**Status**: Accepted

### Context
Choose state management and persistence architecture.

### Decision
Full event sourcing with CQRS:
- **Write side**: Commands → Events → Event Store
- **Read side**: Events → Projections (read models)
- All state changes captured as immutable events
- Projections rebuild from event replay

### Rationale
- **Learning Goal**: Master event sourcing
- **Offline-First**: Event log naturally supports offline queueing
- **Audit Trail**: Complete history of all changes
- **Time Travel**: Can replay events to any point in time
- **Sync-Friendly**: Events are easy to merge across devices

### Consequences
**Positive:**
- Complete audit trail
- Natural undo/redo support
- Offline changes become queued events
- State can be reconstructed at any point
- Easier testing (test events, not state mutations)

**Negative:**
- More complex than simple CRUD
- Storage grows with events (mitigated: events are small)
- Events are immutable (design carefully)
- Learning curve

### SOLID Principles
- **Single Responsibility**: Commands, events, projections have separate concerns
- **Open/Closed**: Add new projections without modifying event store
- **Liskov Substitution**: All events share base Event interface
- **Interface Segregation**: Commands, queries, events are separate contracts
- **Dependency Inversion**: Projections depend on event abstractions

---

## ADR-003: IndexedDB for Local Event Store

**Date**: 2026-01-22  
**Status**: Accepted

### Context
Persist events locally in browser for offline-first PWA.

### Decision
Use IndexedDB as local event store persistence layer.

### Rationale
- **Browser Native**: No additional dependencies
- **Large Storage**: 50MB+ (far more than localStorage's 5-10MB)
- **Structured Data**: Can index by aggregate ID, timestamp, event type
- **Async API**: Non-blocking reads/writes
- **PWA Standard**: Recommended for offline-first apps

**Alternatives Rejected:**
- localStorage: Too small, synchronous, no indexing
- WebSQL: Deprecated
- File System Access API: Not widely supported

### Consequences
**Positive:**
- No external dependencies
- Works in all modern browsers
- Efficient queries by various criteria
- Supports transactions

**Negative:**
- More complex API than localStorage
- Need to handle browser storage quota
- Incognito mode has limited storage

### SOLID Principles
- **Dependency Inversion**: EventStore depends on IStorageAdapter interface

---

## ADR-004: Separate Events per Aggregate Type

**Date**: 2026-01-25  
**Status**: Accepted

### Context
Event schema for entry types (Task, Note, Event). Options:
1. Generic `EntryCreated` with discriminated type field
2. Separate `TaskCreated`, `NoteCreated`, `EventCreated`

### Decision
Use separate event types per aggregate:
- Task events: `TaskCreated`, `TaskCompleted`, `TaskTitleChanged`, etc.
- Note events: `NoteCreated`, `NoteContentChanged`, etc.
- Event events: `EventCreated`, `EventDateChanged`, etc.

### Rationale
- **Type Safety**: Each event has exact fields for its aggregate
- **Clear Audit Trail**: Precise action in log ("task completed" vs "entry updated")
- **No Migration**: Adding new entry types doesn't change existing events
- **Easier Projections**: Pattern match on specific event types
- **Better Tooling**: TypeScript narrows types automatically

### Consequences
**Positive:**
- Explicit, type-safe event schemas
- Clear intent in event log
- No breaking changes when adding new types
- Excellent TypeScript autocomplete

**Negative:**
- More event type definitions (acceptable)
- Some code duplication (mitigated with shared helpers)

### SOLID Principles
- **Single Responsibility**: Each event represents one specific action
- **Open/Closed**: Add new entry types without modifying existing events
- **Liskov Substitution**: All events conform to base Event interface

---

## ADR-005: Discriminated Union for Entry Types

**Date**: 2026-01-25  
**Status**: Accepted

### Context
UI needs to render three entry types with different:
- Bullet symbols: ☐ (task), - (note), ○ (event)
- Fields: Tasks have status, Notes have content, Events have dates
- Behaviors: Only tasks complete, only events have optional dates

### Decision
Use discriminated unions with type narrowing:

```typescript
type Entry = 
  | (Task & { type: 'task' })
  | (Note & { type: 'note' })
  | (Event & { type: 'event' })
```

TypeScript narrows types automatically:
```typescript
if (entry.type === 'task') {
  // TypeScript knows: entry.status and entry.title exist
}
```

### Rationale
- **Type Safety**: TypeScript narrows types based on discriminant
- **Single List**: Render all entry types in unified timeline
- **Compile-Time Checks**: Impossible to access wrong fields
- **Pattern Matching**: Clean switch/if statements

**Alternatives Rejected:**
- Separate lists: Loses unified timeline
- Type casting: Unsafe, defeats TypeScript
- Dynamic property access: No type checking

### Consequences
**Positive:**
- Type-safe polymorphism, zero runtime overhead
- Clean, readable component code
- Perfect autocomplete in VSCode
- Safe refactoring (TypeScript catches errors)

**Negative:**
- Requires understanding discriminated unions
- Must handle all cases in switches (TypeScript enforces)

### SOLID Principles
- **Open/Closed**: Adding new entry types extends the union
- **Liskov Substitution**: All entries treated uniformly where appropriate

---

## ADR-006: Reactive Projections with Event Subscriptions

**Date**: 2026-01-25  
**Status**: Accepted

### Context
UI needs to update automatically when events are appended. Options:
1. Manual reload after each command
2. Polling projections periodically
3. Event store subscriptions (reactive)

### Decision
Implement reactive projections via event store subscriptions:

```typescript
class EventStore {
  private subscribers = new Set<(event: DomainEvent) => void>();

  subscribe(callback: (event: DomainEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async append(event: DomainEvent): Promise<void> {
    // ... append logic ...
    this.notifySubscribers(event);
  }
}

class EntryListProjection {
  constructor(private eventStore: IEventStore) {
    this.eventStore.subscribe(() => {
      this.notifySubscribers(); // Tell UI to reload
    });
  }
}
```

### Rationale
- **Automatic Updates**: UI updates immediately after events
- **No Manual Coordination**: Don't need to remember to reload
- **Proper Event Sourcing**: Follows reactive event-driven pattern
- **Testable**: Can verify subscriptions work correctly

**Alternatives Rejected:**
- Manual reload: Fragile, easy to forget
- Polling: Inefficient, delays updates

### Consequences
**Positive:**
- UI always reflects current state
- No manual reload code needed
- Follows reactive programming patterns
- Works offline (subscriptions still fire)

**Negative:**
- Slightly more complex event store implementation
- Need to manage subscriptions properly (cleanup)

### SOLID Principles
- **Single Responsibility**: Event store handles events, projections handle state
- **Open/Closed**: Add new subscribers without modifying event store

---

## ADR-007: Daily Logs View (Date-Grouped Entries)

**Date**: 2026-01-25  
**Status**: Accepted

### Context
Bullet journal paradigm groups entries by creation date (daily logs), not by type or completion status.

### Decision
Primary view groups entries by **local creation date** (YYYY-MM-DD):
- Sort days newest first (today at top)
- Sort entries within day by creation order
- Progressive loading: 7 days at a time
- Drag-drop only within same day (prevents accidental date changes)

### Rationale
- **Authentic BuJo**: Matches bullet journal daily log paradigm
- **Chronological Context**: See what you were working on each day
- **Natural Workflow**: Add entries to "today" section
- **Performance**: Progressive loading handles large datasets

### Consequences
**Positive:**
- Matches bullet journal methodology
- Provides temporal context
- Prevents overwhelming UI with all entries
- Drag-drop constraints prevent mistakes

**Negative:**
- More complex than flat list
- Timezone considerations for date grouping

### SOLID Principles
- **Single Responsibility**: DailyLogsView handles grouping, DaySection handles one day
- **Open/Closed**: Can add new grouping strategies without changing projection

---

## Future Considerations

Potential future ADRs:
- Event schema versioning strategy
- Conflict resolution for multi-device sync
- Backend event store schema (PostgreSQL)
- Authentication flow with Google OAuth
- Collections (monthly log, future log, custom)

---

*Architecture decisions are revisited as we learn. Status may change to Deprecated or Superseded.*
