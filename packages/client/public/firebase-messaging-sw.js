// Firebase Cloud Messaging Service Worker
// This file must remain a classic (non-module) script — no ES imports, no Vite env vars.
// It uses importScripts to load the Firebase compat SDK from the CDN.
//
// IMPORTANT: This file is served at /firebase-messaging-sw.js and is used ONLY for
// background FCM message handling (when the app tab is not in focus).
// The Vite PWA plugin generates a separate service worker (sw.js) for asset caching.

importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

// Firebase config — these values are NOT secrets; they are already shipped in the
// client JS bundle (packages/client/src/firebase/config.ts uses the same values).
firebase.initializeApp({
  apiKey: 'AIzaSyATbqMFe1OQJ9stJErJqDY6dfFlFUyWP30',
  authDomain: 'squickr-life.firebaseapp.com',
  projectId: 'squickr-life',
  storageBucket: 'squickr-life.firebasestorage.app',
  messagingSenderId: '93795452085',
  appId: '1:93795452085:web:eaf428e74c28cc02a8eafc',
});

const messaging = firebase.messaging();

// Handle background FCM messages (tab not focused / app in background)
messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title ?? 'Habit Reminder';
  const body = payload.data?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    data: payload.data ?? {},
  });
});

// Handle notification click — focus an existing app tab or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/');
      }),
  );
});
