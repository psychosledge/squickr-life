# ADR-010: Firebase Backend Sync for Multi-Device Access

**Date**: 2026-01-30  
**Status**: Accepted (Approved by Architecture Alex)

## Context
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

## Decision
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

## Rationale

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

## Consequences

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

## Architectural Refinements (from Alex Review)

1. **Improved Firestore Security Rules** - Prevent event ID/userId spoofing
2. **Fix Race Condition** - Only mark actually-uploaded events as synced
3. **Batch Append Support** - Avoid rebuilding projections N times when downloading N events
4. **Sync State in React Context** - Components access sync status for UI
5. **Event Schema Version Validation** - Prevent appending wrong-version events
6. **Sync Telemetry** - Log upload/download counts for debugging

## Implementation Plan

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

## SOLID Principles

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

## Future Considerations

- **Real-time sync**: Add Firestore `onSnapshot` for live updates if needed
- **Collaboration**: If multi-user needed, upgrade to operational transforms or CRDTs
- **Event compaction**: Snapshot aggregates periodically to reduce event log size
- **Migration to Supabase**: If vendor lock-in becomes concern, implement PostgreSQL store
