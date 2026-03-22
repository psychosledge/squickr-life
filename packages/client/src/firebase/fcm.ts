/**
 * FCM Token Registration
 *
 * Called once after isAppReady + user are both truthy (with a 2s delay from App.tsx).
 *
 * Design decisions:
 *  - Gated by localStorage so we NEVER request permission twice per browser profile.
 *  - The gate is set BEFORE requestPermission() so a crash/rejection can't leave us
 *    in a state where we'd re-request on next load.
 *  - Silent fail throughout — this must never throw to the caller or crash the app.
 *  - All firebase imports are dynamic (lazy) so they don't slow the initial bundle.
 */

import { app, firestore } from './config';

const FCM_REQUESTED_KEY = 'fcm-permission-requested';

/**
 * Converts a string to its SHA-256 hex digest.
 * Used to produce a stable, collision-resistant Firestore document ID from an FCM token.
 */
export async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Registers the device for FCM push notifications and stores the token in Firestore.
 *
 * @param userId - The authenticated Firebase UID for the current user.
 */
export async function registerFcmToken(userId: string): Promise<void> {
  // 1. Gate: only ever request permission once per browser profile.
  //    Set the flag BEFORE requesting so a crash/throw can't bypass the gate.
  if (localStorage.getItem(FCM_REQUESTED_KEY)) return;
  localStorage.setItem(FCM_REQUESTED_KEY, '1');

  // 2. Check browser support
  if (!('Notification' in window)) return;

  // 3. Request permission — if this throws, we catch below and the gate is already set.
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return;
  }

  if (permission !== 'granted') return;

  // 4. Check FCM is supported in this browser (some browsers / private modes don't support it)
  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    // 5. Get FCM token
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env['VITE_FIREBASE_VAPID_KEY'],
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) return;

    // 6. Write to Firestore: users/{userId}/fcmTokens/{sha256(token)}
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const tokenId = await sha256hex(token);
    await setDoc(
      doc(firestore, `users/${userId}/fcmTokens/${tokenId}`),
      {
        token,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastSeenAt: serverTimestamp(),
        appVersion: import.meta.env['VITE_APP_VERSION'] ?? 'unknown',
        // createdAt is overwritten on re-registration, but the localStorage gate prevents that in practice
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // Silent fail — FCM errors (invalid VAPID, SW registration failed, Firestore errors, etc.)
    // must not surface to the user or crash the app.
  }
}
