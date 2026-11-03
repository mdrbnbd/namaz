/* Retired: the site is no longer an installable browser app (PWA) — only the Android APK is offered.
   Browsers that installed the old app pick up this worker on their next visit; it deletes the old
   app-shell caches (namaz-v*) and unregisters itself. Downloaded Quran audio (namaz-quran-audio) is kept. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => /^namaz-v\d+$/.test(k)).map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({type: 'window'});
    cs.forEach(c => { try { c.navigate(c.url); } catch {} });
  })());
});
