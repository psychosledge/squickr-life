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

## ADR-008: Collections for Entry Grouping

**Date**: 2026-01-28  
**Status**: Accepted

### Context
Bullet journal methodology uses different collection types beyond daily logs:
- **Monthly Log**: Month-level tasks/events
- **Future Log**: Long-term planning (6-12 months)
- **Custom Collections**: Project trackers, habit trackers, etc.

Users need ability to organize entries into these logical groupings.

### Decision
Implement Collection domain aggregate with event sourcing:
- Collections as first-class aggregates (separate from entries)
- Events: `CollectionCreated`, `CollectionRenamed`, `CollectionDeleted`
- Entry events extended with `collectionId?: string` field
- Migration events: `EntryMovedToCollection`, `EntryRemovedFromCollection`
- Built-in collections: Daily, Monthly, Future
- User-created custom collections

### Rationale
- **BuJo Authenticity**: Matches bullet journal methodology
- **Flexible Organization**: Users organize entries beyond daily logs
- **Migration Support**: Move entries between collections (e.g., monthly task → daily)
- **Immutable Events**: Migrations create new events, preserving audit trail
- **Open for Extension**: Users create custom collections for any purpose

### Consequences
**Positive:**
- Complete bullet journal workflow support
- Flexible entry organization
- Migration history preserved in event log
- Custom collections enable habit tracking, project management, etc.

**Negative:**
- Additional complexity beyond daily logs
- Need to handle orphaned entries (deleted collection)
- Migration events add to event log size

**Implementation Notes:**
- Default collection: "Daily" (all entries without explicit collection)
- Orphaned entries revert to Daily collection
- Collections projection maintains collection list
- EntryList projection filters by collectionId

### SOLID Principles
- **Single Responsibility**: Collection aggregate manages collection lifecycle
- **Open/Closed**: Add collection types without modifying core domain
- **Dependency Inversion**: UI depends on Collection abstraction

---

## ADR-009: Bullet Journal Icon System

**Date**: 2026-01-29  
**Status**: Accepted

### Context
Bullet journal methodology uses symbols (bullets) to distinguish entry types and states:
- Tasks: • (incomplete), × (complete), > (migrated), – (irrelevant)
- Notes: – (dash)
- Events: ○ (circle)

Users familiar with BuJo expect these visual indicators.

### Decision
Implement dynamic icon system that maps entry type + state to BuJo symbols:
- Task incomplete: • (bullet)
- Task complete: × (cross)
- Task migrated: > (arrow)
- Task cancelled: – (dash)
- Note: – (dash)
- Event: ○ (circle)

Icons rendered via `getBulletIcon(entry)` helper function using discriminated union type narrowing.

### Rationale
- **Visual Recognition**: Symbols provide instant entry type/state recognition
- **BuJo Standard**: Matches physical bullet journal conventions
- **Type-Safe Mapping**: TypeScript ensures all entry types handled
- **Simple Implementation**: Pure function, no state needed

### Consequences
**Positive:**
- Authentic bullet journal experience
- Instant visual scanning (no need to read text)
- Type-safe exhaustive checking
- Accessibility: Icons have ARIA labels

**Negative:**
- Symbols may be unfamiliar to non-BuJo users (mitigated: tooltip/legend)
- Icon unicode may render differently across platforms (tested: consistent in modern browsers)

### SOLID Principles
- **Single Responsibility**: Icon mapping separated from rendering logic
- **Open/Closed**: Add new entry states without modifying existing mappings

---

## ADR-010: Firebase Backend Sync for Multi-Device Access

**Date**: 2026-01-30  
**Status**: Accepted (Approved by Architecture Alex)

### Context
User's data is currently locked to single browser's IndexedDB storage:
- Cannot access data from different devices (mobile vs desktop)
- No cloud backup (data loss if browser storage cleared)
- Cannot sync data between old Netlify deployment and new squickr.com deployment

User requirements:
- Access data across devices (primarily mobile, occasionally desktop)
- Full offline editing (sync when connection available)
- Eventual consistency (don't need real-time, every 5 min is fine)
- Personal use only (no collaboration features)
- Simple Google OAuth login

### Decision
Implement cloud synchronization using **Firebase Firestore + Google Authentication**:

**Architecture:**
- Firestore stores canonical event log in `/users/{userId}/events/{eventId}` structure
- Google OAuth for authentication (sign in with Google account)
- Periodic sync: On app launch + every 5 minutes + on network reconnect
- Eventual consistency (not real-time)
- Last-write-wins conflict resolution (timestamp-based)
- IndexedDB remains primary storage (offline-first preserved)
- Bidirectional sync: Upload local events, download remote events

**Sync Flow:**
1. User signs in with Google (OAuth)
2. Upload: Push local IndexedDB events not yet in Firestore
3. Download: Pull remote Firestore events not yet in IndexedDB
4. Conflict resolution: Latest timestamp wins for same aggregate
5. Update `lastSyncTimestamp` in localStorage
6. Trigger projection rebuild (UI updates)

**First-Login Flow:**
- Auto-upload all local data to Firestore (silent merge)
- Download any existing remote data
- User sees unified dataset across devices

### Rationale

**Why Firebase:**
- **Offline-first SDK**: Firestore SDK handles sync complexity, caching, retry logic
- **Google OAuth built-in**: Native integration, 3 lines of setup
- **Generous free tier**: 1GB storage, 50k reads/day, 20k writes/day (personal use <1%)
- **NoSQL flexibility**: Matches event sourcing append-only pattern
- **Production-ready**: Used by millions of apps, battle-tested
- **Fastest implementation**: 18-27 hours vs 30+ for Supabase

**Why not Supabase:**
- Requires custom sync logic (no offline-first SDK)
- PostgreSQL adds complexity for simple event log storage
- Longer implementation time (30+ hours)
- Still acceptable alternative for future migration

**Why not Cloudflare D1:**
- Very limited free tier (5GB reads/day total, not per-project)
- Immature platform (beta), no offline SDK
- Would require custom sync implementation

**Why Last-Write-Wins conflict resolution:**
- Single user, one device at a time (primary use case)
- Simple, predictable behavior
- Events are immutable (conflicts rare, only for same aggregate edited offline on multiple devices)
- Can upgrade to operational transforms (OT) or CRDTs later if collaboration needed

**Why eventual consistency:**
- User doesn't need real-time sync (only one user, occasional multi-device)
- Simpler implementation, better battery life
- Can add real-time via Firestore `onSnapshot` if needed later

### Consequences

**Positive:**
- ✅ Multi-device data access (solve user's primary problem)
- ✅ Cloud backup (disaster recovery)
- ✅ Enables migration from old Netlify site to squickr.com
- ✅ Offline-first preserved (IndexedDB still works standalone)
- ✅ No breaking changes (sync is additive feature)
- ✅ All 553 tests continue passing (event sourcing unchanged)
- ✅ Simple UX (sign in with Google, data syncs automatically)

**Negative:**
- ❌ Vendor lock-in to Google Cloud Platform
  - *Mitigation*: `IEventStore` abstraction allows swapping implementation
  - *Mitigation*: Events stored in standard JSON (exportable)
- ❌ Network dependency for sync (offline edits queue until online)
  - *Mitigation*: IndexedDB works fully offline, sync happens when available
- ❌ Potential sync conflicts (rare: only if editing same item on multiple devices while offline)
  - *Mitigation*: Last-write-wins is predictable, events preserved in audit trail
- ❌ Additional complexity (authentication, sync logic, error handling)
  - *Mitigation*: Firebase SDK handles most complexity
  - *Mitigation*: 10-phase implementation plan with testing at each phase

**Security:**
- Firestore security rules enforce userId ownership (users can only access their own events)
- Google OAuth handled by Firebase (industry-standard security)
- No password storage (delegated to Google)

**Performance:**
- Sync on 5-minute interval (configurable)
- Incremental sync (only new events since last sync)
- IndexedDB read/write remains fast (local-first)
- Network calls batched (upload all pending, download all new)

**Migration Path:**
1. User signs into old Netlify site → Data uploads to Firestore
2. User signs into squickr.com → Data downloads from Firestore
3. User's data now accessible on both sites
4. Can safely delete old Netlify deployment

### Architectural Refinements (from Alex Review)

1. **Improved Firestore Security Rules** - Prevent event ID/userId spoofing
2. **Fix Race Condition** - Only mark actually-uploaded events as synced
3. **Batch Append Support** - Avoid rebuilding projections N times when downloading N events
4. **Sync State in React Context** - Components access sync status for UI
5. **Event Schema Version Validation** - Prevent appending wrong-version events
6. **Sync Telemetry** - Log upload/download counts for debugging

### Implementation Plan

**10-Phase Rollout** (18-27 hour estimate):
1. Firebase project setup (user creates project, enables Auth/Firestore)
2. Install dependencies (`firebase` package)
3. Authentication UI (sign in/sign out, AuthContext, AuthGuard)
4. Upload sync (push local events to Firestore)
5. Download sync (pull remote events to IndexedDB)
6. Bidirectional sync (upload + download combined)
7. Offline support (queue, retry, exponential backoff)
8. Migration path (first-login auto-upload)
9. Testing & polish (error states, loading states, telemetry)
10. Security validation (Firestore rules, auth flow)

### SOLID Principles

- **Single Responsibility**: 
  - `FirestoreEventStore` handles cloud persistence
  - `IndexedDBEventStore` handles local persistence
  - `SyncManager` orchestrates bidirectional sync
  - Each component has one clear purpose

- **Open/Closed**: 
  - `IEventStore` interface allows adding Firebase without modifying IndexedDB implementation
  - Can add Supabase/PostgreSQL later by implementing same interface
  - UI components unaware of sync mechanism (depend on abstraction)

- **Liskov Substitution**: 
  - `FirestoreEventStore` and `IndexedDBEventStore` both implement `IEventStore`
  - Can swap implementations without breaking code

- **Interface Segregation**: 
  - `IEventStore` defines only append/getEvents methods
  - Sync logic separated into `SyncManager` (not part of store interface)

- **Dependency Inversion**: 
  - UI depends on `IEventStore` abstraction, not concrete Firebase/IndexedDB
  - Projections depend on event abstractions, not storage implementation
  - Can test with in-memory store, use IndexedDB in dev, Firebase in prod

### Future Considerations

- **Real-time sync**: Add Firestore `onSnapshot` for live updates if needed
- **Collaboration**: If multi-user needed, upgrade to operational transforms or CRDTs
- **Event compaction**: Snapshot aggregates periodically to reduce event log size
- **Migration to Supabase**: If vendor lock-in becomes concern, implement PostgreSQL store

---

## Future Considerations

Potential future ADRs:
- Event schema versioning strategy
- Event compaction/snapshotting for performance
- Real-time collaboration conflict resolution
- Migration from Firebase to self-hosted backend

---

*Architecture decisions are revisited as we learn. Status may change to Deprecated or Superseded.*
