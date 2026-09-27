# ADR-012: Firebase Clean Architecture Refactoring (Domain/Infrastructure Split)

**Date**: 2026-02-07  
**Status**: Accepted

## Context

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

## Decision

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

## Rationale

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

## Consequences

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

## SOLID Principles

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

## Implementation Notes

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

## Future Enhancements

**Optional improvements (not blockers):**
- Add generic typing to `removeUndefined<T>()` helper (currently uses `any`)
- Add Firestore-specific error messages (currently propagates SDK errors)
- Consider batch operations for large syncs (currently one-by-one)
- Extract `removeUndefined()` to shared utility if reused elsewhere

**Future backend integration:**
- Node.js backend can import `@squickr/infrastructure`
- Use Firebase Admin SDK (server-side) instead of Client SDK
- Same `FirestoreEventStore` class, different Firebase instance
