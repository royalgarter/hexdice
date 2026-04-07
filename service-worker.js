const CACHE_NAME = 'hexdice-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/rules.html',
  // Add core JS files
  '/game.js',
  '/markdown-renderer.js',
  // Add rules
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
  // Add assets
  '/assets/board.png',
  '/assets/hex.png',
  // Add all sprite images for dice
  '/assets/sprites/d1blue.gif', '/assets/sprites/d1red.gif',
  '/assets/sprites/d2blue.gif', '/assets/sprites/d2red.gif',
  '/assets/sprites/d3blue.gif', '/assets/sprites/d3red.gif',
  '/assets/sprites/d4blue.gif', '/assets/sprites/d4red.gif',
  '/assets/sprites/d5blue.gif', '/assets/sprites/d5red.gif',
  '/assets/sprites/d6blue.gif', '/assets/sprites/d6red.gif',
  // Add icons
  '/assets/icons/icons.json',
  '/assets/icons/android-chrome-192x192.png',
  '/assets/icons/android-chrome-512x512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon-16x16.png',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon.ico',
  '/assets/icons/favicon.png',
  // Add representative icons for manifest
  '/assets/icons/ios/192.png',
  '/assets/icons/ios/512.png',
  '/assets/images/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
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
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Request was made. clone() the response to save in cache
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]; // Add other cache names if you have multiple versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If this cache name isn't in the list of expected caches, then delete it.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});