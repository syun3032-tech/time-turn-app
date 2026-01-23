// Firebase Messaging Service Worker
// This service worker handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration - these will be filled from environment
const firebaseConfig = {
  apiKey: "AIzaSyBgalHuBt58yfx-Y-KDuKjkBSqEaZTPLOo",
  authDomain: "timeturn-fde25.firebaseapp.com",
  projectId: "timeturn-fde25",
  storageBucket: "timeturn-fde25.firebasestorage.app",
  messagingSenderId: "463816906746",
  appId: "1:463816906746:web:48622dc475dc975fb4b643",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || '秘書ちゃんからのお知らせ';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.data?.tag || 'timeturn-notification',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'アプリを開く',
      },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  event.notification.close();

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there is already a window/tab open
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow('/dashboard');
      }
    })
  );
});
