// LockSeek-ai service worker — caches the app shell so the app still opens
// (and shows previously-loaded chats, since those live in localStorage)
// when there's no network connection. It intentionally does NOT cache
// /api/* calls — chat, login, and image requests always need to hit the
// real network, since that's where the actual AI answers come from.
const CACHE_NAME = 'lockseek-ai-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls (auth, chat, image generation) — those must
  // always go to the network for a real, current answer.
  if (url.pathname.includes('/api/')) return;
  // Only handle same-origin GET requests; let everything else pass through.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      // Serve from cache immediately if we have it, but still refresh the
      // cache in the background so the shell stays reasonably current.
      return cached || networkFetch;
    })
  );
});
