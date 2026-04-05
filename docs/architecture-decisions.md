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
- `packages/backend` - Firebase Admin SDK functions (future)

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
**Status**: Complete (2026-02-15)

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
**Status**: Accepted (enforcement complete 2026-04-04)

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
- ~~⚠️ **Two handlers for migration**: `MoveTaskToCollectionHandler` vs old `MigrateTaskHandler`~~ — resolved: `MigrateTaskHandler` removed from all UI call sites (2026-04-04)

**Trade-offs:**
- **Event volume vs clarity**: Acceptable trade-off for data integrity
- **Backward compatibility complexity**: Worth it to avoid breaking existing data
- **Handler duplication**: `MigrateTaskHandler` retained in domain layer for event replay only; no longer instantiated in UI

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

---

## ADR-016: Projection Snapshots with Delta Replay

**Date**: 2026-02-28  
**Status**: Accepted

### Context

The application currently performs a full event replay on every `getEntries()` call:

```
getEntries() → IEventStore.getAll() → EntryEventApplicator.applyEvents(allEvents)
```

Each call scans the entire IndexedDB event store and reprocesses every event from
the beginning of time. At current scale (~500 events) this is sub-millisecond and
not a user-facing concern. However:

1. **Learning goal**: Implementing snapshots is a core event sourcing concept to
   internalise while the codebase is manageable.
2. **Future-proofing**: A heavy user accumulating entries daily will reach 5,000+
   events within a year; snapshots prevent linear degradation.
3. **Redundant IndexedDB reads**: Every navigation to a collection view triggers
   a full `getAll()` scan, even when no events have changed since the last read.
4. **ADR-010 future note**: "Event compaction: Snapshot aggregates periodically to
   reduce event log size" — this ADR implements the read-model variant.

**Open design questions resolved:**
- Per-collection vs. full-projection snapshots? → **Full-projection snapshot only**
  (Phase 1). Per-collection adds complexity for marginal gain at current scale.
- Firestore snapshot sync for new-device cold start? → **Future concern** (Phase 2).
  Phase 1 is IndexedDB-local only.

### Decision

Implement **projection snapshots with delta replay** and an **in-memory read cache**:

1. **`ISnapshotStore` interface** in `packages/domain/` — mirrors `IEventStore` pattern
2. **`IndexedDBSnapshotStore`** in `packages/infrastructure/` — persists snapshots to
   a dedicated `squickr-snapshots` IndexedDB database
3. **`InMemorySnapshotStore`** in `packages/infrastructure/` — for test environments
4. **`EntryListProjection.hydrate()`** — startup method that loads snapshot + applies
   delta events, populating an in-memory `cachedEntries` array
5. **`EntryListProjection.createSnapshot()`** — returns a `ProjectionSnapshot` for the
   current state; called by `SnapshotManager`
6. **In-memory cache** in `EntryListProjection` — `getEntries()` serves from cache;
   cache invalidated by event store subscription callback
7. **`SnapshotManager`** in `packages/client/` — coordinates two save triggers:
   - **Count trigger**: every 50 appended events since last snapshot
   - **Lifecycle trigger**: `visibilitychange === 'hidden'` (tab close) + `beforeunload`
8. **`SNAPSHOT_SCHEMA_VERSION`** constant — detects stale snapshots after code
   changes that alter `EntryEventApplicator` output shape

### Rationale

**Why full-projection snapshot (not per-aggregate)?**
Event sourcing snapshots commonly operate at the aggregate level. However, Squickr's
domain aggregates (Task, Note, Event) have no individual identity in the read model —
they're unified into `Entry` objects by `EntryListProjection`. The projection is the
aggregate boundary for reads. Snapshotting the projection output directly is the
correct granularity.

**Why `ISnapshotStore` in domain?**
The domain package defines interface contracts. `ISnapshotStore` is a pure TypeScript
interface with no implementation details. It belongs alongside `IEventStore` in the
domain layer. Concrete implementations (IndexedDB, InMemory) belong in infrastructure.

**Why a separate IndexedDB database (`squickr-snapshots`)?**
Keeping snapshots in a separate database:
- Allows clearing snapshots without touching the event log (safety)
- Independent versioning (snapshot schema can evolve independently of event schema)
- Explicit separation of concerns: events are truth, snapshots are cache

**Why `SnapshotManager` in client?**
`SnapshotManager` uses `document.addEventListener` and `window.addEventListener` —
browser APIs unavailable in the domain package (which has zero external dependencies).
Browser lifecycle management is inherently a delivery-mechanism concern.

**Why not use `beforeunload` alone?**
On mobile browsers, `beforeunload` is unreliable (may not fire). `visibilitychange`
fires reliably across platforms when a tab is hidden or the browser is backgrounded.

**Why 50 events per snapshot?**
Bounds the maximum delta replay to 50 events — well under the threshold where replay
latency becomes perceptible (~500+ events). Configurable via `SnapshotManager`
constructor parameter.

**Why invalidate the cache (set `cachedEntries = null`) rather than applying the new event incrementally?**
The `EntryEventApplicator.applyEvents()` method is a pure function over the full event
log. Applying a single event incrementally would require making `EntryEventApplicator`
stateful and accepting a pre-seeded map — a larger refactor. The cache invalidation +
lazy rebuild pattern (null = "rebuild on next read") is correct, testable, and
consistent with the existing reactive subscription pattern.

**Why Phase 1 doesn't implement true incremental delta application in `EntryEventApplicator`?**
The performance win from snapshots comes primarily from **not scanning IndexedDB on
every `getEntries()` call** (the cache hit path). The CPU cost of `applyEvents()` is
negligible at current scale. True incremental application (feeding a pre-seeded map
to the applicator) is a meaningful architectural change that should be deferred to
when profiling shows it's needed.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Per-collection snapshots | More complex, marginal gain at current scale |
| Firestore snapshot sync (Phase 1) | Over-engineered for current need; adds network layer to startup path |
| `sessionStorage` for snapshot | Limited to single tab; doesn't persist across cold starts |
| `localStorage` for snapshot | Size limit too small for large entry datasets |
| Service Worker cache | Adds significant complexity; not warranted at current scale |

### Consequences

**Positive:**
- Eliminates redundant IndexedDB full-scans on every `getEntries()` call
- Cold-start replay bounded to O(delta) not O(all events)
- Pattern extensible to `CollectionListProjection` (same `ISnapshotStore` key mechanism)
- Clean Architecture preserved: domain interface, infrastructure implementation, client coordination
- Graceful degradation: missing or stale snapshot → full replay (no data loss risk)
- Learning exercise completed: demonstrates snapshot, delta replay, schema versioning

**Negative / Risks:**
- `SNAPSHOT_SCHEMA_VERSION` must be manually incremented when `EntryEventApplicator`
  output shape changes — risk of forgotten increment leaving users on stale snapshots
  - *Mitigation*: Warning comment in `entry.event-applicator.ts` file header
- Snapshot save on `visibilitychange` is async — tab may close before write completes
  - *Mitigation*: `visibilitychange` typically has ~0.5–1s before actual unload; IndexedDB
    writes are fast; count trigger (every 50 events) is the reliable path
- `beforeunload` may not complete on mobile browsers
  - *Mitigation*: `visibilitychange` is the primary mobile trigger; `beforeunload` is belt-and-suspenders
- Adds `ISnapshotStore` as optional constructor argument to `EntryListProjection`
  - *Mitigation*: Optional parameter with `?`; existing tests unaffected

**Testing Impact:**
- All existing ~1,800 tests continue to pass (no breaking changes to existing interfaces)
- New tests: ~125 covering `IndexedDBSnapshotStore`, `InMemorySnapshotStore`,
  `EntryListProjection.hydrate()`, `EntryListProjection.createSnapshot()`, `SnapshotManager` triggers

### SOLID Principles

**Single Responsibility:**
- `ISnapshotStore` / `IndexedDBSnapshotStore` — snapshot persistence only
- `EntryListProjection` — read model; snapshot-aware hydration is a natural extension of its existing role
- `SnapshotManager` — trigger coordination only (doesn't persist, doesn't project)
- `EntryEventApplicator` — event application only (unchanged)

**Open/Closed:**
- `ISnapshotStore` allows new implementations (Firestore, OPFS) without modifying `EntryListProjection`
- Snapshot key mechanism allows snapshotting additional projections without modifying existing code

**Liskov Substitution:**
- `IndexedDBSnapshotStore` and `InMemorySnapshotStore` are fully interchangeable via `ISnapshotStore`

**Interface Segregation:**
- `ISnapshotStore` is minimal: `save`, `load`, `clear` — no bloat

**Dependency Inversion:**
- `EntryListProjection` depends on `ISnapshotStore` (domain abstraction), not `IndexedDBSnapshotStore`
- `SnapshotManager` depends on `EntryListProjection` and `ISnapshotStore` (abstractions)

### Files to Create / Modify

**Create:**
- `packages/domain/src/snapshot-store.ts` — `ISnapshotStore`, `ProjectionSnapshot`, `SNAPSHOT_SCHEMA_VERSION`
- `packages/infrastructure/src/indexeddb-snapshot-store.ts` — `IndexedDBSnapshotStore`
- `packages/infrastructure/src/in-memory-snapshot-store.ts` — `InMemorySnapshotStore`
- `packages/client/src/snapshot-manager.ts` — `SnapshotManager`

**Modify:**
- `packages/domain/src/entry.projections.ts` — add `hydrate()`, `createSnapshot()`, cache
- `packages/domain/src/index.ts` — export new snapshot types
- `packages/infrastructure/src/index.ts` — export new snapshot stores
- `packages/client/src/App.tsx` — wire `IndexedDBSnapshotStore` + `SnapshotManager`

### Future Enhancements

- **Phase 2**: True incremental delta application in `EntryEventApplicator`
  (accept pre-seeded entry map, apply delta events only)
- **Phase 3**: `FirestoreSnapshotStore` — sync snapshot to Firestore for new-device
  cold start (avoid full event log download on first open) → **Implemented in ADR-017**
- **Phase 4**: Snapshot `CollectionListProjection` and `UserPreferencesProjection`

---

## ADR-017: Remote Snapshot Store for Cold-Start Acceleration

**Date**: 2026-02-28  
**Status**: Accepted

### Context

ADR-016 (Phase 1) established projection snapshots saved to IndexedDB. This eliminated
redundant full-replay reads on subsequent visits **on the same device**. However, a user
opening the app on a **new device or incognito session** had no local snapshot and no
local events: the full Firestore event log (~945 events for a heavy user) had to be
downloaded and replayed before any content appeared.

This produced two user-visible problems:
1. **Sync overlay blocking the UI** for several seconds while 900+ events downloaded.
2. **Visual churn** as collections updated ~945 times during the download loop.

ADR-010 had noted a `FirestoreSnapshotStore` as a future enhancement. The user base
has now reached a scale where the cold-start experience is materially degraded.

### Decision

Extend the snapshot system with a **remote snapshot store** backed by Firestore:

1. **`FirestoreSnapshotStore`** in `packages/infrastructure/` — implements `ISnapshotStore`
   against the Firestore path `users/{uid}/snapshots/{snapshotKey}`.
2. **`SnapshotManager` dual-store support** — accepts an optional `remoteStore`; on
   `saveSnapshot()`, saves to local first (synchronous path), then fire-and-forgets to
   remote (Firestore write failures do not block the UI or throw to callers).
3. **Cold-start restore in `App.tsx`** — on auth resolve, before starting `SyncManager`:
   - Fetch remote snapshot with a **5-second timeout** (fail fast on slow networks).
   - If remote snapshot is newer than local (or local is absent): save it to IndexedDB,
     call `entryProjection.hydrate()` — projection is populated before any sync begins.
   - Set `restoredFromRemoteRef = true` to skip the sync overlay on this path.
4. **Post-initial-sync snapshot seeding** — on the normal path (first-ever sign-in, no
   remote snapshot yet), `App.tsx` calls `saveSnapshot('post-initial-sync')` once after
   the initial `SyncManager` sync completes. This seeds Firestore without requiring a
   tab-close event.
5. **`isRemoteRestoring` gate** — `App.tsx` adds `isRemoteRestoring` state (starts `true`,
   cleared in `startSync()` finally block). `isAppReady` gates on `!isRemoteRestoring`
   so the tutorial and empty-state logic never fire before the remote check resolves.
6. **Firestore security rules** — `users/{userId}/snapshots/{snapshotKey}` read/write
   rules added and deployed.

### Rationale

**Why a 5-second timeout?**
The cold-start optimisation is a best-effort acceleration, not a hard requirement.
If Firestore is slow or unavailable, the app must fall back gracefully to the normal
sync path. A 5-second timeout is aggressive enough to fail fast on genuinely degraded
networks without penalising normal users.

**Why save remote-first then fire-and-forget?**
`SnapshotManager` already saves to IndexedDB first (which is the source of truth for
the local device). The Firestore write is speculative — it makes the snapshot available
for future cold-starts on other devices. A failed remote save is acceptable; the user's
data is safe in IndexedDB and Firestore's event log.

**Why gate `isAppReady` on `isRemoteRestoring`?**
On the cold-start path `isSyncing` is intentionally never set to `true` (the overlay
is bypassed). Without an explicit gate, `isAppReady` would become `true` the moment
`isLoading` cleared — before `hydrate()` ran — causing `CollectionIndexView` to see
`collections.length === 0` and fire `startTutorial()` on a returning user.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Keep sync overlay on cold-start | Defeats the purpose; returning users see a long spinner on new devices |
| Service Worker cache for events | Stale on new devices; adds significant complexity |
| Download snapshot in Service Worker | Out of scope; SW architecture not established |
| Per-collection remote snapshots | Over-engineered; full-projection snapshot is sufficient |

### Consequences

**Positive:**
- Cold-start on new device / incognito: entries appear immediately, no overlay, no churn
- Returning users are never shown the new-user tutorial on a new device
- Snapshot seeds automatically after first use without requiring tab close
- Graceful degradation: timeout / Firestore error → falls back to normal sync path
- Clean Architecture preserved: `ISnapshotStore` unchanged; `FirestoreSnapshotStore`
  is an infrastructure implementation detail

**Negative / Risks:**
- Remote snapshot may lag behind the event log by up to one `saveSnapshot` interval
  (50 events or tab close). `SyncManager` background sync closes the gap silently.
- Firestore read on every app open (mitigated: single document fetch, < 1KB)
- `isRemoteRestoring` adds one more boolean to the `isAppReady` formula

**Testing Impact:**
- `@squickr/client`: +6 tests (2 post-initial-sync snapshot tests, 3 `isRemoteRestoring`
  gate tests, 1 existing cold-start test updated to async assertion)
- `@squickr/infrastructure`: +13 `FirestoreSnapshotStore` tests

### Files Created / Modified

**Created:**
- `packages/infrastructure/src/firestore-snapshot-store.ts` — `FirestoreSnapshotStore`
- `firestore.rules` — snapshot read/write rules (deployed)

**Modified:**
- `packages/client/src/snapshot-manager.ts` — dual-store support, fire-and-forget remote
- `packages/client/src/App.tsx` — cold-start restore, `isRemoteRestoring` gate,
  post-initial-sync `saveSnapshot`
- `packages/client/src/App.test.tsx` — `MockFirestoreEventStore`, new tests

---

## ADR-018: Snapshot-Aware Background Sync Absorption

**Date**: 2026-02-28  
**Status**: Accepted

### Context

After ADR-017, the cold-start path correctly served entries from the hydrated snapshot
and skipped the sync overlay. However, `SyncManager.syncNow()` then downloaded the full
event log (~945 events) in the background. Two compounding issues caused visible churn:

**Issue 1 — `SyncManager` used `append()` in a loop:**
```typescript
// Before ADR-018
for (const event of eventsToDownload) {
  await this.localStore.append(event); // fires subscriber notification 945 times
}
```
Each `append()` call notified all `IEventStore` subscribers. `appendBatch()` already
existed (ADR-013) for exactly this scenario but was not used in the download path.

**Issue 2 — `EntryListProjection` subscriber ignored the event parameter:**
The constructor subscriber always nulled `cachedEntries` and called `notifySubscribers()`
on every event notification, even for events already baked into the hydrated snapshot.
The `IEventStore.subscribe()` callback receives a `DomainEvent` but it was ignored.

**Combined effect:** 945 subscriber notifications → 945 cache invalidations → 945
React re-renders → collections visually flickering ~945 times during background sync.

### Decision

**Fix 1 — `SyncManager.syncNow()` uses `appendBatch()`:**
```typescript
// After ADR-018
if (eventsToDownload.length > 0) {
  await this.localStore.appendBatch(eventsToDownload);
  // Single subscriber notification with the last event as sentinel
}
```
Reduces 945 notifications to 1, regardless of download size.

**Fix 2 — `EntryListProjection` absorbs pre-snapshot events silently:**
```typescript
// After ADR-018 (constructor subscriber)
this.eventStore.subscribe((event: DomainEvent) => {
  if (this.absorbedEventIds?.has(event.id)) {
    this.absorbedEventIds.delete(event.id); // drain for GC
    return; // silently absorbed — no cache invalidation, no re-render
  }
  this.absorbedEventIds = null; // first genuinely new event clears absorption mode
  this.cachedEntries = null;
  this.notifySubscribers();
});
```

`hydrate()` populates `absorbedEventIds` with all event IDs present at hydration time
(both snapshot events and delta events). The first genuinely new event — one whose ID
is not in the set — clears absorption mode and resumes normal reactive behaviour.

**Why all event IDs (not just `lastEventId`)?**
`appendBatch` notifies with the last event as sentinel — so only the last event ID is
checked in the `appendBatch` path. However, `append()` (called one-by-one) could present
any event ID. Including all IDs in the set protects against any call path, current or
future. The set is drained as events are absorbed, so GC cost is equivalent.

**Why delta event IDs are included:**
`SyncManager` may re-deliver delta events on a subsequent `syncNow()` pass if the
batch download window overlaps with what `hydrate()` already applied (e.g. a retry).
Including delta IDs ensures those re-deliveries are silently absorbed.

### Rationale

**Why `appendBatch` over `append` in a loop?**
`appendBatch` already existed with the correct semantics (single notification after
atomic batch write). The loop was an oversight — the download path pre-dated `appendBatch`.

**Why absorption in the projection, not in SyncManager?**
The projection is the correct location for this logic: it has the snapshot state
and knows which events are already reflected in its cache. SyncManager should not need
to know about projection internals. The `absorbedEventIds` set is an implementation
detail of `EntryListProjection.hydrate()`.

**Alternatives Rejected:**

| Alternative | Rejected Because |
|---|---|
| Debounce subscriber notifications | Hides the root cause; adds latency to genuine updates |
| SyncManager checks local store before append | Requires N individual lookups instead of one batch check |
| Rebuild cache once after appendBatch completes | Would require a public `rebuildCache()` API on the projection — leaks internals |

### Consequences

**Positive:**
- Background sync of 945 events produces at most 1 subscriber notification (not 945)
- Events already baked into the snapshot produce 0 re-renders
- First genuinely new event triggers exactly 1 re-render as expected
- Fully backward-compatible: projections with no snapshot behave identically to before

**Negative / Risks:**
- `absorbedEventIds` set holds N UUID strings in memory until drained (negligible: ~50KB
  for 1,000 events; drained lazily as events arrive)
- `SNAPSHOT_SCHEMA_VERSION` bump is needed if `ProjectionSnapshot.state` shape changes —
  same risk as ADR-016, same mitigation (warning comment in `entry.event-applicator.ts`)

**Testing Impact:**
- `@squickr/client`: +1 `SyncManager` test (download path uses `appendBatch`)
- `@squickr/domain`: +6 `EntryListProjection` absorption tests (4 single-event, 2
  `appendBatch`-path covering all-pre-snapshot and mixed batches)

### Files Modified

- `packages/client/src/firebase/SyncManager.ts` — download loop → `appendBatch()`
- `packages/client/src/firebase/SyncManager.test.ts` — `appendBatch` mock, new test
- `packages/domain/src/entry.projections.ts` — `absorbedEventIds` field, updated
  constructor subscriber, `hydrate()` populates set, `resolveCache()` clears set,
  comments explaining set-size rationale and delta-ID inclusion
- `packages/domain/src/entry.projections.test.ts` — 6 new absorption tests
- `packages/domain/src/logger.ts` — created: minimal `{ warn }` wrapper for domain pkg

---

## ADR-019: Review Screen — Derived Read Model Composed from Existing Projections

**Date**: 2026-03-20
**Status**: Accepted

### Context

The Proactive Squickr initiative (Phase 1) adds a "Review" screen that answers:

1. **"What did I do?"** — completed tasks this week (or month), grouped by collection
2. **"What's stuck?"** — open tasks on any monthly log whose last *content* event is more than 14 days ago

The app already captures everything needed: `completedAt` timestamps on tasks, `type: 'monthly'` on collections, and a full event log with per-aggregate timestamps. No new domain events or aggregates are required.

A key design question: how does this screen get its data?

**Option A: Continuously-projected read model** — a dedicated `ReviewProjection` subscribes to the event store and maintains pre-computed state, like `EntryListProjection`.

**Option B: Computed-on-demand query** — a query object reads from the existing `EntryListProjection` cache (already warm) and the raw event log (needed only for staleness), computes the result at call time, and discards it.

**Option C: New aggregate or new events** — emit `TaskStalled` events, or create a `ReviewAggregate`.

### Decision

Implement **Option B**: a **computed-on-demand** query model composed from existing projections.

Concretely:

1. A new class `ReviewProjection` (`packages/domain/src/review.projection.ts`) holds two query methods and nothing else.
2. It is wired into `EntryListProjection` as a **private façade field** — the same pattern used by `CollectionViewProjection`, `DailyLogProjection`, and `SubTaskProjection`. `EntryListProjection` exposes two new delegating public methods.
3. A new React hook `useReviewData` in the client layer calls these methods, manages loading state, and subscribes to `EntryListProjection` for reactivity.
4. No new events. No new aggregates. No new IndexedDB stores. No continuous projection state.

**New domain surface:**

```typescript
// packages/domain/src/review.projection.ts

export interface StalledTask {
  readonly entry: Entry;
  readonly collectionId: string;
  readonly collectionName: string;
  readonly lastEventAt: string;   // ISO timestamp of most recent content event on this aggregate
  readonly staleDays: number;
}

export class ReviewProjection {
  constructor(
    private readonly entryProjection: EntryListProjection,
    private readonly eventStore: IEventStore,
  ) {}

  /** Returns completed tasks (type === 'task') with completedAt in [from, to] */
  async getCompletedInRange(from: Date, to: Date): Promise<Entry[]>

  /** Returns open tasks on any monthly-type collection whose last content event is > olderThanDays ago */
  async getStalledMonthlyTasks(
    olderThanDays: number,
    getCollection: (id: string) => Collection | undefined,
  ): Promise<StalledTask[]>
}
```

**Staleness algorithm:**

```
staleness(task):
  monthlyColl = task.collections.find(c => collections[c].type === 'monthly')
  if !monthlyColl → not stalled
  if task.status !== 'open' → not stalled
  lastContentEventAt = max(event.timestamp
    for event where event.aggregateId === task.id
      AND event.type IN CONTENT_EVENT_TYPES)
  if !lastContentEventAt → not stalled (no content events = unknown)
  staleDays = floor((now - lastContentEventAt) / 86400000)
  stalled = staleDays > olderThanDays
```

**Content event types** (migration and collection-management events are excluded):
`TaskCreated`, `TaskCompleted`, `TaskReopened`, `TaskTitleChanged`, `TaskDeleted`, `TaskRestored`, `TaskReordered`

**Rationale for content-only staleness:** A task migrated every day but never edited or actioned is as stale as one that was never touched. The migration action (`TaskMigratedToCollection`) reflects the user deferring a task, not engaging with it. Only content changes (edits, completions, status changes) count as evidence of activity.

**Routing:**

```
/review              → weekly view (default)
/review?period=monthly → monthly view
```

Entry point: `UserProfileMenu` in `CollectionIndexView` (avatar/profile menu).

### Rationale

**Why on-demand, not continuously projected?**

The review screen is accessed infrequently (once per week, triggered by notification tap or deliberate navigation). Maintaining continuously-updated in-memory state for a screen that is rarely open wastes memory and adds subscription complexity. The existing `EntryListProjection` cache (`cachedEntries`) means the `getCompletedInRange` query is O(n) in entries — practically free after hydration.

The staleness scan (`getStalledMonthlyTasks`) calls `eventStore.getAll()` each time the screen is opened. At current event log scales (~1,000–5,000 events) this is sub-millisecond. If it becomes a bottleneck in future, a `lastContentEventByAggregate` cache can be memoized inside `ReviewProjection` — an internal implementation detail with zero public API change.

**Why the private façade pattern?**

`EntryListProjection` already uses this pattern three times (`CollectionViewProjection`, `DailyLogProjection`, `SubTaskProjection`). Adding a fourth `ReviewProjection` is consistent and keeps `entry.projections.ts` from growing unboundedly. The façade is an implementation detail — callers only ever see `EntryListProjection`.

**Why `getCollection` as a callback?**

`ReviewProjection` is constructed inside `EntryListProjection`. Injecting `CollectionListProjection` would add a third constructor dependency and risk initialisation order issues (both projections subscribe to the same event store). Passing a `getCollection` callback (resolved at query time by the hook) keeps the domain layer free of cross-projection references, following Interface Segregation — the projection only needs *resolve a collection by ID*, not the full `CollectionListProjection` surface.

**Why no new events?**

Option C (`TaskStalled` events) would require a background scheduler to emit staleness events — impossible in a fully offline, no-backend app. Staleness is a **derived property** of the existing event log, not a domain fact worth recording.

**Why content events only for staleness?**

A task migrated repeatedly from one daily log to the next is demonstrably procrastinated, not actively worked on. Using all events (including `TaskMigratedToCollection`) would reset the staleness clock each time a user defers a task, hiding the very stall the screen is meant to surface. Only edits, completions, and status changes constitute genuine user engagement with a task's content.

### Consequences

**Positive:**
- ✅ Zero new events, zero new aggregates — existing event log is the source of truth
- ✅ Fully offline — all data in IndexedDB, no network required
- ✅ Uses existing `EntryListProjection` cache — `getCompletedInRange` is essentially free after hydration
- ✅ Consistent with existing private façade pattern
- ✅ `StalledTask` return type carries `collectionName` — no N+1 lookups in the view
- ✅ Gracefully handles absent `HabitProjection` — placeholder section in UI until Phase 2
- ✅ Deep-link compatible: `/review?period=weekly` or `/review?period=monthly`
- ✅ All existing tests unaffected — additive change only

**Negative / Risks:**
- ⚠️ `getStalledMonthlyTasks` calls `eventStore.getAll()` on each review screen open. At 5,000+ events this could become perceptible. *Mitigation:* Memoize `lastContentEventByAggregate` map inside `ReviewProjection` between calls — zero API surface change.
- ⚠️ `getCollection` callback is passed from the client layer into the domain layer, which is slightly unusual. *Mitigation:* The callback has a minimal, stable signature `(id: string) => Collection | undefined` and does not leak React or browser APIs into the domain.

### SOLID Principles

- **Single Responsibility**: `ReviewProjection` answers only review-screen queries. `ReviewView` renders only the review screen. `useReviewData` manages only review data fetching.
- **Open/Closed**: `EntryListProjection` is extended via the private façade pattern — not modified. New methods are additive.
- **Liskov Substitution**: `ReviewProjection` accepts `IEventStore` (domain abstraction). Tests use `InMemoryEventStore`.
- **Interface Segregation**: `getCollection` callback exposes only the one operation `ReviewProjection` needs.
- **Dependency Inversion**: `ReviewProjection` depends on `IEventStore` (domain abstraction). `useReviewData` depends on `EntryListProjection` (injected via `AppContext`).

### Files Created / Modified

**Created:**
- `packages/domain/src/review.projection.ts` — `ReviewProjection`, `StalledTask`
- `packages/domain/src/review.projection.test.ts` — 18 domain tests
- `packages/client/src/utils/reviewDateRange.ts` — `getDateRange`, `ReviewPeriod`
- `packages/client/src/utils/reviewDateRange.test.ts` — 11 tests
- `packages/client/src/hooks/useReviewData.ts` — review data hook
- `packages/client/src/hooks/useReviewData.test.ts` — 10 tests
- `packages/client/src/views/ReviewView.tsx` — review screen
- `packages/client/src/views/ReviewView.test.tsx` — 10 tests
- `packages/client/src/components/ReviewHeader.tsx` — header with back/toggle
- `packages/client/src/components/ReviewHeader.test.tsx` — 11 tests
- `packages/client/src/components/ReviewCompletedSection.tsx`
- `packages/client/src/components/ReviewCompletedSection.test.tsx` — 8 tests
- `packages/client/src/components/ReviewStalledSection.tsx`
- `packages/client/src/components/ReviewStalledSection.test.tsx` — 5 tests
- `packages/client/src/components/ReviewHabitSection.tsx` — Phase 2 placeholder

**Modified:**
- `packages/domain/src/entry.projections.ts` — private `review` façade field + 2 delegating methods
- `packages/domain/src/entry.projections.test.ts` — 2 delegation integration tests
- `packages/domain/src/index.ts` — exports `ReviewProjection`, `StalledTask`
- `packages/client/src/routes.tsx` — `review` route constant, `buildReviewPath` helper
- `packages/client/src/App.tsx` — `<Route path={ROUTES.review} element={<ReviewView />} />`
- `packages/client/src/App.test.tsx` — route render test
- `packages/client/src/components/UserProfileMenu.tsx` — `onReviewClick` prop + button
- `packages/client/src/components/UserProfileMenu.test.tsx` — 2 new tests
- `packages/client/src/views/CollectionIndexView.tsx` — passes `onReviewClick` to menu

---

## ADR-020: Phase 2 Habit Tracking — Event-Sourced Habit Aggregate with Derived Read Models

**Date**: 2026-03-20
**Status**: Accepted

### Context

Phase 2 adds habit tracking to Squickr Life: users can create daily or weekly habits, check them off each day, and review streaks + history. The core questions:

1. **How are habits stored?** — New event types on a `Habit` aggregate, or piggy-back on existing `Task`/`Collection` events?
2. **How are read models computed?** — Continuously-projected (live) state, or computed on-demand?
3. **How does the UI access habit data?** — New context fields, or a new provider?
4. **How are habit history and streaks calculated?** — Real-time from events, or cached?

### Decision

#### 1. New `Habit` Aggregate with Dedicated Event Types

Habits have distinct lifecycle semantics (frequency schedules, completion windows, streaks) that don't map cleanly onto `Task` or `Collection`. A dedicated aggregate is the right boundary.

**9 new event types** (all prefixed `habit-`):
- `habit-created`, `habit-title-updated`, `habit-frequency-updated`
- `habit-completed`, `habit-completion-reverted`
- `habit-archived`, `habit-restored`
- `habit-reordered`

Each event carries `aggregateId` (the habit ID), `timestamp` (ISO string), and typed `data`. Events are immutable and appended to the same `IEventStore` shared by all other aggregates — no new storage mechanism.

#### 2. `HabitProjection` — Continuous Read Model

A dedicated `HabitProjection` class (in `packages/domain/src/`) subscribes to the event store and maintains a `Map<habitId, HabitState>` in memory. This follows the existing `EntryListProjection` pattern precisely.

`HabitProjection` exposes:
- `getActiveHabits()` — all non-archived habits, sorted by `order`
- `getAllHabits()` — active + archived
- `getHabitById(id)` — single habit read model
- `getHabitsForDate(dateKey)` — habits scheduled for a given local date (used by daily log view)

The read model (`HabitReadModel`) is fully derived from events at projection time:
- `currentStreak` / `longestStreak` — computed from `history` on every projection update
- `history` — last 30 days of `HabitDayStatus` (`completed | missed | not-scheduled | future`)
- `isScheduledToday` / `isCompletedToday` — derived from today's date and completion events

#### 3. `HabitProjection` Wired into `EntryListProjection` as a Private Façade Field

Following the existing pattern (`review`, `collectionView`, `dailyLog`, `subTask`), `HabitProjection` is held as a **private field** on `EntryListProjection`. Four new public delegating methods are added to `EntryListProjection`:

```typescript
getActiveHabits(): Promise<HabitReadModel[]>
getAllHabits(): Promise<HabitReadModel[]>
getHabitById(id: string): Promise<HabitReadModel | undefined>
getHabitsForDate(date: string): Promise<HabitReadModel[]>
```

This keeps all domain query access behind the single `entryProjection` reference in `AppContext` — no new context fields for projections.

#### 4. 8 New Handler Classes, All Injected via `AppContext`

Each command type (`CreateHabit`, `UpdateHabitTitle`, `UpdateHabitFrequency`, `CompleteHabit`, `RevertHabitCompletion`, `ArchiveHabit`, `RestoreHabit`, `ReorderHabit`) has a dedicated handler class following the existing `CreateTaskHandler` pattern: validate → create event → `eventStore.append()`.

All 8 handlers are instantiated in `App.tsx` and injected into `AppContext`. UI components access them via `useApp()`.

#### 5. Client UI Layer

- **`useHabitsForDate(date)`** — hook wrapping `entryProjection.getHabitsForDate(date)` with reactive subscription
- **`useHabitsManagement()`** — hook exposing all 8 handler `handle()` functions
- **`HabitRow`** — single habit row with check/uncheck, archive, reorder
- **`HabitsSection`** — list of `HabitRow`s for a given date, used in `CollectionDetailView`
- **`CreateHabitModal`** — modal form for creating a new habit (title + frequency)
- **`HabitHistoryGrid`** — 7-column Mon–Sun calendar grid showing last 30 days of status
- **`HabitDetailView`** — `/habits/:habitId` route: title, streak stats, frequency, `HabitHistoryGrid`
- **`HabitsView`** — `/habits` management route: active habits list, archived habits, FAB → `CreateHabitModal`
- **`ReviewHabitSection`** — replaces placeholder; shows each active habit's streak + 30-day completion rate

#### 6. Navigation

`UserProfileMenu` gains an optional `onHabitsClick` prop. When provided, a "📊 Habits" menu item appears between "Review" and the Help Section. `CollectionIndexView` passes `() => navigate(ROUTES.habits)`.

### Consequences

**Positive:**
- ✅ Clean aggregate boundary — habits are not tasks masquerading as another type
- ✅ Zero changes to existing aggregates or their events
- ✅ Follows every established pattern: façade projection field, handler-per-command, AppContext injection
- ✅ `HabitProjection` is fully testable in isolation with `InMemoryEventStore`
- ✅ 30-day history + streaks are pure functions of the event log — no derived state stored
- ✅ Offline-first: all habit data lives in `IndexedDB`, no network required
- ✅ Reactive UI: all hooks subscribe to `entryProjection` and re-render on any event

**Negative / Risks:**
- ⚠️ Streak computation iterates `history` on every projection update. For users with many habits (50+) and long histories this is O(habits × 30). *Mitigation:* Streaks are computed in `HabitProjection.buildReadModel()` which only runs when a habit event is appended — not on every render.
- ⚠️ `getHabitsForDate` is called unconditionally in `CollectionDetailView` (React hooks rules). Non-daily collections pass `''` as the date, returning an empty array. *Mitigation:* Empty date returns `[]` immediately — no projection work done.

### SOLID Principles

- **Single Responsibility**: `HabitProjection` answers only habit queries. Each handler handles one command. `HabitsSection` renders only habit rows.
- **Open/Closed**: `EntryListProjection` extended via the façade pattern — not modified structurally. Additive only.
- **Liskov Substitution**: All handlers accept `IEventStore`. Tests use `InMemoryEventStore`.
- **Interface Segregation**: `useHabitsForDate` exposes only read access; `useHabitsManagement` exposes only write access.
- **Dependency Inversion**: All domain classes depend on `IEventStore` abstraction; all UI components depend on `AppContext` abstraction.

### Files Created / Modified

**Domain (packages/domain/src/):**
- `habit.types.ts` — all command, event, and read model types (NEW)
- `habit.handlers.ts` — 8 handler classes (NEW)
- `habit.handlers.test.ts` — handler tests (NEW)
- `habit.projection.ts` — `HabitProjection` (NEW)
- `habit.projection.test.ts` — projection tests (NEW)
- `entry.projections.ts` — private `habit` façade field + 4 delegating methods (MODIFIED)
- `entry.projections.test.ts` — delegation integration tests (MODIFIED)
- `index.ts` — exports for all new public types (MODIFIED)

**Client (packages/client/src/):**
- `hooks/useHabitsForDate.ts` + `.test.ts` — read hook (NEW)
- `hooks/useHabitsManagement.ts` + `.test.ts` — write hook (NEW)
- `hooks/useReviewData.ts` — added `habits` field from `getActiveHabits()` (MODIFIED)
- `hooks/useReviewData.test.ts` — updated mocks + 2 new tests (MODIFIED)
- `context/AppContext.tsx` — 8 new handler fields (MODIFIED)
- `components/HabitRow.tsx` + `.test.tsx` — habit row component (NEW)
- `components/HabitsSection.tsx` + `.test.tsx` — habit list section (NEW)
- `components/CreateHabitModal.tsx` + `.test.tsx` — create modal (NEW)
- `components/HabitHistoryGrid.tsx` + `.test.tsx` — 30-day calendar grid (NEW)
- `components/ReviewHabitSection.tsx` — replaced placeholder with real data (MODIFIED)
- `components/ReviewHabitSection.test.tsx` — 6 new tests (NEW)
- `components/UserProfileMenu.tsx` — optional `onHabitsClick` prop + menu item (MODIFIED)
- `components/UserProfileMenu.test.tsx` — 2 new tests (MODIFIED)
- `views/CollectionDetailView.tsx` — `HabitsSection` + `CreateHabitModal` integrated (MODIFIED)
- `views/CollectionDetailView.test.tsx` — mock patches (MODIFIED)
- `views/CollectionIndexView.tsx` — passes `onHabitsClick` to `UserProfileMenu` (MODIFIED)
- `views/CollectionIndexView.test.tsx` — mock patches (MODIFIED)
- `views/HabitsView.tsx` + `.test.tsx` — `/habits` management route (NEW)
- `views/HabitDetailView.tsx` + `.test.tsx` — `/habits/:habitId` detail route (NEW)
- `views/ReviewView.tsx` — passes `habits` to `ReviewHabitSection` (MODIFIED)
- `views/ReviewView.test.tsx` — updated fixtures (MODIFIED)
- `routes.tsx` — `ROUTES.habits`, `ROUTES.habitDetail` (MODIFIED)
- `App.tsx` — 8 handlers instantiated + 2 new routes (MODIFIED)
- `test/test-utils.tsx` — 8 habit handler stubs (MODIFIED)

---

## ADR-021: Fix Stale `collectionId` Inheritance in Sub-Task Creation

**Date**: 2026-03-25  
**Status**: Accepted

### Context

Monthly log stats showed phantom task counts: sub-tasks created under a moved parent appeared in the wrong collection. The `CreateSubTaskHandler` inherited `collectionId` from `parentTask.collectionId` — a legacy scalar set once at `TaskCreated` time and never updated when the parent moves. Authoritative collection membership is stored in `parentTask.collections[]` per ADR-015.

A secondary issue existed in `isSubTaskMigrated()` inside `sub-task.projection.ts`, which also used the stale `collectionId` scalar for its intersection check instead of `collections[]`.

### Decision

#### 1. `CreateSubTaskCommand` carries `collectionId`

`CreateSubTaskCommand` gains a required `collectionId: string | undefined` field. The client (`useEntryOperations.handleCreateSubTask`) passes `collection?.id` from the active route, with an `UNCATEGORIZED_COLLECTION_ID` guard for uncategorised contexts.

#### 2. `CreateSubTaskHandler` uses `command.collectionId` directly

The handler no longer reads `parentTask.collectionId`. It uses `command.collectionId` directly, avoiding the stale scalar entirely.

#### 3. `isSubTaskMigrated()` updated to use `collections[]` intersection

`isSubTaskMigrated()` in `sub-task.projection.ts` was comparing `subTask.collectionId` against `parentTask.collectionId` — both potentially stale scalars. Updated to perform the correct `collections[]` intersection check (consistent with how the rest of the codebase identifies multi-collection membership per ADR-015).

#### 4. Historical stale data deliberately not backfilled

Sub-tasks created before this fix may have stale `collectionId` scalars baked into historical events. A migration was considered and deliberately skipped — the stale data will stop affecting new sub-tasks immediately, and existing stale sub-tasks will naturally age out as collections are completed or archived.

### Consequences

**Positive:**
- ✅ New sub-tasks always inherit the correct collection from the active route — no phantom counts
- ✅ `isSubTaskMigrated()` produces correct results regardless of whether the parent has been moved
- ✅ Zero changes to domain events or event store — fix is entirely in the command/handler/projection layer
- ✅ Consistent with ADR-015: `collections[]` is the single source of truth for collection membership

**Negative / Risks:**
- ⚠️ Historical sub-tasks with stale `collectionId` scalars are not corrected. Impact is limited to edge cases in `isSubTaskMigrated()` for very old data.
- ⚠️ `CreateSubTaskCommand.collectionId` can be `undefined` for uncategorised contexts. The handler must guard against this (currently handled via `UNCATEGORIZED_COLLECTION_ID`).

### SOLID Principles

- **Single Responsibility**: The handler is responsible for creating the sub-task event; the route is responsible for knowing which collection is active.
- **Open/Closed**: No changes to existing event types or projections beyond the targeted bug-fix.
- **Dependency Inversion**: The handler receives `collectionId` via the command — it does not reach into the read model to derive it.

### Files Modified

- `packages/domain/src/task.types.ts` — `CreateSubTaskCommand` gains `collectionId?: string`
- `packages/domain/src/sub-task.handlers.ts` — handler uses `command.collectionId` directly
- `packages/domain/src/sub-task.projection.ts` — `isSubTaskMigrated()` uses `collections[]` intersection
- `packages/domain/src/sub-task.handlers.test.ts` — regression test for correct collectionId propagation
- `packages/domain/src/sub-task.projections.test.ts` — 3 new intersection tests + mirror intersection test
- `packages/domain/src/complete-parent-task.handler.test.ts` — 23 fixtures updated with `collectionId`
- `packages/client/src/hooks/useEntryOperations.ts` — passes `collection?.id` as `collectionId`

---

## ADR-022: Collection Debug Panel and Clipboard Copy for Debug Tools

**Date**: 2026-03-25  
**Status**: Accepted

### Context

Two developer-experience gaps were identified:

1. **Collection-level debugging was missing.** The existing `EventHistoryDebugTool` shows events for a single entry, but there was no way to see all events that affected a collection (e.g. all `TaskAddedToCollection`, `TaskRemovedFromCollection`, and entry-level events for tasks ever in that collection) in one view. This made diagnosing phantom count bugs slow.

2. **Clipboard copy was missing from debug tools.** Both the entry-level debug tool and the new collection panel output JSON, but copying it required manually selecting text in the panel — error-prone on mobile and small viewports.

### Decision

#### 1. `useCopyToClipboard` — shared hook with `useRef` timer cleanup

A new `useCopyToClipboard(resetDelayMs = 2000)` hook wraps `navigator.clipboard.writeText`. It returns `[copy(text), copied]`. The `copied` flag resets after `resetDelayMs` via a `useRef`-held timer. Using `useRef` (not `useEffect`) for the timer prevents the stale-closure bug that caused the "copied" state to persist on unmount and the rapid double-click reset bug (where the second click's timer would be lost).

#### 2. `CollectionDebugPanel` — two-pass event filter

A new `CollectionDebugPanel` component (dev-only, rendered inside `CollectionHeader`) performs a two-pass filter over all events:

- **Pass 1 (membership):** Collect all entry IDs that have ever appeared in this collection via `TaskAddedToCollection`, `TaskCreatedInCollection`, `TaskMigrated`, or `TaskRemovedFromCollection` events.
- **Pass 2 (full event set):** Include: (a) lifecycle events directly referencing the `collectionId`, (b) membership events for the collection, (c) all events whose `aggregateId` is one of the entry IDs found in Pass 1.

This two-pass approach ensures that events for entries moved INTO the collection are included even if the event's `collectionId` field references a different collection.

The panel renders the events as formatted JSON with a `📋 Copy` / `✓ Copied!` button in the header. It self-gates via `useDebug().isEnabled` — no new props needed on `CollectionHeader`.

#### 3. `CollectionHeader` wires the panel

`CollectionHeader` gains `<CollectionDebugPanel collectionId={collectionId} />` rendered below the existing header content. The panel is self-gating (returns `null` when debug mode is off), so no conditional logic is needed in `CollectionHeader`.

#### 4. `EventHistoryDebugTool` gains clipboard copy

The existing per-entry debug tool gains a `📋 Copy` / `✓ Copied!` button in its panel header, using the shared `useCopyToClipboard` hook. `key={event.id}` replaces `key={index}` in the event list to avoid stale React keys when events stream in.

### Consequences

**Positive:**
- ✅ Collection-level event history visible in one click — dramatically speeds up phantom count / migration debugging
- ✅ Clipboard copy works reliably on all platforms, including mobile
- ✅ `useCopyToClipboard` is fully reusable — zero duplication between the two debug tools
- ✅ Both debug tools are dev-only (gated by `useDebug().isEnabled`) — zero production surface area added
- ✅ `useRef` timer pattern is the correct React pattern for cleanup-outside-useEffect timers

**Negative / Risks:**
- ⚠️ Two-pass filter iterates all events on every render of `CollectionDebugPanel`. For large event stores (5,000+ events) this is perceptible. Mitigation: the panel only renders in dev mode and is not open by default.
- ⚠️ The `navigator.clipboard` API is not available in all test environments — `useCopyToClipboard` tests mock it via `vi.stubGlobal`.

### SOLID Principles

- **Single Responsibility**: `useCopyToClipboard` manages clipboard state only. `CollectionDebugPanel` renders collection-scoped events only. `EventHistoryDebugTool` renders entry-scoped events only.
- **Open/Closed**: `CollectionHeader` is extended with the new panel via composition — its existing structure is unchanged.
- **Interface Segregation**: `CollectionDebugPanel` takes only `collectionId: string` — it fetches events itself via `useEvents()`.
- **Dependency Inversion**: Both debug components depend on `useEvents()` and `useDebug()` hooks (abstractions) rather than directly accessing the event store.

### Files Created / Modified

**Created:**
- `packages/client/src/hooks/useCopyToClipboard.ts` — shared clipboard hook
- `packages/client/src/hooks/useCopyToClipboard.test.ts` — 5 tests (4 unit + 1 rapid double-click)
- `packages/client/src/components/CollectionDebugPanel.tsx` — new collection debug panel
- `packages/client/src/components/CollectionDebugPanel.test.tsx` — 11 tests

**Modified:**
- `packages/client/src/components/CollectionHeader.tsx` — wired `<CollectionDebugPanel collectionId={collectionId} />`
- `packages/client/src/components/CollectionHeader.test.tsx` — 2 new integration tests
- `packages/client/src/components/EventHistoryDebugTool.tsx` — clipboard copy button, `key={event.id}`
- `packages/client/src/components/EventHistoryDebugTool.test.tsx` — 2 new clipboard tests


---

## ADR-023: Event-Driven Eager Sync, FCM Token Refresh, and Device Identity

**Date**: 2026-04-01
**Status**: Accepted

### Context

Three related but independent problems with the push notification pipeline were
identified during user acceptance testing. They are grouped into a single ADR because
they all affect the same subsystem (`fcm.ts`, `SyncManager`, Firestore `fcmTokens`
collection, and the `habitReminderFanOut` Cloud Function), and their solutions must
be co-designed to avoid introducing new inconsistencies.

---

#### Problem 1 — Sync lag between local event store and Firestore

The `SyncManager` uploads local IndexedDB events to Firestore on a 5-minute periodic
interval, supplemented by triggers on window focus and network reconnection (ADR-011).
A Firebase Cloud Function (`habitReminderFanOut`) runs on a 15-minute cron and reads
directly from Firestore to schedule push notifications.

This creates a correctness gap: if a user sets a notification time (`HabitNotificationTimeSet`)
or creates a habit with notifications (`HabitCreated`), the relevant events may sit in
IndexedDB for up to 5 minutes before reaching Firestore. If the Cloud Function executes
during that window, the habit is silently skipped — the user receives no push notification
despite having configured one correctly. This has been the root cause of confirmed
"no push notifications" reports.

---

#### Problem 2 — Stale FCM tokens

Firebase Messaging regenerates a push token when Chrome updates, when site data is
cleared, or when the underlying push subscription expires. The application currently has
no mechanism to detect that a token has changed. The consequence:

- The old token remains in Firestore under its original `sha256(token)` document ID.
- FCM accepts sends to the old token without returning an error (it delivers silently to
  a dead endpoint).
- The device never receives the notification.
- The user has no indication anything went wrong. The only known workaround is manually
  clearing all site data.

Firebase Messaging (modular SDK) does not expose an `onTokenRefresh` callback. Token
rotation is detected by calling `getToken()` and comparing the returned value against
the previously stored token. The heartbeat path in `refreshFcmTokenLastSeen()` already
calls `getToken()` on every app load, but it only updates `lastSeenAt`; it does not
compare the returned token to the stored one or perform any Firestore write when a
change is detected.

The critical missing piece is knowing *what the previous token was* in order to delete
its document. `FCM_TOKEN_STORED_KEY` currently stores the boolean string `'1'`, not the
token value, so there is no record of the old token at cleanup time.

---

#### Problem 3 — Token accumulation and duplicate notifications

Without a stable device identifier, the system cannot distinguish "the same device
re-registering with a new token" from "a second device registering for the first time."
As a result, every token rotation adds a new document to `users/{userId}/fcmTokens/`.
The old document is never deleted (because neither the client nor the Cloud Function has
enough information to identify it as belonging to the same device).

The fan-out in `habitReminderFanOut` sends to every token in the collection. A device
that has rotated its token twice will have three documents, and the user receives three
notifications for a single habit — one for the live token and two for dead endpoints
that FCM silently discards.

The 60-day `pruneStaleTokens` pass provides an eventual cleanup floor, but a device
that is used daily will keep its `lastSeenAt` current on its newest token, while the
older tokens for the same device also appear active (their `lastSeenAt` was recently
written during prior registrations) and may not age out for weeks.

**Options evaluated for Problem 1 (sync lag):**

| Option | Description |
|---|---|
| A | Trigger `syncNow()` from UI call sites after notification-related handler calls |
| B | Subscribe `SyncManager` to `IndexedDBEventStore`; debounced `syncNow()` on every `append()` |
| C | Dual-write: append to both IndexedDB and Firestore simultaneously on every command |
| D | Priority sync queue: mark certain event types as "sync immediately", regular types as "sync periodically" |

**Options evaluated for Problem 2 (stale tokens):**

| Option | Description |
|---|---|
| E | Store the raw token value (not just `'1'`) in `FCM_TOKEN_STORED_KEY`; compare on heartbeat; delete old doc on change |
| F | Always call `setDoc` with `merge: true` on every heartbeat; accept that stale docs accumulate and rely on 60-day prune |
| G | Store the previous `sha256(token)` in a second localStorage key (`FCM_PREV_TOKEN_HASH_KEY`) to enable targeted Firestore deletion |

**Options evaluated for Problem 3 (device identity):**

| Option | Description |
|---|---|
| H | `crypto.randomUUID()` stored in localStorage as `FCM_DEVICE_ID_KEY`; written as `deviceId` field on the Firestore token doc; used as the doc ID instead of `sha256(token)` |
| I | Browser fingerprint derived from user-agent, screen resolution, and timezone; no localStorage write required |
| J | Keep `sha256(token)` as doc ID; add `deviceId` as a field only; use a Firestore query to find and delete the old doc by `deviceId` on refresh |

### Decision

**Problem 1 — Implement Option B:** subscribe `SyncManager` to the local event store
and trigger a debounced `syncNow()` on every `append()`.

`SyncManager.start()` will call `this.localStore.subscribe()` and store the returned
unsubscribe function. The subscriber fires a debounced sync — using the already-existing
`DEBOUNCE.SYNC_OPERATION` (5 000 ms) — after every event written to IndexedDB. The
unsubscribe function is called in `SyncManager.stop()`.

No changes are required to any UI component, command handler, or event type definition.

---

**Problem 2 — Implement Option E:** change `FCM_TOKEN_STORED_KEY` to store the raw FCM
token string (not `'1'`) so the heartbeat path can detect rotation by comparing
`getToken()` output to the stored value. When a mismatch is detected, the old document
is deleted by its `sha256(oldToken)` doc ID before the new document is written.

`FCM_TOKEN_STORED_KEY` currently stores `'1'`. This will change to store the raw token
string. The `FCM_TOKEN_STORED_KEY` value is never displayed in UI (only its presence is
checked by `useFcmRegistrationStatus` via `!!localStorage.getItem(...)`), so the
truthiness contract is preserved — any non-empty string is truthy. No changes to the
hook are required.

---

**Problem 3 — Implement Option H:** generate a `crypto.randomUUID()` device ID on first
registration and persist it in a new `FCM_DEVICE_ID_KEY` localStorage key
(`'fcm-device-id'`). Write it as a `deviceId` field on the Firestore token document.
Keep `sha256(token)` as the Firestore document ID (Option J is rejected; see Rationale).

The combination of Problems 2 and 3 solutions means that on token rotation:
1. The old raw token is read from `FCM_TOKEN_STORED_KEY`.
2. Its `sha256` is computed.
3. The old Firestore document is deleted.
4. A new document is written under `sha256(newToken)` with the same `deviceId`.
5. `FCM_TOKEN_STORED_KEY` is updated to the new raw token.

This restores the one-doc-per-device invariant without requiring any doc-ID migration.

### Rationale

#### Problem 1 — Sync lag

**Why not Option A (trigger from UI)?**

It solves the notification-time problem but requires threading `syncManagerRef` through
React context (or prop-drilling it) to every call site that dispatches a habit event.
Today that is `HabitDetailView` and `CreateHabitModal`; tomorrow it is any component that
ever calls a habit handler. This creates a long-term coupling between the view layer and
the sync infrastructure and violates the Single Responsibility Principle — components
should not know or care when their events are uploaded.

Furthermore, it is incomplete by construction: it only speeds up the events the developer
remembers to annotate. Any new habit-related event type (e.g. `HabitRescheduled`) would
silently fall back to the 5-minute window unless someone remembers to add another
`syncNow()` call.

**Why not Option C (dual-write)?**

Dual-write is fundamentally at odds with the local-first contract established in ADR-003
and ADR-010. The local store is the source of truth; the remote store is a replica. If
the Firestore write fails (network unavailable, auth token expired, quota exceeded), the
command either throws an error visible to the user — breaking offline functionality — or
silently discards the remote write, leaving an inconsistent state that is harder to
diagnose than the original lag problem. Dual-write also bypasses the idempotency and
deduplication logic in `SyncManager.syncNow()`, which compares event ID sets before
writing to Firestore. Direct `append()` calls to the remote store duplicate that
responsibility.

**Why not Option D (priority queue)?**

A priority queue solves the right problem but introduces the wrong invariant. It requires
the domain layer (or a configuration table) to encode which event types are
"notification-sensitive" — a coupling between sync policy and domain semantics. As the
habit feature evolves, the priority list must be maintained manually. The complexity of
two parallel flush paths (immediate vs periodic) also complicates `SyncManager` tests.
Option B achieves the same latency outcome without any event-type classification.

**Why Option B is correct:**

The `IndexedDBEventStore.subscribe()` API already exists and already fires reliably after
every committed write — both single `append()` and batched `appendBatch()` calls. The
`SyncManager` already owns a debounced `syncNow()` with concurrent-sync protection. The
only missing wiring is connecting these two existing mechanisms at construction time.

This means:
- Every event — not just habit events — gets uploaded within `DEBOUNCE.SYNC_OPERATION`
  milliseconds of being written locally. The Cloud Function's 15-minute window is no
  longer a race hazard for any event type.
- The debounce (5 000 ms default) collapses burst writes (e.g. bulk migration of 30
  tasks) into a single upload, preserving the efficiency of `SyncManager`'s batch-diff
  upload path.
- The `isSyncing` guard in `syncNow()` prevents the subscriber from queuing a concurrent
  sync if one is already in flight.
- The periodic 5-minute interval and focus/online triggers remain in place as a safety
  net for any edge cases where the subscriber fires but `syncNow()` is debounced past
  the window.
- No UI components, command handlers, or event types change. All call sites remain
  decoupled from sync infrastructure.

**Interaction with `appendBatch()` (ADR-018):**

`IndexedDBEventStore.appendBatch()` already notifies subscribers once per event in the
batch after the transaction commits. The subscriber will therefore fire N times for a
batch of N events. Because the debounce collapses all N notifications into a single
`syncNow()` call, this is correct and efficient — N events produce at most 1 upload
cycle.

**Interaction with the download path:**

`SyncManager.syncNow()` itself calls `this.localStore.appendBatch()` when downloading
remote events. Those `appendBatch()` subscriber notifications will re-enter the subscriber
and schedule another debounced `syncNow()`. However, the subsequent `syncNow()` will
compare local and remote IDs and find zero new events to upload, completing immediately.
The `isSyncing` guard prevents re-entrancy if the download is still in progress. This is
a benign no-op extra sync round-trip after download; its cost (one `getAll()` call to
each store) is acceptable.

If this round-trip proves noisy in profiling, a future mitigation is to pass a
`{ source: 'sync-download' }` flag through `appendBatch()` so the subscriber can skip
scheduling an upload. This is not needed now.

---

#### Problem 2 — Stale tokens

**Why not Option F (always setDoc with merge, rely on prune)?**

`merge: true` on `setDoc` is idempotent for the _same_ document, but token rotation
produces a _different_ document ID (`sha256(newToken)` vs `sha256(oldToken)`). Calling
`setDoc` on the new document does nothing to remove the old document. Old documents
accumulate and are only cleaned up if they go 60 days without an update, which may not
happen for actively used devices (see Problem 3). This option does not address the
problem.

**Why not Option G (store previous hash in a second localStorage key)?**

Option G requires two localStorage reads and two writes on every refresh cycle: storing
the new hash and separately storing it as "previous" before the next cycle. It also
introduces a window where the two keys can fall out of sync — for example if the process
is killed between writing `FCM_TOKEN_STORED_KEY` and `FCM_PREV_TOKEN_HASH_KEY`. Option E
is strictly simpler: storing the raw token in a single key gives us both the hash (via
`sha256`) and the equality check in one read. There is no synchronisation risk because
the stored value and the hash are derived from the same source at the same moment.

**Why Option E is correct:**

The only information needed for cleanup is the old token's raw string — from which we can
re-derive its `sha256` doc ID and issue a targeted `deleteDoc`. Storing the raw token
in `FCM_TOKEN_STORED_KEY` (instead of `'1'`) gives us exactly that information with zero
additional storage overhead. The truthiness contract used by `useFcmRegistrationStatus`
(`!!localStorage.getItem(FCM_TOKEN_STORED_KEY)`) is preserved because any non-empty
string is truthy.

The detection mechanism is a simple string equality check in `refreshFcmTokenLastSeen()`:
if `getToken()` returns a value that differs from `localStorage.getItem(FCM_TOKEN_STORED_KEY)`,
the token has rotated. The function deletes the old Firestore document, writes a new one,
and updates the localStorage value in a single atomic sequence (Firestore operations are
not transactional with localStorage, but the failure modes are safe: if the Firestore
delete fails we retain the old doc and try again on the next heartbeat; if the Firestore
write fails we do not update localStorage and retry on the next heartbeat).

The `FCM_TOKEN_STORED_KEY` value is written in `fcm.ts` only; it is never read as a
string anywhere else in the codebase (only its presence is checked). This change is
therefore non-breaking for all consumers.

---

#### Problem 3 — Token accumulation

**Why not Option I (browser fingerprint)?**

A fingerprint derived from user-agent, screen resolution, and timezone is not stable.
Chrome updates change the user-agent; a user connecting a different monitor changes
screen resolution. A fingerprint collision between two distinct devices on the same user
account would silently delete the live token for the other device on re-registration.
The instability and collision risks make fingerprinting unsuitable as a device identity
anchor.

**Why not Option J (deviceId as field only, Firestore query to find old doc)?**

Option J requires an additional Firestore read on every token rotation — a
`where('deviceId', '==', deviceId)` query — to find the old document before deleting
it. It also requires a composite index on `fcmTokens.deviceId`. This is more network
overhead and more Firestore configuration for no benefit over Option H, which performs
the same lookup implicitly via the `sha256(oldToken)` doc ID already stored in
localStorage (after adopting Option E). Option J also has a race condition: two rapid
registrations from the same device could produce two documents that both match the
`deviceId` query, and the delete would need to target all but the latest.

**Why Option H is correct:**

`crypto.randomUUID()` produces a cryptographically random 128-bit identifier. It is
stable across token rotations as long as localStorage is not cleared (which is exactly
the event that also invalidates the FCM token, triggering a new registration anyway —
at which point a new device ID is generated and the old document does not exist to
conflict). The UUID is generated once and stored in `FCM_DEVICE_ID_KEY`; every subsequent
call reads the stored value.

The `deviceId` field on the Firestore token document is informational metadata for the
fan-out. The fan-out itself does not change: it still sends to every document in the
collection. The `deviceId` ensures that token rotation results in a delete-then-write
rather than a write (with the old document lingering), which is the correct invariant.

Keeping `sha256(token)` as the Firestore document ID (rather than `deviceId`) preserves
the existing security property: the Firestore document ID is not the raw token, so a
read of the document list does not expose the tokens directly. The `deviceId` UUID
carries no such risk — it is a meaningless identifier with no relationship to the push
endpoint.

### Firestore Token Document Schema

The existing schema is extended with two new fields:

```typescript
// users/{userId}/fcmTokens/{sha256(token)}
type FcmTokenDoc = {
  token: string;           // raw FCM token (existing)
  timezone: string;        // IANA timezone string (existing)
  lastSeenAt: Timestamp;   // server timestamp, updated on every heartbeat (existing)
  appVersion: string;      // VITE_APP_VERSION (existing)
  createdAt: Timestamp;    // server timestamp, set on first write only (existing)
  deviceId: string;        // NEW — crypto.randomUUID(), stable per browser profile
};
```

The document ID remains `sha256(token)`. No existing documents need migration — old
documents without a `deviceId` field continue to work correctly in the fan-out, which
does not read `deviceId`. They will naturally age out via the 60-day prune or be replaced
when the device next rotates its token.

### localStorage Keys

Three keys are now used by `fcm.ts`:

| Key | Previous value | New value | Purpose |
|---|---|---|---|
| `fcm-permission-requested` | `'1'` | `'1'` (unchanged) | Prevents re-prompting for browser permission |
| `fcm-token-stored` | `'1'` | raw FCM token string | Enables token rotation detection; presence check still works via truthiness |
| `fcm-device-id` | (new) | UUID string | Stable device identity, generated once per browser profile |

`useFcmRegistrationStatus` reads only `FCM_REQUESTED_KEY` and `FCM_TOKEN_STORED_KEY` via
`!!localStorage.getItem(...)`. The truthiness contract is unchanged; no modifications
to the hook are required.

### Consequences

**Positive:**
- Habit-related events (and all events) reach Firestore within ~5 seconds of being
  written locally, eliminating the Cloud Function race window.
- Token rotation is detected automatically on the next heartbeat (app load). The stale
  document is deleted and the new document is written before the next Cloud Function run.
- The one-doc-per-device invariant means the fan-out sends exactly one notification per
  device, regardless of how many times the token has rotated over the device's lifetime.
- Zero changes to UI components or command handlers — call sites remain fully decoupled
  from sync infrastructure.
- No new domain event types, no priority classifications.
- Offline resilience is unchanged: local writes always succeed; the subscriber simply
  schedules a sync that will fail gracefully and be retried on the next focus/online event.
- The `deviceId` field provides diagnostic value in Firestore: operators can see which
  device is which when inspecting a user's token collection.
- The fan-out's existing send-error handling
  (`messaging/registration-token-not-registered` delete) remains as a last-resort safety
  net for tokens that slip through the client-side rotation detection.

**Negative / Risks:**
- Upload frequency increases from "once per 5 minutes" to "within 5 seconds of every
  write". The debounce mitigates burst cost; deduplication in `syncNow()` ensures no
  event is double-written. Firestore billing impact is negligible at personal-use scale.
- The download-triggered re-entry adds one extra Firestore `getAll()` after every
  background sync download. Acceptable at current scale.
- Tests that use a real `IndexedDBEventStore` and real `SyncManager` together will now
  trigger sync attempts after every `append()`. Tests should continue to use
  `InMemoryEventStore` (whose `subscribe()` is a no-op stub) or mock the subscriber.
- Storing the raw FCM token in localStorage is a minor security regression vs. storing
  `'1'`. The token is a bearer credential for sending push notifications to this device.
  However: (a) tokens are already stored in Firestore in plaintext, (b) an attacker with
  localStorage access also has access to auth cookies and session state — the token is
  not the most sensitive asset present, (c) the token is useless without the VAPID key,
  which is not in localStorage. This tradeoff is accepted.
- If a user clears site data, `FCM_DEVICE_ID_KEY` is lost and a new UUID is generated on
  the next registration. The old Firestore document (for the previous device ID and
  token) will not be proactively deleted because we no longer have the old token. It will
  age out via the 60-day prune. This is acceptable: clearing site data is a deliberate
  user action that breaks the continuity of all local state, not just FCM.

### SOLID Principles

- **Single Responsibility**: `SyncManager` remains the sole owner of upload timing
  policy. `fcm.ts` remains the sole owner of token lifecycle (registration, refresh,
  device identity). UI components own user interaction only. No responsibility crosses
  boundaries.
- **Open/Closed**: Problem 1 extends `SyncManager.start()` and `SyncManager.stop()` with
  new wiring without modifying existing methods. Problems 2 and 3 extend
  `registerFcmToken()` and `refreshFcmTokenLastSeen()` by adding rotation detection and
  device identity logic; the public function signatures do not change.
- **Liskov Substitution**: The subscriber mechanism works identically with
  `IndexedDBEventStore`, `InMemoryEventStore`, or any future `IEventStore` implementation
  that honours the `subscribe()` contract.
- **Interface Segregation**: `IEventStore.subscribe()` is already part of the minimal
  interface contract. No interface changes are needed.
- **Dependency Inversion**: `SyncManager` depends on `IEventStore` (abstraction) not
  `IndexedDBEventStore` (concrete class). The subscriber wiring respects this boundary.
  `fcm.ts` has no dependency on `SyncManager` or any React component — it operates
  entirely at the infrastructure layer.

### Implementation Plan

#### Step 1 — Extend `SyncManager` (Problem 1)

**File:** `packages/client/src/firebase/SyncManager.ts`

Add two private fields:

```typescript
private unsubscribeFromLocalStore?: () => void;
private debounceTimer: number | null = null;
```

Add a private `debouncedSyncNow()` method that collapses burst subscriber notifications
into a single `syncNow()` call:

```typescript
private debouncedSyncNow(): void {
  if (this.debounceTimer !== null) {
    clearTimeout(this.debounceTimer);
  }
  this.debounceTimer = window.setTimeout(() => {
    this.debounceTimer = null;
    void this.syncNow();
  }, this.syncDebounceMs);
}
```

In `start()`, after the existing `setupEventListeners()` call, subscribe to the local
store:

```typescript
this.unsubscribeFromLocalStore = this.localStore.subscribe(() => {
  this.debouncedSyncNow();
});
```

In `stop()`, unsubscribe and clear any pending timer before returning:

```typescript
this.unsubscribeFromLocalStore?.();
this.unsubscribeFromLocalStore = undefined;
if (this.debounceTimer !== null) {
  clearTimeout(this.debounceTimer);
  this.debounceTimer = null;
}
```

Note: `syncNow()` already has a `lastSyncTime` debounce guard. The `debouncedSyncNow()`
timer is a separate, clearable debounce for collapsing burst subscriber notifications
before they reach `syncNow()`. The two guards are complementary.

**Tests to add** (`packages/client/src/firebase/SyncManager.test.ts`):
- After `start()`, simulating an `append()` on the mock local store schedules a
  `syncNow()` call within `syncDebounceMs` (use `vi.useFakeTimers()`)
- Burst appends within the debounce window produce exactly one `syncNow()` call, not N
- After `stop()`, appends on the local store no longer trigger `syncNow()`
- A download-path `appendBatch()` produces at most one follow-on `syncNow()` after the
  debounce window elapses

---

#### Step 2 — Add device identity generation (Problem 3)

**File:** `packages/client/src/firebase/fcm.ts`

Export a new constant:

```typescript
export const FCM_DEVICE_ID_KEY = 'fcm-device-id';
```

Add a helper that returns the stored device ID, generating and persisting a new UUID on
first call:

```typescript
function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(FCM_DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(FCM_DEVICE_ID_KEY, id);
  return id;
}
```

This function does not dispatch a synthetic storage event — `FCM_DEVICE_ID_KEY` is never
observed by `useFcmRegistrationStatus` and changes to it require no UI update.

---

#### Step 3 — Store raw token in `FCM_TOKEN_STORED_KEY` (Problems 2 and 3)

**File:** `packages/client/src/firebase/fcm.ts`

In `registerFcmToken()`, change:

```typescript
setLocalStorageKey(FCM_TOKEN_STORED_KEY, '1');
```

to:

```typescript
setLocalStorageKey(FCM_TOKEN_STORED_KEY, token);
```

Also add `deviceId` to the `setDoc` call:

```typescript
await setDoc(
  doc(firestore, `users/${userId}/fcmTokens/${tokenId}`),
  {
    token,
    deviceId: getOrCreateDeviceId(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lastSeenAt: serverTimestamp(),
    appVersion: import.meta.env['VITE_APP_VERSION'] ?? 'unknown',
    createdAt: serverTimestamp(),
  },
  { merge: true },
);
```

---

#### Step 4 — Detect and handle token rotation in the heartbeat path (Problem 2)

**File:** `packages/client/src/firebase/fcm.ts`

Rewrite `refreshFcmTokenLastSeen()` to compare the new token against the stored value
and perform a delete-then-write when rotation is detected:

```typescript
async function refreshFcmTokenLastSeen(userId: string): Promise<void> {
  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const newToken = await getToken(messaging, {
      vapidKey: import.meta.env['VITE_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: swRegistration,
    });

    if (!newToken) {
      removeLocalStorageKey(FCM_TOKEN_STORED_KEY);
      return;
    }

    const storedToken = localStorage.getItem(FCM_TOKEN_STORED_KEY);
    const tokenRotated = storedToken && storedToken !== newToken;

    const { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } =
      await import('firebase/firestore');

    if (tokenRotated) {
      // Delete the old document (best-effort — if it fails we continue)
      try {
        const oldTokenId = await sha256hex(storedToken);
        await deleteDoc(doc(firestore, `users/${userId}/fcmTokens/${oldTokenId}`));
      } catch {
        // Silent fail — old doc will age out via 60-day prune
      }

      // Write the new document
      const newTokenId = await sha256hex(newToken);
      await setDoc(
        doc(firestore, `users/${userId}/fcmTokens/${newTokenId}`),
        {
          token: newToken,
          deviceId: getOrCreateDeviceId(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lastSeenAt: serverTimestamp(),
          appVersion: import.meta.env['VITE_APP_VERSION'] ?? 'unknown',
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Update localStorage to reflect the new token
      setLocalStorageKey(FCM_TOKEN_STORED_KEY, newToken);
      return;
    }

    // Token unchanged — update heartbeat fields only
    const tokenId = await sha256hex(newToken);
    await updateDoc(
      doc(firestore, `users/${userId}/fcmTokens/${tokenId}`),
      {
        lastSeenAt: serverTimestamp(),
        appVersion: import.meta.env['VITE_APP_VERSION'] ?? 'unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    );
  } catch {
    // Silent fail
  }
}
```

Note on the `tokenRotated` condition: when `storedToken` is `null` (pre-migration
sessions where `FCM_TOKEN_STORED_KEY` was `'1'` and has since been cleared, or the app
was never fully registered), we skip rotation handling and fall through to the
`updateDoc` heartbeat. On the next full registration the correct raw token will be stored.

If `storedToken` is `'1'` (a user who was registered before this change is deployed),
`'1' !== newToken` is true and the code will attempt to compute `sha256('1')` and delete
that doc, which does not exist. The `deleteDoc` call will fail silently (Firestore
returns success on deleting a non-existent document), and the new document will be
written correctly. This means the one-time migration for existing users is self-healing
with no special case required.

---

#### Step 5 — Tests for `fcm.ts`

**File:** `packages/client/src/firebase/fcm.test.ts`

New test cases:
- `getOrCreateDeviceId()` returns the same UUID on repeated calls within a session
- `getOrCreateDeviceId()` generates a new UUID and persists it if `FCM_DEVICE_ID_KEY`
  is absent from localStorage
- `registerFcmToken()` writes the raw token string (not `'1'`) to `FCM_TOKEN_STORED_KEY`
- `registerFcmToken()` writes `deviceId` to the Firestore document
- `refreshFcmTokenLastSeen()` calls `deleteDoc` on `sha256(oldToken)` and `setDoc` on
  `sha256(newToken)` when `getToken()` returns a different value than `FCM_TOKEN_STORED_KEY`
- `refreshFcmTokenLastSeen()` calls only `updateDoc` (no delete, no setDoc) when
  `getToken()` returns the same value as `FCM_TOKEN_STORED_KEY`
- `refreshFcmTokenLastSeen()` skips the delete when `storedToken` is null and writes the
  new document correctly
- `refreshFcmTokenLastSeen()` continues to the `setDoc` write even if the `deleteDoc`
  call throws

---

#### Step 6 — No other files change

`HabitDetailView`, `CreateHabitModal`, `App.tsx`, `IndexedDBEventStore`,
`useFcmRegistrationStatus`, `habit-reminder-fanout.ts`, and all event type definitions
are unchanged. The fan-out reads all documents from `fcmTokens` and sends to each token
field — `deviceId` is additive metadata that the fan-out ignores.

### Files to Modify

- `packages/client/src/firebase/SyncManager.ts` — subscribe to local event store in `start()`, unsubscribe in `stop()`, add `debouncedSyncNow()` private method
- `packages/client/src/firebase/SyncManager.test.ts` — subscriber-triggered sync tests (estimated: 4 new tests)
- `packages/client/src/firebase/fcm.ts` — export `FCM_DEVICE_ID_KEY`, add `getOrCreateDeviceId()`, update `registerFcmToken()` to store raw token and `deviceId`, rewrite `refreshFcmTokenLastSeen()` with rotation detection
- `packages/client/src/firebase/fcm.test.ts` — token rotation and device identity tests (estimated: 8 new tests)

---

## ADR-024: Cold-Start Restoration Sequence for Returning Users on Empty Local Store

**Date**: 2026-04-01
**Status**: Accepted

### Context

ADR-017 introduced a remote snapshot fetch at the start of `startSync()` and gated
`isAppReady` on `!isRemoteRestoring` to prevent the tutorial from firing before the
Firestore check resolved. That ADR was designed around the **happy path**: Firestore
responds within 5 seconds, the snapshot is newer than the local snapshot, `hydrate()` is
called, and the overlay is skipped.

Three distinct failure modes remain, each producing a broken user experience for returning
users opening the app on a device with empty IndexedDB:

---

#### Failure Mode 1 — Tutorial fires on slow or unavailable networks

The existing cold-start path races the Firestore snapshot fetch against a 5-second
timeout. When the network is slow or Firestore is temporarily unavailable, the race
resolves to `null` and the `finally` block clears `isRemoteRestoring` immediately. At
that point:

- Local IndexedDB is empty (no events, no local snapshot).
- `isLoading` is already `false` (set by `initializeApp()`).
- `isSyncing` is `false` until `SyncManager.start()` fires — but `SyncManager` is
  constructed **after** the `finally` block.
- There is a React render cycle between `setIsRemoteRestoring(false)` and the
  `SyncManager.start()` call that sets `isSyncing = true`.

During that render cycle, `isAppReady` is `true`, `collections.length === 0`, and
`CollectionIndexView.useEffect` fires `startTutorial()` — even though the user has years
of data in Firestore that the background sync is about to download.

---

#### Failure Mode 2 — Empty state shown before background sync populates the projection

On the same slow-network path, the user sees a blank `CollectionIndexView` between when
`isRemoteRestoring` clears and when the background `SyncManager` sync completes. The
sync overlay is never shown (because `restoredFromRemoteRef.current` is `false` only when
the remote snapshot was actually applied; the timeout path leaves it `false` and
`isSyncing` is set to `true`, which should show the overlay — but see the timing gap
above). The net result: a flash of empty state, then tutorial, then the sync overlay
finally appears.

Specifically, because `SyncManager` on the non-restore path sets `isSyncing = true`
synchronously inside `startSync()`, and `isAppReady` gates on
`!isSyncing || syncManager?.initialSyncComplete`, the overlay should eventually appear.
However the race between `setIsRemoteRestoring(false)` and the `SyncManager`
instantiation means there is at minimum one render where the app is "ready" but empty.

---

#### Failure Mode 3 — Remote snapshot is never fetched on cold start when local IndexedDB
is non-empty but stale

The current cold-start logic always attempts the remote snapshot fetch, regardless of
local store state. This means every app open — including frequent daily users with a
warm local store — incurs a Firestore read on startup. ADR-017 accepted this as an
acceptable cost ("single document fetch, < 1KB"). However, the fetch is only beneficial
when the local store is empty or significantly behind. The comparison currently uses
`savedAt` timestamps on the snapshots, which correctly skips the seed when the local
snapshot is newer — but it still awaits the Firestore round-trip before clearing
`isRemoteRestoring` on every open. On slow networks this delays `isAppReady` by up to
5 seconds for users who do not need the remote restore at all.

This is a performance regression introduced by ADR-017 that is only observable on slow
networks, but it affects all users, not just those on new devices.

---

### Root Cause Analysis

The three failures share a common root cause: **the decision of whether to show the
tutorial, show empty state, or show a loading indicator is determined by `isAppReady`,
but `isAppReady` does not encode the full picture of whether a cold-start restore is
actually needed**.

Specifically:

1. `isRemoteRestoring` starts `true` (conservative) but is cleared by the timeout race
   rather than by the result of a local-store emptiness check. This means the gate
   applies the same latency cost to all users and still fails when the timeout fires.

2. There is no single boolean that answers "is this device definitively a new device
   (no local events, no remote snapshot) versus a returning user that just needs data
   downloaded?"

3. The tutorial trigger in `CollectionIndexView` gates only on `isAppReady` and
   `collections.length === 0`. It has no way to distinguish "empty because truly new"
   from "empty because background sync hasn't completed yet".

---

### Decision

Implement a **three-phase cold-start sequencer** that runs immediately after auth
resolves and drives `isAppReady` with a more precise state machine than the current
pair of booleans (`isRemoteRestoring`, `isSyncing`).

#### Phase 0 — Local store emptiness check (synchronous, free)

Before initiating any network request, call `eventStore.getAll()` to determine whether
the local IndexedDB has any events. This call is already made by `entryProjection.hydrate()`
during `initializeApp()`; the result is available via the in-memory cache.

Introduce a new exported helper on `EntryListProjection`:

```typescript
/** Returns true if the local event store contains zero events at hydration time. */
isLocalStoreEmpty(): boolean
```

This is a pure accessor over the `absorbedEventIds` set populated by `hydrate()`:
if the set is empty after `hydrate()`, the local store had no events at startup.
No new IndexedDB call is needed.

#### Phase 1 — Determine restoration intent (immediately after auth resolves)

Introduce a new `ColdStartPhase` type in `App.tsx`:

```typescript
type ColdStartPhase =
  | 'checking'       // Auth resolved; determining what to do
  | 'restoring'      // Fetching remote snapshot and/or seeding local store
  | 'syncing'        // Normal SyncManager initial sync in progress
  | 'ready';         // App ready for user interaction
```

Replace the pair of `isRemoteRestoring` + `isSyncing` booleans with a single
`coldStartPhase` state value. `isAppReady` becomes:

```typescript
const isAppReady = coldStartPhase === 'ready';
```

The sync overlay and loading state are driven by `coldStartPhase`:

```
'checking'  → spinner, "Loading…"
'restoring' → spinner, "Restoring your journal…"
'syncing'   → spinner, "Syncing your journal…"
'ready'     → no overlay
```

#### Phase 2 — Local-emptiness-gated remote snapshot fetch

When the user is authenticated and `initializeApp()` completes, the sequencer runs:

```
if localStoreEmpty:
  coldStartPhase = 'checking'  (already set)
  attempt remoteSnapshot = FirestoreSnapshotStore.load('entry-list-projection')
    with 10-second timeout (increased from 5s — see Rationale)

  if remoteSnapshot !== null:
    coldStartPhase = 'restoring'
    save remoteSnapshot to local IndexedDBSnapshotStore
    call entryProjection.hydrate()   ← re-hydrate with the seeded snapshot
    coldStartPhase = 'syncing'       ← SyncManager starts, but skip overlay
    start SyncManager (no overlay — restoredFromRemoteRef = true)
    coldStartPhase = 'ready' after SyncManager.initialSyncComplete

  else if remoteSnapshot === null (truly new user OR snapshot not yet written):
    coldStartPhase = 'syncing'
    start SyncManager with overlay
    coldStartPhase = 'ready' after SyncManager.initialSyncComplete

else (localStoreNonEmpty):
  skip remote snapshot fetch entirely — do NOT await Firestore
  coldStartPhase = 'ready'  ← set synchronously before SyncManager starts
  start SyncManager in background (no overlay, ADR-017 restored-from-remote path)
```

This eliminates Failure Mode 3: users with a non-empty local store never wait for a
Firestore round-trip before `isAppReady` becomes `true`.

#### Phase 3 — Tutorial suppression by phase, not by collection count

Change `CollectionIndexView`'s tutorial trigger to gate on both `isAppReady` AND
`collections.length === 0` AND a new condition: `coldStartPhase` was never `'restoring'`
or `'syncing'` during this session.

Concretely: introduce a `sessionStorage` flag `squickr_cold_start_restored` that is
written when `coldStartPhase` transitions through `'restoring'` or `'syncing'`. The
tutorial trigger checks:

```typescript
const wasRestoredThisSession =
  sessionStorage.getItem('squickr_cold_start_restored') === 'true';

if (
  realCollections.length === 0 &&
  !hasSeenThisSession &&
  !hasCompletedTutorial &&
  !wasRestoredThisSession  // ← NEW
) {
  startTutorial();
}
```

The flag is set in `App.tsx` whenever `coldStartPhase` transitions to `'syncing'` (i.e.
whenever a SyncManager sync was needed — whether or not the remote snapshot was found).
It is cleared by `TutorialContext.resetTutorial()` (developer convenience only).

This eliminates Failure Mode 1 entirely: even if the background sync has not yet
populated any collections, the tutorial will not fire during a session where a sync was
in progress.

#### Phase 4 — Eliminating the empty-state flash (Failure Mode 2)

The flash occurs because `isAppReady` becomes `true` before the SyncManager overlay
appears. With the new state machine this cannot happen:

- If `localStoreEmpty && remoteSnapshot !== null`: `coldStartPhase` transitions directly
  from `'restoring'` to `'syncing'` to `'ready'`. The overlay shows `'restoring'` then
  `'syncing'` text. `isAppReady` is `false` throughout. No flash.

- If `localStoreEmpty && remoteSnapshot === null`: `coldStartPhase` is `'syncing'` from
  the moment `SyncManager` starts. `isAppReady` is `false`. No flash.

- If `localStoreNonEmpty`: `coldStartPhase` is `'ready'` immediately. The store is
  already populated. No empty state to flash.

#### Handling the timeout case (slow network, empty local store)

When `localStoreEmpty` is `true` and the Firestore fetch times out:

- `coldStartPhase` transitions from `'checking'` to `'syncing'` (the null-snapshot branch).
- `SyncManager` starts with the full overlay: `isSyncing = true`, overlay shown.
- `wasRestoredThisSession` is set to `'true'` in sessionStorage.
- When `SyncManager.initialSyncComplete` fires, `coldStartPhase` = `'ready'`.
- `isAppReady` becomes `true` with collections now populated. Tutorial does not fire
  because `wasRestoredThisSession` is set.

This is the correct behaviour: the user waits behind the sync overlay (as they would
have on any pre-ADR-017 cold start), but they do not see the tutorial afterward.

#### Increasing the remote snapshot timeout from 5 to 10 seconds

ADR-017 used 5 seconds on the basis that the remote restore is "best-effort". With the
new state machine, the remote snapshot fetch only runs when local IndexedDB is empty —
i.e. the user is on a new device and has no data locally. On such a device, a 5-second
timeout failure falls back to a full event-log download via `SyncManager`, which may
itself take 10–30 seconds for a heavy user. The 5-second timeout is not protecting
the user from a long wait; it is merely choosing a slightly slower recovery path
(full sync vs snapshot + delta sync) with no user-visible benefit.

10 seconds is chosen as a timeout that covers typical mobile network round-trip times
to Firestore without being long enough to feel like a hang. If the fetch fails at 10
seconds, the fallback to full sync is transparent to the user (they see "Syncing your
journal…" either way).

---

### Event Model

No new domain events, event types, or aggregates are introduced. The cold-start
restoration is a read-side optimisation — it populates the local store from a remote
snapshot and then lets the existing `SyncManager` + `EntryListProjection` machinery
handle everything from that point.

The new `isLocalStoreEmpty(): boolean` method on `EntryListProjection` is a pure
read-model accessor. It is implemented as:

```typescript
isLocalStoreEmpty(): boolean {
  // absorbedEventIds is populated by hydrate() from all event IDs in the local store.
  // If it is null, hydrate() has not been called — treat as empty (safe default: may
  // trigger unnecessary remote fetch, but never incorrectly suppresses tutorial for a
  // new user).
  // If it is an empty Set, the local store had zero events at hydration time.
  return this.absorbedEventIds === null || this.absorbedEventIds.size === 0;
}
```

Note: `absorbedEventIds` is `null` before `hydrate()` runs and is drained to empty as
events are absorbed. After the cold-start sync completes and genuine new events arrive,
`absorbedEventIds` is set to `null` (absorption mode cleared). This means
`isLocalStoreEmpty()` is only meaningful between `hydrate()` completing and the first
new event being appended — exactly the window in which the cold-start sequencer needs it.
If called after that window it may return `false` (from the `null` branch — safe, treats
as non-empty) or `true` (if the Set has been drained to size 0 but not yet nulled). To
avoid this ambiguity, the sequencer must call `isLocalStoreEmpty()` exactly once,
immediately after `initializeApp()` completes, and store the result in a local constant.

Alternatively, a simpler implementation: add a separate `localStoreWasEmpty: boolean`
field to `EntryListProjection`, set once in `hydrate()` before applying any events, and
never mutated afterward. This is the preferred implementation as it avoids the
`absorbedEventIds` timing ambiguity:

```typescript
// In EntryListProjection.hydrate():
private localStoreWasEmptyAtHydration = false;

async hydrate(): Promise<void> {
  const snapshot = await this.snapshotStore?.load('entry-list-projection') ?? null;
  // ... existing logic ...
  const allEvents = await this.eventStore.getAll();
  this.localStoreWasEmptyAtHydration = allEvents.length === 0;
  // ... rest of hydration ...
}

/** True if the local event store contained zero events when hydrate() last ran. */
wasLocalStoreEmptyAtHydration(): boolean {
  return this.localStoreWasEmptyAtHydration;
}
```

---

### State Machine Diagram

```
Auth resolves
      │
      ▼
[initializeApp()] ──► coldStartPhase = 'checking'
      │
      ▼
isLocalStoreEmpty()?
      │
   YES │                          NO
      ▼                            ▼
Fetch remote snapshot         coldStartPhase = 'ready'
(10s timeout)                 SyncManager starts (background)
      │
   ┌──┴──────────────┐
   │ snapshot found  │  timeout / null
   ▼                 ▼
coldStartPhase    coldStartPhase
= 'restoring'     = 'syncing'
seed local store  SyncManager starts
hydrate()         (with overlay)
   │              wasRestoredThisSession = 'true'
   ▼                 │
coldStartPhase        │
= 'syncing'           │
SyncManager starts    │
(no overlay)          │
wasRestoredThisSession│
= 'true'              │
   │                  │
   └──────────────────┘
           │
           ▼
   SyncManager.initialSyncComplete
           │
           ▼
   coldStartPhase = 'ready'
   isAppReady = true
```

---

### Rationale

**Why a phase enum instead of two booleans?**

The existing `isRemoteRestoring` + `isSyncing` pair has three meaningful states
(`restoring`, `syncing`, `ready`) but four representable states (including the
transitional "both false, neither complete" state that produces the flash). A named
enum makes the illegal state unrepresentable and makes overlay copy (`"Restoring…"` vs
`"Syncing…"`) trivially derivable from a single value.

**Why gate the remote snapshot fetch on `localStoreWasEmptyAtHydration`?**

Fetching the remote snapshot unconditionally (ADR-017 behaviour) adds a Firestore read
on every startup for every user. For users who use the app daily on the same device,
this fetch is never useful — their local snapshot is always newer than the remote one.
The `savedAt` comparison correctly skips the seed in this case, but the round-trip
latency still delays `isAppReady` by up to 5 seconds on slow networks. Gating the fetch
on `localStoreWasEmptyAtHydration` makes the fast path (local store non-empty) free of
any network dependency, restoring the original offline-first startup time for the
overwhelming majority of sessions.

The remote snapshot fetch is a new-device optimisation. It should only run when a new
device is detected.

**Why `wasLocalStoreEmptyAtHydration()` rather than checking `IEventStore.getAll().length`?**

`entryProjection.hydrate()` already calls `eventStore.getAll()` internally. A second
`getAll()` call in `App.tsx` would duplicate the IndexedDB read. Capturing the result as
a field during `hydrate()` is free — it costs one integer comparison and one boolean
assignment at the time the data is already in memory.

**Why `sessionStorage` for `wasRestoredThisSession` rather than a React ref?**

`CollectionIndexView` is not a child of the component that owns `coldStartPhase` state.
Threading a prop or context value through to `CollectionIndexView` would require either
adding `coldStartPhase` to `AppContext` (polluting a domain-oriented context with startup
infrastructure state) or creating a new context for it. `sessionStorage` is a simpler,
zero-coupling solution: it is written by `App.tsx` once and read by `CollectionIndexView`
once. It is correctly scoped to the session — if the user reloads the page, the sequencer
re-runs and re-sets the flag if needed.

**Why not fix the tutorial logic to check for an active `SyncManager.isSyncing` state?**

This is the most targeted fix for Failure Mode 1, but it introduces coupling between the
tutorial trigger and the sync infrastructure. The tutorial trigger should answer one
question: "is this a brand-new user?" The `wasRestoredThisSession` flag answers that
question correctly and durably across React re-renders and component re-mounts, without
coupling `CollectionIndexView` to `SyncManager`.

**Why 10 seconds instead of 5 for the snapshot timeout?**

See the analysis above. The cold-start path only runs when local IndexedDB is empty,
meaning the user is on a new device. On a new device, the fallback from snapshot failure
is full event log download — a much slower operation. The 5-second timeout does not
meaningfully protect the user from a slow experience; it just swaps "slow snapshot fetch"
for "full sync" with no UX gain. 10 seconds covers P95 mobile Firestore latency.

**What if the user is authenticated but Firebase is down?**

If `FirestoreSnapshotStore.load()` throws (not times out), the `catch` block in
`startSync()` clears `coldStartPhase` to `'syncing'` and starts `SyncManager`. The
`SyncManager` will fail its initial sync, set `syncError`, and show the "Show local
data" button — the existing error recovery path (ADR-017). No change needed here.

**What if `hydrate()` is called twice?**

`hydrate()` is already called once in `initializeApp()`. The cold-start path calls it a
second time after seeding the local snapshot from Firestore. The second call re-reads the
local snapshot (which now contains the seeded remote snapshot) and the event log (which
is still empty — the delta between snapshot and now is fetched by `SyncManager`). This
is safe: `hydrate()` replaces `cachedEntries` and resets `absorbedEventIds`. The
`isInitialized` ref in `App.tsx` prevents double-init of `initializeApp()`, but it must
not prevent the second `hydrate()` call. The second call must be made explicitly by the
cold-start sequencer in `startSync()`, not by `initializeApp()`.

---

### Interaction with Existing Systems

**`isRemoteRestoring` (ADR-017):**
Superseded. The `isRemoteRestoring` state variable is removed and replaced with
`coldStartPhase`. The `isAppReady` formula becomes `coldStartPhase === 'ready'`.

**`restoredFromRemoteRef` (ADR-017):**
Retained. It continues to suppress the `isSyncing` overlay on the snapshot-restored path.
Under the new model, the overlay copy changes to `"Restoring your journal…"` during
`'restoring'` phase and `"Syncing…"` during `'syncing'` phase, but the existing
`restoredFromRemoteRef` still correctly suppresses the sync overlay after restoration.

**`SnapshotManager` (ADR-016):**
Unchanged. The `SnapshotManager` continues to write snapshots to both local IndexedDB
and Firestore on the save triggers (count, visibility, unload). The cold-start sequencer
only reads from Firestore; it does not write. No coordination is needed.

**`SyncManager.initialSyncComplete` (ADR-017):**
Unchanged. The transition from `coldStartPhase = 'syncing'` to `coldStartPhase = 'ready'`
is triggered by the existing `onSyncStateChange` callback when `syncing` transitions from
`true` to `false` and `initialSyncComplete` is true.

**`appendBatch` absorption (ADR-018):**
Unchanged. The second `hydrate()` call (if it runs) re-populates `absorbedEventIds` with
the snapshot's event IDs plus any delta events. The subsequent `SyncManager` download
will deliver the events between the snapshot's `lastEventId` and the current Firestore
tail; these will be absorbed correctly.

**Tutorial context (ADRs pre-017):**
`TutorialContext` is unchanged. `TutorialProvider.resetTutorial()` should additionally
call `sessionStorage.removeItem('squickr_cold_start_restored')` so that developers using
the tutorial reset feature see a clean state. This is a minor addition to the reset
method.

---

### Alternatives Considered

| Option | Rejected Because |
|---|---|
| Keep `isRemoteRestoring`, fix the timing race with `useLayoutEffect` | The race is between a state setter and a class method call; `useLayoutEffect` cannot prevent it. Does not fix Failure Mode 3. |
| Add `coldStartPhase` to `AppContext` | Pollutes the domain-oriented context with startup infrastructure state. `CollectionIndexView` should not need to know about restoration phases. |
| Check `SyncManager.isSyncing` in the tutorial trigger | Couples `CollectionIndexView` to sync infrastructure. `SyncManager` may be null (no user). Fragile. |
| Keep unconditional remote snapshot fetch, increase timeout to 10s | Penalises all returning users on slow networks with a 10s delay before `isAppReady`. Worse than the current 5s regression. |
| Add `EventStore.count()` to `IEventStore` | Adds a method to the core domain interface solely for startup heuristics. Violates Interface Segregation — count is never needed at runtime. Adding a field to `EntryListProjection.hydrate()` is the correct, zero-interface-change approach. |
| Service Worker — intercept Firestore snapshot on install | Adds significant complexity; no established SW architecture. Over-engineered for this problem. |
| Store "user has data" flag in localStorage after first sync | Breaks when the user clears site data on the same device — the flag would incorrectly suppress remote restore on what is effectively a new-device start. `localStoreWasEmptyAtHydration` cannot lie: it reads the actual IndexedDB state. |

---

### Consequences

**Positive:**
- Tutorial never fires for returning users, regardless of network speed.
- Empty state never shown to returning users on new devices.
- No Firestore round-trip on startup for users with a non-empty local store.
  Startup time for daily users on slow networks drops from up to 5 seconds to zero.
- Single, testable state machine replaces two loosely-coordinated booleans.
- Overlay copy ("Restoring…" vs "Syncing…") gives users a clearer signal about what
  is happening.

**Negative / Risks:**
- `coldStartPhase` must be threaded into the overlay JSX (minor refactor of the overlay
  conditional in `App.tsx`).
- The second `hydrate()` call (on the snapshot-restore path) adds a second IndexedDB
  `getAll()` read on cold start for new-device users. At the time of the second call,
  the local event log is still empty, so `getAll()` returns `[]` immediately. Cost is
  negligible.
- `wasLocalStoreEmptyAtHydration()` is only valid in the window between `hydrate()` and
  the first new event. The sequencer must call it once and cache the result. If a future
  refactor calls it lazily, it may return incorrect results. A warning comment in
  `EntryListProjection` documents this constraint.
- Introducing `squickr_cold_start_restored` into `sessionStorage` adds one more key to
  the set of storage keys the app manages. It is session-scoped (cleared on tab close)
  and has no persistence risk.

---

### SOLID Principles

- **Single Responsibility**: `EntryListProjection.hydrate()` acquires a new field
  (`localStoreWasEmptyAtHydration`) that is a natural output of an operation it already
  performs (`eventStore.getAll()`). The cold-start sequencer in `App.tsx` owns the phase
  transitions. `CollectionIndexView` owns the tutorial trigger. Each component has one
  reason to change.
- **Open/Closed**: The `ISnapshotStore` and `IEventStore` interfaces are unchanged.
  `EntryListProjection` is extended with one field and one accessor — existing behaviour
  is unmodified. `CollectionIndexView`'s tutorial effect is extended with one additional
  guard condition — the existing conditions are unchanged.
- **Liskov Substitution**: The `wasLocalStoreEmptyAtHydration()` method has the same
  contract regardless of which `IEventStore` or `ISnapshotStore` implementation backs
  the projection. Tests use `InMemoryEventStore` as before.
- **Interface Segregation**: No new methods are added to `IEventStore` or `ISnapshotStore`.
  The new method lives on `EntryListProjection` (a concrete class) — it is not surfaced
  through any interface, keeping interfaces minimal.
- **Dependency Inversion**: `App.tsx` (delivery layer) depends on `EntryListProjection`
  (domain layer) through the existing accessor pattern. The cold-start sequencer depends
  on `ISnapshotStore` (domain abstraction) for the remote fetch — not on
  `FirestoreSnapshotStore` directly. The `FirestoreSnapshotStore` instance is constructed
  in `App.tsx` and passed downward, preserving the existing Dependency Injection pattern.

---

### Files to Create / Modify

**Modify:**

- `packages/domain/src/entry.projections.ts`
  - Add private `localStoreWasEmptyAtHydration: boolean = false` field
  - Set it in `hydrate()` before applying events: `this.localStoreWasEmptyAtHydration = allEvents.length === 0`
  - Add public `wasLocalStoreEmptyAtHydration(): boolean` accessor
  - Add corresponding JSDoc comment warning about the valid-window constraint

- `packages/domain/src/entry.projections.test.ts`
  - Add 3 tests: returns `true` when store is empty at hydration, returns `false` when
    store has events, returns `false` after re-hydration with events present

- `packages/client/src/App.tsx`
  - Replace `isRemoteRestoring: boolean` state with `coldStartPhase: ColdStartPhase`
    (type defined inline)
  - Replace `isSyncing: boolean` state — the sync overlay is now driven by
    `coldStartPhase === 'syncing'` for the initial sync path (ongoing background syncs
    continue to not block `isAppReady`)
  - Remove the `useEffect` that clears `isRemoteRestoring` when `!user`; replace with
    `coldStartPhase = 'ready'` in the `!user` branch of the existing `useEffect`
  - Rewrite `startSync()`:
    - Read `const isEmptyLocalStore = entryProjection.wasLocalStoreEmptyAtHydration()`
    - If `!isEmptyLocalStore`: set `coldStartPhase = 'ready'`, start `SyncManager`
      background (no overlay), return
    - If `isEmptyLocalStore`: set `coldStartPhase = 'checking'`, fetch remote snapshot
      with 10s timeout, branch as described in Phase 2 above
    - Set `sessionStorage.setItem('squickr_cold_start_restored', 'true')` whenever
      transitioning through `'syncing'` phase
  - Update overlay JSX to render phase-appropriate copy:
    - `'checking'` and `'restoring'`: "Restoring your journal…"
    - `'syncing'`: existing "Syncing your journal…"

- `packages/client/src/context/TutorialContext.tsx`
  - In `resetTutorial()`, add:
    `sessionStorage.removeItem('squickr_cold_start_restored')`

- `packages/client/src/views/CollectionIndexView.tsx`
  - Add `wasRestoredThisSession` check to the tutorial trigger `useEffect`:
    ```typescript
    const wasRestoredThisSession =
      sessionStorage.getItem('squickr_cold_start_restored') === 'true';
    if (
      realCollections.length === 0 &&
      !hasSeenThisSession &&
      !hasCompletedTutorial &&
      !wasRestoredThisSession
    ) {
      startTutorial();
    }
    ```

- `packages/client/src/App.test.tsx`
  - Update existing `isRemoteRestoring` tests to use `coldStartPhase`
  - Add tests for the three failure modes:
    - Empty local store + timeout: `coldStartPhase` transitions to `'syncing'`, tutorial
      suppressed, overlay shown
    - Empty local store + remote snapshot found: `coldStartPhase` transitions through
      `'restoring'` → `'syncing'` → `'ready'`, `wasRestoredThisSession` set
    - Non-empty local store: `coldStartPhase` goes directly to `'ready'`, no Firestore
      read initiated

- `packages/client/src/views/CollectionIndexView.test.tsx`
  - Add test: tutorial does NOT fire when `wasRestoredThisSession` is set in
    `sessionStorage`, even when `collections.length === 0` and `isAppReady` is true
  - Add test: tutorial fires when `wasRestoredThisSession` is absent AND all other
    conditions met (regression guard)

---

## ADR-025: Delta-Only Sync — Firestore Download Scoped to Snapshot Cursor

**Date**: 2026-04-03
**Status**: Proposed

### Context

`SyncManager.syncNow()` currently downloads the **entire** Firestore event log on every
cold start:

```typescript
const remoteEvents = await this.remoteStore.getAll(); // ALL 1593 events
const eventsToDownload = remoteEvents.filter(e => !localIds.has(e.id));
await this.localStore.appendBatch(eventsToDownload);
```

With 1593 events in Firestore this produces several cascading problems:

1. **Download cost**: Every cold start transfers the full event log over the network,
   even when the local projection has already been restored from a remote snapshot (ADR-017)
   that encodes state through all but the last handful of events.

2. **SnapshotManager storm**: The 1593-event `appendBatch()` notifies the
   `SnapshotManager`'s event counter 1593 times. The `isSaving` guard (introduced as a
   tactical fix) suppresses re-entrant saves, but the guard is needed only because the
   root problem — redundant download — is still present.

3. **Stale projection flash**: Delta events (including deletions and migrations) arrive
   inside the large batch. The projection absorbs the pre-snapshot events silently
   (ADR-018), but any event _after_ the snapshot cursor is genuinely new and triggers a
   cache rebuild. When deletion events are buried near the end of a 1593-event batch,
   "Uncategorized" entries appear briefly and then disappear as the later events are
   applied.

4. **Redundant work**: The ADR-016 / ADR-018 snapshot + absorption machinery exists
   precisely so that the projection can resume from a snapshot without replaying every
   event. The download path undermines this: it populates IndexedDB with events the
   projection has already accounted for in its snapshot state, forcing another full-log
   read when the projection next hydrates.

**Why this is the right time to fix it**: ADR-024 completed the cold-start sequencer.
The system now reliably restores state from a snapshot before `SyncManager` starts. The
missing piece is teaching `SyncManager` to ask Firestore "give me only events after the
snapshot cursor" rather than "give me everything."

**Key insight from existing architecture**: The `ProjectionSnapshot` interface
(ADR-016) already records `lastEventId` — the ID of the last event folded into snapshot
state. The `FirestoreEventStore.getAll()` method already queries by `orderBy('timestamp',
'asc')`. The `DomainEvent` interface already has a `timestamp: string` field (ISO 8601)
on every event. The data needed to scope the query is already present in both Firestore
and the local snapshot.

---

### Decision

#### Design Point 1 — `IEventStore` interface: add `getAllAfter()`

Add a new optional method to the `IEventStore` interface in
`packages/domain/src/event-store.ts`:

```typescript
/**
 * Get all events that were appended after the event with the given ID.
 *
 * Implementations use the timestamp of the anchor event as a cursor:
 * return all events whose timestamp is strictly greater than the anchor
 * event's timestamp, ordered ascending.
 *
 * When `lastEventId` is null or the anchor event cannot be found,
 * implementations MUST fall back to returning all events (equivalent to
 * `getAll()`). This preserves correct behaviour on first-ever sync (no
 * snapshot exists) and when the anchor event has been pruned.
 *
 * @param lastEventId - The `id` field of the last known event (i.e.
 *   `ProjectionSnapshot.lastEventId`), or null for a full download.
 * @returns Events after the anchor, in ascending timestamp order.
 */
getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>;
```

The method is added as a **required** member of the interface (not optional). All
three implementations — `FirestoreEventStore`, `IndexedDBEventStore`, and
`InMemoryEventStore` — must be updated simultaneously. Making it required ensures the
type-checker catches any future implementation that omits it. The interface currently has
five methods; adding a sixth remains well within Interface Segregation boundaries because
all callers that need delta fetching will use this method.

**Why not a cursor object instead of a single ID?** The only cursor value that exists
in the current data model is `lastEventId` from `ProjectionSnapshot`. There is no
monotonic sequence number and no server-assigned cursor token. A plain `string | null`
is the simplest contract that satisfies the requirement without over-engineering.

**Why not rename `getAll()` to `getAllAfter(null)`?** `getAll()` is called in over a
dozen places in the test suite and in projection `hydrate()` paths. Renaming it would
require widespread changes for no gain. `getAllAfter(null)` falls back to `getAll()`
semantics, so callers that do not care about the cursor continue to call `getAll()`.

---

#### Design Point 2 — `FirestoreEventStore.getAllAfter()`: timestamp cursor query

**The Firestore data model constraint**: Firestore document IDs are UUIDs (the event's
`id` field). Firestore has no native "cursor by document ID" for non-sequential IDs.
A query `where('id', '>', lastEventId)` would be a lexicographic UUID comparison, which
is meaningless for event ordering.

**The available anchor**: Every `DomainEvent` already has a `timestamp: string` field
(ISO 8601, UTC). Firestore already stores this field on every document. The existing
`getAll()` query uses `orderBy('timestamp', 'asc')`. Timestamps are therefore already
indexed and orderable.

**Chosen approach — two-phase lookup**:

1. Fetch the anchor event's timestamp from Firestore by its document ID:
   ```
   getDoc(doc(eventsRef, lastEventId))
   ```
   This is a single-document point read (cheap: 1 Firestore read unit).

2. Query all events with timestamp strictly greater than the anchor:
   ```
   query(eventsRef, where('timestamp', '>', anchorTimestamp), orderBy('timestamp', 'asc'))
   ```

**Fallback cases**:

- `lastEventId` is `null`: skip the lookup, call `getAll()` directly.
- The anchor document does not exist in Firestore (e.g. the event was written by an
  older client that did not upload it, or the Firestore retention window has elapsed):
  fall back to `getAll()`. This is the safe path — it downloads more than strictly
  necessary but never loses data.
- The anchor document fetch throws (network error, permission error): fall back to
  `getAll()`. Same rationale.

**Why not store `savedAt` from the snapshot and query `timestamp > savedAt`?**

`ProjectionSnapshot.savedAt` records when the snapshot was _written_, not when the last
event in it occurred. There can be a gap between the last-event timestamp and the
snapshot write time during which no new events occurred. Using `savedAt` as the cursor
would re-download events that are already baked into the snapshot (events between the
last-event timestamp and `savedAt`). The anchor event's own timestamp is the correct
boundary.

**Why not a monotonic sequence number?**

Adding a server-assigned `seq` field would require a Cloud Function or Firestore
transaction on every event write to maintain the sequence counter atomically. This
fundamentally changes the write path (currently a simple `setDoc`) and introduces
server-side coordination that does not exist today. The timestamp approach requires
zero changes to the write path and zero schema migration for existing 1593 events.

**Timestamp collision risk**: Two events with identical millisecond timestamps would
both appear in a `timestamp > anchorTimestamp` query if the anchor has that same
timestamp, or both be excluded if one of them is the anchor. This is a pre-existing
condition in `getAll()` (which sorts by timestamp and has the same tie-breaking
ambiguity). In practice, events are created by a single user on a single device; the
likelihood of two events with the same millisecond timestamp is negligible. If it
occurs, the worst outcome is re-downloading one already-absorbed event — handled
correctly by the `appendBatch` deduplication (`setDoc` on `IndexedDBEventStore` uses the
event `id` as the keyPath, so a duplicate append is a no-op at the IndexedDB level).

---

#### Design Point 3 — `IndexedDBEventStore.getAllAfter()`: in-memory filter

IndexedDB already loads all events from the `events` object store in `getAll()`. The
`timestamp` index exists (created in `onupgradeneeded`) but an IDBKeyRange filter on
timestamp would require knowing the anchor timestamp, which requires a separate
`getById(lastEventId)` call first — the same two-phase pattern as Firestore.

Since IndexedDB reads are local and fast (the full set for a heavy user fits in memory
in well under 10ms), the implementation filters in-memory after `getAll()`:

```typescript
async getAllAfter(lastEventId: string | null): Promise<DomainEvent[]> {
  const all = await this.getAll(); // sorted ascending by timestamp
  if (lastEventId === null) return all;

  const anchorIndex = all.findIndex(e => e.id === lastEventId);
  if (anchorIndex === -1) return all; // anchor not found: full fallback

  return all.slice(anchorIndex + 1);
}
```

This is O(n) but n is bounded by the local event log, which is always smaller than the
Firestore log (because we are not yet downloading the full history). The implementation
is correct, testable, and requires no IndexedDB schema migration.

**Alternative rejected — IDBKeyRange on timestamp index**: Requires looking up the
anchor timestamp first (`getById`), then issuing a range query. More code, same
asymptotic cost for local reads, and introduces a second IndexedDB transaction. The
in-memory filter is preferable.

**Future consideration**: If the local event log grows to tens of thousands of events
(unlikely given the snapshot + delta model), an IDBKeyRange approach could be adopted.
The `getAllAfter` API contract is stable; the implementation can change without affecting
callers.

---

#### Design Point 4 — `SyncManager`: cursor passed as a callback

`SyncManager` needs to know the snapshot cursor (`lastEventId`) at the moment
`syncNow()` executes, not at construction time. The snapshot evolves: on the first run
there may be no snapshot; after the first `SnapshotManager` save trigger there will be
one; on subsequent runs the cursor advances.

**Three options evaluated**:

| Option | Description | Assessment |
|---|---|---|
| A | Pass `lastEventId: string \| null` to constructor | Stale: cursor is captured at construction and never updates |
| B | Pass `getSnapshotCursor: () => string \| null` callback | Correct: evaluated lazily at sync time; zero coupling to snapshot internals |
| C | Pass `ISnapshotStore` directly; `SyncManager` loads snapshot | Violates SRP: `SyncManager` should not know how snapshots are stored |

**Decision: Option B — callback**.

```typescript
export class SyncManager {
  constructor(
    private localStore: IEventStore,
    private remoteStore: IEventStore,
    public onSyncStateChange?: (syncing: boolean, error?: string) => void,
    private getSnapshotCursor?: () => string | null,  // NEW (optional)
  ) {}
}
```

The callback is optional and defaults to `undefined`. When `undefined`, `syncNow()`
behaves identically to today — it calls `remoteStore.getAll()`. When provided, it calls
`remoteStore.getAllAfter(this.getSnapshotCursor())`.

**Wiring in `App.tsx`**:

```typescript
const syncManager = new SyncManager(
  localStore,
  remoteStore,
  onSyncStateChange,
  () => entryProjection.getLastSnapshotCursor(),  // lazily evaluated
);
```

`EntryListProjection.getLastSnapshotCursor()` is a new accessor (see Interface Changes
below) that returns the `lastEventId` from the most recently loaded or created snapshot,
or `null` if no snapshot has been applied.

**Why a callback over `ISnapshotStore` (Option C)?** If `SyncManager` held a reference
to `ISnapshotStore`, it would call `snapshotStore.load('entry-list-projection')` on
every `syncNow()` — an async IndexedDB read per sync cycle. The callback is synchronous
and free: `EntryListProjection` already holds the `lastEventId` in memory from
`hydrate()` and `createSnapshot()`. No additional I/O is needed.

**Why optional?** Backward compatibility with existing tests. All existing `SyncManager`
tests construct it with two or three arguments. Making the callback optional means they
continue to pass and exercise the full-download path correctly.

---

#### Design Point 5 — First-time sync (no snapshot)

When `getSnapshotCursor()` returns `null` (no snapshot has been saved), `getAllAfter(null)`
falls back to `getAll()`. This is the existing behaviour. No special-case logic is
needed in `SyncManager`.

---

#### Design Point 6 — Upload path

The upload path is unchanged:

```typescript
const localEvents = await this.localStore.getAll();
// ... compute newEvents = localEvents not in remoteIds ...
for (const event of newEvents) {
  await this.remoteStore.append(event);
}
```

Local events are still uploaded by comparing the full local log against the full remote
log. The download optimisation does not change this; upload correctness requires
knowing what Firestore already has. At current scale (uploading a handful of local-only
events per sync) this is acceptable. A future ADR could scope the upload similarly if
the local log grows large.

---

#### Design Point 7 — Projection correctness after delta-only download

After a delta-only download, `SyncManager` calls `localStore.appendBatch(deltaEvents)`.
The `EntryListProjection` subscriber fires (ADR-018 `appendBatch` path). The subscriber
checks `absorbedEventIds`:

- Events already in the snapshot are in `absorbedEventIds` and are silently absorbed.
- Events between the snapshot and the current Firestore tail (the "delta") are genuinely
  new. They clear absorption mode and trigger a cache rebuild.
- With a recent snapshot the delta is 0–20 events. The rebuild is O(delta), not O(all).

`CollectionListProjection` follows the same pattern via its own `hydrate()` and snapshot
seeding (ADR-024: `collections` field on `ProjectionSnapshot`). The same
`absorbedEventIds` mechanism applies.

No changes to the projection layer are needed for correctness.

---

#### Design Point 8 — Local log truncation (deferred)

The local IndexedDB log accumulates every event ever downloaded. With delta-only sync,
the log will no longer receive the pre-snapshot history on subsequent cold starts.
However, the history already in IndexedDB from previous full downloads remains and is
never cleaned up by this ADR.

A future ADR could implement log truncation: after a snapshot is taken, delete local
events older than `snapshot.lastEventId` from IndexedDB (since the snapshot renders
them redundant). This design does not preclude that: `getAllAfter()` already works
correctly when the local log is truncated — events before the anchor simply do not
exist, and `slice(anchorIndex + 1)` returns the correct delta.

This is explicitly out of scope for ADR-025.

---

### Interface Changes

#### `IEventStore` (`packages/domain/src/event-store.ts`)

```typescript
/**
 * Get all events that were appended after the event with the given ID.
 * Falls back to getAll() when lastEventId is null or the anchor is not found.
 *
 * @param lastEventId - The id of the last known event, or null for full download.
 * @returns Events after the anchor, ascending by timestamp.
 */
getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>;
```

#### `EntryListProjection` (`packages/domain/src/entry.projections.ts`)

```typescript
/**
 * Returns the lastEventId from the most recently hydrated or created snapshot,
 * or null if no snapshot has been applied to this projection instance.
 *
 * Used by SyncManager as a cursor for delta-only Firestore downloads.
 * The value is valid from the moment hydrate() completes and is updated
 * each time createSnapshot() is called.
 */
getLastSnapshotCursor(): string | null;
```

This requires a new private field `lastSnapshotCursor: string | null = null` set in:
- `hydrate()`: after loading the snapshot, `this.lastSnapshotCursor = snapshot?.lastEventId ?? null`
- `createSnapshot()`: after computing the snapshot, `this.lastSnapshotCursor = lastEventId`

#### `SyncManager` (`packages/client/src/firebase/SyncManager.ts`)

```typescript
constructor(
  private localStore: IEventStore,
  private remoteStore: IEventStore,
  public onSyncStateChange?: (syncing: boolean, error?: string) => void,
  private getSnapshotCursor?: () => string | null,  // NEW — optional
) {}
```

`syncNow()` download block changes from:

```typescript
const remoteEvents = await Promise.race([this.remoteStore.getAll(), timeoutPromise]);
```

to:

```typescript
const cursor = this.getSnapshotCursor?.() ?? null;
const remoteEvents = await Promise.race([
  this.remoteStore.getAllAfter(cursor),
  timeoutPromise,
]);
```

The upload block is unchanged (still uses `this.localStore.getAll()` for the full
local set to compute what needs uploading).

---

### SyncManager Changes — How the Cursor Is Passed and Used

At construction time in `App.tsx`, the `SyncManager` receives a callback that reads
`entryProjection.getLastSnapshotCursor()` lazily. On each `syncNow()` call:

1. The callback is evaluated: if the projection has never been hydrated with a snapshot
   (first-ever session), it returns `null` and the full download runs.
2. If it returns a non-null cursor, `remoteStore.getAllAfter(cursor)` is called.
3. The result — a small delta — is compared against the local event IDs (from the upload
   path's `localEvents`) and appended via `appendBatch`.

After a `SnapshotManager` save trigger (e.g. 50 events appended), `createSnapshot()` is
called and `lastSnapshotCursor` advances. The next `syncNow()` uses the new cursor
automatically — no coordination needed between `SnapshotManager` and `SyncManager`.

---

### Firestore Query Strategy

The download query in `FirestoreEventStore.getAllAfter(lastEventId)` proceeds as:

**Step 1 — Anchor lookup** (1 read unit):
```
GET users/{userId}/events/{lastEventId}
→ anchorDoc.data().timestamp  (ISO 8601 string)
```

If the document does not exist or the read fails, skip to step 3 (full fallback).

**Step 2 — Delta query** (N read units, where N = number of new events):
```
SELECT * FROM users/{userId}/events
WHERE timestamp > anchorTimestamp
ORDER BY timestamp ASC
```

This reuses the existing composite index implied by `orderBy('timestamp', 'asc')` in
`getAll()`. No new Firestore indexes are needed.

**Step 3 — Full fallback**:
If step 1 fails for any reason, call `getAll()` as before. The system degrades
gracefully to the pre-ADR-025 behaviour.

**Firestore billing impact**: On a typical re-open after a few hours, the delta is
0–20 events. Instead of reading 1593 documents, the system reads 1 (anchor lookup) +
0–20 (delta). Cost reduction: ~98% for returning users with a recent snapshot.

---

### Tradeoffs

**What we gain:**
- Cold-start sync cost drops from O(all events) to O(delta) for users with a snapshot.
  For a user with 1593 events and a snapshot taken 2 hours ago, this is 1593 reads → ~5
  reads.
- SnapshotManager is no longer triggered by absorbed events (there are none to absorb).
  The `isSaving` guard remains as belt-and-suspenders but is no longer load-bearing.
- The "Uncategorized appears then disappears" flash is eliminated because the deletion
  event arrives in the first (and only) delta batch, not buried in a 1593-event storm.

**What we give up / risks:**
- The local IndexedDB event log is no longer a complete replica of Firestore. Events
  that pre-date the snapshot cursor are in Firestore but may not be in IndexedDB (on
  devices that first open after ADR-025 is deployed with a mature snapshot). This is
  acceptable: projections rebuild from `snapshot.state + delta events`, not from the
  full local log.
- The upload path still reads the full local log to compute what to upload. On a device
  that has used the app for months, this is still a full IndexedDB scan. This is a known
  limitation and does not block ADR-025; it can be addressed in a future ADR alongside
  log truncation.
- If a user's Firestore snapshot is significantly ahead of their IndexedDB log (e.g.
  they have two devices and device B has events that device A has never seen), the
  anchor lookup on device A may find its `lastEventId` in Firestore and return a correct
  delta. This is the happy path. If device A's cursor pre-dates Firestore's retention
  window (hypothetical — Firestore does not prune by default), the anchor lookup returns
  no document and the full fallback fires. Correctness is preserved.
- Timestamp collision (two events with identical timestamps): as analysed above,
  negligible risk; worst outcome is one re-downloaded event that is a no-op on append.

---

### Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| Store a monotonic `seq` field on each event and query `where seq > snapshot.lastSeq` | Requires server-side coordination (Cloud Function or transaction) on every event write. Changes the write path fundamentally. Existing 1593 events have no `seq` field — migration is expensive. |
| Use `snapshot.savedAt` as the Firestore timestamp cursor | `savedAt` is the snapshot write time, not the last-event time. Events between the last event and `savedAt` would be re-downloaded unnecessarily. |
| Fetch all remote events, filter client-side | Defeats the purpose. Transfers 1593+ documents over the network on every cold start. |
| Pass `ISnapshotStore` to `SyncManager` and load snapshot in `syncNow()` | Adds an async IndexedDB read per sync cycle. Violates SRP: `SyncManager` should not load snapshots. The callback pattern is simpler, synchronous, and keeps concerns separated. |
| Make `getAllAfter` optional on `IEventStore` | Would allow implementations to silently omit it. TypeScript would not catch the omission. All implementations are updated together, so the required contract is correct. |
| `getAll()` with client-side filter by timestamp after anchor | Same network cost as full download from Firestore (transfers all documents). Acceptable for IndexedDB (local), rejected for Firestore (remote). |
| Firestore `startAfter(anchorDoc)` cursor pagination | `startAfter` requires a `DocumentSnapshot`, not an ID string. We would still need to fetch the anchor document first. `where('timestamp', '>', anchorTimestamp)` achieves the same result with a simpler query. |

---

### Implementation Plan (for Sam)

All steps follow Red-Green-Refactor. No step introduces a breaking change to the
running application.

**Step 1 — `IEventStore.getAllAfter()` (domain package)**

Add `getAllAfter(lastEventId: string | null): Promise<DomainEvent[]>` to
`packages/domain/src/event-store.ts`. This will cause TypeScript compile errors in all
three implementations — leave them failing until steps 2–4.

Tests: none yet (interface only).

**Step 2 — `InMemoryEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/in-memory-event-store.ts` (or wherever the
in-memory store lives). Logic: if `lastEventId` is null, return all events; otherwise
find the anchor index and return everything after it; if anchor not found, return all.

Tests: write first in `packages/infrastructure/src/__tests__/`:
- `getAllAfter(null)` returns all events
- `getAllAfter(id)` where id is the last event returns `[]`
- `getAllAfter(id)` where id is a middle event returns only later events
- `getAllAfter('nonexistent')` returns all events (fallback)

**Step 3 — `IndexedDBEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/indexeddb-event-store.ts`. Logic: call
`this.getAll()`, find anchor by `id`, return `slice(anchorIndex + 1)`. If anchor not
found, return full result.

Tests in `packages/infrastructure/src/__tests__/indexeddb-event-store.test.ts`
(using the existing fake-IDB test setup):
- Same four cases as InMemoryEventStore

**Step 4 — `FirestoreEventStore.getAllAfter()` (infrastructure package)**

Implement in `packages/infrastructure/src/firestore-event-store.ts`. Logic:
1. If `lastEventId` is null, delegate to `getAll()`.
2. `getDoc(doc(eventsRef, lastEventId))`.
3. If doc exists, extract `anchorTimestamp = doc.data().timestamp`.
4. Query `where('timestamp', '>', anchorTimestamp), orderBy('timestamp', 'asc')`.
5. If doc does not exist or any step throws, fall back to `getAll()`.

Tests in `packages/infrastructure/src/__tests__/firestore-event-store.test.ts`
(mocking the Firestore SDK as existing tests do):
- `getAllAfter(null)` calls `getAll()` path (no `getDoc` call)
- `getAllAfter(existingId)` calls `getDoc`, then issues the timestamp-range query
- `getAllAfter(nonexistentId)` falls back to `getAll()` when `getDoc` returns no document
- `getAllAfter(id)` falls back to `getAll()` when `getDoc` throws

**Step 5 — `EntryListProjection.getLastSnapshotCursor()` (domain package)**

Add private field `lastSnapshotCursor: string | null = null` to `EntryListProjection`.
Set it in `hydrate()` after loading the snapshot, and in `createSnapshot()` after
computing the snapshot. Add public accessor `getLastSnapshotCursor(): string | null`.

Tests in `packages/domain/src/entry.projections.test.ts`:
- Returns `null` before `hydrate()` is called
- Returns `null` after `hydrate()` when no snapshot exists
- Returns the `lastEventId` from the snapshot after `hydrate()` with a snapshot
- Returns the new `lastEventId` after `createSnapshot()` is called

**Step 6 — `SyncManager` constructor and `syncNow()` (client package)**

Add optional `getSnapshotCursor?: () => string | null` as the fourth constructor
parameter. In `syncNow()` replace `this.remoteStore.getAll()` with
`this.remoteStore.getAllAfter(this.getSnapshotCursor?.() ?? null)`.

Tests in `packages/client/src/firebase/SyncManager.test.ts`:
- When `getSnapshotCursor` is not provided, `remoteStore.getAllAfter` is called with
  `null` (equivalent to full download — verify via mock)
- When `getSnapshotCursor` returns a cursor string, `remoteStore.getAllAfter` is called
  with that string
- When `getSnapshotCursor` returns `null`, `remoteStore.getAllAfter` is called with
  `null`
- Existing tests continue to pass (no fourth argument provided — backward compatible)

**Step 7 — Wire cursor in `App.tsx` (client package)**

In `App.tsx`, update the `SyncManager` constructor call to pass the cursor callback:

```typescript
const syncManager = new SyncManager(
  localStore,
  remoteStore,
  onSyncStateChange,
  () => entryProjection.getLastSnapshotCursor(),
);
```

Tests in `packages/client/src/App.test.tsx`:
- Verify that the mock `remoteStore.getAllAfter` is called (not `getAll`) when a cursor
  is available
- Verify that on first sync (no snapshot), `getAllAfter(null)` is called and the full
  download proceeds correctly

**Step 8 — Run full test suite and confirm green**

```bash
pnpm test run
```

All existing tests must pass. No snapshot schema version bump is needed (no change to
`ProjectionSnapshot` shape).

---

### Event Model

No new domain events are introduced. No changes to `ProjectionSnapshot` shape or
`SNAPSHOT_SCHEMA_VERSION`. The `lastEventId` field already present on
`ProjectionSnapshot` is the cursor; it is merely read from a new location (`SyncManager`
via callback) rather than only from the projection internals.

---

### Consequences

**Positive:**
- Cold-start Firestore download cost drops from O(all events) to O(delta) for any
  session where the local snapshot is recent. For a user with 1593 events this is a
  ~98% reduction in Firestore reads on every re-open.
- SnapshotManager count trigger no longer fires on absorbed-event batches because the
  absorbed events are never downloaded. The `isSaving` guard remains but is no longer
  needed for correctness.
- "Uncategorized flash" caused by late-arriving deletion events is eliminated: delta
  events arrive in order and are applied correctly.
- No breaking changes to the Firestore data model. Existing 1593 events remain
  queryable. The timestamp field already exists on all documents.
- The design does not preclude future log truncation (ADR deferred). The local event
  log can be pruned behind the snapshot cursor without affecting `getAllAfter` semantics.

**Negative / Risks:**
- The local IndexedDB event log is no longer a complete replica of Firestore on devices
  that open the app for the first time after ADR-025 is deployed and have a mature
  snapshot. This is an intentional design choice consistent with the snapshot model
  (ADR-016: "snapshots are cache, not source of truth").
- Upload path still scans the full local log. On devices with large logs, this is
  unchanged from today. Addressing it requires log truncation (future ADR).
- Timestamp collision is theoretically possible. Risk is negligible; worst outcome is
  correct (duplicate append is a no-op at the IndexedDB keyPath level).
- `FirestoreEventStore.getAllAfter()` makes one extra Firestore point-read (the anchor
  lookup) compared to the current full-scan path. The trade-off is 1 extra read for a
  ~1592-read saving.

### SOLID Principles

- **Single Responsibility**: `SyncManager` owns sync orchestration; it does not load
  snapshots. `EntryListProjection` owns projection state; it exposes the cursor via
  accessor. `FirestoreEventStore` owns Firestore queries; it encapsulates the two-phase
  timestamp lookup.
- **Open/Closed**: The delta-only behaviour is additive. `SyncManager` with no callback
  is unchanged. Existing tests require no modification.
- **Liskov Substitution**: `InMemoryEventStore`, `IndexedDBEventStore`, and
  `FirestoreEventStore` all implement `getAllAfter` with the same contract. Any caller
  can swap implementations without changing behaviour.
- **Interface Segregation**: `IEventStore.getAllAfter()` is a natural extension of the
  existing query surface. It does not bloat the interface with unrelated concerns.
- **Dependency Inversion**: `SyncManager` depends on `IEventStore` (abstraction) and
  receives a plain `() => string | null` callback — not a snapshot store or projection
  concrete class. The callback is the thinnest possible coupling between the sync and
  snapshot subsystems.
---

## ADR-026: Extend ProjectionSnapshot to Cover HabitProjection and UserPreferencesProjection

**Date**: 2026-04-03
**Status**: Accepted

### Context

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

### Decision

#### Schema (snapshot-store.ts)
- `SNAPSHOT_SCHEMA_VERSION` bumped **4 → 5**.
- `ProjectionSnapshot` gains two new optional fields:
  - `habits?: SerializableHabitState[]` — serialised habit states
  - `userPreferences?: UserPreferences` — user preferences at snapshot time

#### New type (habit.types.ts)
`SerializableHabitState` is a plain-object representation of the internal `HabitState`:
- `completions` stored as `Record<string, string>` (Map is not JSON-serialisable)
- `reverted` stored as `string[]` (Set is not JSON-serialisable)

#### HabitProjection (habit.projection.ts)
- Added `private stateCache: Map<string, HabitState> | null` — avoids repeated replays.
- `loadStates()` checks and populates the cache; invalidated on any event-store append.
- `hydrateFromSnapshot(states)` — deserialises the snapshot and populates the cache;
  notifies subscribers immediately.
- `getStatesForSnapshot()` — async; calls `loadStates()` if cache is cold, then
  serialises to `SerializableHabitState[]`.

#### UserPreferencesProjection (user-preferences.projections.ts)
- Added `private preferencesCache: UserPreferences | null` — single replay per session.
- `getUserPreferences()` now checks the cache before calling `eventStore.getAll()`.
- Cache is cleared in the existing event-store subscriber callback.
- `hydrateFromSnapshot(prefs)` — sets the cache and notifies subscribers.

#### EntryListProjection (entry.projections.ts)
- Exposes `get habitProjection(): HabitProjection` so callers do not need a separate
  constructor argument.
- `hydrate()` adds an **all-or-nothing completeness guard**: if a v5 snapshot is missing
  either `habits` or `userPreferences`, it is discarded and a full replay is scheduled.
  This covers the transition window between schema bump and full deployment.
- After passing the guard, `hydrate()` calls `this.habit.hydrateFromSnapshot(snapshot.habits)`
  before seeding the entry cache, so habit state is available as soon as entries are.

#### SnapshotManager (snapshot-manager.ts)
- Two new optional constructor parameters: `habitProjection?` and
  `userPreferencesProjection?`.
- `saveSnapshot()` enriches the snapshot with `habits` and `userPreferences` when both
  projections are provided.

#### App.tsx
- `UserPreferencesProjection` elevated from a local variable inside `initializeApp` to a
  stable `useState` value so it can be passed to `SnapshotManager` and referenced from
  the cold-start sequencer.
- Cold-start slow path: after seeding `collectionProjection` from the remote snapshot,
  also calls `userPreferencesProjection.hydrateFromSnapshot(remoteSnapshot.userPreferences)`
  when that field is present.
- Both `SnapshotManager` constructor calls updated to pass
  `entryProjection.habitProjection` and `userPreferencesProjection`.

### Rationale

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

### Consequences

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

### SOLID Principles

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

---

## ADR-027: FCM Push Notifications Use Data-Only Messages

**Date**: 2026-04-04
**Status**: Accepted

### Context

The habit reminder Cloud Function sent FCM messages with a `notification` field. On Android/Chrome PWA, when FCM receives a message with a `notification` field while the app is backgrounded, two things happen independently:

1. FCM's platform layer auto-displays a system tray notification using the app's default icon (a grey letter fallback).
2. The service worker's `onBackgroundMessage` handler fires and shows a second notification with the branded Squickr icon.

Users received two identical notifications per habit reminder with different icons (UAT-confirmed bug).

### Decision

All FCM messages sent from Cloud Functions must use **data-only format**: no `notification` field. Title, body, and any deep-link data go in the `data` map as strings. The `firebase-messaging-sw.js` service worker is the single point of notification display, reading from `payload.data`.

### Consequences

**Positive:**
- Single notification per event on Android/Chrome, always with the branded icon.
- Service worker has full control over presentation (icon, vibration patterns, action buttons, and is prepared for deep-link routing when client routing supports it).
- Future notification types (sync conflicts, etc.) follow the same pattern without re-litigating this decision.

**Negative:**
- **iOS limitation**: Data-only FCM messages are silently dropped by Apple Push Notification Service when the PWA is backgrounded or terminated. iOS requires a `notification` field or an `apns.payload.aps` body to display a banner. Habit reminders are therefore not delivered to iOS users. If iOS push support is added in future, the Cloud Function must branch on platform (using `apns` overrides) or send separate APNs messages. Tracked as a known limitation.
- All `data` values must be strings; complex payloads (e.g. a JSON array of habit IDs) must be JSON-serialised in the Cloud Function and parsed in the service worker.
- Data-only messages bypass FCM's built-in notification-open analytics. App-side analytics must be implemented manually via `notificationclick` if needed.

### SOLID Principles

- **Single Responsibility**: The service worker is the sole owner of notification display; the Cloud Function is responsible only for delivery. Previously the `notification` field gave FCM platform layer an implicit second display responsibility.
- **Open/Closed**: The service worker handler can be extended (action buttons, deep links, badge updates) without modifying the Cloud Function payload contract, as long as `data` map keys are additive.
