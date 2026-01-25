# Architecture Decision Records (ADRs)

This document tracks architectural decisions made by **Architecture Alex** throughout the Squickr Life project.

## Format

Each decision follows this structure:
- **Date**: When the decision was made
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Implementation**: ✅ Complete | ⚠️ Partial | 📋 Planned | ⏸️ Deferred | ❌ Abandoned
- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Consequences**: Trade-offs and implications
- **SOLID Principle**: Which principle(s) does this support?

---

## ADR-001: Monorepo with pnpm Workspaces

**Date**: 2026-01-22  
**Status**: Accepted  
**Implementation**: ✅ Complete  
**Decision By**: Architecture Alex

### Context
We need to organize code for a multi-package project (client, shared types, backend). Options include:
- Separate repositories for each package
- Monorepo with npm/yarn/pnpm workspaces
- Single package with manual linking

### Decision
Use a monorepo structure with pnpm workspaces containing three packages:
- `packages/client` - React PWA
- `packages/shared` - TypeScript types and interfaces
- `packages/backend` - Supabase functions (future)

### Rationale
- **Type Safety**: Shared types ensure client and backend use identical event schemas
- **Atomic Changes**: Event schema changes can update client and backend in single commit
- **pnpm Benefits**: Strict dependency management prevents phantom dependencies
- **Development Speed**: No need to publish/install shared package during development

### Consequences
**Positive:**
- Type-safe contract between client and backend
- Single `pnpm install` for entire project
- Easier refactoring across packages
- Simplified CI/CD pipeline

**Negative:**
- Slightly more complex initial setup
- All packages version together (acceptable for this project)
- Need to learn pnpm workspace commands

### SOLID Principles
- **Single Responsibility**: Each package has one clear purpose
- **Dependency Inversion**: Packages depend on abstractions in `shared`, not concrete implementations

### Implementation Notes
**Completed:**
- Monorepo set up with pnpm workspaces
- `packages/client` - React PWA with Vite
- `packages/shared` - Event sourcing domain logic and types
- Workspace dependencies configured correctly

**Files:**
- `pnpm-workspace.yaml` - Workspace configuration
- `packages/shared/package.json` - Shared package config
- `packages/client/package.json` - Client package config

---

## ADR-002: Event Sourcing with CQRS

**Date**: 2026-01-22  
**Status**: Accepted  
**Implementation**: ✅ Complete (Domain Layer) | ⚠️ Partial (UI Layer)  
**Decision By**: Architecture Alex

### Context
Need to choose state management and persistence architecture for task tracking.

### Decision
Implement full event sourcing with CQRS pattern:
- **Write side**: Commands → Events → Event Store
- **Read side**: Events → Projections (read models)
- All state changes captured as immutable events
- Projections rebuild from event replay

### Rationale
- **Learning Goal**: Primary objective is to master event sourcing
- **Offline-First**: Event log naturally supports offline queueing
- **Audit Trail**: Complete history of all task changes
- **Time Travel**: Can replay events to any point in time
- **Sync-Friendly**: Events are easy to merge across devices

### Consequences
**Positive:**
- Complete audit trail of all actions
- Natural support for undo/redo
- Offline changes become queued events
- State can be reconstructed at any point
- Testing is easier (test events, not state mutations)

**Negative:**
- More complex than simple CRUD
- Storage grows with events (mitigated: events are small)
- Need to design events carefully (they're immutable)
- Learning curve for event-sourced thinking

### SOLID Principles
- **Single Responsibility**: Commands, events, and projections have separate concerns
- **Open/Closed**: Add new projections without modifying event store
- **Liskov Substitution**: All events share base Event interface
- **Interface Segregation**: Commands, queries, and events are separate contracts
- **Dependency Inversion**: Projections depend on event abstractions

### Implementation Notes
**Completed (Domain Layer):**
- Event store with append-only log: `packages/shared/src/event-store.ts`
- Command handlers for Task, Note, Event: `packages/shared/src/*.handlers.ts`
- Unified projection for all entry types: `packages/shared/src/entry-list.projection.ts`
- Comprehensive test coverage: 188 tests passing

**Partial (UI Layer):**
- Task UI implemented with event sourcing
- Note and Event UI not yet implemented
- UI currently only handles task-related commands

**Files:**
- `packages/shared/src/event-store.ts` - Core event store
- `packages/shared/src/task.handlers.ts` - Task command handlers
- `packages/shared/src/note.handlers.ts` - Note command handlers
- `packages/shared/src/event.handlers.ts` - Event command handlers
- `packages/shared/src/entry-list.projection.ts` - Unified read model
- `packages/shared/tests/*.test.ts` - Comprehensive test suite

---

## ADR-003: IndexedDB for Local Event Store

**Date**: 2026-01-22  
**Status**: Accepted  
**Implementation**: ⏸️ Deferred (Using localStorage temporarily)  
**Decision By**: Architecture Alex

### Context
Need to persist events locally in the browser for offline-first PWA.

### Decision
Use IndexedDB as the local event store persistence layer.

### Rationale
- **Browser Native**: No additional dependencies
- **Large Storage**: Typically 50MB+ available (far more than localStorage)
- **Structured Data**: Can index by aggregate ID, timestamp, event type
- **Async API**: Non-blocking reads/writes
- **PWA Standard**: Recommended for offline-first applications

**Alternatives Considered:**
- **localStorage**: Too small (5-10MB), synchronous, no indexing
- **WebSQL**: Deprecated
- **File System Access API**: Not widely supported, requires permissions

### Consequences
**Positive:**
- No external dependencies
- Works in all modern browsers
- Can efficiently query events by various criteria
- Supports transactions for consistency

**Negative:**
- Slightly more complex API than localStorage
- Need to handle browser storage quota
- Incognito/private mode has limited storage

### SOLID Principles
- **Dependency Inversion**: EventStore depends on IStorageAdapter interface, IndexedDB is one implementation

### Implementation Notes
**Deferred:**
- Currently using localStorage for faster initial development
- localStorage implementation in `packages/shared/src/event-store.ts`
- Plan to migrate to IndexedDB when storage needs grow
- Event store is abstracted - migration will be straightforward

**Current Implementation:**
- EventStore class uses localStorage with key `'squickr-life-events'`
- Events serialized to JSON
- Load on initialization, save after each append
- Works for MVP, sufficient for ~1000 events

**Future Migration:**
- Create IndexedDBStorageAdapter implementing same interface
- Swap in EventStore constructor
- Add migration script to move localStorage data to IndexedDB

---

## ADR-004: Separate Events per Aggregate Type

**Date**: 2026-01-25  
**Status**: Accepted  
**Implementation**: ✅ Complete  
**Decision By**: Architecture Alex (via OpenCode session review)

### Context
Need to decide event schema for entry types (Task, Note, Event). Two approaches:
1. **Generic events**: Single `EntryCreated` event with discriminated type field
2. **Specific events**: Separate `TaskCreated`, `NoteCreated`, `EventCreated` events

### Decision
Use separate event types per aggregate:
- `TaskCreated`, `TaskUpdated`, `TaskCompleted`, `TaskReopened`, `TaskReordered`
- `NoteCreated`, `NoteUpdated`, `NoteReordered`
- `EventCreated`, `EventUpdated`, `EventReordered`

### Rationale
- **Type Safety**: Each event has exact fields for its aggregate
- **Clear Audit Trail**: Event log shows precise action ("task completed" vs "entry updated")
- **No Migration Needed**: Adding new entry types doesn't require changing existing events
- **Easier Projections**: Projection handlers can pattern match on specific event types
- **Better Tooling**: TypeScript narrows event types automatically

**Alternatives Considered:**
- **Generic EntryCreated**: Would lose type information, harder to query audit trail
- **Hybrid Approach**: Some generic, some specific - inconsistent and confusing

### Consequences
**Positive:**
- Explicit, type-safe event schemas
- Clear intent in event log
- No breaking changes when adding new entry types
- TypeScript provides excellent autocomplete and error checking

**Negative:**
- More event type definitions (acceptable tradeoff)
- Some code duplication in event handling (mitigated with shared validation helpers)

### SOLID Principles
- **Single Responsibility**: Each event represents one specific action on one aggregate type
- **Open/Closed**: Can add new entry types without modifying existing event types
- **Liskov Substitution**: All events conform to base Event interface

### Implementation Notes
**Completed:**
- Event types defined in `packages/shared/src/task.types.ts`
- Handlers for all three entry types: Task, Note, Event
- Shared validation helpers in `packages/shared/src/content-validation.ts`
- 188 tests covering all event types

**Files:**
- `packages/shared/src/task.types.ts` - All event and command type definitions
- `packages/shared/src/task.handlers.ts` - Task-specific handlers
- `packages/shared/src/note.handlers.ts` - Note-specific handlers
- `packages/shared/src/event.handlers.ts` - Event-specific handlers
- `packages/shared/src/content-validation.ts` - Shared validation helpers

---

## ADR-005: Discriminated Union for Entry Types in UI

**Date**: 2026-01-25  
**Status**: Accepted  
**Implementation**: 📋 Planned  
**Decision By**: Architecture Alex (via OpenCode session review)

### Context
UI needs to render three entry types (Task, Note, Event) with different:
- Bullet symbols: ☐ (task), - (note), ○ (event)
- Fields: Tasks have status/title, Notes have content, Events have content/date
- Behaviors: Only tasks can be completed, only events have optional dates

Need type-safe way to handle polymorphism in React components.

### Decision
Use discriminated unions with type narrowing:

```typescript
type Entry = 
  | (Task & { type: 'task' })
  | (Note & { type: 'note' })
  | (Event & { type: 'event' })
```

Then use TypeScript's type narrowing in components:

```typescript
if (entry.type === 'task') {
  // TypeScript knows: entry.status and entry.title exist
}
```

### Rationale
- **Type Safety**: TypeScript narrows types based on discriminant
- **Single List**: Can render all entry types in one unified list
- **Compile-Time Checks**: Impossible to access wrong fields (e.g., `note.status`)
- **Pattern Matching**: Clean switch/if statements for rendering

**Alternatives Considered:**
- **Separate Lists**: Three separate Task/Note/Event lists - loses unified timeline
- **Type Casting**: Manual `as` casts - unsafe, defeats TypeScript benefits
- **Dynamic Property Access**: `entry['status']` - no type checking

### Consequences
**Positive:**
- Type-safe polymorphism with zero runtime overhead
- Clean, readable component code
- Autocomplete works perfectly in VSCode
- Refactoring is safe (TypeScript catches errors)

**Negative:**
- Requires understanding discriminated unions
- Need to handle all cases in switches (TypeScript enforces this)

### SOLID Principles
- **Open/Closed**: Adding new entry types requires only extending the union
- **Liskov Substitution**: All entries can be treated uniformly where appropriate

### Implementation Notes
**Planned:**
- Update `TaskInput.tsx` → `EntryInput.tsx` with type selector
- Update `TaskItem.tsx` → `EntryItem.tsx` with bullet/field rendering
- Update `TaskList.tsx` → `EntryList.tsx` to handle all entry types
- Add filtering UI for entry types

**Files to Update:**
- `packages/client/src/components/EntryInput.tsx` (rename from TaskInput)
- `packages/client/src/components/EntryItem.tsx` (rename from TaskItem)
- `packages/client/src/components/EntryList.tsx` (rename from TaskList)
- `packages/client/src/App.tsx` - Wire up Note and Event handlers

---

## Future ADRs

### Upcoming Decisions
- Frontend component architecture (React patterns)
- Event schema versioning strategy
- Conflict resolution for multi-device sync
- Backend event store schema (PostgreSQL)
- Authentication flow with Google OAuth

---

*Architecture decisions are revisited as we learn more. Status may change to Deprecated or Superseded.*
