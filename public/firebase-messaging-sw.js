// Compatibility artifact for legacy FCM setups.
// QuorumFlow uses /sw.js as the effective PWA and push service worker in production.
// This file is kept only to avoid stale references during transitions and diagnostics.
// Firebase Messaging Service Worker — Modular SDK (v10 compat)
// Must match the Firebase version used by the app
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBsUZcqxqrseCd0xchrNRw6zAzaJQG74YY',
  authDomain: 'quorumflow-dlqh0.firebaseapp.com',
  projectId: 'quorumflow-dlqh0',
  storageBucket: 'quorumflow-dlqh0.firebasestorage.app',
  messagingSenderId: '865790845881',
  appId: '1:865790845881:web:522f762727495861e20c68'
});

const messaging = firebase.messaging();

// Handle background messages (app is in background or closed)
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'QuorumFlow';
  const notificationBody = payload.notification?.body || payload.data?.body || 'Tienes una nueva notificación';
  const notificationUrl = payload.data?.url || payload.fcmOptions?.link || '/';
  const notificationTag = payload.data?.tag || 'quorumflow-notification';

  const notificationOptions = {
    body: notificationBody,
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: notificationTag,
    renotify: true,
    data: {
      url: notificationUrl
    },
    // Vibrate pattern for Android
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open or focus the correct URL
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function (clientList) {
      // Try to focus an existing window with this URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no existing window → open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
