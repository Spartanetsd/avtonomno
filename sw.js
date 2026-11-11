// Service Worker «Автономно»: повна робота офлайн після першого завантаження.
// Під час оновлення змініть VERSION — браузер встановить нову версію,
// а дані користувача (localStorage) кеш не зачіпає.

const VERSION = 'avtonomno-v1.0.0';
const PREFIX = 'avtonomno-';

const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ui.js',
  './screens.js',
  './calcui.js',
  './engine.js',
  './data.js',
  './solutions.js',
  './safety.js',
  './calc.js',
  './physics.js',
  './store.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

const urls = CORE.map((p) => new URL(p, self.location).href);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' — оминаємо HTTP-кеш, щоб зберегти саме нову версію
    await cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })));
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'CACHED', version: VERSION }));
    // Перше встановлення активуємо одразу; оновлення чекає підтвердження користувача
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'STATUS') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    (async () => {
      const cache = await caches.open(VERSION);
      let cached = 0;
      for (const u of urls) if (await cache.match(u)) cached++;
      port.postMessage({ version: VERSION, total: urls.length, cached, ready: cached === urls.length });
    })().catch(() => port.postMessage({ version: VERSION, total: urls.length, cached: 0, ready: false }));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // зовнішні посилання (джерела) — лише з мережі

  // Навігація: оболонка застосунку з кешу; маршрути на хеші, тож завжди index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const shell = (await cache.match(new URL('./index.html', self.location).href)) || (await cache.match(new URL('./', self.location).href));
      if (shell) return shell;
      try { return await fetch(req); } catch { return new Response('<h1>Немає з’єднання</h1><p>Відкрийте застосунок, коли з’явиться інтернет, щоб зберегти його для офлайн-роботи.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }

  // Файли застосунку: спершу кеш, потім мережа
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && urls.includes(url.origin + url.pathname)) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
