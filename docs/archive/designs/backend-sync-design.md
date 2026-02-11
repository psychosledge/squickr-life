# Backend Sync Architecture Design

**Date:** 2026-01-30  
**Status:** ✅ Accepted (Approved by Architecture Alex)  
**Goal:** Enable multi-device synchronization with cloud backup via Firebase

**ADR:** See ADR-010 in `docs/architecture-decisions.md`

---

## Executive Summary

**Problem:** User's data is currently locked to a single browser's IndexedDB. Switching devices or browsers means starting fresh with no data.

**Solution:** Implement cloud-based event synchronization using Firebase Firestore + Google Authentication.

**Key Requirements (from user):**
- ✅ Access data across devices (primarily mobile, occasionally desktop)
- ✅ Full offline editing capabilities (sync when online)
- ✅ Eventual consistency (don't need real-time sync)
- ✅ Personal use only (no collaboration features)
- ✅ Disaster recovery (data backup in cloud)

**Selected Backend:** Firebase  
**Estimated Timeline:** 18-27 hours (~4-6 days)

---

## Design Decisions

### **Decision 1: Backend Platform**

**Options Considered:**
1. **Firebase** (Firestore + Auth) ✅ SELECTED
2. Supabase (PostgreSQL + Auth)
3. Cloudflare D1 + Workers

**Decision:** Use Firebase

**Rationale:**
- **Offline-first SDK** handles sync complexity automatically
- **Google OAuth** is first-class citizen (3 lines of setup)
- **Generous free tier** for personal use (1GB storage, 50k reads/day, 20k writes/day)
- **NoSQL flexibility** matches event sourcing append-only pattern
- **Fastest implementation** (SDK does heavy lifting)
- **Production-ready** (used by millions of apps)

**Trade-offs:**
- ❌ Vendor lock-in to Google
- ❌ Query limitations vs SQL (mitigated: we query by userId + timestamp only)
- ❌ Pricing scales with reads/writes (mitigated: personal use is <1% of free tier)

**Mitigation for vendor lock-in:**
- Event store abstracted via `IEventStore` interface
- Can migrate to Supabase later by swapping implementation
- Events stored in standard JSON format (exportable)

---

### **Decision 2: Sync Strategy**

**Selected:** Eventual Consistency + Periodic Sync

**Sync Timing:**
- On app launch (immediate sync when user opens app)
- Every 5 minutes while app is active
- On network reconnection (after being offline)

**Sync Flow:**
```
1. Upload local events not yet in Firestore (by event ID)
2. Download remote events not yet in IndexedDB (by timestamp)
3. Update last_sync_timestamp
4. Trigger UI refresh (projections rebuild)
```

**Why not real-time?**
- User doesn't need instant sync (only one user, occasional desktop access)
- Periodic sync is simpler and more battery-friendly
- Can add real-time later via Firestore `onSnapshot` if needed

---

### **Decision 3: Conflict Resolution**

**Selected:** Last-Write-Wins (Timestamp-Based)

**Scenarios:**

**Scenario 1: Same task edited on two devices while offline**
- Both events preserved in event log (immutable audit trail)
- Latest event (by timestamp) determines current state
- Example:
  ```
  Phone (offline): TaskTitleChanged at 10:00 AM → "Buy milk"
  Tablet (offline): TaskTitleChanged at 10:05 AM → "Buy almond milk"
  Sync: Both events uploaded, tablet's "Buy almond milk" wins (latest timestamp)
  ```

**Scenario 2: Task deleted on one device, edited on another (both offline)**
- **Delete wins** (deletion is final user intent)
- Alternative (future): Prompt user "Task was edited elsewhere, still delete?"

**Why last-write-wins works for personal use:**
- User is editing from one device at a time (primary mobile)
- Desktop used occasionally for planning/review (low conflict probability)
- Event log preserves full history (can see what changed when)
- Simple to implement and reason about

**Not needed (for personal use):**
- ❌ Operational transforms (for real-time collaboration)
- ❌ CRDTs (for conflict-free replicated data)
- ❌ Three-way merge (user is not collaborating with others)

---

### **Decision 4: Authentication Flow**

**Selected:** Merge Local Data on First Login

**Flow:**
```
User signs in for first time
  ↓
Check if local IndexedDB has events
  ↓
If YES:
  - Upload all local events to Firestore (user's cloud backup)
  - Mark events as synced
  - Download any remote events (shouldn't exist on first login)
If NO:
  - Download all remote events (if user signed in on another device)
  - User's data appears on this device
```

**Why merge (not overwrite)?**
- Preserves user's local work
- Creates cloud backup automatically
- Enables migration from old Netlify site (sign in → auto-uploads)

**Edge case:** User signs in on two fresh devices
- First device uploads local data
- Second device downloads from cloud
- Result: Both devices have same data ✓

---

### **Decision 5: Data Model**

**Firestore Structure:**
```
/users/{userId}/events/{eventId}
  - id: string (event.id - UUID)
  - type: string (TaskCreated, TaskCompleted, etc.)
  - timestamp: string (ISO 8601)
  - version: number (event schema version)
  - aggregateId: string (taskId, collectionId, etc.)
  - payload: object (event-specific data)
```

**Why this structure?**
- ✅ User-isolated: Each user has own `/users/{userId}` collection
- ✅ Event ID as document ID: Natural key, prevents duplicates
- ✅ Timestamp indexed: Efficient queries for incremental sync
- ✅ Flat structure: Simple security rules, no nested collections

**Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/events/{eventId} {
      // Users can only read/write their own events
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Events are immutable (append-only)
      allow update, delete: if false;
    }
  }
}
```

**Security guarantees:**
- ✅ User can only access their own events (userId must match auth.uid)
- ✅ Events cannot be updated or deleted (append-only enforcement)
- ✅ Unauthenticated users have zero access

---

### **Decision 6: Offline Support**

**Selected:** Full Offline Editing + Sync Queue

**Approach:**
1. **Firestore offline persistence** (built into SDK):
   ```typescript
   enableIndexedDbPersistence(firestore);
   ```
2. **Pending sync tracking**:
   - Separate IndexedDB object store: `pending_sync_events`
   - Events created offline → added to both `events` and `pending_sync_events`
   - On sync → upload pending events → remove from `pending_sync_events`
3. **Network state detection**:
   - Listen to `window.addEventListener('online', syncNow)`
   - Trigger immediate sync when network reconnects

**User experience:**
```
User on subway (offline):
  - Creates 5 tasks
  - Edits 2 notes
  - All changes saved to IndexedDB
  - UI shows "Offline" indicator (subtle, non-intrusive)

User arrives at destination (online):
  - Network reconnects
  - Sync runs automatically
  - 7 events uploaded to Firestore
  - Offline indicator disappears
  - No data lost ✓
```

---

### **Decision 7: Migration Path**

**Selected:** Auto-Migration via Sync (No Manual Export/Import)

**Migration Process:**
```
1. User signs into OLD NETLIFY SITE on Android
   ↓
   First-login sync uploads all local events to Firestore
   ↓
   Data now backed up in cloud ✓

2. User signs into SQUICKR.COM on Android (or desktop)
   ↓
   Download sync fetches all events from Firestore
   ↓
   Data appears on new site ✓

3. User stops using old Netlify site
   ↓
   Can optionally delete old deployment
```

**Why this works:**
- Sync is the migration tool (no separate export/import needed)
- Idempotent: Events have unique IDs, duplicates prevented
- Safe: Event log is append-only, can't lose data
- Seamless: User just signs in, data appears

**Edge case:** User signs in on both sites before completing migration
- Both sites upload events
- Duplicate detection (by event ID) prevents duplicates
- Events are idempotent (safe to process twice)

---

## Architecture Overview

### **System Components**

```
┌─────────────────────────────────────────────────────────────┐
│ Client (React PWA)                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                    ┌──────────────┐      │
│  │ IndexedDB    │◄───────────────────┤ SyncManager  │      │
│  │ EventStore   │   Local events     │              │      │
│  └──────────────┘                    └──────┬───────┘      │
│         │                                   │              │
│         │ Projections                       │ Upload/      │
│         │ (Tasks, Collections)              │ Download     │
│         ▼                                   ▼              │
│  ┌──────────────┐                    ┌──────────────┐      │
│  │ UI Components│                    │ Firebase SDK │      │
│  │ (React)      │                    │              │      │
│  └──────────────┘                    └──────┬───────┘      │
│                                             │              │
└─────────────────────────────────────────────┼──────────────┘
                                              │ HTTPS
                                              ▼
                           ┌──────────────────────────────────┐
                           │ Firebase Cloud                   │
                           ├──────────────────────────────────┤
                           │                                  │
                           │  ┌────────────┐  ┌────────────┐ │
                           │  │ Firestore  │  │ Auth       │ │
                           │  │ (Events DB)│  │ (Google)   │ │
                           │  └────────────┘  └────────────┘ │
                           │                                  │
                           └──────────────────────────────────┘
```

### **Data Flow**

**Write Path (Create Task):**
```
User creates task
  ↓
CreateTaskHandler.handle(command)
  ↓
Generate TaskCreated event
  ↓
IndexedDBEventStore.append(event)
  ↓
Event saved locally ✓
  ↓
Mark as pending sync (if online)
  ↓
SyncManager.uploadPendingEvents()
  ↓
Firestore batch write
  ↓
Event in cloud ✓
```

**Read Path (View Collection):**
```
User opens collection
  ↓
EntryListProjection.getEntries(collectionId)
  ↓
IndexedDBEventStore.getAll()
  ↓
Replay events → Build current state
  ↓
Render entries in UI ✓
```

**Sync Path (Bidirectional):**
```
SyncManager.sync() [runs every 5 min]
  ↓
1. UPLOAD:
   Query IndexedDB for pending events
   ↓
   Batch upload to Firestore
   ↓
   Mark events as synced

2. DOWNLOAD:
   Query Firestore for events after last_sync_timestamp
   ↓
   Filter out events already in IndexedDB
   ↓
   Append new events to IndexedDB
   ↓
   Projections rebuild (UI updates)
   ↓
   Update last_sync_timestamp
```

---

## Implementation Phases

### **Phase 1: Firebase Project Setup** (1-2 hours)

**Goal:** Create Firebase project, configure authentication and database

**Tasks:**
1. Create Firebase project at console.firebase.google.com
2. Enable Google Authentication provider
3. Create Firestore database (production mode, us-central1 region)
4. Deploy Firestore security rules
5. Get Firebase config credentials (apiKey, authDomain, etc.)
6. Add Firebase config to project

**Deliverables:**
- Firebase project created
- Google Auth enabled
- Firestore database initialized
- Security rules deployed
- Config credentials obtained

**Files Created:**
- None yet (console configuration only)

---

### **Phase 2: Add Firebase Dependencies** (30 min)

**Goal:** Install Firebase SDK and set up configuration

**Tasks:**
1. Install Firebase packages:
   ```bash
   cd packages/client
   pnpm add firebase
   ```
2. Create Firebase config file
3. Initialize Firebase in app
4. Add environment variables for config

**Files Created:**
- `packages/client/src/firebase/config.ts`
- `packages/client/.env.local` (gitignored)

**Files Modified:**
- `packages/client/.gitignore` (add .env.local)
- `packages/client/package.json` (firebase dependency)

**Environment Variables:**
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

### **Phase 3: Authentication UI** (2-3 hours)

**Goal:** Add Google sign-in flow with auth state management

**Tasks:**
1. Create `AuthContext` for managing auth state
2. Create `SignInView` component (Google sign-in button)
3. Create `AuthGuard` component (protects authenticated routes)
4. Update `App.tsx` routing:
   - Unauthenticated → Show SignInView
   - Authenticated → Show CollectionIndexView
5. Add sign-out button to Collection Index menu
6. Handle auth state persistence (Firebase SDK automatic)

**Files Created:**
- `packages/client/src/firebase/auth.ts` - Auth helpers
- `packages/client/src/context/AuthContext.tsx` - Auth state management
- `packages/client/src/views/SignInView.tsx` - Sign-in page
- `packages/client/src/components/AuthGuard.tsx` - Protected route wrapper

**Files Modified:**
- `packages/client/src/App.tsx` - Add AuthProvider, routing
- `packages/client/src/views/CollectionIndexView.tsx` - Add sign-out button

**Authentication Flow:**
```
User visits squickr.com
  ↓
AuthContext checks auth state
  ↓
Not authenticated → Show SignInView
  ↓
User clicks "Sign in with Google"
  ↓
Firebase signInWithPopup(GoogleAuthProvider)
  ↓
Google OAuth popup
  ↓
User approves
  ↓
Firebase returns user object (uid, email, displayName)
  ↓
AuthContext updates (user state)
  ↓
App re-renders → Shows CollectionIndexView
  ↓
User is signed in ✓
```

**UI Components:**

**SignInView:**
```tsx
<div className="min-h-screen flex items-center justify-center">
  <div className="text-center">
    <h1>Squickr Life</h1>
    <p>Get shit done quicker with Squickr!</p>
    <button onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  </div>
</div>
```

**Sign-out button (in Collection Index menu):**
```tsx
<MenuItem onClick={signOut}>
  Sign Out
</MenuItem>
```

---

### **Phase 4: Firestore Event Sync - Upload** (3-4 hours)

**Goal:** Upload local IndexedDB events to Firestore on first login

**Tasks:**
1. Create `FirestoreEventStore` class (implements `IEventStore`)
2. Implement `uploadLocalEvents()` function
3. Add duplicate detection (by event ID)
4. Use Firestore batched writes (500 events per batch)
5. Track sync state in localStorage
6. Trigger upload on first sign-in

**Files Created:**
- `packages/client/src/firebase/FirestoreEventStore.ts`
- `packages/client/src/firebase/syncEvents.ts`

**Files Modified:**
- `packages/client/src/App.tsx` - Trigger upload on auth

**Upload Logic:**
```typescript
async function uploadLocalEvents(userId: string, indexedDBStore: IEventStore) {
  // Get all local events
  const localEvents = await indexedDBStore.getAll();
  
  if (localEvents.length === 0) {
    console.log('No local events to upload');
    return;
  }
  
  // Check which events already exist in Firestore
  const remoteEventIds = await getRemoteEventIds(userId);
  
  // Filter to only new events
  const eventsToUpload = localEvents.filter(
    event => !remoteEventIds.has(event.id)
  );
  
  console.log(`Uploading ${eventsToUpload.length} events to Firestore`);
  
  // Batch upload (Firestore allows 500 writes per batch)
  const batches = chunk(eventsToUpload, 500);
  
  for (const batch of batches) {
    const firestoreBatch = firestore.batch();
    
    for (const event of batch) {
      const docRef = firestore
        .collection(`users/${userId}/events`)
        .doc(event.id);
      
      firestoreBatch.set(docRef, event);
    }
    
    await firestoreBatch.commit();
  }
  
  // Update sync state
  localStorage.setItem('last_sync_timestamp', new Date().toISOString());
  localStorage.setItem('has_synced', 'true');
  
  console.log('Upload complete ✓');
}
```

**Duplicate Detection:**
```typescript
async function getRemoteEventIds(userId: string): Promise<Set<string>> {
  const snapshot = await firestore
    .collection(`users/${userId}/events`)
    .select('id') // Only fetch IDs (not full docs)
    .get();
  
  return new Set(snapshot.docs.map(doc => doc.id));
}
```

---

### **Phase 5: Firestore Event Sync - Download** (3-4 hours)

**Goal:** Download remote events and merge into IndexedDB

**Tasks:**
1. Implement `downloadRemoteEvents()` function
2. Query Firestore for events after `last_sync_timestamp`
3. Filter out events already in IndexedDB
4. Append new events to IndexedDB
5. Trigger projection rebuild (UI update)
6. Update `last_sync_timestamp`

**Files Modified:**
- `packages/client/src/firebase/syncEvents.ts` - Add download logic

**Download Logic:**
```typescript
async function downloadRemoteEvents(userId: string, indexedDBStore: IEventStore) {
  // Get last sync timestamp (default to epoch if never synced)
  const lastSync = localStorage.getItem('last_sync_timestamp') || '1970-01-01T00:00:00.000Z';
  
  // Query Firestore for events after last sync
  const snapshot = await firestore
    .collection(`users/${userId}/events`)
    .where('timestamp', '>', lastSync)
    .orderBy('timestamp', 'asc')
    .get();
  
  console.log(`Downloaded ${snapshot.docs.length} events from Firestore`);
  
  // Get IDs of events already in IndexedDB
  const localEvents = await indexedDBStore.getAll();
  const localEventIds = new Set(localEvents.map(e => e.id));
  
  // Append only new events
  let newEventsCount = 0;
  for (const doc of snapshot.docs) {
    const event = doc.data() as DomainEvent;
    
    if (!localEventIds.has(event.id)) {
      await indexedDBStore.append(event);
      newEventsCount++;
    }
  }
  
  console.log(`Appended ${newEventsCount} new events to IndexedDB`);
  
  // Update last sync timestamp
  if (snapshot.docs.length > 0) {
    const latestEvent = snapshot.docs[snapshot.docs.length - 1].data();
    localStorage.setItem('last_sync_timestamp', latestEvent.timestamp);
  }
  
  console.log('Download complete ✓');
}
```

**Projection Rebuild:**
```typescript
// After downloading events, projections rebuild automatically
// because IndexedDBEventStore.append() calls notifySubscribers()
// which triggers React component re-renders via useEffect hooks
```

---

### **Phase 6: Bidirectional Sync** (2-3 hours)

**Goal:** Sync on app launch + periodic background sync

**Tasks:**
1. Create `SyncManager` class
2. Implement sync cycle (upload + download)
3. Add sync timing (launch + every 5 minutes)
4. Prevent concurrent syncs
5. Track sync state (idle, syncing, error)
6. Add to `App.tsx`: Initialize on auth

**Files Created:**
- `packages/client/src/sync/SyncManager.ts`

**Files Modified:**
- `packages/client/src/App.tsx` - Initialize SyncManager
- `packages/client/src/context/AppContext.tsx` - Expose sync state

**SyncManager Implementation:**
```typescript
export class SyncManager {
  private syncInterval?: number;
  private isSyncing = false;
  private listeners = new Set<(state: SyncState) => void>();
  
  constructor(
    private userId: string,
    private indexedDBStore: IEventStore
  ) {}
  
  /**
   * Start periodic sync (on launch + every 5 minutes)
   */
  start() {
    // Sync immediately on start
    this.sync();
    
    // Sync every 5 minutes
    this.syncInterval = window.setInterval(() => {
      this.sync();
    }, 5 * 60 * 1000);
    
    // Sync when coming back online
    window.addEventListener('online', () => this.sync());
  }
  
  /**
   * Stop periodic sync
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }
  
  /**
   * Run sync cycle (upload + download)
   */
  async sync(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    this.isSyncing = true;
    this.notifyListeners({ status: 'syncing' });
    
    try {
      // 1. Upload local events
      await uploadLocalEvents(this.userId, this.indexedDBStore);
      
      // 2. Download remote events
      await downloadRemoteEvents(this.userId, this.indexedDBStore);
      
      this.notifyListeners({ status: 'idle', lastSync: new Date() });
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners({ status: 'error', error });
    } finally {
      this.isSyncing = false;
    }
  }
  
  /**
   * Subscribe to sync state changes
   */
  subscribe(callback: (state: SyncState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(state: SyncState) {
    this.listeners.forEach(callback => callback(state));
  }
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  lastSync?: Date;
  error?: Error;
}
```

**Integration in App.tsx:**
```typescript
const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

useEffect(() => {
  if (user && !syncManager) {
    const manager = new SyncManager(user.uid, eventStore);
    manager.start();
    setSyncManager(manager);
  }
  
  return () => {
    syncManager?.stop();
  };
}, [user]);
```

---

### **Phase 7: Offline Support** (2-3 hours)

**Goal:** Handle offline editing and queue for sync

**Tasks:**
1. Enable Firestore offline persistence
2. Track pending sync events in IndexedDB
3. Add network state detection
4. Show offline indicator (optional for testing)
5. Sync pending events when online

**Files Modified:**
- `packages/infrastructure/src/indexeddb-event-store.ts` - Add pending sync tracking
- `packages/client/src/firebase/config.ts` - Enable offline persistence
- `packages/client/src/sync/SyncManager.ts` - Handle pending events
- `packages/client/src/components/OfflineIndicator.tsx` (optional)

**Enable Firestore Offline Persistence:**
```typescript
// In firebase/config.ts
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

**Pending Sync Tracking:**
```typescript
// In IndexedDBEventStore
export class IndexedDBEventStore implements IEventStore {
  private readonly pendingSyncStoreName = 'pending_sync_events';
  
  async append(event: DomainEvent): Promise<void> {
    // Append to main events store
    await this.appendToStore('events', event);
    
    // Also track as pending sync
    await this.appendToStore('pending_sync_events', { eventId: event.id });
    
    this.notifySubscribers(event);
  }
  
  async getPendingSyncEventIds(): Promise<Set<string>> {
    const pending = await this.getAllFromStore('pending_sync_events');
    return new Set(pending.map(p => p.eventId));
  }
  
  async markEventsSynced(eventIds: string[]): Promise<void> {
    const tx = this.db.transaction(['pending_sync_events'], 'readwrite');
    const store = tx.objectStore('pending_sync_events');
    
    for (const eventId of eventIds) {
      await store.delete(eventId);
    }
  }
}
```

**Upload Only Pending Events:**
```typescript
async function uploadLocalEvents(userId: string, indexedDBStore: IndexedDBEventStore) {
  // Get only pending sync events (not all events every time)
  const pendingEventIds = await indexedDBStore.getPendingSyncEventIds();
  
  if (pendingEventIds.size === 0) {
    console.log('No pending events to upload');
    return;
  }
  
  const allEvents = await indexedDBStore.getAll();
  const eventsToUpload = allEvents.filter(e => pendingEventIds.has(e.id));
  
  // Batch upload
  await batchUploadToFirestore(userId, eventsToUpload);
  
  // Mark as synced
  await indexedDBStore.markEventsSynced(Array.from(pendingEventIds));
}
```

**Network State Detection:**
```typescript
// In SyncManager
constructor(userId: string, indexedDBStore: IEventStore) {
  this.userId = userId;
  this.indexedDBStore = indexedDBStore;
  
  // Sync when network reconnects
  window.addEventListener('online', () => {
    console.log('Network reconnected, syncing...');
    this.sync();
  });
}
```

---

### **Phase 8: Migration Path** (1-2 hours)

**Goal:** Enable seamless migration from old Netlify site to squickr.com

**Process (No Code Changes Needed):**

1. **User signs into old Netlify site** (e.g., squickr-life.netlify.app)
   - AuthContext detects first login
   - `uploadLocalEvents()` runs
   - All IndexedDB events uploaded to Firestore
   - User's data now backed up in cloud ✓

2. **User signs into squickr.com**
   - AuthContext detects same user (by Google uid)
   - `downloadRemoteEvents()` runs
   - All events from Firestore downloaded to IndexedDB
   - Projections rebuild
   - User sees all their data on squickr.com ✓

3. **User can stop using old Netlify site**
   - Data is in cloud (accessible from any device)
   - Old site can be deleted (optional)

**Edge Case Handling:**

**Case 1: User signs in on both sites before sync completes**
- Old site uploads events with IDs: [A, B, C]
- New site tries to upload same events: [A, B, C]
- Firestore uses event ID as document ID → Duplicates prevented ✓

**Case 2: User creates new task on old site after migrating**
- New task created → Event uploaded to Firestore
- Next sync on squickr.com → Event downloaded
- Task appears on both sites ✓

**Validation After Migration:**
```typescript
// After migration, verify event counts match
const localEvents = await indexedDBStore.getAll();
const remoteSnapshot = await firestore
  .collection(`users/${userId}/events`)
  .get();

console.log('Local events:', localEvents.length);
console.log('Remote events:', remoteSnapshot.docs.length);
// Should match!
```

---

### **Phase 9: Testing & Polish** (2-3 hours)

**Goal:** Test multi-device sync and edge cases

**Test Cases:**

**1. First Sign-In (Local Data Exists):**
- Create 10 tasks/notes/collections in IndexedDB
- Sign in with Google
- Verify: All 10 events uploaded to Firestore ✓
- Open squickr.com on different browser
- Sign in with same Google account
- Verify: All 10 events downloaded, app shows same data ✓

**2. Offline Editing:**
- Disconnect network (Chrome DevTools → Network → Offline)
- Create 5 new tasks
- Verify: Tasks saved locally ✓
- Reconnect network
- Verify: Sync runs automatically, 5 events uploaded ✓

**3. Concurrent Editing (Different Devices):**
- Phone: Edit task title → "Buy milk"
- Desktop: Edit same task title → "Buy almond milk"
- Both sync
- Verify: Last-write-wins (latest timestamp) ✓

**4. Large Data Sets:**
- Create 500 tasks
- Sign in on fresh device
- Verify: All 500 events download correctly ✓
- Verify: Batch upload works (500 events in one batch) ✓

**5. Error Handling:**
- Simulate network failure during sync (kill connection mid-sync)
- Verify: Sync retries on next interval ✓
- Simulate auth token expiration
- Verify: Re-auth flow works ✓

**Polish (Optional for Testing Phase):**
- Add sync icon in header (cloud icon with sync state)
- Show sync status: "Syncing...", "Synced X ago", "Sync failed"
- Add manual "Sync Now" button in settings

---

### **Phase 10: Security Rules Validation** (1 hour)

**Goal:** Ensure users can only access their own data

**Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId}/events/{eventId} {
      // Rule 1: Users can only read/write their own events
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Rule 2: Events are immutable (append-only)
      allow update, delete: if false;
    }
  }
}
```

**Security Tests:**

**Test 1: User can read own events**
```typescript
// Sign in as user A
const events = await firestore.collection(`users/${userA.uid}/events`).get();
// Should succeed ✓
```

**Test 2: User cannot read other user's events**
```typescript
// Sign in as user A, try to read user B's events
const events = await firestore.collection(`users/${userB.uid}/events`).get();
// Should fail with permission denied ✓
```

**Test 3: User cannot update events (immutable)**
```typescript
const eventRef = firestore.doc(`users/${userId}/events/${eventId}`);
await eventRef.update({ title: 'Hacked!' });
// Should fail with permission denied ✓
```

**Test 4: Unauthenticated access fails**
```typescript
// Sign out
await signOut();
const events = await firestore.collection(`users/${userId}/events`).get();
// Should fail with permission denied ✓
```

**Deploy Security Rules:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize Firestore
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

---

## Project Structure (New Files)

```
packages/
├── client/
│   ├── .env.local                       # Firebase config (gitignored)
│   └── src/
│       ├── firebase/
│       │   ├── config.ts                # Firebase initialization
│       │   ├── auth.ts                  # Auth helpers (signIn, signOut)
│       │   ├── FirestoreEventStore.ts   # Firestore IEventStore implementation
│       │   └── syncEvents.ts            # Upload/download logic
│       ├── sync/
│       │   └── SyncManager.ts           # Sync orchestration
│       ├── context/
│       │   └── AuthContext.tsx          # Auth state management
│       ├── views/
│       │   └── SignInView.tsx           # Sign-in page
│       └── components/
│           ├── AuthGuard.tsx            # Protected route wrapper
│           └── OfflineIndicator.tsx     # Optional: "Offline" badge
└── shared/
    └── src/
        └── indexeddb-event-store.ts     # Modified: Add pending sync tracking
```

---

## Timeline Estimate

| Phase | Task | Hours | Days |
|-------|------|-------|------|
| 1 | Firebase Setup | 1-2 | 0.5 |
| 2 | Dependencies | 0.5 | 0.5 |
| 3 | Authentication UI | 2-3 | 1 |
| 4 | Upload Sync | 3-4 | 1 |
| 5 | Download Sync | 3-4 | 1 |
| 6 | Bidirectional Sync | 2-3 | 1 |
| 7 | Offline Support | 2-3 | 1 |
| 8 | Migration Path | 1-2 | 0.5 |
| 9 | Testing & Polish | 2-3 | 1 |
| 10 | Security Validation | 1 | 0.5 |
| **Total** | | **18-27 hours** | **~4-6 days** |

**With focused work:** 1 week  
**With part-time work:** 2-3 weeks

---

## Risk Assessment

### **Risk 1: Firebase Free Tier Limits**

**Limit:**
- 50k reads/day
- 20k writes/day
- 1GB storage

**Estimated Usage (Personal Use):**
- Reads: ~100/day (10 syncs × 10 events per sync)
- Writes: ~50/day (5 syncs × 10 events per sync)
- Storage: ~1MB (1000 events × 1KB each)

**Verdict:** Well within limits (~1% usage) ✓

**Mitigation:** If usage grows, upgrade to Blaze (pay-as-you-go, still very cheap for personal use)

---

### **Risk 2: Data Loss During Migration**

**Scenario:** Sync fails mid-migration, some events don't upload

**Mitigation:**
- Events are append-only (never deleted)
- Sync is idempotent (can re-run safely)
- Worst case: Re-upload from old site
- Best practice: Keep old site running until migration verified

**Verdict:** Low risk, easy recovery ✓

---

### **Risk 3: Sync Conflicts (Concurrent Edits)**

**Scenario:** Edit same task on phone and desktop while both offline

**Mitigation:**
- Last-write-wins (timestamp-based)
- Event log preserves both versions (audit trail)
- For personal use (single user, one device at a time): Very low probability
- Future: Can add conflict resolution UI if needed

**Verdict:** Acceptable for personal use ✓

---

### **Risk 4: Firebase Vendor Lock-In**

**Scenario:** Need to migrate away from Firebase later

**Mitigation:**
- Event store abstracted via `IEventStore` interface
- Events stored in standard JSON format (exportable)
- Can swap Firebase for Supabase by:
  1. Export events from Firestore
  2. Implement `SupabaseEventStore` (same interface)
  3. Import events to Supabase
  4. Update config to use new store

**Verdict:** Low risk, migration path exists ✓

---

### **Risk 5: Network Failures During Sync**

**Scenario:** Network drops mid-sync, partial upload/download

**Mitigation:**
- Firestore batched writes are atomic (all or nothing)
- Pending sync tracking ensures retry on next sync
- Network reconnection triggers immediate sync
- Duplicate detection prevents double-uploads

**Verdict:** Handled by design ✓

---

## Future Enhancements (Post-MVP)

After basic sync is working and stable:

### **1. Real-Time Sync (Optional)**
**What:** Use Firestore `onSnapshot` for instant updates
**Why:** See changes from other devices immediately
**When:** If user starts using desktop more frequently

### **2. Conflict Resolution UI (Optional)**
**What:** Prompt user when conflicts detected
**Why:** Give user control over which change to keep
**Example:**
```
Conflict detected:
  Phone: "Buy milk" (10:00 AM)
  Desktop: "Buy almond milk" (10:05 AM)
  
  Which version do you want to keep?
  [Phone] [Desktop] [Cancel]
```

### **3. Selective Sync (Advanced)**
**What:** Choose which collections to sync
**Why:** Reduce bandwidth, keep some collections local-only
**Example:** "Work Projects" syncs, "Personal Diary" local-only

### **4. Export/Backup (Useful Even with Cloud)**
**What:** Download all events as JSON file
**Why:** Local backup, data portability, migration to other systems
**When:** Good to have for peace of mind

### **5. Collaboration (Major Feature)**
**What:** Share collections with other users
**Why:** Family shopping lists, team projects
**Requires:**
- Multi-user event model (add `userId` to events)
- Permissions system (owner, editor, viewer)
- Shared collections (different Firestore structure)
- Conflict resolution for concurrent edits

### **6. Sync Settings Page**
**What:** UI for sync configuration
**Features:**
- View last sync time
- Manual "Sync Now" button
- View sync history/logs
- Enable/disable auto-sync
- Clear local data and re-sync

---

## Architectural Refinements from Alex

### **Refinement 1: Improved Firestore Security Rules**

**Issue:** Current rules allow creating events with mismatched userId or event IDs.

**Solution:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/events/{eventId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      
      allow create: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.data.userId == userId  // Enforce userId match
        && request.resource.data.id == eventId;    // Event ID must match document ID
      
      allow update, delete: if false; // Immutable
    }
  }
}
```

---

### **Refinement 2: Fix Race Condition in Pending Sync**

**Issue:** Events created during sync might be incorrectly marked as synced.

**Solution:**
```typescript
async function uploadLocalEvents(userId: string, store: IndexedDBEventStore) {
  // Capture pending IDs at START
  const pendingEventIds = await store.getPendingSyncEventIds();
  
  if (pendingEventIds.size === 0) return;
  
  const allEvents = await store.getAll();
  const eventsToUpload = allEvents.filter(e => pendingEventIds.has(e.id));
  
  // Upload in batches
  await batchUploadToFirestore(userId, eventsToUpload);
  
  // CRITICAL: Mark ONLY the events we successfully uploaded
  const uploadedIds = eventsToUpload.map(e => e.id);
  await store.markEventsSynced(uploadedIds); // Not pendingEventIds!
  
  // Events created during upload remain in pending_sync_events ✓
}
```

---

### **Refinement 3: Add Batch Append Support**

**Issue:** Downloading 50 events calls `notifySubscribers` 50 times (projections rebuild 50x).

**Solution:**
```typescript
class IndexedDBEventStore implements IEventStore {
  async appendBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.appendToStore('events', event);
      await this.appendToStore('pending_sync_events', { eventId: event.id });
    }
    
    // Notify once after batch
    if (events.length > 0) {
      this.notifySubscribers(events[events.length - 1]);
    }
  }
}
```

**Usage in download sync:**
```typescript
async function downloadRemoteEvents(userId: string, indexedDBStore: IndexedDBEventStore) {
  const newEvents = await fetchNewEventsFromFirestore(userId);
  
  // Use batch append (single projection rebuild)
  await indexedDBStore.appendBatch(newEvents);
  
  localStorage.setItem('last_sync_timestamp', new Date().toISOString());
}
```

---

### **Refinement 4: Add Sync State to React Context**

**Issue:** Components can't access sync state for UI updates.

**Solution:**
```typescript
// In AppContext.tsx
interface AppContextValue {
  eventStore: IEventStore;
  syncManager: SyncManager | null;
  syncState: SyncState; // NEW
}

function AppProvider({ children }: { children: React.ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  
  useEffect(() => {
    if (syncManager) {
      return syncManager.subscribe(setSyncState);
    }
  }, [syncManager]);
  
  return (
    <AppContext.Provider value={{ eventStore, syncManager, syncState }}>
      {children}
    </AppContext.Provider>
  );
}
```

---

### **Refinement 5: Add Event Schema Version Validation**

**Issue:** Could append events with wrong schema version.

**Solution:**
```typescript
// In event-helpers.ts
export const CURRENT_EVENT_VERSION = 1;

export function validateEvent(event: DomainEvent): void {
  if (event.version !== CURRENT_EVENT_VERSION) {
    throw new Error(
      `Event version mismatch: expected ${CURRENT_EVENT_VERSION}, got ${event.version}`
    );
  }
  
  if (!event.id || !event.type || !event.timestamp || !event.aggregateId) {
    throw new Error('Event missing required fields');
  }
}

// In IndexedDBEventStore
async append(event: DomainEvent): Promise<void> {
  validateEvent(event); // Validate before appending
  // ... rest of append logic
}
```

---

### **Refinement 6: Add Sync Telemetry**

**Solution:**
```typescript
interface SyncTelemetry {
  syncStartTime: Date;
  syncEndTime: Date;
  eventsUploaded: number;
  eventsDownloaded: number;
  errors: Error[];
}

class SyncManager {
  async sync(): Promise<SyncTelemetry> {
    const telemetry: SyncTelemetry = {
      syncStartTime: new Date(),
      syncEndTime: new Date(),
      eventsUploaded: 0,
      eventsDownloaded: 0,
      errors: []
    };
    
    try {
      const uploadCount = await uploadLocalEvents(...);
      telemetry.eventsUploaded = uploadCount;
      
      const downloadCount = await downloadRemoteEvents(...);
      telemetry.eventsDownloaded = downloadCount;
    } catch (error) {
      telemetry.errors.push(error);
    } finally {
      telemetry.syncEndTime = new Date();
      this.logTelemetry(telemetry);
    }
    
    return telemetry;
  }
  
  private logTelemetry(telemetry: SyncTelemetry) {
    console.log(`[Sync] ${telemetry.eventsUploaded}↑ ${telemetry.eventsDownloaded}↓ in ${telemetry.syncEndTime - telemetry.syncStartTime}ms`);
  }
}
```

---

## Answers to Open Questions (Resolved by Alex)

### **1. Event Schema: userId Field**

**Alex's Answer:** YES - Add `userId` as optional field now

**Decision:**
```typescript
export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly timestamp: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly userId?: string; // NEW
}
```

**Implementation:**
- Add to DomainEvent interface as optional field (backward compatible)
- Update command handlers to populate when user is authenticated
- Existing events without userId remain valid

---

### **2. Sync State: Where to Store?**

**Alex's Answer:** localStorage for MVP, migrate to IndexedDB for production

**Decision:**
- **Phase 1 (MVP):** Use localStorage (simple, ships faster)
- **Phase 2 (Production):** Migrate to IndexedDB (more robust, query capabilities)

**Rationale:**
- localStorage gets you shipping faster
- IndexedDB is more robust for production (atomic updates, larger quota)
- One-time migration: read localStorage → write IndexedDB → clear localStorage

---

### **3. Offline Indicator: Design**

**Alex's Answer:** Cloud icon in header with 4 states

**Decision:**
```tsx
function SyncStatusIcon() {
  // ☁️ + ✓ = Synced (green)
  // ☁️ + ↻ = Syncing (blue, animated)
  // ☁️ + ✗ = Error (red)
  // ☁️ + ⚠ = Offline (gray)
}
```

**Placement:** Top-right corner of header (non-intrusive)

**Rationale:**
- Always visible but doesn't block UI
- Clear affordance (cloud = sync status)
- Common pattern (Google Drive, Notion, etc.)
- Post-MVP: Add tooltip on hover with "Last synced X ago"

---

### **4. First-Login Flow: UX**

**Alex's Answer:** Auto-upload (silent merge, no prompt)

**Decision:**
```typescript
async function onFirstLogin(user: User) {
  const localEvents = await indexedDBStore.getAll();
  
  if (localEvents.length > 0) {
    console.log(`Uploading ${localEvents.length} local events...`);
    await uploadLocalEvents(user.uid, indexedDBStore);
    console.log('Local data backed up to cloud ✓');
  }
  
  await downloadRemoteEvents(user.uid, indexedDBStore);
}
```

**Rationale:**
- User expectation: "My data should just work everywhere"
- Removes cognitive load (no decisions needed)
- Matches Google Drive, Dropbox behavior
- Event sourcing principle: Merging is idempotent and safe

---

### **5. Error Handling: How Aggressive?**

**Alex's Answer:** Silent retry with exponential backoff

**Decision:**
```typescript
class SyncManager {
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = [5000, 15000, 60000]; // 5s, 15s, 60s
  
  async sync(): Promise<void> {
    try {
      await this.doSync();
      this.retryCount = 0; // Reset on success
    } catch (error) {
      console.error('Sync failed:', error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay[this.retryCount - 1];
        setTimeout(() => this.sync(), delay);
      } else {
        // After 3 retries, show error via red cloud icon
        this.notifyListeners({ status: 'error', error });
      }
    }
  }
}
```

**Rationale:**
- Offline-first principle: App works without backend
- Silent retry handles 99% of transient errors
- Status icon shows red only after 3 failures
- No blocking UI or annoying toasts

---

## Dependencies & Prerequisites

### **External:**
- ✅ Google account (for OAuth) - User has
- ✅ Firebase account (free) - Need to create
- ✅ Domain configured (squickr.com) - Already done

### **Code:**
- ✅ No breaking changes to event sourcing architecture
- ✅ All current tests should continue passing
- ✅ Firebase sync is additive (doesn't replace IndexedDB)
- ✅ `IEventStore` interface already supports multiple implementations

---

## Success Criteria

**MVP is successful when:**

1. ✅ User can sign in with Google on any device
2. ✅ Local data auto-uploads to Firestore on first login
3. ✅ Data syncs across devices (phone ↔ desktop)
4. ✅ Offline editing works (changes sync when online)
5. ✅ Old Netlify data migrates to squickr.com via sync
6. ✅ All 553 existing tests still pass
7. ✅ Security rules prevent unauthorized access
8. ✅ No data loss scenarios

**Definition of Done:**
- User can delete old Netlify site and use only squickr.com
- User can access data from phone, tablet, and desktop
- User can create/edit/delete offline without losing data
- All data backed up in cloud (disaster recovery)

---

## Next Steps

**Immediate:**
1. Alex reviews this design document
2. Alex answers open questions
3. Alex approves or requests changes

**After Approval:**
1. Create ADR-010: Firebase Backend Sync
2. User creates Firebase project (Phase 1)
3. Begin implementation (Phase 2-10)

**Implementation Order:**
- Phases 1-3: Can do in one session (auth setup)
- Phases 4-6: Can do in one session (sync logic)
- Phases 7-10: Can do in one session (polish & testing)

**Total estimated time:** 3-4 focused sessions (~1 week)

---

**Document Status:** ✅ APPROVED BY ALEX (with refinements incorporated)  
**Author:** OpenCode  
**Reviewer:** Architecture Alex  
**Date:** 2026-01-30

---

## Alex's Architectural Review Summary

**Status:** APPROVED for Implementation

**Key Approvals:**
- ✅ Firebase backend choice is sound for event sourcing
- ✅ Sync strategy (periodic + eventual consistency) appropriate for personal use
- ✅ Last-write-wins conflict resolution correct for single-user scenario
- ✅ Migration strategy (sync as migration tool) is elegant
- ✅ Design preserves offline-first architecture

**Open Questions - Answered by Alex:**

1. **Add `userId` field to DomainEvent?** → YES (add as optional field now)
2. **Where to store sync state?** → localStorage for MVP, IndexedDB for production
3. **Offline indicator design?** → Cloud icon in header (4 states: synced/syncing/error/offline)
4. **First-login flow?** → Auto-upload (silent merge, no prompt)
5. **Error handling?** → Silent retry with exponential backoff (5s, 15s, 60s)

**Required Refinements:**
1. Improve Firestore security rules (prevent event ID spoofing)
2. Fix race condition in pending sync tracking
3. Add batch append support for efficiency
4. Add sync state to React context
5. Add event schema version validation
6. Add sync telemetry for debugging

See "Architectural Refinements from Alex" section below for implementation details.

---
