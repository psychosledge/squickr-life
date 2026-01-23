# Architecture Decision Records (ADRs)

This document tracks architectural decisions made by **Architecture Alex** throughout the Squickr Life project.

## Format

Each decision follows this structure:
- **Date**: When the decision was made
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: What problem are we solving?
- **Decision**: What did we decide?
- **Consequences**: Trade-offs and implications
- **SOLID Principle**: Which principle(s) does this support?

---

## ADR-001: Monorepo with pnpm Workspaces

**Date**: 2026-01-22  
**Status**: Accepted  
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

---

## ADR-002: Event Sourcing with CQRS

**Date**: 2026-01-22  
**Status**: Accepted  
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

---

## ADR-003: IndexedDB for Local Event Store

**Date**: 2026-01-22  
**Status**: Accepted  
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
