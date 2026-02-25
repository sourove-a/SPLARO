/* SPLARO push service worker */

function toBase64Url(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function resolvePayloadFromServer() {
  const fallback = {
    title: 'SPLARO',
    message: 'New update is available.',
    url: '/'
  };

  try {
    const registration = self.registration;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return fallback;

    const endpoint = subscription.endpoint || '';
    const auth = toBase64Url(subscription.getKey('auth'));
    if (!endpoint || !auth) return fallback;

    const params = new URLSearchParams({
      action: 'push_latest',
      endpoint,
      auth
    });
    const response = await fetch(`/api/index.php?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status !== 'success' || !payload.payload) {
      return fallback;
    }

    return {
      title: String(payload.payload.title || fallback.title),
      message: String(payload.payload.message || fallback.message),
      url: String(payload.payload.url || fallback.url),
      notification_id: Number(payload.payload.notification_id || 0)
    };
  } catch (error) {
    return fallback;
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const payload = await resolvePayloadFromServer();
    const title = payload.title || 'SPLARO';
    const options = {
      body: payload.message || 'New update is available.',
      icon: '/favicon-192.png',
      badge: '/favicon-32.png',
      data: {
        url: payload.url || '/',
        notification_id: payload.notification_id || 0
      },
      tag: 'splaro-notification',
      renotify: true
    };

    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      const samePath = targetUrl && new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname;
      if (samePath && 'focus' in client) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
