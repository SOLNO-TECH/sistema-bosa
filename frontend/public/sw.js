/* Service Worker — Web Push para pantalla de bloqueo / PWA (Bosa HUB) */

self.addEventListener('push', (event) => {
  let payload = { title: 'Bosa HUB', body: '', icon: '/logo.png', badge: '/logo.png', tag: 'bosa', data: { url: '/' } };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag || 'bosa',
    data: payload.data || { url: '/' },
    renotify: true,
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const appOpen = clientList.some(
        (c) => c.visibilityState === 'visible' || c.focused === true
      );
      if (appOpen) {
        for (const client of clientList) {
          client.postMessage({ type: 'PUSH_RECEIVED', payload });
        }
        return;
      }
      return self.registration.showNotification(payload.title || 'Bosa HUB', options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
