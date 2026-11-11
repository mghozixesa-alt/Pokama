/* Sistem Kerja Pokama · service worker: hanya untuk notifikasi HP (tidak menyimpan cache halaman) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Sistem Kerja Pokama', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Sistem Kerja Pokama', {
    body: d.body || '', icon: '/img/icon.png', badge: '/img/icon.png', tag: d.tag || undefined,
    data: { url: d.url || '/' }, requireInteraction: !!d.urgent
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (new URL(c.url).origin === self.location.origin) { await c.focus(); try { c.navigate(url); } catch (x) {} return; } }
    await self.clients.openWindow(url);
  })());
});
