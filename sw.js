const CACHE = 'namaz-v4';
const SHELL = ['./', 'index.html', 'styles.css?v=4', 'app.js?v=4', 'districts.js?v=4', 'install.js?v=4', 'quran.js?v=4', 'native.js?v=4', 'data/quran/index.json?v=4', 'data/surah-guide.json?v=4', 'manifest.json?v=4', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'namaz-quran-audio').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'everyayah.com') {      // Quran audio: from the offline cache if saved, else stream (not cached)
    e.respondWith(caches.open('namaz-quran-audio').then(c => c.match(e.request.url)).then(hit => hit || fetch(e.request)));
    return;
  }
  if (u.hostname === 'api.aladhan.com') {           // network first, cache fallback
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // app shell, hadith data and fonts: stale-while-revalidate
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
