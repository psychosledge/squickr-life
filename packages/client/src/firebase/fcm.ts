/**
 * FCM Token Registration
 *
 * Called once after isAppReady + user are both truthy (with a 2s delay from App.tsx).
 *
 * Design decisions:
 *  - TWO localStorage keys are used:
 *      FCM_REQUESTED_KEY  ('fcm-permission-requested'): set before calling requestPermission()
 *                          so the browser permission dialog is never shown twice.
 *      FCM_TOKEN_STORED_KEY ('fcm-token-stored'): set only after a token is successfully
 *                           written to Firestore. Cleared if the token becomes invalid.
 *  - Gate logic on each call:
 *      Both keys present   → heartbeat path: refresh lastSeenAt only (no permission re-prompt)
 *      Only REQUESTED set  → token was never stored (prior failure): retry without re-prompting
 *      Neither key set     → first time: run full flow (request permission + store token)
 *  - Silent fail throughout — this must never throw to the caller or crash the app.
 *  - All firebase imports are dynamic (lazy) so they don't slow the initial bundle.
 */

import { app, firestore } from './config';

export const FCM_REQUESTED_KEY = 'fcm-permission-requested';
export const FCM_TOKEN_STORED_KEY = 'fcm-token-stored';

/**
 * Sets a localStorage key and dispatches a synthetic `storage` event so that
 * listeners in the same tab (e.g. useFcmRegistrationStatus) can react immediately.
 */
function setLocalStorageKey(key: string, value: string): void {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

/**
 * Removes a localStorage key and dispatches a synthetic `storage` event.
 */
function removeLocalStorageKey(key: string): void {
  localStorage.removeItem(key);
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

export async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function refreshFcmTokenLastSeen(userId: string): Promise<void> {
  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env['VITE_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      removeLocalStorageKey(FCM_TOKEN_STORED_KEY);
      return;
    }

    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const tokenId = await sha256hex(token);
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

export async function registerFcmToken(userId: string): Promise<void> {
  const hasRequested = !!localStorage.getItem(FCM_REQUESTED_KEY);
  const hasStoredToken = !!localStorage.getItem(FCM_TOKEN_STORED_KEY);

  // Heartbeat path: token already stored — just refresh lastSeenAt
  if (hasRequested && hasStoredToken) {
    await refreshFcmTokenLastSeen(userId);
    return;
  }

  // First-time path: request browser permission
  if (!hasRequested) {
    if (!('Notification' in window)) return;
    setLocalStorageKey(FCM_REQUESTED_KEY, '1');

    let permission: NotificationPermission;
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
    if (permission !== 'granted') return;
  }

  // Registration path (first time or retry after prior failure)
  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env['VITE_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) return;

    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const tokenId = await sha256hex(token);
    await setDoc(
      doc(firestore, `users/${userId}/fcmTokens/${tokenId}`),
      {
        token,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastSeenAt: serverTimestamp(),
        appVersion: import.meta.env['VITE_APP_VERSION'] ?? 'unknown',
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    setLocalStorageKey(FCM_TOKEN_STORED_KEY, '1');
  } catch {
    // Silent fail
  }
}
