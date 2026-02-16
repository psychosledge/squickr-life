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
- `packages/domain` - Pure business logic, event sourcing, types (Clean Architecture core)
- `packages/infrastructure` - EventStore implementations (IndexedDB, InMemory)
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

## ADR-011: Hierarchical Collection Architecture with Virtual Hierarchy

**Date**: 2026-02-01  
**Status**: Accepted

### Context

User wants to organize collections in a hierarchical folder structure aligned with Bullet Journal methodology to solve the navigation problem as collection count grows:

```
★ App Ideas                      ← Pinned custom collection
★ Home Projects                  ← Pinned custom collection
▼ 2026 Logs                      ← Virtual year node
  ▼ February                     ← Virtual month node
    • Saturday, February 1       ← Daily log collection
    • Friday, January 31         ← Daily log collection
  ▶ January (31 logs)            ← Collapsed month
▶ 2025 Logs (365 logs)           ← Collapsed year
  Work Projects                  ← Non-pinned custom collection
```

**Requirements:**
1. Hierarchical presentation of date-based collections (year → month → day)
2. Smart navigation - Auto-expand current year/month, prioritize today + favorites
3. Migration filtering - Show today + pinned + yesterday by default
4. BuJo workflow support - Easy yesterday→today migration
5. Type system - Distinguish temporal (daily) from topical (custom) collections
6. No future log concept - Year nodes replace traditional BuJo future log
7. Immutable types - Collection type cannot change after creation

**Architectural Choice: Virtual vs Real Hierarchy**

**Option A: Virtual Hierarchy** (CHOSEN ✅)
- Collections remain flat in data model
- Hierarchy derived from `type` and `date` fields in UI layer
- Year/month are presentation-only nodes (not stored collections)

**Option B: Real Hierarchy** (REJECTED ❌)
- Year/month are actual collections with IDs
- Daily logs have `parentId` pointing to month
- Cascade deletes, orphaned nodes, complex event sourcing

### Decision

**Implement virtual hierarchy** using `type` and `date` fields to derive hierarchical presentation in UI layer.

**Data Model:**

```typescript
export type CollectionType = 
  | 'yearly'   // Reserved for future use
  | 'monthly'  // Reserved for future use
  | 'daily'    // Actual daily log (e.g., "Saturday, February 1")
  | 'custom';  // User-defined topical collection

export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly type: CollectionType;
  readonly order: string;
  readonly date?: string;           // ISO format (YYYY-MM-DD for daily)
  readonly isFavorite?: boolean;    // Pin topical collections
  readonly lastAccessedAt?: string; // Smart sorting
  readonly createdAt: string;
  readonly deletedAt?: string;
  readonly userId?: string;
  readonly settings?: CollectionSettings;
}
```

**New Events:**

```typescript
// Extend CollectionCreated with date field
CollectionCreated { 
  payload: { 
    date?: string; // ISO date for temporal collections 
  } 
}

// Favorite/unfavorite custom collections
CollectionFavorited { collectionId, favoritedAt }
CollectionUnfavorited { collectionId, unfavoritedAt }

// Track access for smart sorting
CollectionAccessed { collectionId, accessedAt }
```

**Hierarchy Building:**

UI builds tree from flat collections by grouping daily logs by year/month extracted from `date` field:
- Year nodes: Group by `date.substring(0, 4)` → "2026 Logs"
- Month nodes: Group by `date.substring(0, 7)` → "February"
- Day nodes: Actual collections with `type: 'daily'` → "Saturday, February 1"

**Display Order:**
1. Pinned custom collections (★)
2. Temporal hierarchy (current year/month auto-expanded)
3. Non-pinned custom collections

**Migration Modal Filtering:**
- Default view: Today's log + Pinned customs + Yesterday's log
- "Show all collections" expands to full hierarchical list
- Year/month nodes not selectable (can't migrate to a month)

**Daily Log Auto-Generation:**
- User selects date via date picker
- System auto-generates name: "Saturday, February 1" from date "2026-02-01"
- Names are immutable (derived from date)

**Schema Migration Strategy:**

Existing collections with old types (`'log'`, `'tracker'`) are automatically interpreted as `'custom'` by the projection:

```typescript
private mapCollectionType(rawType: string): CollectionType {
  switch (rawType) {
    case 'log':
    case 'tracker':
      return 'custom'; // Old schema → map to custom
    case 'yearly':
    case 'monthly':
    case 'daily':
    case 'custom':
      return rawType as CollectionType; // New schema → pass through
    default:
      return 'custom'; // Unknown → default to custom
  }
}
```

**Rationale:** Events are immutable facts. Old `CollectionCreated` events with `type: 'log'` remain valid. The projection interprets them as `type: 'custom'` for current requirements. This follows event sourcing best practices (event upcasting in projections, not event mutation).

### Rationale

**Why Virtual Hierarchy:**
- **Event sourcing alignment** - Collections remain independent aggregates (no parent/child dependencies)
- **No cascade deletes** - Year/month are UI concepts, not data entities
- **Simple querying** - Filter by date field, no recursive traversal
- **Flexible presentation** - Can reorganize hierarchy without data migration
- **Fewer events** - No `YearCreated`, `MonthCreated` needed
- **No orphaned collections** - Year/month derived from existing daily logs

**Why Type System:**
- **Separates temporal from topical** - Daily logs (date-based) vs custom collections (user interest)
- **Enables smart sorting** - Daily logs by date, customs by favorites + access
- **Aligns with BuJo methodology** - Daily logs for planning, customs for projects

**Why No Future Log:**
- User's workflow focuses on daily + custom collections
- Year nodes serve as organizational containers (replace future log concept)
- Can add future log type later if needed

### Consequences

**Positive:**
- ✅ Solves navigation problem immediately with smart sorting + hierarchy
- ✅ Event sourcing friendly (no complex relationships)
- ✅ Flexible presentation (reorganize UI without data migration)
- ✅ No cascade deletes (deleting "year" is just UI filtering)
- ✅ Future-proof (can add real `parentId` later)
- ✅ BuJo workflow support (hierarchical view matches physical journal)
- ✅ Smart migration modal (shows contextually relevant collections)
- ✅ Simple querying (`getDailyLog(date)` is a filter)

**Negative:**
- ❌ UI complexity (need tree view component with expand/collapse)
- ❌ Slight performance cost (building hierarchy on render, mitigated with `useMemo`)
- ❌ Fixed hierarchy (can't nest custom collections)
- ❌ Name auto-generation (user can't customize daily log names)

**Trade-offs:**
- **Immutable types** - Prevents confusion but requires creating new collection + migrating entries to change organization
- **No monthly/yearly creation** - Phase 1 only supports daily logs; monthly/yearly reserved for future
- **Virtual hierarchy limitations** - Year/month nodes not navigable (can't view "all entries in February"); acceptable for Phase 1

### SOLID Principles

- **Single Responsibility**: `CollectionProjection` handles querying, `buildHierarchy()` handles UI construction
- **Open/Closed**: Can add new hierarchy types without modifying existing code
- **Dependency Inversion**: UI depends on `HierarchyNode` abstraction, not concrete structure

### Implementation Plan

**Phase 1: Collection Types + Hierarchical Navigation** (~5 hours, one session)

**Phase 1A: Types + Date Fields** (1.5 hours)
- Add `date`, `isFavorite`, `lastAccessedAt` fields
- Add collection types: `yearly`, `monthly`, `daily`, `custom`
- Update events and projection with schema migration logic
- Tests for date validation and type mapping
- **Commit:** "feat: add collection types and date fields for hierarchical organization"

**Phase 1B: Favorites + Access Tracking** (1 hour)
- Implement favorite/unfavorite handlers
- Track last access on navigation
- Add "Favorite" toggle to collection menu
- Tests for favorites and access tracking
- **Commit:** "feat: add collection favorites and access tracking"

**Phase 1C: Hierarchical UI** (2 hours)
- New components: `HierarchicalCollectionList`, tree nodes
- New hook: `useCollectionHierarchy`
- Auto-expand current year/month
- Persist expand state in localStorage
- Tests for hierarchy building and rendering
- **Commit:** "feat: implement hierarchical collection list view"

**Phase 1D: Migration Modal Filtering** (0.5 hours)
- Update modal with filtered default view
- "Show all collections" expansion
- Tests for filtering logic
- **Commit:** "feat: add smart collection filtering to migration modal"

### Future Enhancements

- **Phase 2**: Date-based collection creation (date picker, auto-generate names)
- **Phase 3**: Calendar navigation UI (calendar widget, jump to date)
- **Phase 4**: Virtual yesterday→today migration (bulk migration banner)
- **Phase 5**: Google Calendar integration (export to GCal, agenda view)

---

## ADR-012: Firebase Clean Architecture Refactoring (Domain/Infrastructure Split)

**Date**: 2026-02-07  
**Status**: Accepted

### Context

After implementing Firebase sync (ADR-010), all Firebase-related code lived in the client package:
- `packages/client/src/firebase/config.ts` - Firebase initialization
- `packages/client/src/firebase/auth.ts` - Google authentication  
- `packages/client/src/firebase/SyncManager.ts` - Sync orchestration
- `packages/client/src/firebase/syncEvents.ts` - Firestore upload/download logic

This created architectural issues:
1. **Violated Dependency Inversion** - Client directly imported Firestore functions (not abstractions)
2. **Mixed concerns** - Cloud storage logic bundled with UI delivery mechanism
3. **Not reusable** - Future backend would duplicate all Firestore code
4. **Hard to test** - SyncManager tests required mocking Firebase SDK

Meanwhile, we had already established Clean Architecture with domain/infrastructure separation:
- `packages/domain/` - Pure business logic with `IEventStore` interface
- `packages/infrastructure/` - Storage implementations (`IndexedDBEventStore`, `InMemoryEventStore`)
- `packages/client/` - React PWA

**The question:** Should Firestore follow the same pattern?

### Decision

**Split Firebase into proper Clean Architecture layers:**

1. **Move Firestore storage to infrastructure package:**
   - Create `FirestoreEventStore` implementing `IEventStore` interface
   - Lives in `packages/infrastructure/src/firestore-event-store.ts`
   - Takes `Firestore` instance and `userId` via Dependency Injection

2. **Keep auth/config in client package:**
   - `config.ts` uses Vite environment variables (client-specific)
   - `auth.ts` uses popup-based Google sign-in (browser-specific)

3. **Refactor SyncManager to use IEventStore abstraction:**
   - Constructor: `(localStore: IEventStore, remoteStore: IEventStore)`
   - No direct Firebase SDK imports
   - Pure orchestration logic using interface methods

4. **Wire up dependencies in App.tsx:**
   ```typescript
   const localStore = new IndexedDBEventStore();
   const remoteStore = new FirestoreEventStore(firestore, user.uid);
   const syncManager = new SyncManager(localStore, remoteStore);
   ```

### Rationale

**Why move Firestore to infrastructure:**
- **Dependency Inversion Principle** - Client depends on `IEventStore` interface, not concrete Firestore
- **Liskov Substitution** - `FirestoreEventStore` is drop-in replacement for `IndexedDBEventStore`
- **Reusability** - Future Node.js backend can import same `FirestoreEventStore` (with Admin SDK)
- **Testability** - SyncManager tests use `IEventStore` mocks (no Firebase SDK needed)
- **Consistency** - Matches existing architecture (`IndexedDBEventStore` already in infrastructure)

**Why keep auth/config in client:**
- **Environment-specific** - Uses Vite's `import.meta.env` (not available in infrastructure)
- **UI-specific** - Google sign-in uses popup (browser API)
- **Not domain logic** - Authentication is delivery mechanism, not business logic

**Why refactor SyncManager:**
- **Separation of Concerns** - Orchestration (client) vs storage (infrastructure)
- **Single Responsibility** - SyncManager coordinates, EventStores persist
- **Open/Closed** - Can add new sync strategies without modifying storage implementations

### Consequences

**Positive:**
- ✅ **Perfect Clean Architecture** - All dependencies flow inward (infrastructure → domain)
- ✅ **Backend reusability** - Node.js backend can import `@squickr/infrastructure` and use same Firestore code
- ✅ **Better testability** - 16 new FirestoreEventStore tests, SyncManager tests simplified
- ✅ **No functional changes** - All 1,118 tests pass (417 domain + 16 infrastructure + 685 client)
- ✅ **Consistent architecture** - All `IEventStore` implementations in infrastructure package
- ✅ **Dependency Injection** - SyncManager receives both stores as constructor params

**Negative:**
- ⚠️ **Slightly more complex wiring** - App.tsx must instantiate both stores (acceptable trade-off)
- ⚠️ **Firebase in infrastructure** - Infrastructure now has browser-specific dependency (Firestore SDK)
  - *Mitigation*: Future backend can use Firebase Admin SDK (server-side alternative)

**Files Changed:**
- **Created**: `packages/infrastructure/src/firestore-event-store.ts` (123 lines)
- **Created**: `packages/infrastructure/src/__tests__/firestore-event-store.test.ts` (387 lines, 16 tests)
- **Modified**: `packages/infrastructure/package.json` (added `firebase@^12.8.0`)
- **Modified**: `packages/client/src/firebase/SyncManager.ts` (refactored to use `IEventStore`)
- **Modified**: `packages/client/src/App.tsx` (wiring with Dependency Injection)
- **Deleted**: `packages/client/src/firebase/syncEvents.ts` (logic moved to `FirestoreEventStore`)

**Test Results:**
- Before: 1,102 tests passing
- After: 1,118 tests passing (+16 new FirestoreEventStore tests)
- No regressions

### SOLID Principles

- ✅ **Single Responsibility**: 
  - `FirestoreEventStore` - Cloud persistence only
  - `SyncManager` - Sync orchestration only
  - Each class has one reason to change

- ✅ **Open/Closed**: 
  - Can add new `IEventStore` implementations (e.g., Supabase) without modifying existing code
  - SyncManager open for extension (can add new sync strategies)

- ✅ **Liskov Substitution**: 
  - `FirestoreEventStore`, `IndexedDBEventStore`, `InMemoryEventStore` all interchangeable
  - Any code accepting `IEventStore` works with any implementation

- ✅ **Interface Segregation**: 
  - `IEventStore` defines minimal contract (append, getAll, getById, subscribe)
  - No bloated interfaces

- ✅ **Dependency Inversion**: 
  - Client depends on `IEventStore` abstraction (domain layer)
  - Infrastructure provides concrete implementations
  - High-level modules (client) don't depend on low-level modules (Firestore SDK)

### Implementation Notes

**FirestoreEventStore specifics:**
- Uses `removeUndefined()` helper (Firestore doesn't allow undefined values)
- Document ID = event.id (prevents duplicate events automatically)
- Collection path: `users/{userId}/events`
- Implements all `IEventStore` methods (append, getAll, getById, subscribe)

**SyncManager refactoring:**
- Bidirectional sync: Upload local → remote, download remote → local
- Duplicate detection: Compare event IDs before appending
- No longer uses `uploadLocalEvents/downloadRemoteEvents` functions
- Cleaner separation between orchestration and storage

**Testing approach:**
- FirestoreEventStore tests mock Firestore SDK (unit tests)
- SyncManager tests mock `IEventStore` interface (no Firebase dependency)
- Integration testing done manually (browser + Firestore Console)

### Future Enhancements

**Optional improvements (not blockers):**
- Add generic typing to `removeUndefined<T>()` helper (currently uses `any`)
- Add Firestore-specific error messages (currently propagates SDK errors)
- Consider batch operations for large syncs (currently one-by-one)
- Extract `removeUndefined()` to shared utility if reused elsewhere

**Future backend integration:**
- Node.js backend can import `@squickr/infrastructure`
- Use Firebase Admin SDK (server-side) instead of Client SDK
- Same `FirestoreEventStore` class, different Firebase instance

---

## ADR-014: Portal-Based Menu Positioning for Entry Actions

**Date**: 2026-02-14  
**Status**: Accepted

### Context

The EntryActionsMenu component (three-dot menu on each entry) had multiple critical UX and accessibility issues:

1. **Menu coverage bug**: Long sub-task text was covering/overlapping the menu when opened
2. **Portal positioning bugs** (discovered during fix):
   - Menu appeared at top-left corner briefly before moving to correct position
   - Menu positioned incorrectly when page was scrolled (viewport vs document coordinates)
   - Sub-task menus closed immediately after opening (click-outside handler registered too early)
   - Menu stayed visible when scrolling, appearing detached from entry (confusing UX)

**Initial implementation:**
- Menu rendered inline within entry component DOM
- Absolute positioning relative to parent container
- CSS stacking context issues caused overlap with long text
- z-index conflicts with other UI elements

### Decision

**Implement portal-based rendering with fixed positioning:**

1. **React Portal rendering**:
   - Render menu in `document.body` instead of inline DOM
   - Break out of parent component's CSS stacking context
   - Use `createPortal()` from `react-dom`

2. **Fixed viewport positioning**:
   - Calculate position from button's `getBoundingClientRect()`
   - Use `position: fixed` (viewport-relative, not document-relative)
   - Do NOT add `window.scrollY/scrollX` (would double-count scroll offset)
   - Initial `menuPosition` state is `null` (only render when calculated)

3. **Deferred event listener registration**:
   - Use `setTimeout(..., 0)` to defer click-outside listener
   - Prevents opening click from immediately closing menu
   - Add `stopPropagation()` on button click for sub-task wrapper handling

4. **Scroll-to-close behavior**:
   - Add window scroll listener when menu is open
   - Use `{ capture: true, passive: true }` for performance
   - Close menu immediately when scrolling starts

5. **Proper z-index layering**:
   - Menu uses `z-[150]` (above entries, below full-page modals)
   - Entry content uses `pr-8` padding to prevent text wrapping under menu button

### Rationale

**Why React Portal:**
- **Escapes stacking context**: Parent CSS (overflow, transform, z-index) can't affect menu
- **Predictable z-index**: Menu always above page content, no cascading z-index issues
- **Accessibility**: Screen readers handle portals correctly (menu still associated with button)
- **React best practice**: Recommended pattern for modals/dropdowns

**Why fixed positioning:**
- **Viewport-relative**: Menu position stays consistent regardless of scroll
- **Simple math**: `getBoundingClientRect()` gives viewport coords directly (no offset needed)
- **No double-counting**: Adding `window.scrollY` to `getBoundingClientRect()` with `fixed` is incorrect

**Why deferred event listeners:**
- **Click event order**: Click fires → opens menu → next tick → register listener
- **Prevents immediate closure**: Opening click has already bubbled before listener exists
- **Sub-task compatibility**: DOM walking + stopPropagation handles wrapper divs

**Why scroll-to-close:**
- **UX clarity**: Menu should close when entry scrolls out of view
- **Prevents confusion**: Menu appearing at wrong position during scroll is jarring
- **Performance**: Passive listener doesn't block scrolling

**Why pr-8 padding:**
- **Text wrapping**: Prevents long titles from flowing under menu button
- **Visual balance**: Creates white space for menu button without layout shift
- **Responsive**: Works across different screen sizes

### Consequences

**Positive:**
- ✅ Menu never covered by entry text (portal rendering)
- ✅ No flash at top-left (null initial position)
- ✅ Correct positioning when scrolled (fixed, no offset double-counting)
- ✅ Sub-task menus work reliably (deferred listener + stopPropagation)
- ✅ Menu closes on scroll (better UX)
- ✅ Predictable z-index layering
- ✅ Accessible (ARIA labels, keyboard support maintained)
- ✅ All 894 client tests passing

**Negative:**
- ❌ Slightly more complex implementation (portal + position calculation)
- ❌ Menu rendered outside component tree (debugging requires understanding portals)
- ❌ Need to manage cleanup for scroll listeners
- ❌ Fixed padding on all entries (even when menu not open)

**Trade-offs:**
- **Portal complexity vs reliability**: Worth it for correct z-index behavior
- **Memory overhead**: Small (one event listener per open menu)
- **Fixed padding**: Acceptable visual trade-off for preventing text overlap

### Implementation Details

**Position Calculation:**
```typescript
const rect = buttonRef.current.getBoundingClientRect();
setMenuPosition({
  top: rect.bottom + 4,    // 4px gap below button
  left: rect.right - 160,  // Align right edge (menu width = 160px)
});
```

**Deferred Listener Registration:**
```typescript
useEffect(() => {
  if (!isOpen) return;
  
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  }, 0);
  
  return () => {
    clearTimeout(timeoutId);
    // ... remove listeners
  };
}, [isOpen]);
```

**Click-Outside Handler (Sub-task Compatible):**
```typescript
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  
  // Don't close if clicking menu
  if (menuRef.current?.contains(target)) return;
  
  // Don't close if clicking button or its parents (sub-task wrappers)
  if (buttonRef.current) {
    if (buttonRef.current.contains(target)) return;
    
    // Walk up DOM tree to check for button
    let node: Node | null = target;
    while (node) {
      if (node === buttonRef.current) return;
      node = node.parentNode;
    }
  }
  
  setIsOpen(false);
};
```

### Testing

**8 new comprehensive tests:**
1. Menu does NOT close immediately after opening
2. Menu closes when clicking outside
3. Menu closes on Escape key
4. Menu closes when scrolling window
5. Menu closes when scrolling container
6. Menu has correct z-index (`z-[150]`)
7. Menu renders in `document.body` portal
8. Sub-task menus handle wrapper divs correctly

### SOLID Principles

- **Single Responsibility**: EntryActionsMenu handles menu display only, not entry rendering
- **Open/Closed**: Portal pattern allows extending menu behavior without modifying core logic
- **Dependency Inversion**: Component depends on React Portal abstraction (not DOM manipulation)

### Files Changed

**Modified:**
- `packages/client/src/components/EntryActionsMenu.tsx` (portal + positioning + listeners)
- `packages/client/src/components/EntryActionsMenu.test.tsx` (+8 tests)
- `packages/client/src/components/TaskEntryItem.tsx` (+pr-8 padding)
- `packages/client/src/components/NoteEntryItem.tsx` (+pr-8 padding)
- `packages/client/src/components/EventEntryItem.tsx` (+pr-8 padding)

**Test Results:**
- Before: 886 client tests passing
- After: 894 client tests passing (+8 new tests)
- No regressions

---

## Future Considerations

Potential future ADRs:
- Event schema versioning strategy
- Event compaction/snapshotting for performance
- Real-time collaboration conflict resolution
- Migration from Firebase to self-hosted backend
- Backend implementation with Node.js + Firebase Admin SDK

---

## ADR-013: Bulk Migration UX - Terminology and Accessibility

**Date**: 2026-02-08  
**Status**: In Progress (Phase 1 Complete)

### Context

Users need to migrate multiple entries between collections efficiently. Two UX issues were identified:

1. **Misleading "Incomplete" terminology**: Task-specific term doesn't work for notes/events
2. **Screen flashing during bulk migration**: Rapid UI updates cause accessibility hazard (WCAG 2.1 violation)

### Decision

Implement improvements in 4 phases:

**Phase 1**: Replace "Incomplete" with "Active" terminology
- "Active" = entries without `migratedTo` pointer (not ghost entries)
- Domain-agnostic, works for tasks, notes, and events

**Phase 2**: Add batch append infrastructure to IEventStore
- New `appendBatch()` method for atomic multi-event writes
- Single projection rebuild instead of N rebuilds

**Phase 3**: Create generic `BulkMigrateEntriesHandler`
- Handles tasks, notes, and events in single handler
- Uses `appendBatch()` to eliminate screen flashing

**Phase 4**: Wire UI with loading state
- Show loading indicator for any bulk operation (>1 entry)
- Single UI update after batch completes

### Rationale

**Phase 1 (Terminology)**:
- "Active" is domain-agnostic vs. task-specific "Incomplete"
- Aligns with event sourcing terminology (active vs. migrated/archived)
- Semantically correct: active = not yet migrated away

**Phases 2-4 (Batching)**:
- **Accessibility**: Prevents rapid flashing (WCAG 2.1 compliance)
- **Performance**: One projection rebuild vs. N rebuilds
- **Event sourcing intact**: Still emit individual events (audit trail preserved)
- **Atomic operations**: IndexedDB/Firestore transactions ensure consistency

### Consequences

**Positive:**
- ✅ No screen flashing - WCAG 2.1 compliant
- ✅ Better performance (single projection rebuild)
- ✅ Domain-agnostic terminology
- ✅ Reusable batching pattern for other bulk operations
- ✅ Maintains complete audit trail (individual events)

**Negative:**
- ⚠️ Added complexity: `appendBatch()` method on all event stores
- ⚠️ Implementation effort: ~5 hours total
- ⚠️ Breaking change: External docs referencing "Incomplete" need updates

### SOLID Principles

**Single Responsibility**:
- IEventStore: Handles event persistence (batch capability added)
- BulkMigrateEntriesHandler: Coordinates bulk migration logic
- Projections: Rebuild read models (unchanged responsibility)

**Open/Closed**:
- Extended IEventStore interface without modifying existing `append()`
- New bulk handler doesn't modify individual migration handlers
- Batching pattern extensible to other operations

**Dependency Inversion**:
- UI depends on command handler abstractions
- Handlers depend on IEventStore interface (not concrete implementations)

### Implementation Status

- ✅ **Phase 1 Complete**: Terminology renamed, tests passing
- ✅ **Phase 2 Complete**: Batch append infrastructure added
- ✅ **Phase 3 Complete**: BulkMigrateEntriesHandler implemented
- ✅ **Phase 4 Complete**: UI wiring with loading state

**Status**: Complete (2026-02-15) - See ADR-015 for migration pattern evolution

---

## ADR-015: Multi-Collection Event Pattern (TaskMigrated Deprecation)

**Date**: 2026-02-15  
**Status**: Accepted

### Context

The original task migration implementation used `TaskMigrated` events that created new task IDs and lost collection history. This caused **Issue #7G**: Users couldn't see the full history of where a task had been.

**Problem Example (Issue #7G)**:
- User's "Find eye doctor" sub-task only showed 1 entry in `collectionHistory` (Today)
- Expected: 3 entries (Monthly created, Yesterday added then removed, Today added)
- Root cause: Task was MIGRATED (new ID created) instead of MOVED (ID preserved)

**Old Pattern (Deprecated)**:
```typescript
// Created NEW task with NEW ID
TaskMigrated {
  originalTaskId: "abc",
  migratedToId: "def",  // New ID!
  targetCollectionId: "today"
}
// Result: Lost full collection history
```

**Issues with TaskMigrated**:
1. **Data loss**: New task ID meant fresh `collectionHistory` (lost previous collections)
2. **Ghost rendering complexity**: `migratedTo` pointer required special handling
3. **ID proliferation**: Each migration created a new task ID
4. **Inconsistent with domain**: Tasks don't "migrate" in event sourcing, they appear/disappear from collections

### Decision

**Deprecate `TaskMigrated` events** and use multi-collection pattern instead:

**New Pattern (Multi-Collection)**:
```typescript
// Remove from current collection(s)
TaskRemovedFromCollection {
  taskId: "abc",           // SAME ID
  collectionId: "monthly",
  removedAt: "2026-02-14T10:00:00Z"
}

// Add to target collection
TaskAddedToCollection {
  taskId: "abc",           // SAME ID
  collectionId: "today",
  addedAt: "2026-02-14T10:00:00Z"
}
// Result: Full collection history preserved
```

**Task Model Evolution**:
```typescript
// OLD (deprecated)
interface Task {
  id: string;
  collectionId: string | null;     // Single collection
  migratedTo?: string;             // Pointer to new ID
  migratedToCollectionId?: string; // Where it was migrated
}

// NEW (multi-collection)
interface Task {
  id: string;
  collections: string[];           // Multiple collections
  collectionHistory: CollectionHistoryEntry[];
}

interface CollectionHistoryEntry {
  collectionId: string;
  addedAt: string;
  removedAt?: string;  // Undefined if still active
}
```

### Rationale

**Why Multi-Collection Pattern:**
- **Preserves task IDs**: Same task across all collections (no ID proliferation)
- **Full history tracking**: `collectionHistory` contains complete audit trail
- **Event sourcing alignment**: Tasks don't "migrate", they're added/removed from collections
- **Flexible semantics**: Supports both "move" (remove + add) and "add" (just add) modes
- **Ghost rendering simplicity**: Ghost = collection in history with `removedAt` timestamp
- **Domain clarity**: "Task appears on collection" is clearer mental model than "task migrates"

**Why Deprecate (Not Delete) TaskMigrated:**
- **Backward compatibility**: Existing events remain valid (event sourcing principle)
- **Projection upcasting**: Old events still handled by projections
- **Data safety**: No migration of existing event log needed
- **Graceful transition**: New code doesn't generate TaskMigrated, but reads it if present

### Consequences

**Positive:**
- ✅ **Full collection history preserved** (fixes Issue #7G)
- ✅ **Task IDs stable** across migrations
- ✅ **Multi-collection support** (task can appear on multiple collections)
- ✅ **Flexible migration modes**: Both "move" and "add" supported
- ✅ **Simpler ghost rendering**: Check `removedAt` in history
- ✅ **Event sourcing best practice**: Events describe what happened, not implementation details
- ✅ **Backward compatible**: Old TaskMigrated events still handled

**Negative:**
- ⚠️ **More events per migration**: 2 events (remove + add) vs 1 event (TaskMigrated)
- ⚠️ **Larger event log**: More events = more storage (mitigated: events are small JSON)
- ⚠️ **Legacy support burden**: Projections must handle both old and new patterns
- ⚠️ **Two handlers for migration**: `MoveTaskToCollectionHandler` vs old `MigrateTaskHandler`

**Trade-offs:**
- **Event volume vs clarity**: Acceptable trade-off for data integrity
- **Backward compatibility complexity**: Worth it to avoid breaking existing data
- **Handler duplication**: Old handlers kept for legacy events only

### Implementation Details

**5-Phase Implementation** (2026-02-15):

**Phase 1: Fix Move Semantics** (3 hours)
- Added `currentCollectionId` to `MoveTaskToCollectionCommand`
- Handler removes from current collection only (not all collections)
- Comprehensive validation and edge case tests
- Casey approved: 9.5/10

**Phase 2: Fix BulkMigrateEntriesHandler** (4 hours)
- Removed `TaskMigrated` event generation for tasks
- Rewrote to use `TaskAddedToCollection` + `TaskRemovedFromCollection`
- Added idempotency checks (prevent duplicate events)
- Uses `generateEventMetadata()` helper for consistency
- Casey approved: 9.2/10

**Phase 3: Verify UI Wiring** (1 hour)
- Confirmed UI already using `handleMigrateWithMode`
- Fixed dependency array bug in `useEntryOperations.ts`
- All migration flows tested and working

**Phase 4: Integration Testing** (3 hours)
- Created 19 comprehensive end-to-end tests
- Verified full stack behavior (handlers → projections → UI)
- All tests passing (577 domain tests, 1,540 total)

**Phase 5: Documentation** (1 hour)
- ADR-015 documented
- CHANGELOG updated
- Implementation notes added

**Total Time**: 12 hours (under original 18-22 hour estimate)

### Files Changed

**Domain Layer**:
- `packages/domain/src/task.types.ts` - Added `currentCollectionId` to command, enhanced JSDoc
- `packages/domain/src/collection-management.handlers.ts` - Fixed move semantics, added validation
- `packages/domain/src/bulk-migrate-entries.handler.ts` - Removed TaskMigrated, added idempotency
- `packages/domain/src/collection-management.test.ts` - Added 4 edge case tests
- `packages/domain/src/bulk-migrate-entries.handler.test.ts` - Updated 12 tests, added 1 comprehensive test
- `packages/domain/src/multi-collection-integration.test.ts` - **NEW**: 19 integration tests

**Client Layer**:
- `packages/client/src/hooks/useEntryOperations.ts` - Fixed dependency array bug
- `packages/client/src/views/CollectionDetailView.test.tsx` - Fixed 3 date/time mocking issues

**Test Results**:
- Before: 1,521 tests passing
- After: 1,540 tests passing (+19 integration tests)
- Zero regressions

### Migration Strategy

**For New Code**:
- ✅ Use `BulkMigrateEntriesHandler` (generates multi-collection events)
- ✅ Use `MoveTaskToCollectionHandler` (removes from current, adds to target)
- ✅ Use `AddTaskToCollectionHandler` (adds to collection without removing)
- ❌ DO NOT use `MigrateTaskHandler` (generates deprecated TaskMigrated events)

**For Existing Data**:
- ✅ Projections handle both old (TaskMigrated) and new (multi-collection) events
- ✅ Old tasks with `migratedTo` pointers still render as ghosts
- ✅ No data migration needed (backward compatible)
- ✅ Event log preserved (immutable events)

**Projection Handling**:
```typescript
// Projection handles BOTH patterns
private replayEvents(events: DomainEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      // NEW pattern
      case 'TaskAddedToCollection':
        task.collections.push(event.payload.collectionId);
        task.collectionHistory.push({
          collectionId: event.payload.collectionId,
          addedAt: event.payload.addedAt,
        });
        break;
      
      case 'TaskRemovedFromCollection':
        task.collections = task.collections.filter(
          id => id !== event.payload.collectionId
        );
        const historyEntry = task.collectionHistory.find(
          h => h.collectionId === event.payload.collectionId
        );
        if (historyEntry) {
          historyEntry.removedAt = event.payload.removedAt;
        }
        break;
      
      // OLD pattern (legacy support)
      case 'TaskMigrated':
        // Create new task with new ID, point old task to new
        // (handled for backward compatibility only)
        break;
    }
  }
}
```

### Testing Strategy

**Unit Tests** (Domain Handlers):
- Move semantics (removes from current only)
- Idempotency (duplicate operations are no-ops)
- Validation (empty IDs, invalid collections)
- Edge cases (same-collection moves, uncategorized)

**Integration Tests** (Full Stack):
- Task ID preservation across migrations
- Collection history completeness
- Multi-collection behavior (move vs add)
- Bulk migration atomicity
- Ghost rendering in multiple collections

**UI Tests** (Client Layer):
- Migration modal mode selection
- Collection history display
- Ghost entry rendering
- Navigation between collections

### Future Considerations

**Potential Improvements**:
1. **Event compaction**: Snapshot aggregates to reduce event log size
2. **Batch optimization**: Single `appendBatch()` for bulk migrations
3. **Real-time sync**: Firestore `onSnapshot` for live multi-device updates
4. **Legacy migration**: Script to convert old TaskMigrated events (optional)

**Event Schema Evolution**:
- Current: v1 (TaskMigrated deprecated, multi-collection recommended)
- Future: v2 (remove TaskMigrated support after migration period)

### SOLID Principles

**Single Responsibility**:
- `MoveTaskToCollectionHandler` - Coordinates move operation (remove + add)
- `AddTaskToCollectionHandler` - Adds to collection only
- `RemoveTaskFromCollectionHandler` - Removes from collection only
- Each handler has one clear responsibility

**Open/Closed**:
- New multi-collection events added without modifying existing event types
- Projections extended to handle new events without changing old logic
- UI can use new handlers without breaking old code

**Liskov Substitution**:
- Both `TaskMigrated` and `TaskAddedToCollection + TaskRemovedFromCollection` produce same outcome (task moves)
- Projections handle both transparently
- Old code still works with new events

**Dependency Inversion**:
- Handlers depend on `IEventStore` abstraction (not concrete implementation)
- UI depends on command handler abstractions (not event details)
- Projections depend on event interfaces (not storage)

### Documentation

**ADR-015**: This document  
**Implementation Plan**: `docs/adr-015-implementation-plan.md` (original plan, superseded)  
**Integration Tests**: `packages/domain/src/multi-collection-integration.test.ts`  
**CHANGELOG**: Updated with Issue #7G fix

---

*Architecture decisions are revisited as we learn. Status may change to Deprecated or Superseded.*
