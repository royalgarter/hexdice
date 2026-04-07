const CACHE_NAME = 'hexdice-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/rules.html',
  // Core JS files
  '/game.js',
  '/markdown-renderer.js',
  // Rules markdown files
  '/rules.md',
  '/rules/v1.0.md',
  '/rules/v1.0.1.md',
  '/rules/v1.1.md',
  '/rules/v1.2.md',
  '/rules/v1.3.md',
  '/rules/v1.4.md',
  // AI files
  '/ai/ai.js',
  '/ai/ai-heuristic.js',
  '/ai/ai-minimax.js',
  '/ai/ai-priority.js',
  '/ai/ai-random.js',
  '/ai/heuristic-profiles.js',
  // Root assets
  '/board.png',
  '/hex.png',
  // Sprite images for dice
  '/assets/sprites/d1blue.gif', '/assets/sprites/d1red.gif',
  '/assets/sprites/d2blue.gif', '/assets/sprites/d2red.gif',
  '/assets/sprites/d3blue.gif', '/assets/sprites/d3red.gif',
  '/assets/sprites/d4blue.gif', '/assets/sprites/d4red.gif',
  '/assets/sprites/d5blue.gif', '/assets/sprites/d5red.gif',
  '/assets/sprites/d6blue.gif', '/assets/sprites/d6red.gif',
  // Icons
  '/assets/images/android-chrome-192x192.png',
  '/assets/images/android-chrome-512x512.png',
  '/assets/images/apple-touch-icon.png',
  '/assets/images/favicon-16x16.png',
  '/assets/images/favicon-32x32.png',
  '/assets/images/favicon.ico',
  '/assets/images/favicon.png',
  '/assets/images/site.webmanifest',
  // iOS icons
  '/assets/icons/ios/192.png',
  '/assets/icons/ios/512.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit, return response
        if (response) {
          return response;
        }
        // Not in cache, fetch from network
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache it
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // If both cache and network fail, return offline fallback
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
          return new Response('Offline - resource not cached', {
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});