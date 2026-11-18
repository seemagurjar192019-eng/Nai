const CACHE_NAME = 'bolbahi-nextjs-v4';
const SHELL_ASSETS = [
  '/',
  '/privacy',
  '/terms',
  '/delete-account',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept Firebase, Firestore, Google Auth, Identity Toolkit, or API calls
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('google.com') ||
    (url.hostname.includes('gstatic.com') && !url.pathname.includes('fonts'))
  ) {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match('/').then(
              (home) =>
                home ||
                new Response(
                  '<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;"><h2>BolBahi is Offline</h2><p>Please check your internet connection and reload.</p></body></html>',
                  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                )
            );
          })
        )
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
  }
});
