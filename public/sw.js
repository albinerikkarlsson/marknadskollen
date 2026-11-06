// Service worker för Marknadskollen. Används bara för att visa prislarm som notiser
// och öppna rätt bolagssida när man klickar på notisen. Ingen cachning av data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const href = e.notification.data?.href || '/bevakning';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) return c.navigate(href); return; } }
    return self.clients.openWindow(href);
  })());
});
