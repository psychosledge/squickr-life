# ADR-023: Event-Driven Eager Sync, FCM Token Refresh, and Device Identity

**Date**: 2026-04-01
**Status**: Accepted

## Context

Three related but independent problems with the push notification pipeline were
identified during user acceptance testing. They are grouped into a single ADR because
they all affect the same subsystem (`fcm.ts`, `SyncManager`, Firestore `fcmTokens`
collection, and the `habitReminderFanOut` Cloud Function), and their solutions must
be co-designed to avoid introducing new inconsistencies.

---

### Problem 1 — Sync lag between local event store and Firestore

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

### Problem 2 — Stale FCM tokens

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

### Problem 3 — Token accumulation and duplicate notifications

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

## Decision

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

## Rationale

### Problem 1 — Sync lag

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

### Problem 2 — Stale tokens

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

### Problem 3 — Token accumulation

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

## Firestore Token Document Schema

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

## localStorage Keys

Three keys are now used by `fcm.ts`:

| Key | Previous value | New value | Purpose |
|---|---|---|---|
| `fcm-permission-requested` | `'1'` | `'1'` (unchanged) | Prevents re-prompting for browser permission |
| `fcm-token-stored` | `'1'` | raw FCM token string | Enables token rotation detection; presence check still works via truthiness |
| `fcm-device-id` | (new) | UUID string | Stable device identity, generated once per browser profile |

`useFcmRegistrationStatus` reads only `FCM_REQUESTED_KEY` and `FCM_TOKEN_STORED_KEY` via
`!!localStorage.getItem(...)`. The truthiness contract is unchanged; no modifications
to the hook are required.

## Consequences

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

## SOLID Principles

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

## Implementation Plan

### Step 1 — Extend `SyncManager` (Problem 1)

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

### Step 2 — Add device identity generation (Problem 3)

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

### Step 3 — Store raw token in `FCM_TOKEN_STORED_KEY` (Problems 2 and 3)

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

### Step 4 — Detect and handle token rotation in the heartbeat path (Problem 2)

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

### Step 5 — Tests for `fcm.ts`

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

### Step 6 — No other files change

`HabitDetailView`, `CreateHabitModal`, `App.tsx`, `IndexedDBEventStore`,
`useFcmRegistrationStatus`, `habit-reminder-fanout.ts`, and all event type definitions
are unchanged. The fan-out reads all documents from `fcmTokens` and sends to each token
field — `deviceId` is additive metadata that the fan-out ignores.

## Files to Modify

- `packages/client/src/firebase/SyncManager.ts` — subscribe to local event store in `start()`, unsubscribe in `stop()`, add `debouncedSyncNow()` private method
- `packages/client/src/firebase/SyncManager.test.ts` — subscriber-triggered sync tests (estimated: 4 new tests)
- `packages/client/src/firebase/fcm.ts` — export `FCM_DEVICE_ID_KEY`, add `getOrCreateDeviceId()`, update `registerFcmToken()` to store raw token and `deviceId`, rewrite `refreshFcmTokenLastSeen()` with rotation detection
- `packages/client/src/firebase/fcm.test.ts` — token rotation and device identity tests (estimated: 8 new tests)
