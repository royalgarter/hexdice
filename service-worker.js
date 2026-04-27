const CACHE_NAME = 'hexdice-cache-v3';
const CORE_ASSETS = [
	'/',
	'/index.html',
	'/rules.html',
	'/game.js',
	'/assets/assets-manifest.json'
];

self.addEventListener('install', (event) => {
	console.log('Service Worker installing...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(async (cache) => {
				console.log('Opened cache');
				// First cache core assets
				await cache.addAll(CORE_ASSETS);
				
				// Then try to fetch and cache all other assets from manifest
				try {
					const response = await fetch('/assets/assets-manifest.json');
					const urlsToCache = await response.json();
					console.log(`Caching ${urlsToCache.length} assets from manifest`);
					return cache.addAll(urlsToCache);
				} catch (error) {
					console.error('Failed to load assets manifest:', error);
				}
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

function fetchEvent(event) {
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
}

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
					fetchEvent(event);
					return response;
				}
				// Not in cache, fetch from network

				return fetchEvent(event);
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
