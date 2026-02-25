const CACHE_NAME = 'footfield-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('auth') ||
    url.pathname.includes('rest') ||
    url.pathname.includes('realtime')
  ) {
    return;
  }

  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2|ttf|ico)$/) ||
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/icons/');

  if (isStaticAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || fetch(event.request)))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then(cached => cached || fetch('/index.html'))
      )
    );
    return;
  }
});
