// Import Firebase Messaging for Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// Usar valores predeterminados seguros que serán reemplazados por el script de build si es necesario
firebase.initializeApp({
  apiKey: 'AIzaSyBsUZcqxqrseCd0xchrNRw6zAzaJQG74YY',
  authDomain: 'quorumflow-dlqh0.firebaseapp.com',
  projectId: 'quorumflow-dlqh0',
  storageBucket: 'quorumflow-dlqh0.firebasestorage.app',
  messagingSenderId: '865790845881',
  appId: '1:865790845881:web:522f762727495861e20c68'
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title || 'QuorumFlow';
  const notificationOptions = {
    body: payload.notification.body || 'Tienes una nueva notificación',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: {
      url: payload.data && payload.data.url ? payload.data.url : '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
