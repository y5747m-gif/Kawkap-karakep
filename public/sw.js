/* كوكب كراكيب — Service Worker
   - تثبيت متسامح: فشل ملف واحد لا يمنع التثبيت.
   - الصفحات: شبكة أولًا مع بديل من الكاش عند انقطاع الاتصال.
   - أصول /assets/ المُجزَّأة: كاش أولًا مع تحديث خلفي (أسماء الملفات تتغير مع كل بناء).
   - الصور والخطوط الخارجية (Unsplash / Google Fonts): شبكة أولًا ثم كاث عند النجاح.
   - لا يعترض غير GET ولا البروتوكولات غير http(s). */
const VERSION = 'kawkap-v3';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/theme-init.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

const isCacheableOrigin = (url) =>
  url.origin === self.location.origin ||
  url.origin === 'https://fonts.googleapis.com' ||
  url.origin === 'https://fonts.gstatic.com' ||
  url.origin === 'https://images.unsplash.com';

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (!/^https?:$/.test(url.protocol)) return;

  /* أصول البناء المُجزَّأة: كاش أولًا ثم تحديث خلفي */
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(request);
        if (cached) {
          event.waitUntil(cache.add(request).catch(() => {}));
          return cached;
        }
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (!isCacheableOrigin(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      /* التنقل بين الصفحات: شبكة أولًا، وبديل هو التطبيق المخزَّن */
      if (request.mode === 'navigate') {
        try {
          return await fetch(request);
        } catch {
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            Response.error()
          );
        }
      }
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        return cached || Response.error();
      }
    })(),
  );
});
