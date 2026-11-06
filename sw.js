// Offline cache: app shell precached, everything else stale-while-revalidate.
const V = 'angi-v5';
const SHELL = ['./', 'index.html', 'style.css', 'skins.css', 'js/app.js', 'js/modes.js', 'js/modes2.js', 'js/sketch.js', 'js/skins.js', 'js/store.js', 'js/extras.js', 'js/group.js', 'js/bowl3d.js',
  'vendor/rough.js', 'vendor/gsap.min.js', 'data/dishes.json', 'data/credits.json', 'data/memes.json', 'data/rebus.json', 'data/more.json', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: u.pathname.endsWith('/') || u.pathname.endsWith('.html') });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

const LUNCH = ['Đói chưa? 11 giờ rồi đó 🍜', 'Bao tử gọi điện kìa, bấm nghe đi 📞', 'Trưa nay ăn gì? Để cái bát lo!', 'Đừng nhịn đói, tui buồn đó 🥺', 'Giờ vàng ăn trưa đã điểm 🔔'];
self.addEventListener('push', (e) => {
  e.waitUntil(self.registration.showNotification('Hôm nay ăn gì?', { body: LUNCH[Math.floor(Math.random() * LUNCH.length)], icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'lunch' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('./?go=1'));
});
