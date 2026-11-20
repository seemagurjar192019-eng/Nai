const CACHE_NAME = 'ucred-nextjs-v8';
const SHELL_ASSETS = [
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
];

const IS_DEV_HOST =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.startsWith('ais-dev-');

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

  // Never serve cached HTML or Next.js chunks in local/dev preview environments
  // so SSR HTML and client JS bundles never go out of sync across edits.
  if (IS_DEV_HOST && (req.mode === 'navigate' || url.pathname.startsWith('/_next/'))) {
    return;
  }

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
                  '<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;background:#F6F7FB;color:#0F172A;"><h2>Ucred is Offline</h2><p>Please check your internet connection and reload.</p></body></html>',
                  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                )
            );
          })
        )
    );
    return;
  }

  // Network-first for Next.js static bundles (offline fallback only)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webp') ||
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
